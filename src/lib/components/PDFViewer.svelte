<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { drawingState, pdfState, currentPagePaths, addDrawingPath, drawingPaths, type DrawingPath, type Point } from '../stores/drawingStore';
  import { PDFManager } from '../utils/pdfUtils';
  import { DrawingEngine } from '../utils/drawingUtils';

  export let pdfFile: File | null = null;

  let pdfCanvas: HTMLCanvasElement;
  let drawingCanvas: HTMLCanvasElement;
  let containerDiv: HTMLDivElement;
  
  let pdfManager: PDFManager;
  let drawingEngine: DrawingEngine;
  let isDrawing = false;
  let isPanning = false;
  let currentDrawingPath: Point[] = [];
  let canvasesReady = false;
  let lastLoadedFile: File | null = null;
  let panStart = { x: 0, y: 0 };
  let panOffset = { x: 0, y: 0 };
  let viewportTransform = { x: 0, y: 0, scale: 1 };
  let isRendering = false;
  let isCtrlPressed = false;
  let cursorOverCanvas = false;

  // Debug prop changes
  $: console.log('PDFViewer prop pdfFile changed:', pdfFile?.name || 'null');
  $: console.log('PDFViewer canvases ready:', canvasesReady);
  
  // Only load PDF when both conditions are met and it's a new file
  $: if (pdfFile && canvasesReady && pdfFile !== lastLoadedFile) {
    console.log('Loading PDF - file changed and canvases ready:', pdfFile.name);
    loadPDF();
  }

  // Re-render drawing paths when they change
  $: if (drawingEngine && $currentPagePaths && canvasesReady) {
    drawingEngine.renderPaths($currentPagePaths);
  }
  
  // Update cursor when drawing state changes
  $: if ($drawingState.tool && containerDiv) {
    updateCursor();
  }

  onMount(async () => {
    console.log('PDFViewer mounted');
    pdfManager = new PDFManager();
    
    // Wait for DOM to be fully rendered
    await tick();
    
    // Check if canvases are ready and initialize
    initializeCanvases();
  });

  onDestroy(() => {
    if (pdfManager) {
      pdfManager.destroy();
    }
    
    // Clean up keyboard event listeners
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
  });

  async function initializeCanvases() {
    if (pdfCanvas && drawingCanvas) {
      console.log('Initializing canvases...');
      canvasesReady = true;
      
      try {
        drawingEngine = new DrawingEngine(drawingCanvas);
        setupDrawingEvents();
        console.log('Drawing engine initialized successfully');
        
        // If there's a pending file, load it now
        if (pdfFile && pdfFile !== lastLoadedFile) {
          console.log('Loading pending PDF file:', pdfFile.name);
          await loadPDF();
        }
      } catch (error) {
        console.error('Error initializing drawing engine:', error);
      }
    } else {
      console.log('Canvases not ready yet:', { pdfCanvas: !!pdfCanvas, drawingCanvas: !!drawingCanvas });
    }
  }

  // Monitor canvas binding
  $: if (pdfCanvas && drawingCanvas && !canvasesReady) {
    console.log('Canvases bound, initializing...');
    initializeCanvases();
  }

  async function loadPDF() {
    if (!pdfFile || !pdfCanvas) {
      console.log('Missing pdfFile or pdfCanvas:', { pdfFile: !!pdfFile, pdfCanvas: !!pdfCanvas });
      return;
    }

    console.log('Loading PDF:', pdfFile.name, 'Size:', pdfFile.size);
    
    try {
      pdfState.update(state => ({ ...state, isLoading: true }));
      
      console.log('Calling pdfManager.loadFromFile...');
      const document = await pdfManager.loadFromFile(pdfFile);
      console.log('PDF loaded successfully, pages:', document.numPages);
      
      pdfState.update(state => ({
        ...state,
        document,
        totalPages: document.numPages,
        currentPage: 1,
        isLoading: false
      }));

      // Mark this file as loaded
      lastLoadedFile = pdfFile;
      
      // Reset pan offset to center the PDF
      panOffset = { x: 0, y: 0 };
      
      await renderCurrentPage();
      console.log('PDF render completed successfully');
    } catch (error) {
      console.error('Error loading PDF:', error);
      pdfState.update(state => ({ ...state, isLoading: false }));
      // Reset the tracking to allow retry
      lastLoadedFile = null;
      alert(`Failed to load PDF: ${error.message}`);
    }
  }

  async function renderCurrentPage() {
    if (!pdfCanvas || !$pdfState.document || isRendering) return;

    isRendering = true;
    try {
      const page = await $pdfState.document.getPage($pdfState.currentPage);
      const viewport = page.getViewport({ scale: $pdfState.scale });
      const outputScale = window.devicePixelRatio || 1;
      
      // Set canvas dimensions to match the scaled viewport and device pixel ratio for crisp rendering
      pdfCanvas.width = Math.floor(viewport.width * outputScale);
      pdfCanvas.height = Math.floor(viewport.height * outputScale);
      pdfCanvas.style.width = `${viewport.width}px`;
      pdfCanvas.style.height = `${viewport.height}px`;
      
      // Scale the canvas context to match device pixel ratio
      const context = pdfCanvas.getContext('2d');
      if (context) {
        context.scale(outputScale, outputScale);
      }
      
      await pdfManager.renderPage($pdfState.currentPage, {
        scale: $pdfState.scale * outputScale,
        canvas: pdfCanvas
      });

      // Sync drawing canvas size with PDF canvas (but don't apply devicePixelRatio to drawing canvas)
      if (drawingCanvas) {
        drawingCanvas.width = viewport.width;
        drawingCanvas.height = viewport.height;
        drawingCanvas.style.width = `${viewport.width}px`;
        drawingCanvas.style.height = `${viewport.height}px`;
        
        // Re-render drawing paths for current page
        if (drawingEngine) {
          drawingEngine.renderPaths($currentPagePaths);
        }
      }
    } catch (error) {
      console.error('Error rendering page:', error);
    } finally {
      isRendering = false;
    }
  }

  function setupDrawingEvents() {
    if (!drawingCanvas || !containerDiv) return;

    // Add drawing events to the drawing canvas
    drawingCanvas.addEventListener('pointerdown', handlePointerDown);
    drawingCanvas.addEventListener('pointermove', handlePointerMove);
    drawingCanvas.addEventListener('pointerup', handlePointerUp);
    drawingCanvas.addEventListener('pointerleave', handlePointerUp);
    
    // Add canvas hover events for cursor tracking
    drawingCanvas.addEventListener('pointerenter', handleCanvasEnter);
    drawingCanvas.addEventListener('pointerleave', handleCanvasLeave);
    
    // Add panning events to the entire container for infinite canvas feel
    containerDiv.addEventListener('pointerdown', handleContainerPointerDown);
    containerDiv.addEventListener('pointermove', handleContainerPointerMove);
    containerDiv.addEventListener('pointerup', handleContainerPointerUp);
    containerDiv.addEventListener('pointerleave', handleContainerPointerUp);
    
    // Add wheel event for zoom with Ctrl+scroll to container
    containerDiv.addEventListener('wheel', handleWheel, { passive: false });
    
    // Add keyboard events for Ctrl key tracking
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Prevent context menu on right click
    drawingCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    containerDiv.addEventListener('contextmenu', (e) => e.preventDefault());
  }

