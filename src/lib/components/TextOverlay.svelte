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

  // Clamp utility to enforce min/max bounds
  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
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
  let resizeStartPosX = 0;
  let resizeStartPosY = 0;
  let resizingAnnotation: TextAnnotation | null = null;
  let resizeDirection: 'se' | 'e' | 's' | 'w' | 'n' | null = null; // southeast, east, south, west, north
  
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

    // Initialize default dimensions honoring declared MIN/DEFAULT constants
    const initialWidth = Math.max(DEFAULT_WIDTH, MIN_WIDTH);
    const initialHeight = Math.max(DEFAULT_HEIGHT, MIN_HEIGHT);

    const newAnnotation: TextAnnotation = {
      id: generateId(),
      pageNumber: $pdfState.currentPage,
      x: baseX, // Store at base scale
      y: baseY, // Store at base scale
      text: '',
      fontSize: 24,
      color: $drawingState.color,
      fontFamily: 'ReenieBeanie, cursive',
      width: initialWidth,
      height: initialHeight,
      relativeX,
      relativeY,
      relativeWidth: baseWidth > 0 ? initialWidth / baseWidth : 0,
      relativeHeight: baseHeight > 0 ? initialHeight / baseHeight : 0
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
      const baseWidth = textareaWidth / safeScale;
      
      const canvasBaseHeight = canvasHeight / safeScale;
      const canvasBaseWidth = canvasWidth / safeScale;
      
      // Apply minimal padding then clamp to declared bounds
      const paddedBaseWidth = baseWidth + 12;
      const paddedBaseHeight = baseHeight + 8;
      const clampedWidth = clamp(paddedBaseWidth, MIN_WIDTH, MAX_WIDTH);
      const clampedHeight = clamp(paddedBaseHeight, MIN_HEIGHT, MAX_HEIGHT);
      
      // Update annotation with new text and fitted, clamped dimensions
      updateTextAnnotation({
        ...editingAnnotation,
        text: newText,
        width: clampedWidth,
        height: clampedHeight,
        relativeWidth: canvasBaseWidth > 0 ? clampedWidth / canvasBaseWidth : editingAnnotation.relativeWidth,
        relativeHeight: canvasBaseHeight > 0 ? clampedHeight / canvasBaseHeight : editingAnnotation.relativeHeight
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
    } else if (isResizing && resizingAnnotation && resizeDirection) {
      const deltaX = event.clientX - resizeStartX;
      const deltaY = event.clientY - resizeStartY;
      
      // Calculate new dimensions at base scale
      const safeScale = getSafeScale();
      const baseStartWidth = resizeStartWidth / safeScale;
      const baseStartHeight = resizeStartHeight / safeScale;
      const baseDeltaX = deltaX / safeScale;
      const baseDeltaY = deltaY / safeScale;
      
      let newWidth = baseStartWidth;
      let newHeight = baseStartHeight;
      let newX = resizeStartPosX;
      let newY = resizeStartPosY;
      
      // Apply resize based on direction
      if (resizeDirection === 'se') {
        // Southeast corner: grow right and down
        newWidth = baseStartWidth + baseDeltaX;
        newHeight = baseStartHeight + baseDeltaY;
      } else if (resizeDirection === 'e') {
        // East edge: grow right only
        newWidth = baseStartWidth + baseDeltaX;
      } else if (resizeDirection === 's') {
        // South edge: grow down only
        newHeight = baseStartHeight + baseDeltaY;
      } else if (resizeDirection === 'w') {
        // West edge: grow left
        newWidth = baseStartWidth - baseDeltaX;
        newX = resizeStartPosX + baseDeltaX;
      } else if (resizeDirection === 'n') {
        // North edge: grow up
        newHeight = baseStartHeight - baseDeltaY;
        newY = resizeStartPosY + baseDeltaY;
      }
      
      // Ensure minimum and maximum size at base scale
      newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
      
      // Adjust position if width/height hit limits when resizing left/up
      if (resizeDirection === 'w' && newWidth === MIN_WIDTH) {
        newX = resizeStartPosX + baseStartWidth - MIN_WIDTH;
      } else if (resizeDirection === 'w' && newWidth === MAX_WIDTH) {
        newX = resizeStartPosX + baseStartWidth - MAX_WIDTH;
      }
      if (resizeDirection === 'n' && newHeight === MIN_HEIGHT) {
        newY = resizeStartPosY + baseStartHeight - MIN_HEIGHT;
      } else if (resizeDirection === 'n' && newHeight === MAX_HEIGHT) {
        newY = resizeStartPosY + baseStartHeight - MAX_HEIGHT;
      }
      
      const baseWidth = canvasWidth / safeScale;
      const baseHeight = canvasHeight / safeScale;
      
      // Calculate new font size with intelligent constraints
      const widthBasedSize = newWidth * 0.12;
      const heightConstraint = newHeight * 0.4;
      const maxFontSize = 48;
      const minFontSize = 12;
      const newFontSize = Math.max(minFontSize, Math.min(widthBasedSize, heightConstraint, maxFontSize));
      
      // Update the annotation with new dimensions and position
      updateTextAnnotation({
        ...resizingAnnotation,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        fontSize: newFontSize,
        relativeX: baseWidth > 0 ? newX / baseWidth : resizingAnnotation.relativeX,
        relativeY: baseHeight > 0 ? newY / baseHeight : resizingAnnotation.relativeY,
        relativeWidth: baseWidth > 0 ? newWidth / baseWidth : (resizingAnnotation.relativeWidth ?? 0),
        relativeHeight: baseHeight > 0 ? newHeight / baseHeight : (resizingAnnotation.relativeHeight ?? 0)
      });
    }
  }

  function handleMouseUp() {
    draggedAnnotation = null;
    isResizing = false;
    resizingAnnotation = null;
    resizeDirection = null;
  }
  
  // Handle resize handle mouse down
  function handleResizeMouseDown(event: MouseEvent, annotation: TextAnnotation, direction: 'se' | 'e' | 's' | 'w' | 'n') {
    if (viewOnlyMode || editingAnnotation) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    isResizing = true;
    resizingAnnotation = annotation;
    resizeDirection = direction;
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    
    // Get current display dimensions and position
    const safeScale = getSafeScale();
    const width = annotation.width ?? DEFAULT_WIDTH;
    const height = annotation.height ?? DEFAULT_HEIGHT;
    resizeStartWidth = width * safeScale;
    resizeStartHeight = height * safeScale;
    resizeStartPosX = annotation.x;
    resizeStartPosY = annotation.y;
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
        class="text-box-container text-box-edit"
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
        
        <!-- Resize handles -->
        {#if !viewOnlyMode}
          <!-- Corner handle (southeast) -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="text-box-resize-handle resize-se"
            on:mousedown|stopPropagation={(e) => handleResizeMouseDown(e, annotation, 'se')}
            title="Drag to resize"
            role="button"
            tabindex="0"
            aria-label="Resize text annotation"
          ></div>
          
          <!-- Edge handles -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="text-box-resize-handle resize-e"
            on:mousedown|stopPropagation={(e) => handleResizeMouseDown(e, annotation, 'e')}
            title="Drag to resize width"
          ></div>
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="text-box-resize-handle resize-s"
            on:mousedown|stopPropagation={(e) => handleResizeMouseDown(e, annotation, 's')}
            title="Drag to resize height"
          ></div>
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="text-box-resize-handle resize-w"
            on:mousedown|stopPropagation={(e) => handleResizeMouseDown(e, annotation, 'w')}
            title="Drag to resize width"
          ></div>
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="text-box-resize-handle resize-n"
            on:mousedown|stopPropagation={(e) => handleResizeMouseDown(e, annotation, 'n')}
            title="Drag to resize height"
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
    background: transparent !important;
    border: none !important;
    border-radius: 0;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box;
    overflow: hidden;
    pointer-events: auto;
    z-index: 10;
  }
  
  /* Edit mode - show white background and sage green border */
  .text-box-edit {
    background: white;
    border: 2px solid #87A96B;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  .text-box-display {
    border: none !important;
    background: transparent;
    cursor: move;
    transition: all 0.15s ease;
    box-shadow: none;
    border-radius: 0;
    padding: 0;
  }
  
  .text-box-display:hover {
    background: white;
    border: 1px solid #87A96B !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 4px 6px;
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
    padding: 0 !important;
    margin: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
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
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: auto;
  }
  
  .text-box-container:hover .text-box-resize-handle {
    opacity: 1;
  }
  
  .text-box-container:hover .resize-se {
    background: linear-gradient(-45deg, transparent 0%, transparent 40%, #9CA3AF 40%, #9CA3AF 60%, transparent 60%);
  }
  
  .text-box-container:hover .resize-e,
  .text-box-container:hover .resize-s,
  .text-box-container:hover .resize-w,
  .text-box-container:hover .resize-n {
    background: rgba(135, 169, 107, 0.1);
  }
  
  /* Corner handle (southeast) */
  .resize-se {
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: nw-resize;
    background: transparent;
    z-index: 3;
  }
  
  /* Edge handles */
  .resize-e {
    top: 0;
    right: -4px;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    background: transparent;
    z-index: 2;
  }
  
  .resize-e:hover {
    background: rgba(135, 169, 107, 0.3);
  }
  
  .resize-s {
    bottom: -4px;
    left: 0;
    width: 100%;
    height: 8px;
    cursor: ns-resize;
    background: transparent;
    z-index: 2;
  }
  
  .resize-s:hover {
    background: rgba(135, 169, 107, 0.3);
  }
  
  .resize-w {
    top: 0;
    left: -4px;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    background: transparent;
    z-index: 2;
  }
  
  .resize-w:hover {
    background: rgba(135, 169, 107, 0.3);
  }
  
  .resize-n {
    top: -4px;
    left: 0;
    width: 100%;
    height: 8px;
    cursor: ns-resize;
    background: transparent;
    z-index: 2;
  }
  
  .resize-n:hover {
    background: rgba(135, 169, 107, 0.3);
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
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
</style>
