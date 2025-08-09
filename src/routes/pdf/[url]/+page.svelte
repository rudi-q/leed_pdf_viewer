<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
  import { listen } from '@tauri-apps/api/event';
  import { message } from '@tauri-apps/plugin-dialog';
  import { readFile } from '@tauri-apps/plugin-fs';
  import { invoke } from '@tauri-apps/api/core';
  import PDFViewer from '$lib/components/PDFViewer.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
  import PageThumbnails from '$lib/components/PageThumbnails.svelte';
  import { createBlankPDF, isValidPDFFile } from '$lib/utils/pdfUtils';
  import { redo, setCurrentPDF, setTool, undo } from '$lib/stores/drawingStore';
  import { PDFExporter } from '$lib/utils/pdfExport';

  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_EVENT_PLUGIN_INTERNALS__;

  let pdfViewer: PDFViewer;
  let currentFile: File | string | null = null;
  let dragOver = false;
  let showShortcuts = false;
  let isFullscreen = false;
  let showThumbnails = false;
  let focusMode = false;
  let isLoading = true;

  // Debug variables
  let debugVisible = false;
  let debugResults = 'Click button to test...';

  // File loading variables
  let hasLoadedFromCommandLine = false;
  let fileLoadingAttempts = 0;
  let maxFileLoadingAttempts = 10;
  let fileLoadingTimer: number | null = null;

  // Extract and decode URL parameter
  $: if (browser && $page && $page.params.url) {
    const encodedUrl = $page.params.url;
    try {
      const decodedUrl = decodeURIComponent(encodedUrl);
      console.log('[PDF Route] Loading PDF from URL:', decodedUrl);
      
      if (decodedUrl && !currentFile) {
        handlePdfUrlLoad(decodedUrl);
      }
    } catch (error) {
      console.error('Error decoding URL parameter:', error);
      // Redirect to home if URL is invalid
      goto('/');
    }
  }

  // Redirect to home if no URL parameter
  $: if (browser && $page && !$page.params.url) {
    console.log('No URL parameter found, redirecting to home');
    goto('/');
  }

  onMount(() => {
    // Setup all the event listeners and handlers for Tauri functionality
    setupEventListeners();
    
    return cleanup;
  });

  function setupEventListeners() {
    console.log('[PDF Route] Setting up event listeners');
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Strategy 1: Immediate checks for Tauri file associations
    if (isTauri) {
      console.log('Starting immediate file checks...');
      checkForPendingFiles();
      checkFileAssociations();
    }

    // Strategy 2: Event listeners for Tauri
    if (isTauri) {
      console.log('Setting up Tauri event listeners...');

      const unlistenFileOpened = listen('file-opened', (event) => {
        console.log('*** FILE-OPENED EVENT RECEIVED ***');
        console.log('Event payload:', event.payload);
        handleFileFromCommandLine(event.payload as string);
      });

      const unlistenStartupReady = listen('startup-file-ready', (event) => {
        console.log('*** STARTUP-FILE-READY EVENT RECEIVED ***');
        console.log('Event payload:', event.payload);
        handleFileFromCommandLine(event.payload as string);
      });

      const unlistenDebug = listen('debug-info', (event) => {
        console.log('TAURI DEBUG:', event.payload);
      });

      registerDeepLinkHandler();

      // Store cleanup functions for later
      window.__pdfRouteCleanup = {
        unlistenFileOpened,
        unlistenStartupReady,
        unlistenDebug
      };
    }

    console.log('✅ All file loading strategies initialized');
  }

  function cleanup() {
    console.log('[PDF Route] Cleaning up');
    document.removeEventListener('fullscreenchange', handleFullscreenChange);

    if (fileLoadingTimer) {
      clearInterval(fileLoadingTimer);
    }

    // Clean up Tauri event listeners
    if (window.__pdfRouteCleanup) {
      const { unlistenFileOpened, unlistenStartupReady, unlistenDebug } = window.__pdfRouteCleanup;
      unlistenFileOpened.then((fn: () => void) => fn()).catch(console.error);
      unlistenStartupReady.then((fn: () => void) => fn()).catch(console.error);
      unlistenDebug.then((fn: () => void) => fn()).catch(console.error);
      delete window.__pdfRouteCleanup;
    }
  }

  function handleFileUpload(files: FileList) {
    console.log('handleFileUpload called with:', files);
    const file = files[0];
    console.log('Selected file:', file?.name, 'Type:', file?.type, 'Size:', file?.size);

    if (!isValidPDFFile(file)) {
      console.log('Invalid PDF file');
      alert('Please choose a valid PDF file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      console.log('File too large');
      alert('File too large. Please choose a file under 50MB.');
      return;
    }

    console.log('Storing file and navigating to pdf-upload route');
    // Store file in sessionStorage temporarily and navigate to upload route
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const fileData = {
        name: file.name,
        size: file.size,
        type: file.type,
        data: Array.from(new Uint8Array(arrayBuffer))
      };
      sessionStorage.setItem('tempPdfFile', JSON.stringify(fileData));
      console.log('File stored in sessionStorage, navigating...');
      goto('/pdf-upload');
    };
    fileReader.readAsArrayBuffer(file);
  }

  function isValidPdfUrl(url: string): boolean {
    try {
      const validUrl = new URL(url);
      return validUrl.protocol === 'https:' || validUrl.protocol === 'http:';
    } catch {
      return false;
    }
  }

  async function registerDeepLinkHandler() {
    try {
      await onOpenUrl((urls) => {
        console.log('Deep link received:', urls);

        // Handle the deep link URLs
        for (const url of urls) {
          console.log('Processing deep link URL:', url);

          if (url.startsWith('leedpdf://')) {
            const filePath = url.replace('leedpdf://', '');
            console.log('Extracted file path:', filePath);

            // If it's a local file path, try to handle it
            if (filePath) {
              handleDeepLinkFile(filePath);
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to register deep link handler:', error);
    }
  }

  async function handleDeepLinkFile(filePath: string) {
    console.log('Handling deep link file:', filePath);
    await message(`Deep link received for file: ${filePath}`, 'LeedPDF - Deep Link');
  }

  async function handleFileFromCommandLine(filePath: string): Promise<boolean> {
    console.log('*** HANDLING FILE FROM COMMAND LINE ***');
    console.log('File path:', filePath);

    // Mark that we've attempted to load from command line
    hasLoadedFromCommandLine = true;

    try {
      // Step 1: Validate path
      if (!filePath || typeof filePath !== 'string') {
        debugResults += '\n❌ FAILED: Invalid file path received';
        throw new Error('Invalid file path received');
      }
      debugResults += '\n✅ Step 1: Path validation passed';

      // Step 2: Sanitize path
      let cleanPath = filePath.trim();
      if (cleanPath.startsWith('"') && cleanPath.endsWith('"')) {
        cleanPath = cleanPath.slice(1, -1);
      }
      debugResults += `\n✅ Step 2: Cleaned path: ${cleanPath}`;

      // Step 3: Extract filename
      const fileName = cleanPath.split(/[\\\/]/).pop() || 'document.pdf';
      debugResults += `\n✅ Step 3: Extracted filename: ${fileName}`;

      // Step 4: Check if it's a PDF
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        debugResults += '\n❌ FAILED: Not a PDF file';
        return false;
      }
      debugResults += '\n✅ Step 4: PDF file check passed';

      // Step 5: Try to read the file
      debugResults += '\n🔄 Step 5: Reading file...';
      let fileData: Uint8Array;
      try {
        fileData = await readFile(cleanPath);
        debugResults += `\n✅ Step 5: File read successfully! Size: ${fileData.length} bytes`;
      } catch (readError: unknown) {
        const errorMsg = readError instanceof Error ? readError.message : String(readError);
        debugResults += `\n❌ FAILED at Step 5: File read error: ${errorMsg}`;

        // Try alternative path formats
        debugResults += '\n🔄 Trying alternative path formats...';
        const altPaths = [
          cleanPath.replace(/\\/g, '/'),
          cleanPath.replace(/\//g, '\\'),
          `"${cleanPath}"` // Try with quotes
        ];

        let success = false;
        for (const altPath of altPaths) {
          try {
            debugResults += `\n🔄 Trying: ${altPath}`;
            fileData = await readFile(altPath);
            debugResults += `\n✅ Success with alternative path!`;
            cleanPath = altPath;
            success = true;
            break;
          } catch (altError: unknown) {
            const altErrorMsg = altError instanceof Error ? altError.message : String(altError);
            debugResults += `\n❌ Failed: ${altErrorMsg}`;
          }
        }

        if (!success) {
          debugResults += '\n❌ FINAL FAILURE: All path formats failed';
          return false;
        }
      }

      // Step 6: Validate PDF header
      debugResults += '\n🔄 Step 6: Validating PDF header...';
      const pdfHeader = new Uint8Array(fileData!.slice(0, 4));
      const pdfSignature = String.fromCharCode(...pdfHeader);
      if (pdfSignature !== '%PDF') {
        debugResults += `\n❌ FAILED: Invalid PDF signature: ${pdfSignature}`;
        return false;
      }
      debugResults += '\n✅ Step 6: PDF signature valid';

      // Step 7: Create File object
      debugResults += '\n🔄 Step 7: Creating File object...';
      const file = new File([new Uint8Array(fileData!)], fileName, { type: 'application/pdf' });
      debugResults += `\n✅ Step 7: File object created - ${file.name}, ${file.size} bytes`;

      // Step 8: Size check
      if (file.size > 50 * 1024 * 1024) {
        debugResults += '\n❌ FAILED: File too large';
        return false;
      }
      debugResults += '\n✅ Step 8: Size check passed';

      // Step 9: Set state
      debugResults += '\n🔄 Step 9: Setting application state...';
      currentFile = file;
      isLoading = false;
      debugResults += '\n✅ Step 9: State updated';

      // Step 10: Set PDF for auto-save
      debugResults += '\n🔄 Step 10: Setting up auto-save...';
      setCurrentPDF(file.name, file.size);
      debugResults += '\n✅ Step 10: Auto-save configured';

      // Step 11: Mark as processed
      try {
        await invoke('mark_file_processed');
        debugResults += '\n✅ Step 11: Marked as processed in Rust';
      } catch (e) {
        debugResults += '\n⚠️ Step 11: Could not mark as processed (not critical)';
      }

      debugResults += '\n🎉 SUCCESS: PDF should now be loading!';
      return true;

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      debugResults += `\n💥 UNEXPECTED ERROR: ${errorMsg}`;
      return false;
    }
  }

  // Multiple strategies for checking files
  async function checkForPendingFiles() {
    try {
      console.log('Checking for pending files (strategy 1: command)...');
      const pendingFile = await invoke('get_pending_file') as string | null;

      if (pendingFile) {
        console.log('Found pending file via command:', pendingFile);
        const success = await handleFileFromCommandLine(pendingFile);

        if (success) {
          // Check for more files
          setTimeout(checkForPendingFiles, 100);
        }
      } else {
        console.log('No pending files found via command');
      }
    } catch (error) {
      console.error('Error checking for pending files:', error);
    }
  }

  async function checkFileAssociations() {
    try {
      console.log('Checking file associations (strategy 2: direct check)...');
      const pdfFiles = await invoke('check_file_associations') as string[];

      if (pdfFiles && pdfFiles.length > 0) {
        console.log('Found PDF files via direct check:', pdfFiles);
        for (const pdfFile of pdfFiles) {
          const success = await handleFileFromCommandLine(pdfFile);
          if (success) {
            break; // Only load the first one
          }
        }
      } else {
        console.log('No PDF files found via direct check');
      }
    } catch (error) {
      console.error('Error checking file associations:', error);
    }
  }

  function fixDropboxUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      if (!urlObj.hostname.includes('dropbox.com')) {
        return url;
      }

      // Remove problematic st parameter and ensure dl=1
      urlObj.searchParams.delete('st');
      urlObj.searchParams.set('dl', '1');

      // For /scl/fi/ format, try to convert to dropboxusercontent.com
      if (urlObj.pathname.includes('/scl/fi/')) {
        const pathMatch = urlObj.pathname.match(/\/scl\/fi\/([^\/]+)\/(.+)/);
        if (pathMatch) {
          const fileId = pathMatch[1];
          const fileName = pathMatch[2];
          const rlkey = urlObj.searchParams.get('rlkey');

          if (rlkey) {
            console.log('Converting to dropboxusercontent.com domain');
            return `https://dl.dropboxusercontent.com/scl/fi/${fileId}/${fileName}?rlkey=${rlkey}&dl=1`;
          }
        }
      }

      return urlObj.toString();
    } catch (error) {
      console.warn('Error fixing Dropbox URL:', error);
      return url;
    }
  }

  async function handlePdfUrlLoad(url: string) {
    console.log('[handlePdfUrlLoad] Starting with URL:', url);

    if (!isValidPdfUrl(url)) {
      console.log('Invalid PDF URL');
      alert('Invalid PDF URL. Please provide a valid web address.');
      goto('/');
      return;
    }

    // Fix Dropbox URLs
    const fixedUrl = fixDropboxUrl(url);
    console.log('Fixed URL:', fixedUrl);

    console.log('Setting currentFile');
    currentFile = fixedUrl;
    isLoading = false;

    // Set current PDF for auto-save functionality
    const filename = extractFilenameFromUrl(fixedUrl);
    setCurrentPDF(filename, 0);
    console.log('PDF URL setup completed');
  }

  function extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // For Dropbox URLs, extract from path
      if (urlObj.hostname.includes('dropbox.com')) {
        const pathMatch = urlObj.pathname.match(/\/scl\/fi\/[^\/]+\/(.+)/);
        if (pathMatch) {
          return pathMatch[1];
        }
      }

      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'document.pdf';

      // Ensure .pdf extension
      return filename.toLowerCase().endsWith('.pdf') ? filename : filename + '.pdf';
    } catch {
      return 'document.pdf';
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;

    if (event.dataTransfer?.files) {
      handleFileUpload(event.dataTransfer.files);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    // Only set dragOver to false if we're actually leaving the main container
    // Check if the related target is outside the main element
    const mainElement = event.currentTarget as Element;
    const relatedTarget = event.relatedTarget as Element;
    
    // If relatedTarget is null (leaving the window) or not a child of main, we're truly leaving
    if (!relatedTarget || !mainElement.contains(relatedTarget)) {
      dragOver = false;
    }
  }

  function handleKeyboard(event: KeyboardEvent) {
    const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (isTyping && event.key !== 'Escape') {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'z':
          if (event.shiftKey) {
            event.preventDefault();
            redo();
          } else {
            event.preventDefault();
            undo();
          }
          break;
        case 'y':
          event.preventDefault();
          redo();
          break;
        case '=':
        case '+':
          event.preventDefault();
          pdfViewer?.zoomIn();
          break;
        case '-':
          event.preventDefault();
          pdfViewer?.zoomOut();
          break;
        case '0':
          event.preventDefault();
          pdfViewer?.resetZoom();
          break;
      }
    } else {
      switch (event.key) {
        case 'ArrowLeft':
          pdfViewer?.previousPage();
          break;
        case 'ArrowRight':
          pdfViewer?.nextPage();
          break;
        case '1':
          event.preventDefault();
          setTool('pencil');
          break;
        case '2':
          event.preventDefault();
          setTool('eraser');
          break;
        case '3':
          event.preventDefault();
          setTool('text');
          break;
        case '4':
          event.preventDefault();
          setTool('rectangle');
          break;
        case '5':
          event.preventDefault();
          setTool('circle');
          break;
        case '6':
          event.preventDefault();
          setTool('arrow');
          break;
        case '7':
          event.preventDefault();
          setTool('star');
          break;
        case '8':
          event.preventDefault();
          setTool('highlight');
          break;
        case '9':
          event.preventDefault();
          setTool('note');
          break;
        case 'h':
        case 'H':
          event.preventDefault();
          pdfViewer?.fitToHeight();
          break;
        case 'w':
        case 'W':
          event.preventDefault();
          pdfViewer?.fitToWidth();
          break;
        case '?':
          event.preventDefault();
          showShortcuts = true;
          break;
        case 'F1':
          event.preventDefault();
          showShortcuts = true;
          break;
        case 't':
        case 'T':
          event.preventDefault();
          showThumbnails = !showThumbnails;
          break;
        case 'u':
        case 'U':
          event.preventDefault();
          (document.querySelector('input[type="file"]') as HTMLInputElement)?.click();
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          focusMode = !focusMode;
          break;
        case 's':
        case 'S':
          event.preventDefault();
          setTool('stamp');
          // Also open the stamp palette
          // Dispatch event to the toolbar to show stamp palette
          const stampButton = document.querySelector('.stamp-palette-container button');
          if (stampButton) {
            (stampButton as HTMLButtonElement).click();
          }
          break;
        case 'F11':
          event.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            exitFullscreen();
          } else if (showShortcuts) {
            showShortcuts = false;
          }
          break;
      }
    }
  }

  function handleWheel(event: WheelEvent) {
    if (event.ctrlKey) {
      event.preventDefault();
      const zoomIn = event.deltaY < 0;
      if (zoomIn) {
        pdfViewer?.zoomIn();
      } else {
        pdfViewer?.zoomOut();
      }
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }

  function enterFullscreen() {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
      isFullscreen = true;
    }
  }

  function exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
      isFullscreen = false;
    }
  }

  async function handleExportPDF() {
    if (!currentFile || !pdfViewer) {
      alert('No PDF to export');
      return;
    }

    try {
      let pdfBytes: Uint8Array;
      let originalName: string;

      if (typeof currentFile === 'string') {
        console.log('Fetching PDF data from URL for export:', currentFile);
        const response = await fetch(currentFile);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
        originalName = extractFilenameFromUrl(currentFile).replace(/\.pdf$/i, '');
      } else {
        const arrayBuffer = await currentFile.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
        originalName = currentFile.name.replace(/\.pdf$/i, '');
      }

      const exporter = new PDFExporter();
      exporter.setOriginalPDF(pdfBytes);

      const mergedCanvas = await pdfViewer.getMergedCanvas();
      if (mergedCanvas) {
        exporter.setPageCanvas(1, mergedCanvas);
      }

      const annotatedPdfBytes = await exporter.exportToPDF();
      const filename = `${originalName}_annotated.pdf`;

      PDFExporter.downloadFile(annotatedPdfBytes, filename, 'application/pdf');
      console.log('PDF exported successfully:', filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  }

  function handleToggleThumbnails(show: boolean) {
    showThumbnails = show;
  }

  function handlePageSelect(pageNumber: number) {
    pdfViewer?.goToPage(pageNumber);
  }

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
  }

  function goHome() {
    goto('/');
  }
</script>

<svelte:window on:keydown={handleKeyboard} on:wheel={handleWheel} />

<main
  class="w-screen h-screen relative overflow-hidden"
  class:drag-over={dragOver}
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
>
  {#if isLoading}
    <div class="h-full flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sage mx-auto mb-4"></div>
        <p class="text-lg text-charcoal dark:text-gray-300">Loading PDF...</p>
      </div>
    </div>
  {:else if currentFile}
    {#if !focusMode}
      <Toolbar
        onFileUpload={handleFileUpload}
        onPreviousPage={() => pdfViewer?.previousPage()}
        onNextPage={() => pdfViewer?.nextPage()}
        onZoomIn={() => pdfViewer?.zoomIn()}
        onZoomOut={() => pdfViewer?.zoomOut()}
        onResetZoom={() => pdfViewer?.resetZoom()}
        onFitToWidth={() => pdfViewer?.fitToWidth()}
        onFitToHeight={() => pdfViewer?.fitToHeight()}
        onExportPDF={handleExportPDF}
        {showThumbnails}
        onToggleThumbnails={handleToggleThumbnails}
      />
    {/if}

    <div class="w-full h-full" class:pt-12={!focusMode}>
      <div class="flex h-full">
        {#if showThumbnails}
          <PageThumbnails
            isVisible={showThumbnails}
            onPageSelect={handlePageSelect}
          />
        {/if}

        <div class="flex-1">
          <PDFViewer bind:this={pdfViewer} pdfFile={currentFile} />
        </div>
      </div>
    </div>

    {#if dragOver}
      <div class="absolute inset-0 bg-sage/20 backdrop-blur-sm flex items-center justify-center z-40">
        <div class="text-center">
          <div class="text-6xl mb-4">📄</div>
          <h3 class="text-2xl font-bold text-charcoal mb-2">Drop your new PDF here</h3>
          <p class="text-slate">Release to replace current PDF</p>
        </div>
      </div>
    {/if}

    {#if !focusMode}
      <div class="absolute bottom-4 right-4 text-xs text-charcoal/60 dark:text-gray-300 flex items-center gap-2">
        <span>Made by Rudi K</span>
        <a aria-label="Credit" href="https://github.com/rudi-q/leed_pdf_viewer" class="text-charcoal/60 dark:text-gray-300 hover:text-sage dark:hover:text-sage transition-colors" target="_blank" rel="noopener" title="View on GitHub">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.30 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </div>

      <button
        class="absolute bottom-4 left-4 text-xs text-charcoal/60 dark:text-gray-300 hover:text-charcoal dark:hover:text-white transition-colors flex items-center gap-1 bg-white/50 hover:bg-white/80 px-2 py-1 rounded-lg backdrop-blur-sm"
        on:click={() => showShortcuts = true}
        title="Show keyboard shortcuts (? or F1)"
      >
        <span>?</span>
        <span>Help</span>
      </button>

      <button
        class="absolute top-16 left-4 text-sm text-charcoal/60 dark:text-gray-300 hover:text-charcoal dark:hover:text-white transition-colors flex items-center gap-2 bg-white/50 hover:bg-white/80 px-3 py-2 rounded-lg backdrop-blur-sm"
        on:click={goHome}
        title="Go back to home"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>
        </svg>
        <span>Home</span>
      </button>
    {/if}
  {/if}
</main>

<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => showShortcuts = false} />

<!-- Hidden file input -->
<input
  type="file"
  accept=".pdf,application/pdf"
  multiple={false}
  class="hidden"
  on:change={(event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFileUpload(input.files);
    }
  }}
/>

<style>
  main {
    background: linear-gradient(135deg, #FDF6E3 0%, #F7F3E9 50%, #F0EFEB 100%);
  }
  
  :global(.dark) main {
    background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%);
  }

  .drag-over {
    background: linear-gradient(135deg, #FDF6E3 0%, #E8F5E8 50%, #F0EFEB 100%);
  }
  
  :global(.dark) .drag-over {
    background: linear-gradient(135deg, #111827 0%, #065f46 50%, #374151 100%);
  }

  :global(body) {
    font-family: 'Inter', system-ui, sans-serif;
  }
</style>
