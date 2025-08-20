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
  import { redo, setCurrentPDF, setTool, undo, pdfState, forceSaveAllAnnotations } from '$lib/stores/drawingStore';
  import { PDFExporter } from '$lib/utils/pdfExport';

  // Get the page data from the load function
  export let data;

  const isTauri = typeof window !== 'undefined' && !!window.__TAURI_EVENT_PLUGIN_INTERNALS__;

  let pdfViewer: PDFViewer;
  let currentFile: File | string | null = null;
  let dragOver = false;
  let showShortcuts = false;
  let isFullscreen = false;
  let showThumbnails = false;
  let focusMode = false;
  let isLoading = true;
  let templateError = false;

  // Load template PDF if it exists
  $: if (browser && data) {
    if (data.exists && data.templateUrl && !currentFile) {
      console.log('[Template Route] Loading template PDF:', data.templateName);
      handleTemplateLoad(data.templateUrl, data.templateName);
    } else if (!data.exists) {
      console.log('[Template Route] Template not found:', data.templateName);
      templateError = true;
      isLoading = false;
    }
  }

  onMount(() => {
    // Setup all the event listeners and handlers for Tauri functionality
    setupEventListeners();
    
    return cleanup;
  });

  function setupEventListeners() {
    console.log('[Template Route] Setting up event listeners');
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
      (window as any).__templateRouteCleanup = {
        unlistenFileOpened,
        unlistenStartupReady,
        unlistenDebug
      };
    }

    console.log('✅ All file loading strategies initialized');
  }

  function cleanup() {
    console.log('[Template Route] Cleaning up');
    document.removeEventListener('fullscreenchange', handleFullscreenChange);

    // Clean up Tauri event listeners
    if ((window as any).__templateRouteCleanup) {
      const { unlistenFileOpened, unlistenStartupReady, unlistenDebug } = (window as any).__templateRouteCleanup;
      unlistenFileOpened.then((fn: () => void) => fn()).catch(console.error);
      unlistenStartupReady.then((fn: () => void) => fn()).catch(console.error);
      unlistenDebug.then((fn: () => void) => fn()).catch(console.error);
      delete (window as any).__templateRouteCleanup;
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

    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path received');
      }

      let cleanPath = filePath.trim();
      if (cleanPath.startsWith('"') && cleanPath.endsWith('"')) {
        cleanPath = cleanPath.slice(1, -1);
      }

      const fileName = cleanPath.split(/[\\\/]/).pop() || 'document.pdf';

      if (!fileName.toLowerCase().endsWith('.pdf')) {
        return false;
      }

      let fileData: Uint8Array;
      try {
        fileData = await readFile(cleanPath);
      } catch (readError: unknown) {
        const errorMsg = readError instanceof Error ? readError.message : String(readError);
        console.error('File read error:', errorMsg);
        return false;
      }

      const pdfHeader = new Uint8Array(fileData.slice(0, 4));
      const pdfSignature = String.fromCharCode(...pdfHeader);
      if (pdfSignature !== '%PDF') {
        return false;
      }

      const file = new File([new Uint8Array(fileData)], fileName, { type: 'application/pdf' });

      if (file.size > 50 * 1024 * 1024) {
        return false;
      }

      currentFile = file;
      isLoading = false;

      setCurrentPDF(file.name, file.size);

      try {
        await invoke('mark_file_processed');
      } catch (e) {
        console.warn('Could not mark as processed (not critical)');
      }

      return true;

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Unexpected error:', errorMsg);
      return false;
    }
  }

  async function checkForPendingFiles() {
    try {
      console.log('Checking for pending files...');
      const pendingFile = await invoke('get_pending_file') as string | null;

      if (pendingFile) {
        console.log('Found pending file via command:', pendingFile);
        const success = await handleFileFromCommandLine(pendingFile);

        if (success) {
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
      console.log('Checking file associations...');
      const pdfFiles = await invoke('check_file_associations') as string[];

      if (pdfFiles && pdfFiles.length > 0) {
        console.log('Found PDF files via direct check:', pdfFiles);
        for (const pdfFile of pdfFiles) {
          const success = await handleFileFromCommandLine(pdfFile);
          if (success) {
            break;
          }
        }
      } else {
        console.log('No PDF files found via direct check');
      }
    } catch (error) {
      console.error('Error checking file associations:', error);
    }
  }

  async function handleTemplateLoad(templateUrl: string, templateName: string) {
    console.log('[handleTemplateLoad] Loading template:', templateName, 'from:', templateUrl);

    try {
      // Set the template URL as currentFile (similar to how URL route works)
      currentFile = templateUrl;
      isLoading = false;

      // Set current PDF for auto-save functionality  
      setCurrentPDF(`${templateName}.pdf`, 0);
      console.log('Template PDF setup completed');
    } catch (error) {
      console.error('Template loading failed:', error);
      templateError = true;
      isLoading = false;
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
    const mainElement = event.currentTarget as Element;
    const relatedTarget = event.relatedTarget as Element;
    
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
          const stampButton = document.querySelector('.stamp-palette-container button');
          if (stampButton) {
            (stampButton as HTMLButtonElement).click();
          }
          break;
      }
    }
  }

  function handleWheel(event: WheelEvent) {
    if (event.ctrlKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        pdfViewer?.zoomIn();
      } else {
        pdfViewer?.zoomOut();
      }
    }
  }

  async function handleExportPDF() {
    if (!currentFile || !pdfViewer) {
      return;
    }

    try {
      console.log('Starting multi-page PDF export with annotations...');
      
      // Force save all annotations to localStorage before export
      forceSaveAllAnnotations();
      console.log('✅ All annotations force-saved to localStorage before export');
      
      let pdfBytes: Uint8Array;
      let originalName: string;

      if (typeof currentFile === 'string') {
        // Template URL - fetch the PDF data
        const response = await fetch(currentFile);
        if (!response.ok) {
          throw new Error(`Failed to fetch template: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
        originalName = data.templateName || 'template';
      } else {
        const arrayBuffer = await currentFile.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
        originalName = currentFile.name.replace(/\.pdf$/i, '');
      }

      const exporter = new PDFExporter();
      exporter.setOriginalPDF(pdfBytes);

      // Export ALL pages that have annotations
      console.log('Checking all pages for annotations...');
      const totalPages = $pdfState.totalPages;
      let pagesWithAnnotations = 0;
      
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        const hasAnnotations = await pdfViewer.pageHasAnnotations(pageNumber);
        
        if (hasAnnotations) {
          console.log(`📄 Page ${pageNumber} has annotations - creating merged canvas`);
          const mergedCanvas = await pdfViewer.getMergedCanvasForPage(pageNumber);
          if (mergedCanvas) {
            exporter.setPageCanvas(pageNumber, mergedCanvas);
            pagesWithAnnotations++;
            console.log(`✅ Added merged canvas for page ${pageNumber}`);
          } else {
            console.warn(`❌ Failed to create merged canvas for page ${pageNumber}`);
          }
        } else {
          console.log(`📄 Page ${pageNumber} has no annotations - will preserve original page`);
        }
      }
      
      console.log(`📊 Export summary: ${pagesWithAnnotations} pages with annotations out of ${totalPages} total pages`);

      const annotatedPdfBytes = await exporter.exportToPDF();
      const filename = `${originalName}_annotated.pdf`;

      const success = await PDFExporter.exportFile(annotatedPdfBytes, filename, 'application/pdf');
      if (success) {
        console.log('🎉 Multi-page PDF exported successfully:', filename);
      } else {
        console.log('📄 Export was cancelled by user');
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
</script>

<svelte:window on:keydown={handleKeyboard} on:wheel={handleWheel} />

<main
  class="w-screen h-screen relative overflow-hidden"
  class:drag-over={dragOver}
  on:drop={handleDrop}
  on:dragover={handleDragOver}
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
    {#if templateError}
      <!-- Error state when template is not found -->
      <div class="h-full flex items-center justify-center">
        <div class="text-center max-w-md mx-auto px-6">
          <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Template Not Found
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            The template "<strong>{data.templateName}</strong>" could not be found.
          </p>
          <button
            class="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            on:click={() => goto('/')}
          >
            Go Back Home
          </button>
        </div>
      </div>
    {:else if isLoading}
      <!-- Loading state -->
      <div class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Loading template...</p>
        </div>
      </div>
    {:else if currentFile}
      <!-- PDF viewer -->
      <div class="relative w-full h-full">
        {#if showThumbnails}
          <PageThumbnails
            isVisible={showThumbnails}
            onPageSelect={handlePageSelect}
          />
        {/if}
        
        <PDFViewer
          bind:this={pdfViewer}
          pdfFile={currentFile}
        />
      </div>
    {/if}
  </div>
</main>

<!-- Keyboard shortcuts modal -->
<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => showShortcuts = false} />

<style>
  .drag-over {
    background-color: rgb(239 246 255); /* bg-blue-50 */
  }
  :global(.dark) .drag-over {
    background-color: rgb(30 58 138 / 0.1); /* dark:bg-blue-900/10 */
  }
</style>
