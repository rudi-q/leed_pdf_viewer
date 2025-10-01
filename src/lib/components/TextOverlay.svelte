<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		addTextAnnotation,
		currentPageTextAnnotations,
		deleteTextAnnotation,
		drawingState,
		pdfState,
		type TextAnnotation,
		updateTextAnnotation
	} from '../stores/drawingStore';
	import { trackFirstAnnotation } from '../utils/analytics';

	export let canvasWidth: number = 0; // Actual displayed canvas width
  export let canvasHeight: number = 0; // Actual displayed canvas height
  export let currentScale: number = 1; // Current PDF scale
  export let viewOnlyMode = false; // If true, disable all editing interactions
  
  // Helper function to get safe scale (prevent division by zero)
  function getSafeScale(): number {
    return currentScale > 0 ? currentScale : 1;
  }

  let editingAnnotation: TextAnnotation | null = null;
  let editInput: HTMLTextAreaElement;
  let overlayContainer: HTMLDivElement;
  
  // Resize state
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;
  let resizingAnnotation: TextAnnotation | null = null;
  
  // Default dimensions for new text annotations
  const DEFAULT_WIDTH = 200;
  const DEFAULT_HEIGHT = 80;
  const MIN_WIDTH = 120;
  const MIN_HEIGHT = 60;
  const MAX_WIDTH = 400; // Based on max font size (48px * 0.12 = 400)
  const MAX_HEIGHT = 120; // Based on max font size (48px / 0.4 = 120)

  // Generate unique ID for new annotations
  function generateId(): string {
    return `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Handle click on overlay to create new text annotation
  function handleOverlayClick(event: MouseEvent) {
    // Only handle clicks when text tool is active and not in view-only mode
    if ($drawingState.tool !== 'text' || viewOnlyMode) return;
    
    // Don't create new annotation if clicking on existing text
    if (event.target !== overlayContainer) return;

    const rect = overlayContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert to base scale for storage
    const safeScale = getSafeScale();
    const baseX = x / safeScale;
    const baseY = y / safeScale;

    // Store as relative position (0-1 range) - relative to base dimensions
    const baseWidth = canvasWidth / safeScale;
    const baseHeight = canvasHeight / safeScale;
    const relativeX = baseWidth > 0 ? baseX / baseWidth : 0;
    const relativeY = baseHeight > 0 ? baseY / baseHeight : 0;

    const newAnnotation: TextAnnotation = {
      id: generateId(),
      pageNumber: $pdfState.currentPage,
      x: baseX, // Store at base scale
      y: baseY, // Store at base scale
      text: '',
      fontSize: 24,
      color: $drawingState.color,
      fontFamily: 'ReenieBeanie, cursive',
      width: 150, // Smaller default width at base scale
      height: 40, // Smaller default height at base scale
      relativeX,
      relativeY,
      relativeWidth: baseWidth > 0 ? 150 / baseWidth : 0,
      relativeHeight: baseHeight > 0 ? 40 / baseHeight : 0
    };

    // Track first annotation creation
    trackFirstAnnotation('text');
    
    addTextAnnotation(newAnnotation);
    startEditing(newAnnotation);
  }

  // Start editing an annotation
  async function startEditing(annotation: TextAnnotation) {
    editingAnnotation = annotation;
    await tick(); // Wait for DOM update
    if (editInput) {
      editInput.focus();
      editInput.select();
    }
  }

  // Save editing changes
  function saveEdit() {
    if (!editingAnnotation || !editInput) return;

    const newText = editInput.value.trim();
    
    if (newText === '') {
      // Delete empty annotation
      deleteTextAnnotation(editingAnnotation.id, editingAnnotation.pageNumber);
    } else {
      // Calculate required dimensions based on textarea content
      const safeScale = getSafeScale();
      const textareaHeight = editInput.scrollHeight;
      const textareaWidth = editInput.scrollWidth;
      
      const baseHeight = textareaHeight / safeScale;
      const baseWidth = Math.min(textareaWidth / safeScale, 600); // Cap max width
      
      const canvasBaseHeight = canvasHeight / safeScale;
      const canvasBaseWidth = canvasWidth / safeScale;
      
      // Update annotation with new text and fitted dimensions (tight fit)
      updateTextAnnotation({
        ...editingAnnotation,
        text: newText,
        width: Math.max(80, baseWidth + 12), // Minimal padding
        height: Math.max(35, baseHeight + 8), // Minimal padding
        relativeWidth: canvasBaseWidth > 0 ? (baseWidth + 12) / canvasBaseWidth : editingAnnotation.relativeWidth,
        relativeHeight: canvasBaseHeight > 0 ? (baseHeight + 8) / canvasBaseHeight : editingAnnotation.relativeHeight
      });
    }
    
    editingAnnotation = null;
  }

  // Cancel editing
  function cancelEdit() {
    if (!editingAnnotation) return;
    
    // If annotation was newly created and empty, delete it
    if (editingAnnotation.text === '') {
      deleteTextAnnotation(editingAnnotation.id, editingAnnotation.pageNumber);
    }
    
    editingAnnotation = null;
  }

  // Handle keyboard events in edit mode
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }

  // Calculate display position from stored coordinates
  function getDisplayPosition(annotation: TextAnnotation) {
    // Annotations are stored at base scale, need to scale up for current display
    const safeScale = getSafeScale();
    const baseWidth = canvasWidth / safeScale;
    const baseHeight = canvasHeight / safeScale;
    const baseX = annotation.x !== undefined ? annotation.x : annotation.relativeX * baseWidth;
    const baseY = annotation.y !== undefined ? annotation.y : annotation.relativeY * baseHeight;
    return {
      x: baseX * safeScale,
      y: baseY * safeScale
    };
  }

  // Update position when annotation is moved
  function updatePosition(annotation: TextAnnotation, displayX: number, displayY: number) {
    // Convert from display coordinates to base scale for storage
    const safeScale = getSafeScale();
    const baseX = displayX / safeScale;
    const baseY = displayY / safeScale;
    
    const baseWidth = canvasWidth / safeScale;
    const baseHeight = canvasHeight / safeScale;
    const relativeX = baseWidth > 0 ? baseX / baseWidth : annotation.relativeX;
    const relativeY = baseHeight > 0 ? baseY / baseHeight : annotation.relativeY;
    
    updateTextAnnotation({
      ...annotation,
      x: baseX, // Store at base scale
      y: baseY, // Store at base scale
      relativeX,
      relativeY
    });
  }

  // Handle double-click to edit existing annotation
  function handleAnnotationDoubleClick(annotation: TextAnnotation) {
    if (viewOnlyMode) return; // Disable editing in view-only mode
    startEditing(annotation);
  }

  // Handle delete
  function handleDelete(annotation: TextAnnotation) {
    if (viewOnlyMode) return;
    deleteTextAnnotation(annotation.id, annotation.pageNumber);
  }

  // Handle annotation drag
  let draggedAnnotation: TextAnnotation | null = null;
  let dragStart = { x: 0, y: 0 };
  let annotationStart = { x: 0, y: 0 };

  function handleMouseDown(event: MouseEvent, annotation: TextAnnotation) {
    // Don't start drag if we're editing, resizing, or in view-only mode
    if (editingAnnotation || isResizing || viewOnlyMode) return;
    
    draggedAnnotation = annotation;
    dragStart = { x: event.clientX, y: event.clientY };
    const pos = getDisplayPosition(annotation);
    annotationStart = { x: pos.x, y: pos.y };
    
    event.preventDefault();
  }

  function handleMouseMove(event: MouseEvent) {
    if (draggedAnnotation) {
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      
      const newX = Math.max(0, Math.min(canvasWidth - 100, annotationStart.x + deltaX));
      const newY = Math.max(0, Math.min(canvasHeight - 20, annotationStart.y + deltaY));
      
      updatePosition(draggedAnnotation, newX, newY);
    } else if (isResizing && resizingAnnotation) {
      const deltaX = event.clientX - resizeStartX;
      const deltaY = event.clientY - resizeStartY;
      
      // Calculate new dimensions at base scale
      const safeScale = getSafeScale();
      const baseStartWidth = resizeStartWidth / safeScale;
      const baseStartHeight = resizeStartHeight / safeScale;
      const baseDeltaX = deltaX / safeScale;
      const baseDeltaY = deltaY / safeScale;
      
      // Ensure minimum and maximum size at base scale
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, baseStartWidth + baseDeltaX));
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, baseStartHeight + baseDeltaY));
      
      const baseWidth = canvasWidth / safeScale;
      const baseHeight = canvasHeight / safeScale;
      
      // Calculate new font size with intelligent constraints (similar to sticky notes)
      // Use width-based scaling but cap it to ensure it fits within height
      const widthBasedSize = newWidth * 0.12; // 12% of width
      const heightConstraint = newHeight * 0.4; // Max 40% of height
      const maxFontSize = 48; // Absolute maximum font size
      const minFontSize = 12; // Absolute minimum font size
      const newFontSize = Math.max(minFontSize, Math.min(widthBasedSize, heightConstraint, maxFontSize));
      
      // Update the annotation with new dimensions
      updateTextAnnotation({
        ...resizingAnnotation,
        width: newWidth,
        height: newHeight,
        fontSize: newFontSize,
        relativeWidth: baseWidth > 0 ? newWidth / baseWidth : (resizingAnnotation.relativeWidth ?? 0),
        relativeHeight: baseHeight > 0 ? newHeight / baseHeight : (resizingAnnotation.relativeHeight ?? 0)
      });
    }
  }

  function handleMouseUp() {
    draggedAnnotation = null;
    isResizing = false;
    resizingAnnotation = null;
  }
  
  // Handle resize handle mouse down
  function handleResizeMouseDown(event: MouseEvent, annotation: TextAnnotation) {
    if (viewOnlyMode || editingAnnotation) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    isResizing = true;
    resizingAnnotation = annotation;
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    
    // Get current display dimensions
    const safeScale = getSafeScale();
    const width = annotation.width ?? DEFAULT_WIDTH;
    const height = annotation.height ?? DEFAULT_HEIGHT;
    resizeStartWidth = width * safeScale;
    resizeStartHeight = height * safeScale;
  }

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  });

  // No need to update positions when canvas size changes
  // Annotations are stored at base scale and displayed at current scale
</script>

<!-- Text Overlay Container -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  bind:this={overlayContainer}
  class="absolute top-0 left-0 w-full h-full"
  class:cursor-crosshair={$drawingState.tool === 'text' && !editingAnnotation}
  class:pointer-events-auto={$drawingState.tool === 'text'}
  class:pointer-events-none={$drawingState.tool !== 'text'}
  style="width: {canvasWidth}px; height: {canvasHeight}px; z-index: 4;"
  on:click={handleOverlayClick}
  role="application"
  aria-label="Text annotation overlay"
  tabindex="-1"
>
  <!-- Render all text annotations for current page -->
  {#each $currentPageTextAnnotations as annotation (annotation.id)}
    {@const pos = getDisplayPosition(annotation)}
    {@const width = annotation.width ?? DEFAULT_WIDTH}
    {@const height = annotation.height ?? DEFAULT_HEIGHT}
    {@const displayWidth = width * currentScale}
    {@const displayHeight = height * currentScale}
    
    <!-- Edit mode -->
    {#if editingAnnotation && editingAnnotation.id === annotation.id}
      <div
        class="text-box-container"
        style="left: {pos.x}px; top: {pos.y}px; width: {displayWidth}px; height: {displayHeight}px;"
      >
        <textarea
          bind:this={editInput}
          class="text-box-textarea"
          style="font-size: {annotation.fontSize * currentScale}px; color: {annotation.color}; font-family: {annotation.fontFamily};"
          value={annotation.text}
          on:blur={saveEdit}
          on:keydown={handleKeyDown}
          placeholder="Enter text..."
        ></textarea>
      </div>
    {:else}
      <!-- Display mode -->
      <div
        class="text-box-container"
        class:text-box-display={true}
        class:text-box-active={$drawingState.tool === 'text'}
        style="left: {pos.x}px; top: {pos.y}px; width: {displayWidth}px; height: {displayHeight}px;"
        on:dblclick={() => handleAnnotationDoubleClick(annotation)}
        on:mousedown={(e) => handleMouseDown(e, annotation)}
        role="button"
        tabindex="0"
        aria-label="Text annotation: {annotation.text}"
        title="Double-click to edit, drag to move"
      >
        <!-- Delete button -->
        {#if !viewOnlyMode}
          <button
            class="text-box-delete-btn"
            on:click|stopPropagation={() => handleDelete(annotation)}
            title="Delete text annotation"
            aria-label="Delete text annotation"
          >
            ×
          </button>
        {/if}
        
        <!-- Text content -->
        <div
          class="text-box-content"
          style="font-size: {annotation.fontSize * currentScale}px; color: {annotation.color}; font-family: {annotation.fontFamily};"
        >
          {annotation.text || 'Click to edit...'}
        </div>
        
        <!-- Resize handle -->
        {#if !viewOnlyMode}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="text-box-resize-handle"
            on:mousedown|stopPropagation={(e) => handleResizeMouseDown(e, annotation)}
            title="Drag to resize"
            role="button"
            tabindex="0"
            aria-label="Resize text annotation"
          ></div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .cursor-crosshair {
    cursor: crosshair;
  }
  
  /* Text box container styling */
  .text-box-container {
    position: absolute;
    background: white;
    border: 2px solid #3B82F6;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 4px 6px;
    box-sizing: border-box;
    overflow: hidden;
    pointer-events: auto;
    z-index: 10;
  }
  
  .text-box-display {
    border: 1px solid rgba(0, 0, 0, 0.2);
    cursor: move;
    transition: all 0.15s ease;
  }
  
  .text-box-display:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    border-color: #3B82F6;
  }
  
  .text-box-active {
    opacity: 0.85;
  }
  
  /* Text box textarea (edit mode) */
  .text-box-textarea {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    font-family: inherit;
    resize: none;
    outline: none;
    padding: 0;
    margin: 0;
    overflow-y: auto;
  }
  
  .text-box-textarea::placeholder {
    color: #9CA3AF;
    font-style: italic;
  }
  
  /* Text box content (display mode) */
  .text-box-content {
    width: 100%;
    height: 100%;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
    padding-right: 0;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }
  
  /* Delete button styling */
  .text-box-delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border: none;
    background: rgba(239, 68, 68, 0.8);
    color: white;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    line-height: 1;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.1s ease;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  
  .text-box-container:hover .text-box-delete-btn {
    opacity: 1;
  }
  
  .text-box-delete-btn:hover {
    background: rgba(239, 68, 68, 1);
    transform: scale(1.1);
  }
  
  /* Resize handle styling */
  .text-box-resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: nw-resize;
    background: linear-gradient(-45deg, transparent 0%, transparent 40%, #9CA3AF 40%, #9CA3AF 60%, transparent 60%);
    opacity: 0.5;
    transition: opacity 0.2s ease;
  }
  
  .text-box-container:hover .text-box-resize-handle {
    opacity: 1;
  }
  
  /* Scrollbar styling for webkit browsers */
  .text-box-textarea::-webkit-scrollbar,
  .text-box-content::-webkit-scrollbar {
    width: 4px;
  }
  
  .text-box-textarea::-webkit-scrollbar-track,
  .text-box-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .text-box-textarea::-webkit-scrollbar-thumb,
  .text-box-content::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 2px;
  }
  
  .text-box-textarea::-webkit-scrollbar-thumb:hover,
  .text-box-content::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }
  
  /* Make sure text annotations are visible but don't interfere with other tools */
  :global(.text-annotation) {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }
</style>
