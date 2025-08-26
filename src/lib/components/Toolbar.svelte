<script lang="ts">
  import {
    availableColors,
    availableEraserSizes,
    availableLineWidths,
    availableStamps,
    clearCurrentPageDrawings,
    drawingPaths,
    drawingState,
    type DrawingTool,
    pdfState,
    redo,
    redoStack,
    setColor,
    setEraserSize,
    setLineWidth,
    setStampId,
    setTool,
    undo,
    undoStack
  } from '../stores/drawingStore';
  import { isDarkMode, toggleTheme } from '../stores/themeStore';
  import { handleSearchLinkClick } from '../utils/navigationUtils';
  import { goto } from '$app/navigation';
  import StampPalette from './StampPalette.svelte';
  // Feather Icons
  import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit3,
    Folder,
    Highlighter,
    Layout,
    MoreHorizontal,
    Moon,
    Redo2,
    Search,
    Square,
    Sticker,
    StickyNote,
    Sun,
    Trash2,
    Type,
    Undo2,
    ZoomIn,
    ZoomOut
  } from 'lucide-svelte';

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
  let showStampPalette = false;
  let showMoreMenu = false;
  let toolbarScrollContainer: HTMLDivElement;
  let showLeftFade = false;
  let showRightFade = true;

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

  function handleStampSelect(stamp: any) {
    setStampId(stamp.id);
    showStampPalette = false;
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
    if (confirm('Delete all drawings on this page? This can\'t be undone.')) {
      clearCurrentPageDrawings();
    }
  }

  async function handleLogoClick() {
    await goto('/');
  }

  function handleToolbarScroll() {
    if (toolbarScrollContainer) {
      const { scrollLeft, scrollWidth, clientWidth } = toolbarScrollContainer;
      showLeftFade = scrollLeft > 0;
      showRightFade = scrollLeft < scrollWidth - clientWidth - 1;
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
    if (!target.closest('.stamp-palette-container')) {
      showStampPalette = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<!-- Top Toolbar - Always visible -->
<div class="toolbar-top fixed top-2 left-4 right-4 z-50">
  <div class="floating-panel !py-1 !px-3">

    
    <div class="flex items-center justify-between">
      <!-- Left section: Logo, Folder, Page Navigation, Zoom Controls, Reset/Fit (Desktop) -->
      <div class="flex items-center space-x-2">
        <!-- Logo -->
        <button
          class="flex items-center hover:opacity-80 transition-opacity cursor-pointer w-11 h-11 lg:w-8 lg:h-8 justify-center"
          on:click={handleLogoClick}
          title="Go to homepage"
          aria-label="Go to homepage"
        >
          <img src="/favicon.png" alt="LeedPDF" class="w-5 h-5 lg:w-4 lg:h-4" />
        </button>
        
        <div class="h-4 w-px bg-charcoal/20"></div>
        
        <!-- Desktop: Folder icon -->
        <div class="hidden lg:block">
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            on:click={handleFileSelect}
            title="Upload PDF"
          >
            <Folder size={14} />
          </button>
        </div>

        <!-- Desktop: Page Navigation -->
        <div class="hidden lg:flex items-center space-x-2">
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:opacity-50={$pdfState.currentPage <= 1}
            disabled={$pdfState.currentPage <= 1}
            on:click={onPreviousPage}
            title="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:opacity-50={$pdfState.currentPage >= $pdfState.totalPages}
            disabled={$pdfState.currentPage >= $pdfState.totalPages}
            on:click={onNextPage}
            title="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <!-- Desktop: Zoom Controls -->
        <div class="hidden lg:flex items-center space-x-2">
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            on:click={onZoomOut}
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>

          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            on:click={onZoomIn}
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <!-- Desktop: Reset and Fit Controls -->
        <div class="hidden lg:flex items-center space-x-2">
          <button
            class="tool-button w-8 h-8 flex items-center justify-center text-xs px-1"
            on:click={onResetZoom}
            title="Reset zoom to 120%"
          >
            <span class="font-medium text-xs">Reset</span>
          </button>

          <button
            class="tool-button h-8 w-auto flex items-center justify-center text-xs px-2"
            on:click={onFitToWidth}
            title="Fit to width"
          >
            <span class="font-medium text-xs">Fit W</span>
          </button>

          <button
            class="tool-button h-8 w-auto flex items-center justify-center text-xs px-2"
            on:click={onFitToHeight}
            title="Fit to height"
          >
            <span class="font-medium text-xs">Fit H</span>
          </button>
        </div>
      </div>

      <!-- Center section: Drawing tools (hidden on small screens) -->
      <div class="hidden lg:flex items-center space-x-2">
        <button
          class="tool-button w-8 h-8 flex items-center justify-center"
          class:active={$drawingState.tool === 'pencil'}
          on:click={() => handleToolChange('pencil')}
          title="Pencil (1)"
        >
          <Edit3 size={14} />
        </button>

        <button
          class="tool-button w-8 h-8 flex items-center justify-center"
          class:active={$drawingState.tool === 'eraser'}
          on:click={() => handleToolChange('eraser')}
          title="Eraser (2)"
        >
          <Square size={14} />
        </button>

        <button
          class="tool-button w-8 h-8 flex items-center justify-center"
          class:active={$drawingState.tool === 'text'}
          on:click={() => handleToolChange('text')}
          title="Text (3)"
        >
          <Type size={14} />
        </button>

        <button
          class="tool-button w-8 h-8 flex items-center justify-center"
          class:active={$drawingState.tool === 'arrow'}
          on:click={() => handleToolChange('arrow')}
          title="Arrow (4)"
        >
          <ArrowRight size={14} />
        </button>

        <button
          class="tool-button w-8 h-8 flex items-center justify-center"
          class:active={$drawingState.tool === 'highlight'}
          on:click={() => handleToolChange('highlight')}
          title="Highlighter (8)"
        >
          <Highlighter size={14} />
        </button>

        <button
          class="tool-button w-8 h-8 flex items-center justify-center"
          class:active={$drawingState.tool === 'note'}
          on:click={() => handleToolChange('note')}
          title="Sticky Note (9)"
        >
          <StickyNote size={14} />
        </button>

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Stamp tool with palette -->
        <div class="relative stamp-palette-container">
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:active={$drawingState.tool === 'stamp'}
            on:click={() => {
              handleToolChange('stamp');
              showStampPalette = !showStampPalette;
            }}
            title="Stamps/Stickers"
          >
            <Sticker size={14} />
          </button>

          <StampPalette 
            isOpen={showStampPalette} 
            onClose={() => showStampPalette = false}
          />
        </div>

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Page Thumbnails Toggle -->
        <button
          class="tool-button w-8 h-8 flex items-center justify-center"
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
            class="tool-button w-11 h-11 lg:w-8 lg:h-8 p-1"
            on:click={() => showColorPalette = !showColorPalette}
            title="Drawing color"
            aria-label="Choose drawing color"
          >
            <div 
              class="w-full h-full rounded-md border border-white shadow-inner"
              style="background-color: {$drawingState.color}"
            ></div>
          </button>

          {#if showColorPalette}
            <div class="absolute top-full mt-2 left-0 z-50">
              <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]">
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

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Line width picker -->
        <div class="relative line-width-container">
          <button
            class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
            on:click={() => showLineWidthPicker = !showLineWidthPicker}
            title="Brush size"
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
              class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
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

      <!-- Right section: Undo, Redo, Search, Download (Always visible) + More menu (Mobile) -->
      <div class="flex items-center space-x-2">
        <!-- Undo, Redo, Search, Download - Always visible -->
        <div class="flex items-center space-x-2">
          <button
            class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
            class:opacity-50={$undoStack.length === 0}
            disabled={$undoStack.length === 0}
            on:click={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} class="lg:w-3.5 lg:h-3.5" />
          </button>

          <button
            class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
            class:opacity-50={$redoStack.length === 0}
            disabled={$redoStack.length === 0}
            on:click={handleRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} class="lg:w-3.5 lg:h-3.5" />
          </button>

          <button
            class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center group"
            title="Search PDF documents"
            on:click={handleSearchLinkClick}
          >
            <Search size={18} class="group-hover:text-blue-600 lg:w-4 lg:h-4" />
          </button>

          <!-- Delete changes (trash icon) -->
          <button
            class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            class:opacity-50={!$pdfState.document}
            disabled={!$pdfState.document}
            on:click={handleClear}
            title="Delete all changes"
          >
            <Trash2 size={16} class="lg:w-3.5 lg:h-3.5" />
          </button>

          <button
            class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center text-sage hover:bg-sage/10"
            class:opacity-50={!$pdfState.document}
            disabled={!$pdfState.document}
            on:click={onExportPDF}
            title="Export annotated PDF"
          >
            <Download size={16} class="lg:w-3.5 lg:h-3.5" />
          </button>
        </div>

        <!-- Desktop: Current tool indicator, Light/Dark mode -->
        <div class="hidden lg:flex items-center space-x-2">
          <!-- Current tool indicator -->
          <div class="flex items-center space-x-2 px-3 py-1.5 rounded-lg">
            <span class="text-sm text-charcoal dark:text-gray-200 capitalize">{$drawingState.tool}</span>
            <span class="text-xs text-charcoal/70 dark:text-gray-400">
              {$drawingState.tool === 'eraser' ? $drawingState.eraserSize : $drawingState.lineWidth}px
            </span>
          </div>

          <!-- Light/Dark mode toggle -->
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            on:click={toggleTheme}
            title="Toggle light/dark mode"
          >
            {#if $isDarkMode}
              🌞
            {:else}
              🌙
            {/if}
          </button>
        </div>

        <!-- Mobile: Current tool indicator, Light/Dark mode -->
        <div class="flex items-center space-x-2 lg:hidden">
          <!-- Current tool indicator -->
          <div class="flex items-center space-x-2 px-3 py-2 bg-sage/10 rounded-lg">
            <span class="text-xs text-sage font-medium">{$drawingState.tool}</span>
            <span class="text-xs text-charcoal/70 dark:text-gray-400">
              {Math.max($drawingState.tool === 'eraser' ? $drawingState.eraserSize : $drawingState.lineWidth, 1)}px
            </span>
          </div>

          <!-- Light/Dark mode toggle -->
          <button
            class="tool-button w-11 h-11 items-center justify-center"
            on:click={toggleTheme}
            title="Toggle light/dark mode"
          >
            {#if $isDarkMode}
              <Sun size={16} />
            {:else}
              <Moon size={16} />
            {/if}
          </button>
        </div>

        <!-- More menu (3-dot icon) for mobile -->
        <div class="relative lg:hidden">
          <button
            class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
            on:click={() => showMoreMenu = !showMoreMenu}
            title="More options"
            aria-label="More options"
          >
            <MoreHorizontal size={18} class="lg:w-4 lg:h-4" />
          </button>

          {#if showMoreMenu}
            <div class="absolute top-full mt-2 right-0 z-50 min-w-[200px]">
              <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3">
                <!-- Current tool info -->
                <div class="mb-3 p-2 bg-sage/10 rounded-lg">
                  <div class="text-xs text-sage font-medium mb-1">Current Tool</div>
                  <div class="text-sm text-charcoal dark:text-gray-200 capitalize">{$drawingState.tool}</div>
                  <div class="text-xs text-charcoal/70 dark:text-gray-400">
                    {$drawingState.tool === 'eraser' ? $drawingState.eraserSize : $drawingState.lineWidth}px
                  </div>
                </div>

                <!-- File operations -->
                <div class="space-y-1 mb-3">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    on:click={() => { handleFileSelect(); showMoreMenu = false; }}
                  >
                    📁 Open other file
                  </button>
                </div>

                <!-- Zoom controls -->
                <div class="space-y-1 mb-3">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    on:click={() => { onResetZoom(); showMoreMenu = false; }}
                  >
                    🔍 Reset size
                  </button>
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    on:click={() => { onFitToWidth(); showMoreMenu = false; }}
                  >
                    ↔️ Fit width
                  </button>
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    on:click={() => { onFitToHeight(); showMoreMenu = false; }}
                  >
                    ↕️ Fit height
                  </button>
                </div>

                <!-- Navigation -->
                <div class="space-y-1 mb-3">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    class:opacity-50={$pdfState.currentPage <= 1}
                    disabled={$pdfState.currentPage <= 1}
                    on:click={() => { onPreviousPage(); showMoreMenu = false; }}
                  >
                    ⬅️ Previous page
                  </button>
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    class:opacity-50={$pdfState.currentPage >= $pdfState.totalPages}
                    disabled={$pdfState.currentPage >= $pdfState.totalPages}
                    on:click={() => { onNextPage(); showMoreMenu = false; }}
                  >
                    ➡️ Next page
                  </button>
                </div>

                <!-- Actions -->
                <div class="space-y-1 mb-3">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    on:click={() => { handleClear(); showMoreMenu = false; }}
                  >
                    🗑️ Delete changes
                  </button>
                </div>

                <!-- Theme toggle -->
                <div class="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    on:click={() => { toggleTheme(); showMoreMenu = false; }}
                  >
                    {#if $isDarkMode}
                      🌞 Light mode
                    {:else}
                      🌙 Dark mode
                    {/if}
                  </button>
                </div>

                <!-- Credit -->
                <div class="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div class="flex items-center justify-between p-2">
                    <span class="text-xs text-charcoal/60 dark:text-gray-400">Made by Rudi K</span>
                    <a 
                      href="https://github.com/rudi-q/leed_pdf_viewer" 
                      target="_blank" 
                      rel="noopener"
                      class="text-charcoal/60 dark:text-gray-400 hover:text-sage dark:hover:text-sage transition-colors"
                      title="View on GitHub"
                      aria-label="View on GitHub"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.30 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>


      </div>
    </div>
  </div>
</div>

<!-- Bottom Toolbar - Drawing tools for small screens -->
<div class="toolbar-bottom fixed bottom-4 left-4 right-4 z-50 lg:hidden">
  <div class="floating-panel !py-2 !px-3 overflow-x-auto relative">

    
    <!-- Left fade indicator -->
    <div class="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white/80 dark:from-gray-800/80 to-transparent pointer-events-none z-[5]" class:opacity-0={!showLeftFade}></div>
    
    <!-- Right fade indicator -->
    <div class="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/80 dark:from-gray-800/80 to-transparent pointer-events-none z-[5]" class:opacity-0={!showRightFade}></div>
    
    <div class="flex items-center space-x-2 min-w-max px-2" bind:this={toolbarScrollContainer} on:scroll={handleToolbarScroll}>
      <!-- Drawing tools -->
      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'pencil'}
        on:click={() => handleToolChange('pencil')}
        title="Pencil (1)"
      >
        <Edit3 size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'eraser'}
        on:click={() => handleToolChange('eraser')}
        title="Eraser (2)"
      >
        <Square size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'text'}
        on:click={() => handleToolChange('text')}
        title="Text (3)"
      >
        <Type size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'arrow'}
        on:click={() => handleToolChange('arrow')}
        title="Arrow (4)"
      >
        <ArrowRight size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'highlight'}
        on:click={() => handleToolChange('highlight')}
        title="Highlighter (8)"
      >
        <Highlighter size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'note'}
        on:click={() => handleToolChange('note')}
        title="Sticky Note (9)"
      >
        <StickyNote size={16} />
      </button>

      <div class="h-6 w-px bg-charcoal/20"></div>

      <!-- Stamp tool -->
      <div class="relative stamp-palette-container">
        <button
          class="tool-button flex items-center justify-center"
          class:active={$drawingState.tool === 'stamp'}
          on:click={() => {
            handleToolChange('stamp');
            showStampPalette = !showStampPalette;
          }}
          title="Stamps/Stickers"
        >
          <Sticker size={16} />
        </button>
        
        <StampPalette 
          isOpen={showStampPalette} 
          onClose={() => showStampPalette = false}
        />
      </div>

      <div class="h-6 w-px bg-charcoal/20"></div>

      <!-- Page Thumbnails Toggle -->
      <button
        class="tool-button flex items-center justify-center"
        class:active={showThumbnails}
        on:click={() => onToggleThumbnails(!showThumbnails)}
        title="Page Thumbnails (T)"
      >
        <Layout size={16} />
      </button>

      <div class="h-6 w-px bg-charcoal/20"></div>

      <!-- Color picker -->
      <div class="relative color-palette-container">
        <button
          class="tool-button w-8 h-8 p-1 flex items-center justify-center"
          on:click={() => showColorPalette = !showColorPalette}
          title="Drawing color"
          aria-label="Choose drawing color"
        >
          <div 
            class="w-full h-full rounded-md border border-white shadow-inner"
            style="background-color: {$drawingState.color}"
          ></div>
        </button>
      </div>

      <!-- Line width picker -->
      <div class="relative line-width-container">
        <button
          class="tool-button flex items-center justify-center"
          on:click={() => showLineWidthPicker = !showLineWidthPicker}
          title="Brush size"
          aria-label="Choose line thickness"
        >
          <div 
            class="rounded-full bg-charcoal"
            style="width: {Math.max($drawingState.lineWidth * 2, 4)}px; height: {Math.max($drawingState.lineWidth * 2, 4)}px;"
          ></div>
        </button>
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
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Mobile Dropdowns - Positioned outside toolbar to prevent clipping -->

{#if showStampPalette}
  <div class="fixed bottom-20 left-4 z-[70] lg:hidden">
    <div class="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-600/50 p-3 min-w-[280px]">
      <div class="mb-2">
        <h3 class="text-sm font-medium text-charcoal/80 dark:text-gray-200 mb-3 text-center">Choose a Stamp</h3>
        <div class="flex flex-wrap gap-3 justify-center">
          {#each availableStamps as stamp}
            <button
              class="sticker-preview group relative transition-all duration-300 hover:scale-110 hover:rotate-2 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:ring-offset-2 {stamp.id === $drawingState.stampId ? 'scale-110' : ''}"
              on:click={() => handleStampSelect(stamp)}
              title={stamp.name}
            >
              <!-- SVG sticker with built-in realistic border -->
              <div class="w-12 h-12 transition-transform duration-300 group-hover:scale-110">
                {@html stamp.svg}
              </div>
              
              <!-- Selection indicator -->
              {#if stamp.id === $drawingState.stampId}
                <div class="absolute -inset-1 border-2 border-sage rounded-xl animate-pulse"></div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
      
      <div class="border-t border-gray-200/50 dark:border-gray-600/50 pt-2 mt-2">
        <div class="text-center">
          <span class="text-xs text-charcoal/60 dark:text-gray-400">
            Perfect for feedback & grading ✨
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showColorPalette}
  <div class="fixed bottom-20 left-4 z-[70] lg:hidden">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]">
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

{#if showLineWidthPicker}
  <div class="fixed bottom-20 left-4 z-[70] lg:hidden">
    <div class="floating-panel animate-slide-up">
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
  </div>
{/if}

{#if showEraserSizePicker}
  <div class="fixed bottom-20 left-4 z-[70] lg:hidden">
    <div class="floating-panel animate-slide-up">
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
  </div>
{/if}

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
  .toolbar-top,
  .toolbar-bottom {
    pointer-events: none;
  }
  
  .toolbar-top > *,
  .toolbar-bottom > * {
    pointer-events: auto;
  }
  
  .floating-panel {
    backdrop-filter: blur(20px);
  }
</style>
