<script lang="ts">
  import { onMount } from 'svelte';
  import PDFViewer from '$lib/components/PDFViewer.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import { isValidPDFFile, formatFileSize } from '$lib/utils/pdfUtils';
  
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
          // Undo handled by toolbar
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
</script>

<svelte:window on:keydown={handleKeyboard} />

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
  />

  <!-- Main content -->
  <div class="w-full h-full pt-32">
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
  <div class="absolute bottom-4 right-4 text-xs text-slate/70">
    Made with 💚 by LeedPDF
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
