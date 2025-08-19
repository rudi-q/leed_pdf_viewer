<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { 
    currentPageTextAnnotations, 
    addTextAnnotation, 
    updateTextAnnotation, 
    deleteTextAnnotation,
    type TextAnnotation,
    pdfState,
    drawingState
  } from '../stores/drawingStore';

  export let canvasWidth: number = 0; // Actual displayed canvas width
  export let canvasHeight: number = 0; // Actual displayed canvas height
  export let currentScale: number = 1; // Current PDF scale

  let editingAnnotation: TextAnnotation | null = null;
  let editInput: HTMLTextAreaElement;
  let overlayContainer: HTMLDivElement;

  // Generate unique ID for new annotations
  function generateId(): string {
    return `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Handle click on overlay to create new text annotation
  function handleOverlayClick(event: MouseEvent) {
    // Only handle clicks when text tool is active
    if ($drawingState.tool !== 'text') return;
    
    // Don't create new annotation if clicking on existing text
    if (event.target !== overlayContainer) return;

    const rect = overlayContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert to base scale for storage
    const baseX = x / currentScale;
    const baseY = y / currentScale;

    // Store as relative position (0-1 range) - relative to base dimensions
    const baseWidth = canvasWidth / currentScale;
    const baseHeight = canvasHeight / currentScale;
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
      relativeX,
      relativeY
    };

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
      // Update annotation with new text
      updateTextAnnotation({
        ...editingAnnotation,
        text: newText
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
    const baseWidth = canvasWidth / currentScale;
    const baseHeight = canvasHeight / currentScale;
    const baseX = annotation.x !== undefined ? annotation.x : annotation.relativeX * baseWidth;
    const baseY = annotation.y !== undefined ? annotation.y : annotation.relativeY * baseHeight;
    return {
      x: baseX * currentScale,
      y: baseY * currentScale
    };
  }

  // Update position when annotation is moved
  function updatePosition(annotation: TextAnnotation, displayX: number, displayY: number) {
    // Convert from display coordinates to base scale for storage
    const baseX = displayX / currentScale;
    const baseY = displayY / currentScale;
    
    const baseWidth = canvasWidth / currentScale;
    const baseHeight = canvasHeight / currentScale;
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
    startEditing(annotation);
  }

  // Handle annotation drag
  let draggedAnnotation: TextAnnotation | null = null;
  let dragStart = { x: 0, y: 0 };
  let annotationStart = { x: 0, y: 0 };

  function handleMouseDown(event: MouseEvent, annotation: TextAnnotation) {
    // Don't start drag if we're editing
    if (editingAnnotation) return;
    
    draggedAnnotation = annotation;
    dragStart = { x: event.clientX, y: event.clientY };
    const pos = getDisplayPosition(annotation);
    annotationStart = { x: pos.x, y: pos.y };
    
    event.preventDefault();
  }

  function handleMouseMove(event: MouseEvent) {
    if (!draggedAnnotation) return;
    
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    
    const newX = Math.max(0, Math.min(canvasWidth - 100, annotationStart.x + deltaX));
    const newY = Math.max(0, Math.min(canvasHeight - 20, annotationStart.y + deltaY));
    
    updatePosition(draggedAnnotation, newX, newY);
  }

  function handleMouseUp() {
    draggedAnnotation = null;
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
    
    <!-- Edit mode -->
    {#if editingAnnotation && editingAnnotation.id === annotation.id}
      <textarea
        bind:this={editInput}
        class="absolute bg-white border-2 border-blue-500 rounded px-2 py-1 font-mono resize-none shadow-lg z-10"
        style="left: {pos.x}px; top: {pos.y}px; font-size: {annotation.fontSize * currentScale}px; color: {annotation.color}; font-family: {annotation.fontFamily}; min-width: {200 * currentScale}px; min-height: {60 * currentScale}px;"
        value={annotation.text}
        on:blur={saveEdit}
        on:keydown={handleKeyDown}
        placeholder="Enter text..."
      ></textarea>
    {:else}
      <!-- Display mode -->
      <div
        class="absolute select-none cursor-pointer hover:bg-blue-50 hover:bg-opacity-50 rounded px-1"
        class:opacity-75={$drawingState.tool === 'text'}
        style="left: {pos.x}px; top: {pos.y}px; font-size: {annotation.fontSize * currentScale}px; color: {annotation.color}; font-family: {annotation.fontFamily}; white-space: pre-wrap; pointer-events: auto;"
        on:dblclick={() => handleAnnotationDoubleClick(annotation)}
        on:mousedown={(e) => handleMouseDown(e, annotation)}
        role="button"
        tabindex="0"
        aria-label="Text annotation: {annotation.text}"
        title="Double-click to edit, drag to move"
      >
        {annotation.text || 'Click to edit...'}
      </div>
    {/if}
  {/each}
</div>

<style>
  .cursor-crosshair {
    cursor: crosshair;
  }
  
  /* Make sure text annotations are visible but don't interfere with other tools */
  :global(.text-annotation) {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }
</style>
