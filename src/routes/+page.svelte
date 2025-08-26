<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
  import { listen } from '@tauri-apps/api/event';
  import { message } from '@tauri-apps/plugin-dialog';
  import { readFile as readFilePlugin } from '@tauri-apps/plugin-fs';
  import { invoke } from '@tauri-apps/api/core';
  import PDFViewer from '$lib/components/PDFViewer.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
  import PageThumbnails from '$lib/components/PageThumbnails.svelte';
  import { createBlankPDF, isValidPDFFile } from '$lib/utils/pdfUtils';
  import { redo, setCurrentPDF, setTool, undo, pdfState } from '$lib/stores/drawingStore';
  import { toastStore } from '$lib/stores/toastStore';
  import { MAX_FILE_SIZE } from '$lib/constants';
  import { isDarkMode } from '$lib/stores/themeStore';
  import { handleSearchLinkClick } from '$lib/utils/navigationUtils';
  import TemplatePicker from '$lib/components/TemplatePicker.svelte';
  import { storeUploadedFile } from '$lib/utils/fileStorageUtils';
  import DebugPanel from '$lib/components/DebugPanel.svelte';
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
  let showDebugPanel = false;

  // File loading variables
  let hasLoadedFromCommandLine = false;

  // Debug state changes (development only)
  $: if (import.meta.env.DEV) {
    console.log('State changed:', { 
      currentFile: !!currentFile, 
      showWelcome, 
      dragOver,
      fileType: currentFile ? (typeof currentFile === 'string' ? 'string' : 'File') : 'null'
    });
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

    console.log('Processing PDF file directly on current page');
    console.log('Before state change - showWelcome:', showWelcome, 'currentFile:', !!currentFile);
    
    try {
      // Update state immediately
      currentFile = file;
      showWelcome = false;
      
      // Set current PDF for auto-save functionality
      setCurrentPDF(file.name, file.size);
      
      console.log('After state change - showWelcome:', showWelcome, 'currentFile:', !!currentFile);
      
      // Show success toast
      toastStore.success('PDF Loaded', `${file.name} has been loaded successfully!`);
      
      console.log('PDF loaded successfully:', { 
        name: file.name, 
        size: file.size, 
        currentFile: !!currentFile,
        showWelcome 
      });
      
    } catch (error) {
      console.error('Error loading PDF:', error);
      toastStore.error('Load Error', 'Failed to load the PDF. Please try again.');
    }
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
    if (import.meta.env.DEV) {
      console.log('*** HANDLING FILE FROM COMMAND LINE ***');
      console.log('File path:', filePath);
    }

    // Mark that we've attempted to load from command line
    hasLoadedFromCommandLine = true;

    try {
      // Step 1: Validate path
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path received');
      }

      // Step 2: Sanitize path
      let cleanPath = filePath.trim();
      if (cleanPath.startsWith('"') && cleanPath.endsWith('"')) {
        cleanPath = cleanPath.slice(1, -1);
      }

      // Step 3: Extract filename
      const fileName = cleanPath.split(/[\\/]/).pop() || 'document.pdf';

      // Step 4: Check if it's a PDF
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        return false;
      }

      // Step 5: Try to read the file
      let fileData: Uint8Array;
      try {
        // Try using the Rust command first to avoid glob pattern issues
        const fileContent = await invoke('read_file_content', { filePath: cleanPath });
        
        // Validate the result before casting
        if (!Array.isArray(fileContent) || !fileContent.every(x => typeof x === 'number')) {
          throw new Error(`Invalid response from read_file_content: expected array of numbers, got ${typeof fileContent}`);
        }
        
        fileData = new Uint8Array(fileContent);
      } catch (readError: unknown) {
        const errorMsg = readError instanceof Error ? readError.message : String(readError);
        console.error('File read error:', errorMsg);

        // Try alternative path formats
        const altPaths = [
          cleanPath.replace(/\\/g, '/'),
          cleanPath.replace(/\//g, '\\'),
          `"${cleanPath}"` // Try with quotes
        ];

        let success = false;
        for (const altPath of altPaths) {
          try {
            fileData = await readFilePlugin(altPath);
            cleanPath = altPath;
            success = true;
            break;
          } catch (altError: unknown) {
            console.warn('Alternative path failed:', altPath, altError);
          }
        }

        if (!success) {
          console.error('All path formats failed');
          return false;
        }
      }

      // Step 6: Validate PDF header
      const pdfHeader = new Uint8Array(fileData!.slice(0, 4));
      const pdfSignature = String.fromCharCode(...pdfHeader);
      if (pdfSignature !== '%PDF') {
        console.error('Invalid PDF signature:', pdfSignature);
        return false;
      }

      // Step 7: Create File object
      const file = new File([new Uint8Array(fileData!)], fileName, { type: 'application/pdf' });

      // Step 8: Size check
      if (file.size > MAX_FILE_SIZE) {
        console.error('File too large:', file.size);
        return false;
      }

      // Step 9: Set state
      currentFile = file;
      showWelcome = false;

      // Step 10: Set PDF for auto-save
      setCurrentPDF(file.name, file.size);

      // Step 11: Mark as processed
      try {
        await invoke('mark_file_processed');
      } catch (e) {
        console.warn('Could not mark as processed (not critical)');
      }

      console.log('PDF loaded successfully from command line');
      return true;

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Unexpected error in handleFileFromCommandLine:', errorMsg);
      return false;
    }
  }

  // Multiple strategies for checking files
  async function checkForPendingFiles() {
    try {
      if (import.meta.env.DEV) {
        console.log('Checking for pending files (strategy 1: command)...');
      }
      const pendingFile = await invoke('get_pending_file');
      
      // Validate the result before casting
      if (pendingFile !== null && typeof pendingFile !== 'string') {
        if (import.meta.env.DEV) {
          console.error('Invalid response from get_pending_file: expected string or null');
        }
        return;
      }

      if (pendingFile) {
        if (import.meta.env.DEV) {
          console.log('Found pending file via command:', pendingFile);
        }
        const success = await handleFileFromCommandLine(pendingFile);

        if (success) {
          // Check for more files
          setTimeout(checkForPendingFiles, 100);
        }
      } else if (import.meta.env.DEV) {
        console.log('No pending files found via command');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error checking for pending files:', error);
      }
    }
  }

  async function checkFileAssociations() {
    try {
      if (import.meta.env.DEV) {
        console.log('Checking file associations (strategy 2: direct check)...');
      }
      const pdfFiles = await invoke('check_file_associations');
      
      // Validate the result before casting
      if (!Array.isArray(pdfFiles) || !pdfFiles.every(x => typeof x === 'string')) {
        if (import.meta.env.DEV) {
          console.error('Invalid response from check_file_associations: expected array of strings');
        }
        return;
      }

      if (pdfFiles.length > 0) {
        if (import.meta.env.DEV) {
          console.log('Found PDF files via direct check:', pdfFiles);
        }
        for (const pdfFile of pdfFiles) {
          const success = await handleFileFromCommandLine(pdfFile);
          if (success) {
            break; // Only load the first one
          }
        }
      } else if (import.meta.env.DEV) {
        console.log('No PDF files found via direct check');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error checking file associations:', error);
      }
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
    console.log('=== DROP EVENT TRIGGERED ===');
    event.preventDefault();
    event.stopPropagation();
    
    // Reset drag state immediately
    dragOver = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      console.log('Files detected in drop:', event.dataTransfer.files.length);
      console.log('File details:', {
        name: event.dataTransfer.files[0]?.name,
        type: event.dataTransfer.files[0]?.type,
        size: event.dataTransfer.files[0]?.size
      });
      
      // Process the files
      handleFileUpload(event.dataTransfer.files);
    } else {
      console.log('No files in drop event');
      console.log('DataTransfer types:', event.dataTransfer?.types);
      console.log('DataTransfer files:', event.dataTransfer?.files);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Only set dragOver to true if we have files
    if (event.dataTransfer?.types.includes('Files')) {
      if (!dragOver) {
        console.log('Drag over with files - setting dragOver to true');
        dragOver = true;
      }
    }
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Only set dragOver to true if we have files
    if (event.dataTransfer?.types.includes('Files')) {
      console.log('Drag enter with files - setting dragOver to true');
      dragOver = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    // Check if we're actually leaving the main container
    const mainElement = event.currentTarget as Element;
    const relatedTarget = event.relatedTarget as Element;
    
    // If relatedTarget is null (leaving the window) or not a child of main, we're truly leaving
    if (!relatedTarget || !mainElement.contains(relatedTarget)) {
      console.log('Drag leave - setting dragOver to false');
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
    if (import.meta.env.DEV) {
      console.log('[onMount] Component mounted - setting up comprehensive file loading');
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // Check if the download card was dismissed
    if (browser) {
      const dismissed = localStorage.getItem('leedpdf-download-card-dismissed');
      showDownloadCard = dismissed !== 'true';
    }

    // Strategy 1: Immediate checks
    if (import.meta.env.DEV) {
      console.log('Starting immediate file checks...');
    }
    checkForPendingFiles();
    checkFileAssociations();

    // Strategy 2: Event listeners
    if (import.meta.env.DEV) {
      console.log('Setting up event listeners...');
    }

    const unlistenFileOpened = listen('file-opened', (event) => {
      if (import.meta.env.DEV) {
        console.log('*** FILE-OPENED EVENT RECEIVED ***');
        console.log('Event payload:', event.payload);
      }
      handleFileFromCommandLine(event.payload as string);
    });

    const unlistenStartupReady = listen('startup-file-ready', (event) => {
      if (import.meta.env.DEV) {
        console.log('*** STARTUP-FILE-READY EVENT RECEIVED ***');
        console.log('Event payload:', event.payload);
      }
      handleFileFromCommandLine(event.payload as string);
    });

    const unlistenDebug = listen('debug-info', (event) => {
      if (import.meta.env.DEV) {
        console.log('TAURI DEBUG:', event.payload);
      }
    });

    registerDeepLinkHandler();

    // Signal that frontend is ready to receive events
    if (isTauri) {
      if (import.meta.env.DEV) {
        console.log('Signaling frontend is ready...');
      }
      invoke('frontend_ready').then(() => {
        if (import.meta.env.DEV) {
          console.log('Frontend ready signal sent');
        }
      }).catch(console.error);
    }

    if (import.meta.env.DEV) {
      console.log('✅ All file loading strategies initialized');
    }

    return () => {
      if (import.meta.env.DEV) {
        console.log('[onDestroy] Cleaning up file loading systems');
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);

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
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragenter={handleDragEnter}
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
    <div class="absolute inset-0 bg-sage/40 backdrop-blur-sm flex items-center justify-center z-40 transition-all duration-200 ease-out pointer-events-none">
      <div class="text-center transform scale-105 transition-transform duration-200">
        <div class="text-6xl mb-4 animate-bounce">📄</div>
        <h3 class="text-2xl font-bold text-charcoal mb-2">Drop your PDF here</h3>
        <p class="text-slate">Release to start drawing</p>
        <div class="mt-4 text-sm text-sage font-medium">Ready to receive PDF</div>
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

    <!-- Debug button (only visible in development mode) -->
    {#if isTauri && import.meta.env.DEV}
      <button
        class="absolute bottom-4 left-20 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors flex items-center gap-1 bg-white/80 hover:bg-white/90 dark:bg-gray-800/80 dark:hover:bg-gray-700/90 px-2 py-1 rounded-lg backdrop-blur-sm border border-blue-200 dark:border-blue-700"
        on:click={() => showDebugPanel = true}
        title="Open debug panel"
      >
        <span>🔧</span>
        <span>Debug</span>
      </button>
    {/if}
  {/if}
</main>

<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => showShortcuts = false} />
<TemplatePicker bind:isOpen={showTemplatePicker} on:close={() => showTemplatePicker = false} />
<DebugPanel bind:isVisible={showDebugPanel} />

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
