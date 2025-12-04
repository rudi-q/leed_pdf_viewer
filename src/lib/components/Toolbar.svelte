<script lang="ts">
  import {
    availableColors,
    availableEraserSizes,
    availableFonts,
    availableHighlightColors,
    availableLineWidths,
    availableStamps,
    clearCurrentPageDrawings,
    drawingPaths,
    drawingState,
    type DrawingTool,
    pdfState,
    redo,
    redoStack,
    selectedTextAnnotationId,
    setColor,
    setEraserSize,
    setHighlightColor,
    setLineWidth,
    setStampId,
    setTextFontFamily,
    setTool,
    undo,
    undoStack,
    updateTextAnnotationFont
  } from '../stores/drawingStore';
  import { isDarkMode, toggleTheme } from '../stores/themeStore';
  import { hasParityBanner } from '../stores/parityBannerStore';
  import { handleSearchLinkClick } from '../utils/navigationUtils';
  import { trackToolSelection } from '../utils/analytics';
  import { goto } from '$app/navigation';
  import StampPalette from './StampPalette.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import {
    ArrowLeftRight,
    ArrowRight,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit3,
    Eraser,
    FileText,
    Folder,
    Highlighter,
    Layout,
    Moon,
    MoreHorizontal,
    MousePointerClick,
    Package,
    Redo2,
    RotateCcw,
    Search,
    Share,
    Square,
    Stamp,
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

  // Close highlight color picker when tool changes away from 'highlight'
  $: if ($drawingState.tool !== 'highlight' && showHighlightColorPicker) {
    showHighlightColorPicker = false;
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
	export let onExportLPDF: () => void;
	export let onExportDOCX: () => void;
	export let onSharePDF: (() => void) | undefined = undefined;
  
  // Thumbnail panel control
  export let showThumbnails = false;
  export let onToggleThumbnails: (show: boolean) => void;
  export let isSharedView = false;
  export let viewOnlyMode = false;
  export let allowDownloading = true;

  let fileInput: HTMLInputElement;
  let showColorPalette = false;
  let showHighlightColorPicker = false;
  let showLineWidthPicker = false;
  let showEraserSizePicker = false;
  let showStampPalette = false;
  let showFontPicker = false;
  let showMoreMenu = false;
  let showExportMenu = false;
  let toolbarScrollContainer: HTMLDivElement;
  let showLeftFade = false;
  let showRightFade = true;

  function handleToolChange(tool: DrawingTool) {
    const previousTool = $drawingState.tool;
    setTool(tool);
    
    // Track tool selection
    trackToolSelection(tool, previousTool);
  }

  function handleColorChange(color: string) {
    setColor(color);
    showColorPalette = false;
  }

  function handleHighlightColorChange(color: string) {
    setHighlightColor(color);
    showHighlightColorPicker = false;
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

  function handleFontChange(fontFamily: string) {
    setTextFontFamily(fontFamily);
    
    // If a text annotation is selected, update its font too
    if ($selectedTextAnnotationId) {
      updateTextAnnotationFont($selectedTextAnnotationId, $pdfState.currentPage, fontFamily);
    }
    
    showFontPicker = false;
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
    if (!target.closest('.highlight-color-container')) {
      showHighlightColorPicker = false;
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
    if (!target.closest('.font-picker-container')) {
      showFontPicker = false;
    }
    if (!target.closest('.export-menu-container')) {
      showExportMenu = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<!-- Hidden file inputs -->
<input
  bind:this={fileInput}
  type="file"
  accept=".pdf,.lpdf,.md,.markdown"
  on:change={handleFileChange}
  class="hidden"
  aria-hidden="true"
/>


<!-- Top Toolbar - Always visible -->
<div class="toolbar-top left-4 right-4 z-50" class:fixed={!$hasParityBanner} class:absolute={$hasParityBanner} class:top-2={!$hasParityBanner}>
  <div class="floating-panel !py-1 !px-3">

    
    <div class="flex items-center justify-between">
      <!-- Left section: Logo, Folder, Page Navigation, Zoom Controls, Reset/Fit (Desktop) -->
      <div class="flex items-center space-x-2">
        <!-- Logo -->
        <Tooltip content="Go to homepage">
          <button
            class="flex items-center hover:opacity-80 transition-opacity cursor-pointer w-11 h-11 lg:w-8 lg:h-8 justify-center"
            on:click={handleLogoClick}
            aria-label="Go to homepage"
          >
            <enhanced:img src="/static/./favicon.png" alt="LeedPDF" class="w-5 h-5 lg:w-4 lg:h-4" />
          </button>
        </Tooltip>
        
        <div class="h-4 w-px bg-charcoal/20"></div>
        
        <!-- Desktop: Folder icon -->
        <div class="hidden lg:block">
        <Tooltip content="Upload PDF (U)">
            <button
              class="tool-button w-8 h-8 flex items-center justify-center"
              on:click={handleFileSelect}
              aria-label="Upload PDF"
            >
              <Folder size={14} />
            </button>
          </Tooltip>
        </div>

        <!-- Desktop: Page Navigation -->
        <div class="hidden lg:flex items-center space-x-2">
        <Tooltip content="Previous page (←)">
            <button
              class="tool-button w-8 h-8 flex items-center justify-center"
              class:opacity-50={$pdfState.currentPage <= 1}
              disabled={$pdfState.currentPage <= 1}
              on:click={onPreviousPage}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
          </Tooltip>

        <Tooltip content="Next page (→)">
            <button
              class="tool-button w-8 h-8 flex items-center justify-center"
              class:opacity-50={$pdfState.currentPage >= $pdfState.totalPages}
              disabled={$pdfState.currentPage >= $pdfState.totalPages}
              on:click={onNextPage}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </Tooltip>

          <!-- Page Thumbnails Toggle -->
          <Tooltip content="Page Thumbnails (T)">
            <button
              class="tool-button w-8 h-8 flex items-center justify-center"
              class:active={showThumbnails}
              on:click={() => onToggleThumbnails(!showThumbnails)}
              aria-label="Toggle page thumbnails"
            >
              <Layout size={14} />
            </button>
          </Tooltip>

        </div>

        <!-- Desktop: Zoom Controls -->
        <div class="hidden lg:flex items-center space-x-2">
          <Tooltip content="Zoom out (Ctrl+-)">
            <button
              class="tool-button w-8 h-8 flex items-center justify-center"
              on:click={onZoomOut}
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
          </Tooltip>

          <Tooltip content="Zoom in (Ctrl++)">
            <button
              class="tool-button w-8 h-8 flex items-center justify-center"
              on:click={onZoomIn}
              aria-label="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </Tooltip>
        </div>

        <!-- Desktop: Reset and Fit Controls -->
        <div class="hidden lg:flex items-center space-x-2">

          <Tooltip content="Reset zoom to 120% (Ctrl+0)">
            <button
              class="tool-button w-8 h-8 flex items-center justify-center text-xs px-1"
              on:click={onResetZoom}
              aria-label="Reset zoom to 120%"
            >
              <span class="font-medium text-xs">Reset</span>
            </button>
          </Tooltip>

          <Tooltip content="Fit to width (W)">
            <button
              class="tool-button h-8 w-auto flex items-center justify-center text-xs px-2"
              on:click={onFitToWidth}
              aria-label="Fit to width"
            >
              <span class="font-medium text-xs">Fit W</span>
            </button>
          </Tooltip>

          <Tooltip content="Fit to height (H)">
            <button
              class="tool-button h-8 w-auto flex items-center justify-center text-xs px-2"
              on:click={onFitToHeight}
              aria-label="Fit to height"
            >
              <span class="font-medium text-xs">Fit H</span>
            </button>
          </Tooltip>
        </div>
      </div>

      <!-- Center section: Drawing tools (hidden on small screens) -->
      <div class="hidden lg:flex items-center space-x-2" class:opacity-50={viewOnlyMode}>
        <Tooltip content={viewOnlyMode ? 'Drawing disabled in view-only mode' : 'Pencil (1)'}>
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:active={$drawingState.tool === 'pencil'}
            disabled={viewOnlyMode}
            on:click={() => !viewOnlyMode && handleToolChange('pencil')}
            aria-label={viewOnlyMode ? 'Drawing disabled in view-only mode' : 'Pencil tool'}
          >
            <Edit3 size={14} />
          </button>
        </Tooltip>

        <Tooltip content={viewOnlyMode ? 'Eraser disabled in view-only mode' : 'Eraser (2)'}>
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:active={$drawingState.tool === 'eraser'}
            disabled={viewOnlyMode}
            on:click={() => !viewOnlyMode && handleToolChange('eraser')}
            aria-label={viewOnlyMode ? 'Eraser disabled in view-only mode' : 'Eraser tool'}
          >
            <Eraser size={14} />
          </button>
        </Tooltip>

        <Tooltip content={viewOnlyMode ? 'Text tool disabled in view-only mode' : 'Text (3)'}>
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:active={$drawingState.tool === 'text'}
            disabled={viewOnlyMode}
            on:click={() => !viewOnlyMode && handleToolChange('text')}
            aria-label={viewOnlyMode ? 'Text tool disabled in view-only mode' : 'Text tool'}
          >
            <Type size={14} />
          </button>
        </Tooltip>

        <!-- Font picker (only visible when text tool is active) -->
        {#if $drawingState.tool === 'text'}
          <div class="relative font-picker-container">
            <Tooltip content="Text font">
              <button
                class="tool-button h-8 px-2 flex items-center justify-center gap-1 text-xs font-medium"
                on:click={() => showFontPicker = !showFontPicker}
                aria-label="Choose text font"
                style="font-family: {$drawingState.textFontFamily};"
              >
                <span class="truncate max-w-[60px]">
                  {availableFonts.find(f => f.fontFamily === $drawingState.textFontFamily)?.name || 'Font'}
                </span>
                <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </Tooltip>

            {#if showFontPicker}
              <div class="absolute top-full mt-2 left-0 z-50">
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[140px]">
                  <div class="flex flex-col gap-1">
                    {#each availableFonts as font}
                      <button
                        class="w-full px-3 py-2 text-left rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
                        class:bg-sage={font.fontFamily === $drawingState.textFontFamily}
                        class:text-white={font.fontFamily === $drawingState.textFontFamily}
                        class:bg-opacity-20={font.fontFamily === $drawingState.textFontFamily}
                        style="font-family: {font.fontFamily};"
                        on:click={() => handleFontChange(font.fontFamily)}
                        aria-label="Select font {font.name}"
                      >
                        <span class="text-sm">{font.name}</span>
                      </button>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <Tooltip content={viewOnlyMode ? 'Arrow tool disabled in view-only mode' : 'Arrow (4)'}>
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:active={$drawingState.tool === 'arrow'}
            disabled={viewOnlyMode}
            on:click={() => !viewOnlyMode && handleToolChange('arrow')}
            aria-label={viewOnlyMode ? 'Arrow tool disabled in view-only mode' : 'Arrow tool'}
          >
            <ArrowRight size={14} />
          </button>
        </Tooltip>

        <Tooltip content={viewOnlyMode ? 'Highlighter disabled in view-only mode' : 'Highlighter (5)'}>
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:active={$drawingState.tool === 'highlight'}
            disabled={viewOnlyMode}
            on:click={() => !viewOnlyMode && handleToolChange('highlight')}
            aria-label={viewOnlyMode ? 'Highlighter disabled in view-only mode' : 'Highlighter tool'}
          >
            <Highlighter size={14} />
          </button>
        </Tooltip>

        <Tooltip content={viewOnlyMode ? 'Sticky note disabled in view-only mode' : 'Sticky Note (6)'}>
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:active={$drawingState.tool === 'note'}
            disabled={viewOnlyMode}
            on:click={() => !viewOnlyMode && handleToolChange('note')}
            aria-label={viewOnlyMode ? 'Sticky note disabled in view-only mode' : 'Sticky note tool'}
          >
            <StickyNote size={14} />
          </button>
        </Tooltip>

        <Tooltip content="Select Text (7)">
          <button
            class="tool-button w-8 h-8 flex items-center justify-center"
            class:active={$drawingState.tool === 'select'}
            on:click={() => handleToolChange('select')}
            aria-label="Select text tool"
          >
            <MousePointerClick size={14} />
          </button>
        </Tooltip>

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Stamp tool with palette -->
        <div class="relative stamp-palette-container">
          <Tooltip content={viewOnlyMode ? 'Stamps disabled in view-only mode' : 'Stamps/Stickers (S)'}>
            <button
              class="tool-button w-8 h-8 flex items-center justify-center"
              class:active={$drawingState.tool === 'stamp'}
              disabled={viewOnlyMode}
              on:click={() => {
                if (!viewOnlyMode) {
                  handleToolChange('stamp');
                  showStampPalette = !showStampPalette;
                }
              }}
              aria-label={viewOnlyMode ? 'Stamps disabled in view-only mode' : 'Stamps and stickers'}
            >
              <Stamp size={14} />
            </button>
          </Tooltip>

          <StampPalette 
            isOpen={showStampPalette} 
            onClose={() => showStampPalette = false}
          />
        </div>

        <div class="h-4 w-px bg-charcoal/20"></div>

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Color picker (hidden when highlighter tool is active) -->
        {#if $drawingState.tool !== 'highlight'}
          <div class="relative color-palette-container">
            <Tooltip content="Drawing color">
              <button
                class="tool-button w-11 h-11 lg:w-8 lg:h-8 p-1"
                on:click={() => showColorPalette = !showColorPalette}
                aria-label="Choose drawing color"
              >
                <div 
                  class="w-full h-full rounded-md border border-white shadow-inner"
                  style="background-color: {$drawingState.color}"
                ></div>
              </button>
            </Tooltip>

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
        {/if}

        <!-- Highlight color picker (only visible when highlight tool is active) -->
        {#if $drawingState.tool === 'highlight'}
          <div class="relative highlight-color-container">
            <Tooltip content="Highlight color">
              <button
                class="tool-button w-11 h-11 lg:w-8 lg:h-8 p-1"
                on:click={() => showHighlightColorPicker = !showHighlightColorPicker}
                aria-label="Choose highlight color"
              >
                <div 
                  class="w-full h-full rounded-md border border-white shadow-inner opacity-60"
                  style="background-color: {$drawingState.highlightColor}"
                ></div>
              </button>
            </Tooltip>

            {#if showHighlightColorPicker}
              <div class="absolute top-full mt-2 left-0 z-50">
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]">
                  <h3 class="text-xs font-medium text-charcoal/80 dark:text-gray-300 mb-3 text-center">Highlight Color</h3>
                  <div class="grid grid-cols-4 gap-3">
                    {#each availableHighlightColors as color}
                      <button
                        class="w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 opacity-60 hover:opacity-80"
                        class:border-sage={color === $drawingState.highlightColor}
                        class:border-gray-300={color !== $drawingState.highlightColor}
                        class:scale-110={color === $drawingState.highlightColor}
                        class:shadow-lg={color === $drawingState.highlightColor}
                        class:opacity-80={color === $drawingState.highlightColor}
                        style="background-color: {color}"
                        on:click={() => handleHighlightColorChange(color)}
                        aria-label="Select highlight color {color}"
                      >
                        {#if color === $drawingState.highlightColor}
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
        {/if}

        <div class="h-4 w-px bg-charcoal/20"></div>

        <!-- Line width picker -->
        <div class="relative line-width-container">
          <Tooltip content="Brush size">
            <button
              class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
              on:click={() => showLineWidthPicker = !showLineWidthPicker}
              aria-label="Choose line thickness"
            >
            <div 
              class="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
              style="width: {Math.max($drawingState.lineWidth * 2 + 4, 8)}px; height: {Math.max($drawingState.lineWidth * 2 + 4, 8)}px;"
            >
                <div 
                  class="rounded-full bg-charcoal w-full h-full"
                ></div>
              </div>
            </button>
          </Tooltip>

          {#if showLineWidthPicker}
            <div class="absolute top-full mt-2 left-0 floating-panel animate-slide-up">
              <div class="flex flex-col space-y-2 p-2">
                {#each availableLineWidths as width}
                  <button
                    class="flex items-center justify-center p-2 rounded-lg hover:bg-sage/10 transition-colors"
                    class:bg-sage={width === $drawingState.lineWidth}
                    on:click={() => handleLineWidthChange(width)}
                    aria-label="Line width {width} pixels"
                  >
                    <div 
                      class="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
                      style="width: {Math.max(width * 2 + 4, 8)}px; height: {Math.max(width * 2 + 4, 8)}px;"
                    >
                      <div 
                        class="rounded-full bg-charcoal w-full h-full"
                      ></div>
                    </div>
                    <span class="ml-2 text-sm text-charcoal dark:text-gray-200">{width}px</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Eraser size picker -->
        {#if $drawingState.tool === 'eraser'}
          <div class="relative eraser-size-container">
            <Tooltip content="Eraser size">
              <button
                class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
                on:click={() => showEraserSizePicker = !showEraserSizePicker}
                aria-label="Choose eraser size"
              >
              <div 
                class="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
                style="width: {Math.max($drawingState.eraserSize / 2 + 4, 10)}px; height: {Math.max($drawingState.eraserSize / 2 + 4, 10)}px;"
              >
                  <div 
                    class="rounded-full bg-charcoal opacity-50 w-full h-full"
                  ></div>
                </div>
              </button>
            </Tooltip>

            {#if showEraserSizePicker}
              <div class="absolute top-full mt-2 left-0 floating-panel animate-slide-up">
                <div class="flex flex-col space-y-2 p-2">
                  {#each availableEraserSizes as size}
                    <button
                      class="flex items-center justify-center p-2 rounded-lg hover:bg-sage/10 transition-colors"
                      class:bg-sage={size === $drawingState.eraserSize}
                      on:click={() => handleEraserSizeChange(size)}
                      aria-label="Eraser size {size} pixels"
                    >
                      <div 
                        class="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
                        style="width: {Math.max(size / 2 + 4, 10)}px; height: {Math.max(size / 2 + 4, 10)}px;"
                      >
                        <div 
                          class="rounded-full bg-charcoal opacity-50 w-full h-full"
                        ></div>
                      </div>
                      <span class="ml-2 text-sm text-charcoal dark:text-gray-200">{size}px</span>
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
          <Tooltip content={viewOnlyMode ? 'Undo disabled in view-only mode' : 'Undo (Ctrl+Z)'}>
            <button
              class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
              class:opacity-50={$undoStack.length === 0 || viewOnlyMode}
              disabled={$undoStack.length === 0 || viewOnlyMode}
              on:click={handleUndo}
              aria-label={viewOnlyMode ? 'Undo disabled in view-only mode' : 'Undo last action'}
            >
              <Undo2 size={16} class="lg:w-3.5 lg:h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content={viewOnlyMode ? 'Redo disabled in view-only mode' : 'Redo (Ctrl+Y)'}>
            <button
              class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
              class:opacity-50={$redoStack.length === 0 || viewOnlyMode}
              disabled={$redoStack.length === 0 || viewOnlyMode}
              on:click={handleRedo}
              aria-label={viewOnlyMode ? 'Redo disabled in view-only mode' : 'Redo last action'}
            >
              <Redo2 size={16} class="lg:w-3.5 lg:h-3.5" />
            </button>
          </Tooltip>

          <Tooltip content="Search PDF documents">
            <button
              class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center group"
              on:click={handleSearchLinkClick}
              aria-label="Search PDF documents"
            >
              <Search size={18} class="group-hover:text-blue-600 lg:w-4 lg:h-4" />
            </button>
          </Tooltip>

          <!-- Delete changes (trash icon) -->
          <Tooltip content={viewOnlyMode ? 'Clear disabled in view-only mode' : 'Delete all changes'}>
            <button
              class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              class:opacity-50={!$pdfState.document || viewOnlyMode}
              disabled={!$pdfState.document || viewOnlyMode}
              on:click={handleClear}
              aria-label={viewOnlyMode ? 'Clear disabled in view-only mode' : 'Delete all changes on this page'}
            >
              <Trash2 size={16} class="lg:w-3.5 lg:h-3.5" />
            </button>
          </Tooltip>

          <!-- Share Button (if not in shared view) -->
          {#if onSharePDF && !isSharedView}
            <Tooltip content="Share PDF with link">
              <button
                class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                class:opacity-50={!$pdfState.document}
                disabled={!$pdfState.document}
                on:click={onSharePDF}
                aria-label="Share PDF with link"
              >
                <Share size={16} class="lg:w-3.5 lg:h-3.5" />
              </button>
            </Tooltip>
          {/if}

          <!-- Export Menu -->
          {#if allowDownloading}
            <div class="relative export-menu-container">
              <Tooltip content="Export options">
                <button
                  class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center text-sage hover:bg-sage/10"
                  class:opacity-50={!$pdfState.document}
                  disabled={!$pdfState.document}
                  on:click={() => showExportMenu = !showExportMenu}
                  aria-label="Export options"
                >
                  <Download size={16} class="lg:w-3.5 lg:h-3.5" />
                </button>
              </Tooltip>

            {#if showExportMenu}
              <div class="absolute top-full mt-2 right-0 z-50 min-w-[180px]">
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-2">
                  {#if onSharePDF && !isSharedView}
                    <button
                      class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                      class:opacity-50={!$pdfState.document}
                      disabled={!$pdfState.document}
                      on:click={() => { onSharePDF(); showExportMenu = false; }}
                    >
                      <Share size={16} class="text-blue-600" />
                      Share with Link
                    </button>
                    <div class="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                  {/if}
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    on:click={() => { onExportPDF(); showExportMenu = false; }}
                  >
                    <Download size={16} class="text-sage" />
                    Export as PDF
                  </button>
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    on:click={() => { onExportLPDF(); showExportMenu = false; }}
                  >
                    <Package size={16} class="text-sage" />
                    Export as LPDF
                  </button>
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    on:click={() => { onExportDOCX(); showExportMenu = false; }}
                  >
                    <FileText size={16} class="text-blue-600" />
                    Export as DOCX
                  </button>
                </div>
              </div>
            {/if}
            </div>
          {/if}
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
          <Tooltip content="Toggle light/dark mode">
            <button
              class="tool-button w-8 h-8 flex items-center justify-center"
              on:click={toggleTheme}
              aria-label="Toggle light/dark mode"
            >
              {#if $isDarkMode}
                <Sun size={16} />
              {:else}
                <Moon size={16} />
              {/if}
            </button>
          </Tooltip>
        </div>

        <!-- Mobile: Current tool indicator, Light/Dark mode (Hidden) -->
        <div class="hidden lg:hidden">
          <!-- Current tool indicator -->
          <div class="flex items-center space-x-2 px-3 py-2 bg-sage/10 rounded-lg">
            <span class="text-xs text-sage font-medium">{$drawingState.tool}</span>
            <span class="text-xs text-charcoal/70 dark:text-gray-400">
              {Math.max($drawingState.tool === 'eraser' ? $drawingState.eraserSize : $drawingState.lineWidth, 1)}px
            </span>
          </div>

          <!-- Light/Dark mode toggle -->
          <Tooltip content="Toggle light/dark mode">
            <button
              class="tool-button w-11 h-11 items-center justify-center"
              on:click={toggleTheme}
              aria-label="Toggle light/dark mode"
            >
              {#if $isDarkMode}
                <Sun size={16} />
              {:else}
                <Moon size={16} />
              {/if}
            </button>
          </Tooltip>
        </div>

        <!-- More menu (3-dot icon) for mobile -->
        <div class="relative lg:hidden">
          <Tooltip content="More options">
            <button
              class="tool-button w-11 h-11 lg:w-8 lg:h-8 flex items-center justify-center"
              on:click={() => showMoreMenu = !showMoreMenu}
              aria-label="More options"
            >
              <MoreHorizontal size={18} class="lg:w-4 lg:h-4" />
            </button>
          </Tooltip>

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
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    on:click={() => { handleFileSelect(); showMoreMenu = false; }}
                  >
                    <FileText size={14} />
                    Open PDF file
                  </button>
                </div>

                <!-- Share and Export operations -->
                <div class="space-y-1 mb-3">
                  {#if onSharePDF && !isSharedView}
                    <button
                      class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                      class:opacity-50={!$pdfState.document}
                      disabled={!$pdfState.document}
                      on:click={() => { onSharePDF(); showMoreMenu = false; }}
                    >
                      <Share size={14} />
                      Share with Link
                    </button>
                  {/if}
                  {#if allowDownloading}
                    <button
                      class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                      class:opacity-50={!$pdfState.document}
                      disabled={!$pdfState.document}
                      on:click={() => { onExportPDF(); showMoreMenu = false; }}
                    >
                      <Download size={14} />
                      Export as PDF
                    </button>
                    <button
                      class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                      class:opacity-50={!$pdfState.document}
                      disabled={!$pdfState.document}
                      on:click={() => { onExportLPDF(); showMoreMenu = false; }}
                    >
                      <Package size={14} />
                      Export as LPDF
                    </button>
                    <button
                      class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                      class:opacity-50={!$pdfState.document}
                      disabled={!$pdfState.document}
                      on:click={() => { onExportDOCX(); showMoreMenu = false; }}
                    >
                      <FileText size={14} />
                      Export as DOCX
                    </button>
                  {/if}
                </div>

                <!-- Zoom controls -->
                <div class="space-y-1 mb-3">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    on:click={() => { onResetZoom(); showMoreMenu = false; }}
                  >
                    <RotateCcw size={14} />
                    Reset size
                  </button>
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    on:click={() => { onFitToWidth(); showMoreMenu = false; }}
                  >
                    <ArrowLeftRight size={14} />
                    Fit width
                  </button>
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    on:click={() => { onFitToHeight(); showMoreMenu = false; }}
                  >
                    <ArrowUpDown size={14} />
                    Fit height
                  </button>
                </div>

                <!-- Navigation -->
                <div class="space-y-1 mb-3">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    class:opacity-50={$pdfState.currentPage <= 1}
                    disabled={$pdfState.currentPage <= 1}
                    on:click={() => { onPreviousPage(); showMoreMenu = false; }}
                  >
                    <ChevronLeft size={14} />
                    Previous page
                  </button>
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    class:opacity-50={$pdfState.currentPage >= $pdfState.totalPages}
                    disabled={$pdfState.currentPage >= $pdfState.totalPages}
                    on:click={() => { onNextPage(); showMoreMenu = false; }}
                  >
                    <ChevronRight size={14} />
                    Next page
                  </button>
                </div>

                <!-- Actions -->
                <div class="space-y-1 mb-3">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm flex items-center gap-2"
                    on:click={() => { handleClear(); showMoreMenu = false; }}
                  >
                    <Trash2 size={14} />
                    Delete changes
                  </button>
                </div>

                <!-- Theme toggle -->
                <div class="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <button
                    class="w-full text-left p-2 rounded-lg hover:bg-sage/10 transition-colors text-sm"
                    on:click={() => { toggleTheme(); showMoreMenu = false; }}
                  >
                    <div class="flex items-center gap-2">
                      {#if $isDarkMode}
                        <Sun size={14} />
                        <span>Light mode</span>
                      {:else}
                        <Moon size={14} />
                        <span>Dark mode</span>
                      {/if}
                    </div>
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
        aria-label="Pencil tool"
      >
        <Edit3 size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'eraser'}
        on:click={() => handleToolChange('eraser')}
        aria-label="Eraser tool"
      >
        <Square size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'text'}
        on:click={() => handleToolChange('text')}
        aria-label="Text tool"
      >
        <Type size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'arrow'}
        on:click={() => handleToolChange('arrow')}
        aria-label="Arrow tool"
      >
        <ArrowRight size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'highlight'}
        on:click={() => handleToolChange('highlight')}
        aria-label="Highlighter tool"
      >
        <Highlighter size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'note'}
        on:click={() => handleToolChange('note')}
        aria-label="Sticky note tool"
      >
        <StickyNote size={16} />
      </button>

      <button
        class="tool-button flex items-center justify-center"
        class:active={$drawingState.tool === 'select'}
        on:click={() => handleToolChange('select')}
        aria-label="Select text tool"
      >
        <MousePointerClick size={16} />
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
          aria-label="Stamps and stickers"
        >
          <Sticker size={16} />
        </button>
        
        <StampPalette 
          isOpen={showStampPalette} 
          onClose={() => showStampPalette = false}
        />
      </div>

      <div class="h-6 w-px bg-charcoal/20"></div>

      <div class="h-6 w-px bg-charcoal/20"></div>

      <!-- Color picker (hidden when highlighter tool is active) -->
      {#if $drawingState.tool !== 'highlight'}
        <div class="relative color-palette-container">
          <button
            class="tool-button w-8 h-8 p-1 flex items-center justify-center"
            on:click={() => showColorPalette = !showColorPalette}
            aria-label="Choose drawing color"
          >
            <div 
              class="w-full h-full rounded-md border border-white shadow-inner"
              style="background-color: {$drawingState.color}"
            ></div>
          </button>
        </div>
      {/if}

      <!-- Highlight color picker (only visible when highlight tool is active) -->
      {#if $drawingState.tool === 'highlight'}
        <div class="relative highlight-color-container">
          <button
            class="tool-button w-8 h-8 p-1 flex items-center justify-center"
            on:click={() => showHighlightColorPicker = !showHighlightColorPicker}
            aria-label="Choose highlight color"
          >
            <div 
              class="w-full h-full rounded-md border border-white shadow-inner opacity-60"
              style="background-color: {$drawingState.highlightColor}"
            ></div>
          </button>
        </div>
      {/if}

      <!-- Line width picker -->
      <div class="relative line-width-container">
        <button
          class="tool-button flex items-center justify-center"
          on:click={() => showLineWidthPicker = !showLineWidthPicker}
          aria-label="Choose line thickness"
        >
          <div 
            class="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
            style="width: {Math.max($drawingState.lineWidth * 2 + 4, 8)}px; height: {Math.max($drawingState.lineWidth * 2 + 4, 8)}px;"
          >
            <div 
              class="rounded-full bg-charcoal w-full h-full"
            ></div>
          </div>
        </button>
      </div>

      <!-- Eraser size picker -->
      {#if $drawingState.tool === 'eraser'}
        <div class="relative eraser-size-container">
          <button
            class="tool-button flex items-center justify-center"
            on:click={() => showEraserSizePicker = !showEraserSizePicker}
            aria-label="Choose eraser size"
          >
            <div 
              class="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
              style="width: {Math.max($drawingState.eraserSize / 2 + 4, 10)}px; height: {Math.max($drawingState.eraserSize / 2 + 4, 10)}px;"
            >
              <div 
                class="rounded-full bg-charcoal opacity-50 w-full h-full"
              ></div>
            </div>
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
              aria-label={stamp.name}
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
            Perfect for feedback & grading
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

{#if showHighlightColorPicker}
  <div class="fixed bottom-20 left-4 z-[70] lg:hidden">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]">
      <h3 class="text-xs font-medium text-charcoal/80 dark:text-gray-300 mb-3 text-center">Highlight Color</h3>
      <div class="grid grid-cols-4 gap-3">
        {#each availableHighlightColors as color}
          <button
            class="w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 opacity-60 hover:opacity-80"
            class:border-sage={color === $drawingState.highlightColor}
            class:border-gray-300={color !== $drawingState.highlightColor}
            class:scale-110={color === $drawingState.highlightColor}
            class:shadow-lg={color === $drawingState.highlightColor}
            class:opacity-80={color === $drawingState.highlightColor}
            style="background-color: {color}"
            on:click={() => handleHighlightColorChange(color)}
            aria-label="Select highlight color {color}"
          >
            {#if color === $drawingState.highlightColor}
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
            aria-label="Line width {width} pixels"
          >
            <div 
              class="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
              style="width: {Math.max(width * 2 + 4, 8)}px; height: {Math.max(width * 2 + 4, 8)}px;"
            >
              <div 
                class="rounded-full bg-charcoal w-full h-full"
              ></div>
            </div>
            <span class="ml-2 text-sm text-charcoal dark:text-gray-200">{width}px</span>
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
            aria-label="Eraser size {size} pixels"
          >
            <div 
              class="rounded-full bg-white dark:bg-white p-0.5 border border-gray-200 dark:border-white/30"
              style="width: {Math.max(size / 2 + 4, 10)}px; height: {Math.max(size / 2 + 4, 10)}px;"
            >
              <div 
                class="rounded-full bg-charcoal opacity-50 w-full h-full"
              ></div>
            </div>
            <span class="ml-2 text-sm text-charcoal dark:text-gray-200">{size}px</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

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
