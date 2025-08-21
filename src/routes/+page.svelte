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
  import { redo, setCurrentPDF, setTool, undo, pdfState } from '$lib/stores/drawingStore';
  import { PDFExporter } from '$lib/utils/pdfExport';
  import { isDarkMode } from '$lib/stores/themeStore';
  import { handleSearchLinkClick } from '$lib/utils/navigationUtils';
  import TemplatePicker from '$lib/components/TemplatePicker.svelte';
  import { toastStore } from '$lib/stores/toastStore';
  import { storeUploadedFile } from '$lib/utils/fileStorageUtils';
  import { detectOS, isTauri } from '$lib/utils/tauriUtils';

  let pdfViewer: PDFViewer;
  let currentFile: File | string | null = null;
  let dragOver = false;
  let showWelcome = true;
  let showShortcuts = false;
  let isFullscreen = false;
  let showThumbnails = false;
  let showUrlInput = false;
  let urlInput = '';
  let urlError = '';
  let focusMode = false;
  let showTemplatePicker = false;
  let showDownloadCard = true;

  // Debug variables
  let debugVisible = false;
  let debugResults = 'Click button to test...';

  // File loading variables
  let hasLoadedFromCommandLine = false;
  let fileLoadingAttempts = 0;
  let maxFileLoadingAttempts = 10;
  let fileLoadingTimer: number | null = null;

  // Debug function to test app state
  async function testAppState() {
    try {
      debugResults = 'Testing app state...';
      const result = await invoke('check_app_state');
      debugResults = `App State:\n${result}`;
      console.log('App state result:', result);
    } catch (error) {
      debugResults = `Error: ${error}`;
      console.error('Error testing app state:', error);
    }
  }

  // Debug function to test file event
  async function testFileEvent() {
    try {
      debugResults = 'Testing file event...';
      await invoke('test_file_event', { filePath: '/tmp/test.pdf' });
      debugResults = 'File event test completed - check terminal for output';
    } catch (error) {
      debugResults = `Error: ${error}`;
      console.error('Error testing file event:', error);
    }
  }

  // Redirect from /?pdf=URL to /pdf/URL for better URL structure
  $: if (browser && $page && $page.url) {
    const pdfUrl = $page.url.searchParams.get('pdf');
    if (pdfUrl) {
      console.log('[PDF URL] Redirecting to new URL structure:', pdfUrl);
      const encodedUrl = encodeURIComponent(pdfUrl);
      goto(`/pdf/${encodedUrl}`);
    }
  }

  async function handleFileUpload(files: FileList) {
    console.log('handleFileUpload called with:', files);
    
    // Early guard: Check if FileList is empty or no file selected
    if (files.length === 0) {
      console.log('No files in FileList');
      toastStore.error('No File Selected', 'No file selected — please choose a PDF to upload.');
      return;
    }
    
    const file = files[0];
    console.log('Selected file:', file?.name, 'Type:', file?.type, 'Size:', file?.size);
    
    // Additional guard: Check if file is undefined/null
    if (!file) {
      console.log('File is undefined or null');
      toastStore.error('No File Selected', 'No file selected — please choose a PDF to upload.');
      return;
    }

    if (!isValidPDFFile(file)) {
      console.log('Invalid PDF file');
      toastStore.error('Invalid File', 'Please choose a valid PDF file.');
      return;
    }

    console.log('Storing file and navigating to pdf-upload route');
    
    // Use new IndexedDB storage system
    const result = await storeUploadedFile(file);
    
    if (result.success && result.id) {
      // Navigate with the file ID
      goto(`/pdf-upload?fileId=${result.id}`);
    }
    // Error handling is done in the storage utility via toasts
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

    // For now, we'll just show an alert with the file path
    // In a real implementation, you might want to:
    // 1. Check if the file exists
    // 2. Validate it's a PDF
    // 3. Load it into your PDF viewer

    await message(`Deep link received for file: ${filePath}`, 'LeedPDF - Deep Link');

    // You could potentially navigate to a URL with the file path
    // or implement file reading logic here
  }

  // Replace your handleFileFromCommandLine function with this enhanced debug version

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
      const fileName = cleanPath.split(/[\\/]/).pop() || 'document.pdf';
      debugResults += `\n✅ Step 3: Extracted filename: ${fileName}`;

      // Step 4: Check if it's a PDF
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        debugResults += '\n❌ FAILED: Not a PDF file';
        return false;
      }
      debugResults += '\n✅ Step 4: PDF file check passed';

      // Step 5: Try to read the file (this is probably where it fails)
      debugResults += '\n🔄 Step 5: Reading file...';
      let fileData: Uint8Array;
      try {
        // Try using the Rust command first to avoid glob pattern issues
        const fileContent = await invoke('read_file_content', { filePath: cleanPath }) as number[];
        fileData = new Uint8Array(fileContent);
        debugResults += `\n✅ Step 5: File read successfully via Rust! Size: ${fileData.length} bytes`;
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

      // Step 9: Set state (this should hide welcome screen and show PDF)
      debugResults += '\n🔄 Step 9: Setting application state...';
      currentFile = file;
      showWelcome = false;
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
      return;
    }

    // Fix Dropbox URLs
    const fixedUrl = fixDropboxUrl(url);
    console.log('Fixed URL:', fixedUrl);

    console.log('Setting currentFile and hiding welcome');
    currentFile = fixedUrl;
    showWelcome = false;

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
          setTool('arrow');
          break;
        case '5':
          event.preventDefault();
          setTool('highlight');
          break;
        case '6':
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

      // Export all pages with annotations
      console.log('Exporting PDF with', $pdfState.totalPages, 'pages');
      
      for (let pageNum = 1; pageNum <= $pdfState.totalPages; pageNum++) {
        console.log(`Processing page ${pageNum} for export...`);
        
        // Check if this page has any annotations
        const hasAnnotations = await pdfViewer.pageHasAnnotations(pageNum);
        
        // Always try to create merged canvas for all pages to debug the issue
        console.log(`Page ${pageNum} has annotations: ${hasAnnotations}. Creating merged canvas anyway...`);
        const mergedCanvas = await pdfViewer.getMergedCanvasForPage(pageNum);
        if (mergedCanvas) {
          exporter.setPageCanvas(pageNum, mergedCanvas);
          console.log(`Added merged canvas for page ${pageNum}`);
        } else {
          console.log(`Failed to create merged canvas for page ${pageNum}`);
        }
      }

      const annotatedPdfBytes = await exporter.exportToPDF();
      const filename = `${originalName}_annotated.pdf`;

      const success = await PDFExporter.exportFile(annotatedPdfBytes, filename, 'application/pdf');
      if (success) {
        console.log('PDF exported successfully:', filename);
      } else {
        console.log('Export was cancelled by user');
      }
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

  function handleViewFromLink() {
    showUrlInput = true;
    urlError = '';
    urlInput = '';
  }

  function handleUrlSubmit() {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      urlError = 'Please enter a URL';
      return;
    }

    if (!isValidPdfUrl(trimmedUrl)) {
      urlError = 'Please enter a valid URL starting with http:// or https://';
      return;
    }

    // Navigate to the new PDF route structure
    goto(`/pdf/${encodeURIComponent(trimmedUrl)}`);
  }

  function handleUrlCancel() {
    showUrlInput = false;
    urlInput = '';
    urlError = '';
  }

  function handleUrlKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      try {
        event.preventDefault();
      } catch (e) {
        // Ignore passive event listener errors
      }
      handleUrlSubmit();
    } else if (event.key === 'Escape') {
      try {
        event.preventDefault();
      } catch (e) {
        // Ignore passive event listener errors
      }
      handleUrlCancel();
    }
  }

  async function handleCreateBlankPDF() {
    try {
      console.log('Creating blank PDF...');
      const blankPdfFile = await createBlankPDF();
      console.log('Blank PDF created:', blankPdfFile.name, blankPdfFile.size, 'bytes');
      
      console.log('Storing blank PDF and navigating to pdf-upload route');
      
      // Use new IndexedDB storage system
      const result = await storeUploadedFile(blankPdfFile);
      
      if (result.success && result.id) {
        // Navigate with the file ID
        goto(`/pdf-upload?fileId=${result.id}`);
      } else {
        toastStore.error('Storage Error', 'Failed to store blank PDF. Please try again.');
      }
    } catch (error) {
      console.error('Failed to create blank PDF:', error);
      toastStore.error('PDF Creation Error', 'Failed to create blank PDF. Please try again.');
    }
  }

  // Enhanced onMount with comprehensive file loading
  onMount(() => {
    console.log('[onMount] Component mounted - setting up comprehensive file loading');
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // Check if the download card was dismissed
    if (browser) {
      const dismissed = localStorage.getItem('leedpdf-download-card-dismissed');
      showDownloadCard = dismissed !== 'true';
    }

    // Strategy 1: Immediate checks
    console.log('Starting immediate file checks...');
    checkForPendingFiles();
    checkFileAssociations();

    // Strategy 2: Event listeners
    console.log('Setting up event listeners...');

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

    // Signal that frontend is ready to receive events
    if (isTauri) {
      console.log('Signaling frontend is ready...');
      invoke('frontend_ready').then(() => {
        console.log('Frontend ready signal sent');
      }).catch(console.error);
    }

    console.log('✅ All file loading strategies initialized');

    return () => {
      console.log('[onDestroy] Cleaning up file loading systems');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);

      if (fileLoadingTimer) {
        clearInterval(fileLoadingTimer);
      }

      // Clean up all event listeners
      unlistenFileOpened.then(fn => fn()).catch(console.error);
      unlistenStartupReady.then(fn => fn()).catch(console.error);
      unlistenDebug.then(fn => fn()).catch(console.error);
    };
  });
