<script lang="ts">
  import { onMount } from 'svelte';
  import PDFViewer from '$lib/components/PDFViewer.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import { isValidPDFFile, formatFileSize } from '$lib/utils/pdfUtils';
  import { undo, redo } from '$lib/stores/drawingStore';
  
  let pdfViewer: PDFViewer;
  let currentFile: File | null = null;
  let dragOver = false;
  let showWelcome = true;

  function handleFileUpload(files: FileList) {
    console.log('handleFileUpload called with:', files);
    const file = files[0];
    console.log('Selected file:', file?.name, 'Type:', file?.type, 'Size:', file?.size);
    
    if (!isValidPDFFile(file)) {
      console.log('Invalid PDF file');
      alert('Please select a valid PDF file.');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      console.log('File too large');
      alert('File size too large. Please select a file smaller than 50MB.');
      return;
    }
    
    console.log('Setting currentFile and hiding welcome');
    currentFile = file;
    showWelcome = false;
    console.log('Updated state:', { currentFile: !!currentFile, showWelcome });
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
    // Handle keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'z':
          if (event.shiftKey) {
            // Ctrl+Shift+Z = Redo (alternative to Ctrl+Y)
            event.preventDefault();
            redo();
          } else {
            // Ctrl+Z = Undo
            event.preventDefault();
            undo();
          }
          break;
        case 'y':
          // Ctrl+Y = Redo
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
          // Switch to pencil - handled by toolbar
          break;
        case '2':
          // Switch to eraser - handled by toolbar
          break;
      }
    }
  }

  function handleWheel(event: WheelEvent) {
    // Handle Ctrl+scroll for zoom anywhere on the page
    if (event.ctrlKey) {
      event.preventDefault();
      
      // deltaY < 0 means scroll up (zoom in), deltaY > 0 means scroll down (zoom out)
      const zoomIn = event.deltaY < 0;
      if (zoomIn) {
        pdfViewer?.zoomIn();
      } else {
        pdfViewer?.zoomOut();
      }
    }
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
  <!-- Toolbar -->
  <Toolbar 
    onFileUpload={handleFileUpload}
    onPreviousPage={() => pdfViewer?.previousPage()}
    onNextPage={() => pdfViewer?.nextPage()}
    onZoomIn={() => pdfViewer?.zoomIn()}
    onZoomOut={() => pdfViewer?.zoomOut()}
    onResetZoom={() => pdfViewer?.resetZoom()}
  />

  <!-- Main content -->
  <div class="w-full h-full pt-12">
    {#if showWelcome}
      <!-- Welcome screen -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-center max-w-md mx-auto px-6">
          <div class="text-8xl mb-6 animate-bounce-soft">✏️</div>
          <h1 class="text-4xl font-bold text-charcoal mb-4">LeedPDF</h1>
          <p class="text-lg text-slate mb-8">
            A vibey PDF viewer where you can draw, sketch, and annotate with the smoothness of pencil on paper.
          </p>
          
          <div class="space-y-4">
            <button 
              class="primary-button text-lg px-8 py-4"
              on:click={() => document.querySelector('input[type="file"]')?.click()}
            >
              Upload PDF & Start Drawing
            </button>
            
            <p class="text-sm text-slate">
              Or drag and drop a PDF file anywhere on this page
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
      <!-- PDF Viewer -->
      <PDFViewer bind:this={pdfViewer} pdfFile={currentFile} />
    {/if}
  </div>

  <!-- Drag overlay -->
  {#if dragOver}
    <div class="absolute inset-0 bg-sage/20 backdrop-blur-sm flex items-center justify-center z-40">
      <div class="text-center">
        <div class="text-6xl mb-4">📄</div>
        <h3 class="text-2xl font-bold text-charcoal mb-2">Drop your PDF here</h3>
        <p class="text-slate">Release to start drawing</p>
      </div>
    </div>
  {/if}

  <!-- App info -->
  <div class="absolute bottom-4 right-4 text-xs text-charcoal/60 flex items-center gap-2">
    <span>❤️ An open-source, lovable PDF viewer • Made by Rudi K</span>
    <a href="https://github.com/rudi-q/leed_pdf_viewer" class="text-charcoal/60 hover:text-sage transition-colors" target="_blank" rel="noopener" title="View on GitHub">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    </a>
  </div>
</main>


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