function handlePointerDown(event: PointerEvent) {
    if (!drawingEngine) return;
    
    // If Ctrl is pressed, let the container handle panning
    if (event.ctrlKey) {
      return; // Don't capture the event, let container handle it
    }
    
    event.preventDefault();
    drawingCanvas.setPointerCapture(event.pointerId);

    isDrawing = true;
    const point = drawingEngine.getPointFromEvent(event);
    
    const size = $drawingState.tool === 'eraser' ? $drawingState.eraserSize : $drawingState.lineWidth;
    drawingEngine.startDrawing(
      point,
      $drawingState.tool,
      $drawingState.color,
      size
    );
    
    currentDrawingPath = [point];
  }

function handlePointerMove(event: PointerEvent) {
    if (isPanning) {
      panOffset = { x: event.clientX - panStart.x, y: event.clientY - panStart.y };
      // Apply the transform to the content wrapper
      const contentWrapper = containerDiv.querySelector('.flex');
      if (contentWrapper) {
        contentWrapper.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
      }
      return;
    }

    if (!isDrawing || !drawingEngine) return;
    
    event.preventDefault();
    const point = drawingEngine.getPointFromEvent(event);
    
    drawingEngine.continueDrawing(point);
    currentDrawingPath.push(point);
  }

function handlePointerUp(event: PointerEvent) {
    if (!isDrawing || !drawingEngine) return;
    
    event.preventDefault();
    drawingCanvas.releasePointerCapture(event.pointerId);
    
    isDrawing = false;
    const finalPath = drawingEngine.endDrawing();
    
    if (finalPath.length > 1) {
      // Check tool type
      if ($drawingState.tool === 'eraser') {
        // Remove intersecting pencil paths and ensure auto-save
        drawingPaths.update(paths => {
          const pagePaths = paths.get($pdfState.currentPage) || [];
          const eraserPath = {
            tool: 'eraser' as const,
            color: '#000000',
            lineWidth: $drawingState.eraserSize,
            points: finalPath,
            pageNumber: $pdfState.currentPage
          };
          
          console.log('Checking eraser intersections with', pagePaths.length, 'paths');
          const remainingPaths = pagePaths.filter((path, index) => {
            const intersects = drawingEngine.pathsIntersect(path, eraserPath);
            if (intersects) {
              console.log(`Path ${index} intersects with eraser - removing`);
            }
            return !intersects;
          });

          // Always update to ensure auto-save triggers
          paths.set($pdfState.currentPage, [...remainingPaths]);
          console.log(`Eraser processed: ${pagePaths.length} -> ${remainingPaths.length} paths remaining`);
          
          // Force immediate re-render
          setTimeout(() => {
            if (drawingEngine) {
              drawingEngine.renderPaths(remainingPaths);
            }
          }, 0);

          return new Map(paths);
        });
      } else {
        // Add pencil drawing path
        const drawingPath: DrawingPath = {
          tool: $drawingState.tool,
          color: $drawingState.color,
          lineWidth: $drawingState.lineWidth,
          points: finalPath,
          pageNumber: $pdfState.currentPage
        };
        addDrawingPath(drawingPath);
      }
    }
    currentDrawingPath = [];
  }

  // Canvas hover handlers for cursor tracking
  function handleCanvasEnter(event: PointerEvent) {
    cursorOverCanvas = true;
    updateCursor();
  }

  function handleCanvasLeave(event: PointerEvent) {
    cursorOverCanvas = false;
    updateCursor();
  }

  // Keyboard handlers for Ctrl key tracking
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Control' && !isCtrlPressed) {
      isCtrlPressed = true;
      updateCursor();
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.key === 'Control' && isCtrlPressed) {
      isCtrlPressed = false;
      updateCursor();
    }
  }

  // Custom cursors using separate SVG files
  const pencilCursor = `url('/cursors/pencil.svg') 2 18, auto`;
  const eraserCursor = `url('/cursors/eraser.svg') 10 10, auto`;

  // Update cursor based on current state
  function updateCursor() {
    if (!containerDiv) return;
    
    if (cursorOverCanvas) {
      // Inside canvas (PDF area)
      if (isCtrlPressed) {
        containerDiv.style.cursor = 'grab';
        if (drawingCanvas) drawingCanvas.style.cursor = 'grab';
      } else {
        // Custom cursors based on tool
        containerDiv.style.cursor = '';
        if (drawingCanvas) {
          if ($drawingState.tool === 'eraser') {
            console.log('Setting eraser cursor:', eraserCursor);
            drawingCanvas.style.cursor = eraserCursor;
          } else {
            console.log('Setting pencil cursor:', pencilCursor);
            drawingCanvas.style.cursor = pencilCursor;
          }
        }
      }
    } else {
      // Outside canvas (background area) - always show grab cursor
      containerDiv.style.cursor = 'grab';
      if (drawingCanvas) drawingCanvas.style.cursor = '';
    }
  }

  // Container panning handlers for infinite canvas
  function handleContainerPointerDown(event: PointerEvent) {
    // Handle panning when Ctrl is pressed anywhere, or when outside canvas area
    if (event.ctrlKey || !cursorOverCanvas) {
      event.preventDefault();
      isPanning = true;
      panStart = { x: event.clientX - panOffset.x, y: event.clientY - panOffset.y };
      containerDiv.setPointerCapture(event.pointerId);
      containerDiv.style.cursor = 'grabbing';
    }
  }

  function handleContainerPointerMove(event: PointerEvent) {
    if (isPanning) {
      event.preventDefault();
      panOffset = { x: event.clientX - panStart.x, y: event.clientY - panStart.y };
      // Apply the transform to the content wrapper
      const contentWrapper = containerDiv.querySelector('.flex');
      if (contentWrapper) {
        contentWrapper.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
      }
    }
  }

  function handleContainerPointerUp(event: PointerEvent) {
    if (isPanning) {
      isPanning = false;
      containerDiv.releasePointerCapture(event.pointerId);
      updateCursor(); // Restore proper cursor after panning
    }
  }

  function handleWheel(event: WheelEvent) {
    // Only handle wheel events when Ctrl is pressed (for zooming)
    if (event.ctrlKey) {
      event.preventDefault();
      
      // Fix zoom direction: deltaY < 0 means scroll up (zoom in)
      const zoomIn = event.deltaY < 0;
      
      if (zoomIn) {
        const newScale = Math.min($pdfState.scale * 1.1, 10); // Allow much more zoom in
        pdfState.update(state => ({ ...state, scale: newScale }));
      } else {
        const newScale = Math.max($pdfState.scale / 1.1, 0.1); // Allow much more zoom out
        pdfState.update(state => ({ ...state, scale: newScale }));
      }
      
      // Re-render at new scale
      renderCurrentPage();
    }
  }

  export async function goToPage(pageNumber: number) {
    if (pageNumber < 1 || pageNumber > $pdfState.totalPages) return;
    
    pdfState.update(state => ({ ...state, currentPage: pageNumber }));
    await renderCurrentPage();
  }

  export async function nextPage() {
    await goToPage($pdfState.currentPage + 1);
  }

  export async function previousPage() {
    await goToPage($pdfState.currentPage - 1);
  }

  export async function zoomIn() {
    const newScale = Math.min($pdfState.scale * 1.2, 10); // Allow much more zoom in
    pdfState.update(state => ({ ...state, scale: newScale }));
    await renderCurrentPage();
  }

  export async function zoomOut() {
    const newScale = Math.max($pdfState.scale / 1.2, 0.1); // Allow much more zoom out
    pdfState.update(state => ({ ...state, scale: newScale }));
    await renderCurrentPage();
  }

  export function resetZoom() {
    // Reset both zoom and pan position to center the PDF
    panOffset = { x: 0, y: 0 };
    pdfState.update(state => ({ ...state, scale: 1.2 }));
    renderCurrentPage();
  }

  export async function fitToWidth() {
    if (!$pdfState.document || !containerDiv) return;
    
    try {
      const page = await $pdfState.document.getPage($pdfState.currentPage);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = containerDiv.clientWidth - 40; // Account for padding
      const newScale = containerWidth / viewport.width;
      
      panOffset = { x: 0, y: 0 };
      pdfState.update(state => ({ ...state, scale: newScale }));
      await renderCurrentPage();
    } catch (error) {
      console.error('Error fitting to width:', error);
    }
  }

  export async function fitToHeight() {
    if (!$pdfState.document || !containerDiv) return;
    
    try {
      const page = await $pdfState.document.getPage($pdfState.currentPage);
      const viewport = page.getViewport({ scale: 1 });
      const containerHeight = containerDiv.clientHeight - 100; // Account for toolbar and page info
      const newScale = containerHeight / viewport.height;
      
      panOffset = { x: 0, y: 0 };
      pdfState.update(state => ({ ...state, scale: newScale }));
      await renderCurrentPage();
    } catch (error) {
      console.error('Error fitting to height:', error);
    }
  }