</script>

<svelte:window on:keydown|nonpassive={handleKeyboard} on:wheel|nonpassive|preventDefault={handleWheel} />

<main
  class="w-screen h-screen relative overflow-hidden"
  class:drag-over={dragOver}
  on:drop|nonpassive={handleDrop}
  on:dragover|nonpassive={handleDragOver}
  on:dragleave={handleDragLeave}
>
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
    {#if showWelcome}
      <div class="h-full flex flex-col">
      <!--  <div class="flex justify-center pt-8 pb-4">
          <a href="https://peerlist.io/rudik/project/leedpdf" target="_blank" rel="noreferrer">
            <img
              src={`https://peerlist.io/api/v1/projects/embed/PRJHBARD8EREAG6RM1B78ODJOGA68D?showUpvote=true&theme=${$isDarkMode ? 'dark' : 'light'}`}
              alt="LeedPDF"
              style="width: auto; height: 72px;"
              class="mx-auto"
            />
          </a>
        </div>-->
        
        <!-- Main content, centered in remaining space -->
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center max-w-md mx-auto px-6">
            <div class="mb-6 animate-bounce-soft">
            <img src="/logo.png" alt="LeedPDF" class="w-24 h-24 mx-auto dark:hidden object-contain" />
            <img src="/logo-dark.png" alt="LeedPDF" class="w-24 h-24 mx-auto hidden dark:block object-contain" />
          </div>

          <h1 class="text-4xl text-charcoal dark:text-gray-100 mb-4" style="font-family: 'Dancing Script', cursive; font-weight: 600;">LeedPDF - Free PDF Annotation Tool</h1>
          <h2 class="text-lg text-slate dark:text-gray-300 mb-6 font-normal">
            Add drawings and notes to any PDF. <br />
            <i>Works with mouse, touch, or stylus - completely free and private.</i>
          </h2>

          <div class="space-y-4 flex flex-col items-center">
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                class="primary-button text-lg px-6 py-4 w-56 h-16 flex items-center justify-center"
                on:click={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
              >
                Choose PDF File
              </button>

              <button
                class="secondary-button text-lg px-6 py-4 w-56 h-16 flex items-center justify-center"
                on:click={handleViewFromLink}
              >
                Open from URL
              </button>
            </div>

                        <!-- Debug Buttons -->
            {#if isTauri && import.meta.env.DEV}
              <div class="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
                <h3 class="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Debug Tools (Dev Mode)</h3>
                <div class="flex gap-2">
                  <button
                    on:click={testAppState}
                    class="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    Test App State
                  </button>
                  <button
                    on:click={testFileEvent}
                    class="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                  >
                    Test File Event
                  </button>
                </div>
                {#if debugResults !== 'Click button to test...'}
                  <div class="mt-2 p-2 bg-white dark:bg-gray-700 rounded text-xs overflow-auto max-h-20">
                    <pre class="whitespace-pre-wrap">{debugResults}</pre>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- DEBUG BUTTON -->
           <!-- <button
              class="secondary-button text-sm px-4 py-2 bg-yellow-200 border-yellow-400"
              on:click={async () => {
                debugVisible = true;
                debugResults = 'Testing...';

                try {
                  // Test 1: Check if invoke works
                  debugResults = 'Step 1: Testing invoke function...';

                  const pdfFiles = await invoke('check_file_associations') as string[];
                  debugResults = `Step 2: SUCCESS! Found files: ${JSON.stringify(pdfFiles)}`;

                  if (pdfFiles && pdfFiles.length > 0) {
                    // Test 2: Try to load the file
                    debugResults += '\nStep 3: Trying to load file...';
                    await handleFileFromCommandLine(pdfFiles[0]);
                    debugResults += '\nStep 4: File loading attempted!';
                  } else {
                    debugResults += '\nStep 3: No files found to load';
                  }

                } catch (error: unknown) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  debugResults = `ERROR: ${errorMessage}`;
                }
              }}
            >
              🔧 DEBUG: Test File Loading
            </button>-->

            <div class="text-sm text-slate">
              <span>or</span>
            </div>

            {#if !showUrlInput}
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                class="secondary-button text-lg px-6 py-4 w-56 h-16 flex items-center justify-center"
                on:click={handleCreateBlankPDF}
                title="Create a blank PDF page to start drawing and taking notes"
              >
                Start Fresh
              </button>

              <button
                class="secondary-button text-lg px-6 py-4 w-56 h-16 flex items-center justify-center text-center"
                on:click={() => showTemplatePicker = true}
              >
                Browse Templates
              </button>

              <button
                class="secondary-button text-lg px-6 py-4 w-56 h-16 flex items-center justify-center text-center"
                on:click={handleSearchLinkClick}
                aria-label="Search PDFs"
              >
                Search PDFs
              </button>
            </div>
            {:else}
              <div class="space-y-3 animate-slide-up">
                <div class="flex gap-2">
                  <input
                    type="url"
                    bind:value={urlInput}
                    on:keydown|nonpassive={handleUrlKeydown}
                    placeholder="Paste PDF URL (Dropbox links supported)"
                    class="flex-1 px-4 py-3 rounded-xl border border-charcoal/20 bg-white/80 text-charcoal placeholder-slate focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage transition-all"
                  />
                </div>
                <div class="flex gap-2 justify-center">
                  <button
                    class="primary-button px-6 py-2"
                    on:click={handleUrlSubmit}
                  >
                    Load PDF
                  </button>
                  <button
                    class="secondary-button px-6 py-2"
                    on:click={handleUrlCancel}
                  >
                    Cancel
                  </button>
                </div>
                {#if urlError}
                  <p class="text-sm text-red-600 text-center animate-fade-in">
                    {urlError}
                  </p>
                {/if}
              </div>
            {/if}

            <p class="text-lg text-slate dark:text-gray-300 font-medium">
              or drop a file anywhere
            </p>

            <!-- Debug results display -->
            {#if debugVisible}
              <div class="mt-4 p-4 bg-gray-100 rounded-lg text-sm max-w-md mx-auto">
                <h4 class="font-bold mb-2">Debug Results:</h4>
                <pre class="whitespace-pre-wrap text-xs">{debugResults}</pre>
                <button
                  class="mt-2 text-xs px-2 py-1 bg-gray-300 rounded"
                  on:click={() => debugVisible = false}
                >
                  Close
                </button>
              </div>
            {/if}
          </div>

        </div>
      </div>
    </div>
    {:else}
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
    {/if}
  </div>

  {#if dragOver}
    <div class="absolute inset-0 bg-sage/20 backdrop-blur-sm flex items-center justify-center z-40">
      <div class="text-center">
        <div class="text-6xl mb-4">📄</div>
        <h3 class="text-2xl font-bold text-charcoal mb-2">Drop your PDF here</h3>
        <p class="text-slate">Release to start drawing</p>
      </div>
    </div>
  {/if}

  {#if !focusMode && browser && !isTauri && showDownloadCard && detectOS() === 'Windows'}
    <!-- Optimized Desktop App Download Card -->
    <div class="absolute bottom-16 right-4 w-72 animate-fade-in download-card">
      <div class="floating-panel p-4 group hover:scale-[1.01] transition-all duration-300 hover:shadow-xl">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <div class="w-9 h-9 bg-gradient-to-br from-sage to-mint rounded-xl flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" class="drop-shadow-sm">
                <path d="M13 5v6h1.17L12 13.17 9.83 11H11V5h2m2-2H9v6H5l7 7 7-7h-4V3zm4 15H5v2h14v-2z"/>
              </svg>
            </div>
          </div>
          <div class="flex-1 min-w-0 pr-2">
            <h3 class="font-semibold text-charcoal dark:text-gray-100 text-sm mb-1.5 group-hover:text-sage transition-colors leading-tight">
              Download LeedPDF Desktop
            </h3>
            <p class="text-xs text-slate dark:text-gray-400 mb-3 leading-relaxed">
              Better performance and offline access
            </p>
            <a 
              href="/download-for-windows"
              target="_blank" 
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-sage hover:text-sage/80 transition-colors group/link"
            >
              <span>Download Now</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" class="group-hover/link:translate-x-0.5 transition-transform">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
              </svg>
            </a>
          </div>
          <button 
            class="flex-shrink-0 text-slate/40 hover:text-slate/70 transition-colors p-1.5 -mt-1 -mr-1 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50"
            on:click={() => {
              // Store dismissal in localStorage and hide the card
              localStorage.setItem('leedpdf-download-card-dismissed', 'true');
              showDownloadCard = false;
            }}
            title="Dismiss"
            aria-label="Dismiss download card"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <!-- Subtle decorative gradient border -->
        <div class="absolute inset-0 rounded-2xl bg-gradient-to-r from-sage/8 via-mint/8 to-lavender/8 -z-10 blur-sm group-hover:blur-md transition-all duration-300"></div>
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
      class="absolute bottom-4 left-4 text-xs text-charcoal dark:text-gray-100 hover:text-sage dark:hover:text-sage transition-colors flex items-center gap-1 bg-white/80 hover:bg-white/90 dark:bg-gray-800/80 dark:hover:bg-gray-700/90 px-2 py-1 rounded-lg backdrop-blur-sm border border-charcoal/10 dark:border-gray-600/20"
      on:click={() => showShortcuts = true}
      title="Show keyboard shortcuts (? or F1)"
    >
      <span>?</span>
      <span>Help</span>
    </button>
  {/if}
</main>

<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => showShortcuts = false} />
<TemplatePicker bind:isOpen={showTemplatePicker} on:close={() => showTemplatePicker = false} />

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
