<script lang="ts">
  import { 
    drawingState, 
    pdfState, 
    setTool, 
    setColor, 
    setLineWidth, 
    setEraserSize,
    setHighlightColor,
    setHighlightOpacity,
    availableColors, 
    availableLineWidths,
    availableEraserSizes,
    availableHighlightColors,
    undo,
    redo,
    undoStack,
    redoStack,
    clearCurrentPageDrawings,
    drawingPaths,
    type DrawingTool 
  } from '../stores/drawingStore';
  
  // Auto-save indicator
  let showAutoSaveIndicator = false;
  let autoSaveTimeout: number;
  
  // Show auto-save indicator when drawings change
  $: if ($drawingPaths && typeof window !== 'undefined') {
    showAutoSaveIndicator = true;
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = window.setTimeout(() => {
      showAutoSaveIndicator = false;
    }, 2000); // Hide after 2 seconds
  }
  
  // Feather Icons
  import { 
    Folder, 
    ChevronLeft, 
    ChevronRight, 
    ZoomIn, 
    ZoomOut, 
    Edit3, 
    Square, 
    Undo2, 
    Redo2, 
    Trash2,
    Type,
    RectangleHorizontal,
    Circle,
    ArrowRight,
    Download,
    Layout,
    Star,
    Highlighter
  } from 'lucide-svelte';


  export let onFileUpload: (files: FileList) => void;
  export let onPreviousPage: () => void;
  export let onNextPage: () => void;
  export let onZoomIn: () => void;
  export let onZoomOut: () => void;
  export let onResetZoom: () => void;
  export let onFitToWidth: () => void;
  export let onFitToHeight: () => void;
  export let onExportPDF: () => void;
  
  // Thumbnail panel control
  export let showThumbnails = false;
  export let onToggleThumbnails: (show: boolean) => void;

  let fileInput: HTMLInputElement;
  let showColorPalette = false;
  let showLineWidthPicker = false;
  let showEraserSizePicker = false;

  function handleToolChange(tool: DrawingTool) {
    setTool(tool);
  }

  function handleColorChange(color: string) {
    setColor(color);
    showColorPalette = false;
  }

  function handleLineWidthChange(width: number) {
    setLineWidth(width);
    showLineWidthPicker = false;
  }

  function handleEraserSizeChange(size: number) {
    setEraserSize(size);
    showEraserSizePicker = false;
  }

  function handleFileSelect() {
    fileInput.click();
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      onFileUpload(input.files);
    }
  }

  function handleUndo() {
    undo();
  }
  
  function handleRedo() {
    redo();
  }

  function handleClear() {
    if (confirm('Clear all drawings on this page?')) {
      clearCurrentPageDrawings();
    }
  }

  // Close dropdowns when clicking outside
  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.color-palette-container')) {
      showColorPalette = false;
    }
    if (!target.closest('.line-width-container')) {
      showLineWidthPicker = false;
    }
    if (!target.closest('.eraser-size-container')) {
      showEraserSizePicker = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="toolbar fixed top-2 left-4 right-4 z-50">
  <div class="floating-panel !py-1 !px-3">
    <div class="flex items-center justify-between">
      <!-- Left section: Branding and file operations -->
      <div class="flex items-center space-x-2">
        <!-- Leed branding -->
        <h1 class="text-sm font-serif text-charcoal tracking-wider mr-1" style="font-family: 'Playfair Display', 'Times New Roman', serif; font-weight: 700; letter-spacing: 0.1em;">
          Leed
        </h1>
        
        <div class="h-4 w-px bg-charcoal/20"></div>
        
        <button
          class="tool-button"
          on:click={handleFileSelect}
          title="Upload PDF"
        >
          <Folder size={14} />
        </button>

        <button
          class="tool-button"
          class:opacity-50={$pdfState.currentPage <= 1}
          disabled={$pdfState.currentPage <= 1}
          on:click={onPreviousPage}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          class="tool-button"
          class:opacity-50={$pdfState.currentPage >= $pdfState.totalPages}
          disabled={$pdfState.currentPage >= $pdfState.totalPages}
          on:click={onNextPage}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>

        <button
          class="tool-button"
          on:click={onZoomOut}
          title="Zoom out"
        >
          <ZoomOut size={12} />
        </button>

        <button
          class="tool-button"
          on:click={onZoomIn}
          title="Zoom in"
        >
          <ZoomIn size={12} />
        </button>

        <button
          class="tool-button text-xs px-1"
          on:click={onResetZoom}
          title="Reset zoom to 120%"
        >
          <span class="font-medium text-xs">Reset</span>
        </button>

        <button
          class="tool-button text-xs px-1"
          on:click={onFitToWidth}
          title="Fit to width"
        >
          <span class="font-medium text-xs">Fit W</span>
        </button>

        <button
          class="tool-button text-xs px-1"
          on:click={onFitToHeight}
          title="Fit to height"
        >
          <span class="font-medium text-xs">Fit H</span>
        </button>
      </div>

      <!-- Center section: Drawing tools -->
      <div class="flex items-center space-x-2">
        <button
          class="tool-button"
          class:active={$drawingState.tool === 'pencil'}
          on:click={() => handleToolChange('pencil')}
          title="Pencil"
        >
          <Edit3 size={14} />
        </button>

        <button
          class="tool-button"
          class:active={$drawingState.tool === 'eraser'}
          on:click={() => handleToolChange('eraser')}
          title="Eraser"
        >
          <Square size={14} />
        </button>

        <button
          class="tool-button"
          class:active={$drawingState.tool === 'highlight'}
          on:click={() => handleToolChange('highlight')}
          title="Highlighter"
        >
          <Highlighter size={14} />
        </button>

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Shape Tools -->
        <button
          class="tool-button"
          class:active={$drawingState.tool === 'text'}
          on:click={() => handleToolChange('text')}
          title="Text"
        >
          <Type size={14} />
        </button>

        <button
          class="tool-button"
          class:active={$drawingState.tool === 'rectangle'}
          on:click={() => handleToolChange('rectangle')}
          title="Rectangle"
        >
          <RectangleHorizontal size={14} />
        </button>

        <button
          class="tool-button"
          class:active={$drawingState.tool === 'circle'}
          on:click={() => handleToolChange('circle')}
          title="Circle"
        >
          <Circle size={14} />
        </button>

        <button
          class="tool-button"
          class:active={$drawingState.tool === 'arrow'}
          on:click={() => handleToolChange('arrow')}
          title="Arrow"
        >
          <ArrowRight size={14} />
        </button>

        <button
          class="tool-button"
          class:active={$drawingState.tool === 'star'}
          on:click={() => handleToolChange('star')}
          title="Star"
        >
          <Star size={14} />
        </button>

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Page Thumbnails Toggle -->
        <button
          class="tool-button"
          class:active={showThumbnails}
          on:click={() => onToggleThumbnails(!showThumbnails)}
          title="Page Thumbnails (T)"
        >
          <Layout size={14} />
        </button>

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Color picker -->
        <div class="relative color-palette-container">
          <button
            class="tool-button w-8 h-8 p-1"
            on:click={() => showColorPalette = !showColorPalette}
            title="Choose color"
            aria-label="Choose drawing color"
          >
            <div 
              class="w-full h-full rounded-md border border-white shadow-inner"
              style="background-color: {$drawingState.color}"
            ></div>
          </button>

          {#if showColorPalette}
            <div class="absolute top-full mt-2 left-0 z-50">
              <div class="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 min-w-[200px]">
                <div class="grid grid-cols-4 gap-3">
                  {#each availableColors as color}
                    <button
                      class="w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
                      class:border-sage={color === $drawingState.color}
                      class:border-gray-300={color !== $drawingState.color}
                      class:scale-110={color === $drawingState.color}
                      class:shadow-lg={color === $drawingState.color}
                      style="background-color: {color}"
                      on:click={() => handleColorChange(color)}
                      title="Select {color}"
                      aria-label="Select color {color}"
                    >
                      {#if color === $drawingState.color}
                        <div class="w-full h-full rounded-full flex items-center justify-center">
                          <svg class="w-3 h-3 text-white drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                          </svg>
                        </div>
                      {/if}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Line width picker -->
        <div class="relative line-width-container">
          <button
            class="tool-button flex items-center justify-center"
            on:click={() => showLineWidthPicker = !showLineWidthPicker}
            title="Line thickness"
            aria-label="Choose line thickness"
          >
            <div 
              class="rounded-full bg-charcoal"
              style="width: {Math.max($drawingState.lineWidth * 2, 4)}px; height: {Math.max($drawingState.lineWidth * 2, 4)}px;"
            ></div>
          </button>

          {#if showLineWidthPicker}
            <div class="absolute top-full mt-2 left-0 floating-panel animate-slide-up">
              <div class="flex flex-col space-y-2 p-2">
                {#each availableLineWidths as width}
                  <button
                    class="flex items-center justify-center p-2 rounded-lg hover:bg-sage/10 transition-colors"
                    class:bg-sage={width === $drawingState.lineWidth}
                    on:click={() => handleLineWidthChange(width)}
                    title="Line width {width}px"
                  >
                    <div 
                      class="rounded-full bg-charcoal"
                      style="width: {Math.max(width * 2, 4)}px; height: {Math.max(width * 2, 4)}px;"
                    ></div>
                    <span class="ml-2 text-sm text-charcoal">{width}px</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Eraser size picker -->
        {#if $drawingState.tool === 'eraser'}
          <div class="relative eraser-size-container">
            <button
              class="tool-button flex items-center justify-center"
              on:click={() => showEraserSizePicker = !showEraserSizePicker}
              title="Eraser size"
              aria-label="Choose eraser size"
            >
              <div 
                class="rounded-full bg-charcoal opacity-50"
                style="width: {Math.max($drawingState.eraserSize / 2, 6)}px; height: {Math.max($drawingState.eraserSize / 2, 6)}px;"
              ></div>
            </button>

            {#if showEraserSizePicker}
              <div class="absolute top-full mt-2 left-0 floating-panel animate-slide-up">
                <div class="flex flex-col space-y-2 p-2">
                  {#each availableEraserSizes as size}
                    <button
                      class="flex items-center justify-center p-2 rounded-lg hover:bg-sage/10 transition-colors"
                      class:bg-sage={size === $drawingState.eraserSize}
                      on:click={() => handleEraserSizeChange(size)}
                      title="Eraser size {size}px"
                    >
                      <div 
                        class="rounded-full bg-charcoal opacity-50"
                        style="width: {Math.max(size / 2, 6)}px; height: {Math.max(size / 2, 6)}px;"
                      ></div>
                      <span class="ml-2 text-sm text-charcoal">{size}px</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Right section: Actions and status -->
      <div class="flex items-center space-x-3">
        <button
          class="tool-button"
          class:opacity-50={$undoStack.length === 0}
          disabled={$undoStack.length === 0}
          on:click={handleUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={12} />
        </button>

        <button
          class="tool-button"
          class:opacity-50={$redoStack.length === 0}
          disabled={$redoStack.length === 0}
          on:click={handleRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={12} />
        </button>

        <button
          class="tool-button text-red-500 hover:bg-red-50"
          on:click={handleClear}
          title="Clear all drawings on this page"
        >
          <Trash2 size={12} />
        </button>

        <button
          class="tool-button text-sage hover:bg-sage/10"
          class:opacity-50={!$pdfState.document}
          disabled={!$pdfState.document}
          on:click={onExportPDF}
          title="Export annotated PDF"
        >
          <Download size={12} />
        </button>
        
        <div class="h-4 w-px bg-charcoal/20"></div>
        
        <!-- Compact tool status -->
        <div class="flex items-center space-x-2 text-xs text-charcoal/70">
          <span class="capitalize font-medium text-charcoal">{$drawingState.tool}</span>
          <span>{$drawingState.tool === 'eraser' ? $drawingState.eraserSize : $drawingState.lineWidth}px</span>
          {#if $pdfState.document}
            <span>•</span>
            <span>{$pdfState.totalPages}p</span>
          {/if}
          {#if showAutoSaveIndicator}
            <span>•</span>
            <span class="text-sage font-medium">Saved ✓</span>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Hidden file input -->
<input
  bind:this={fileInput}
  type="file"
  accept=".pdf,application/pdf"
  multiple={false}
  class="hidden"
  on:change={handleFileChange}
/>

<style>
  .toolbar {
    pointer-events: none;
  }
  
  .toolbar > * {
    pointer-events: auto;
  }
  
  .floating-panel {
    backdrop-filter: blur(20px);
  }
</style>
