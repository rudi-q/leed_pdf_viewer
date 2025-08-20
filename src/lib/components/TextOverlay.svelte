<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    currentPageTextAnnotations, 
    addTextAnnotation, 
    updateTextAnnotation,
    deleteTextAnnotation,
    type TextAnnotation,
    pdfState,
    drawingState
  } from '../stores/drawingStore';
  import TextAnnotationComponent from './TextAnnotation.svelte';

  export let canvasWidth: number = 0; // Actual displayed canvas width
  export let canvasHeight: number = 0; // Actual displayed canvas height
  export let currentScale: number = 1; // Current PDF scale

  let overlayContainer: HTMLDivElement;

  // Generate unique ID for new annotations
  function generateId(): string {
    return `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Handle click on overlay to create new text annotation
  function handleOverlayClick(event: MouseEvent) {
    // Only handle clicks when text tool is active
    if ($drawingState.tool !== 'text') return;
    
    // Don't create new annotation if clicking on existing text components
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

    // Default dimensions for new text annotations
    const defaultWidth = 200;
    const defaultHeight = 60;
    const relativeWidth = baseWidth > 0 ? defaultWidth / baseWidth : 0.2;
    const relativeHeight = baseHeight > 0 ? defaultHeight / baseHeight : 0.1;

    const newAnnotation: TextAnnotation = {
      id: generateId(),
      pageNumber: $pdfState.currentPage,
      x: baseX, // Store at base scale
      y: baseY, // Store at base scale
      text: '',
      fontSize: 24,
      color: $drawingState.color,
      fontFamily: 'ReenieBeanie, cursive',
      width: defaultWidth,
      height: defaultHeight,
      relativeX,
      relativeY,
      relativeWidth,
      relativeHeight
    };

    addTextAnnotation(newAnnotation);
  }
</script>

<!-- Text Overlay Container -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  bind:this={overlayContainer}
  class="absolute top-0 left-0 w-full h-full"
  class:cursor-crosshair={$drawingState.tool === 'text'}
  class:pointer-events-auto={$drawingState.tool === 'text'}
  class:pointer-events-none={$drawingState.tool !== 'text'}
  style="width: {canvasWidth}px; height: {canvasHeight}px; z-index: 4;"
  on:click={handleOverlayClick}
  role="application"
  aria-label="Text annotation overlay"
  tabindex="-1"
>
  <!-- Render all text annotations for current page using the scalable component -->
  {#each $currentPageTextAnnotations as annotation (annotation.id)}
    <TextAnnotationComponent
      {annotation}
      containerWidth={canvasWidth}
      containerHeight={canvasHeight}
      scale={currentScale}
      on:update={(event) => updateTextAnnotation(event.detail)}
      on:delete={(event) => deleteTextAnnotation(event.detail, annotation.pageNumber)}
      on:startEdit={(event) => console.log('Text annotation editing started:', event.detail)}
    />
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