</script>

<div bind:this={containerDiv} class="pdf-viewer relative w-full h-full overflow-hidden">
  <!-- Debug info -->
  {#if console.log('PDF State:', { isLoading: $pdfState.isLoading, hasDocument: !!$pdfState.document, totalPages: $pdfState.totalPages })}<!-- Debug logged -->{/if}
  
  <!-- Simple centered canvas -->
  <div class="flex items-center justify-center w-full h-full" style="transform: translate({panOffset.x}px, {panOffset.y}px);">
    <div class="relative">
      <!-- PDF Canvas -->
      <canvas
        bind:this={pdfCanvas}
        class="shadow-lg rounded-lg"
        class:hidden={!$pdfState.document}
        style="z-index: 1;"
      ></canvas>
      
      <!-- Drawing Canvas Overlay -->
      <canvas
        bind:this={drawingCanvas}
        class="absolute top-0 left-0 drawing-canvas rounded-lg"
        class:eraser={$drawingState.tool === 'eraser'}
        class:hidden={!$pdfState.document}
        style="z-index: 2;"
      ></canvas>
      
    </div>
  </div>

  {#if $pdfState.isLoading}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-sage border-t-transparent"></div>
      <span class="ml-3 text-charcoal font-medium">Loading PDF...</span>
    </div>
  {:else if $pdfState.document && $pdfState.totalPages > 0}
    <!-- Page Info -->
    <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 floating-panel">
      <div class="flex items-center space-x-2 text-sm text-charcoal">
        <span>Page</span>
        <span class="font-semibold">{$pdfState.currentPage}</span>
        <span>of</span>
        <span class="font-semibold">{$pdfState.totalPages}</span>
        <span class="mx-2">•</span>
        <span>{Math.round($pdfState.scale * 100)}%</span>
      </div>
    </div>
  {:else}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="text-center">
        <div class="text-6xl mb-4">📄</div>
        <h3 class="text-xl font-medium text-charcoal mb-2">No PDF loaded</h3>
        <p class="text-slate">Upload a PDF file to start drawing</p>
        <p class="text-xs text-slate mt-2">Debug: Loading={$pdfState.isLoading}, Document={!!$pdfState.document}, Pages={$pdfState.totalPages}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .pdf-viewer {
    background: linear-gradient(135deg, #FDF6E3 0%, #F7F3E9 100%);
    position: relative;
  }
  
  .drawing-canvas {
    /* Cursor is dynamically controlled by JavaScript */
  }
</style>
