<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import PDFViewer from '$lib/components/PDFViewer.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
  import PageThumbnails from '$lib/components/PageThumbnails.svelte';
  import { isValidPDFFile, formatFileSize } from '$lib/utils/pdfUtils';
  import { undo, redo, setCurrentPDF, setTool, drawingPaths, shapeObjects } from '$lib/stores/drawingStore';
  import { PDFExporter } from '$lib/utils/pdfExport';

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

  // Check for PDF URL parameter reactively
  $: if (browser && $page && $page.url) {
    const pdfUrl = $page.url.searchParams.get('pdf');
    if (pdfUrl && !currentFile) {
      console.log('[PDF URL] Found PDF parameter:', pdfUrl);
      handlePdfUrlLoad(pdfUrl);
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

    console.log('Setting currentFile and hiding welcome');
    currentFile = file;
    showWelcome = false;

    // Set current PDF for auto-save functionality
    setCurrentPDF(file.name, file.size);
    console.log('Updated state:', { currentFile: !!currentFile, showWelcome });
  }

  function isValidPdfUrl(url: string): boolean {
    try {
      const validUrl = new URL(url);
      return validUrl.protocol === 'https:' || validUrl.protocol === 'http:';
    } catch {
      return false;
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

  function handleDragLeave() {
    dragOver = false;
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
          document.querySelector('input[type="file"]')?.click();
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
    
    // Navigate to the same page with the PDF parameter
    goto(`/?pdf=${encodeURIComponent(trimmedUrl)}`);
  }

  function handleUrlCancel() {
    showUrlInput = false;
    urlInput = '';
    urlError = '';
  }

  function handleUrlKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleUrlSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleUrlCancel();
    }
  }

  onMount(() => {
    console.log('[onMount] Component mounted');
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  });
</script>

<svelte:window on:keydown={handleKeyboard} on:wheel={handleWheel} />

<main
  class="w-screen h-screen relative overflow-hidden"
  class:drag-over={dragOver}
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
>
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

  <div class="w-full h-full pt-12">
    {#if showWelcome}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-center max-w-md mx-auto px-6">
          <div class="mb-6 animate-bounce-soft">
            <img src="/favicon.png" alt="LeedPDF" class="w-24 h-24 mx-auto" />
          </div>
          <h1 class="text-4xl font-bold text-charcoal mb-4">LeedPDF</h1>
          <p class="text-lg text-slate mb-8">
            Add drawings and notes to any PDF. <br>
            <i>Works with mouse, touch, or stylus.</i>
          </p>

          <div class="space-y-4">
            <button
              class="primary-button text-lg px-8 py-4"
              on:click={() => document.querySelector('input[type="file"]')?.click()}
            >
              Choose PDF File
            </button>

            <div class="text-sm text-slate">
              <span>or</span>
            </div>

            {#if !showUrlInput}
              <button
                class="secondary-button text-lg px-8 py-4"
                on:click={handleViewFromLink}
              >
                View from Link
              </button>
            {:else}
              <div class="space-y-3 animate-slide-up">
                <div class="flex gap-2">
                  <input
                    type="url"
                    bind:value={urlInput}
                    on:keydown={handleUrlKeydown}
                    placeholder="Paste PDF URL (Dropbox links supported)"
                    class="flex-1 px-4 py-3 rounded-xl border border-charcoal/20 bg-white/80 text-charcoal placeholder-slate focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage transition-all"
                    autofocus
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

            <p class="text-sm text-slate">
              or drop a file anywhere
            </p>
          </div>

          <div class="mt-12 flex justify-center space-x-8 text-sm text-slate">
            <div class="flex items-center">
              <span class="text-lg mr-2">🖱️</span>
              Mouse
            </div>
            <div class="flex items-center">
              <span class="text-lg mr-2">👆</span>
              Touch
            </div>
            <div class="flex items-center">
              <span class="text-lg mr-2">✏️</span>
              Apple Pencil
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

  <div class="absolute bottom-4 right-4 text-xs text-charcoal/60 flex items-center gap-2">
    <span>💛 Open-source PDF editor • Free, lightweight, private • Made by Rudi K</span>
    <a aria-label="Credit" href="https://github.com/rudi-q/leed_pdf_viewer" class="text-charcoal/60 hover:text-sage transition-colors" target="_blank" rel="noopener" title="View on GitHub">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    </a>
  </div>

  <button
    class="absolute bottom-4 left-4 text-xs text-charcoal/60 hover:text-charcoal transition-colors flex items-center gap-1 bg-white/50 hover:bg-white/80 px-2 py-1 rounded-lg backdrop-blur-sm"
    on:click={() => showShortcuts = true}
    title="Show keyboard shortcuts (? or F1)"
  >
    <span>?</span>
    <span>Help</span>
  </button>
</main>

<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => showShortcuts = false} />

<style>
  main {
    background: linear-gradient(135deg, #FDF6E3 0%, #F7F3E9 50%, #F0EFEB 100%);
  }

  .drag-over {
    background: linear-gradient(135deg, #FDF6E3 0%, #E8F5E8 50%, #F0EFEB 100%);
  }

  :global(body) {
    font-family: 'Inter', system-ui, sans-serif;
  }
</style>