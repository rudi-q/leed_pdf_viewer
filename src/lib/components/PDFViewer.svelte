<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import {
    addDrawingPath,
    arrowAnnotations,
    currentPageArrowAnnotations,
    currentPagePaths,
    currentPageStampAnnotations,
    currentPageStickyNotes,
    currentPageTextAnnotations,
    type DrawingPath,
    drawingPaths,
    drawingState,
    getStampById,
    pdfState,
    type Point,
    stampAnnotations,
    stickyNoteAnnotations,
    textAnnotations
  } from '../stores/drawingStore';
  import { PDFManager } from '../utils/pdfUtils';
  import { DrawingEngine } from '../utils/drawingUtils';

  // Helper function to convert SVG string to image
  async function svgToImage(svgString: string, width: number, height: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        resolve(img);
      };
      img.onerror = (err) => {
        reject(err);
      };
      
      // Create a data URL from the SVG string
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      // Clean up the object URL after image loads
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };
      
      img.addEventListener('load', cleanup, { once: true });
      img.addEventListener('error', cleanup, { once: true });
      
      img.src = url;
    });
  }
import TextOverlay from './TextOverlay.svelte';
import StickyNoteOverlay from './StickyNoteOverlay.svelte';
import StampOverlay from './StampOverlay.svelte';
import ArrowOverlay from './ArrowOverlay.svelte';

  export let pdfFile: File | string | null = null;

  let pdfCanvas: HTMLCanvasElement;
  let drawingCanvas: HTMLCanvasElement;
  let containerDiv: HTMLDivElement;
  
  let pdfManager: PDFManager;
  let drawingEngine: DrawingEngine;
  let isDrawing = false;
  let isPanning = false;
  let currentDrawingPath: Point[] = [];
  let canvasesReady = false;
  let lastLoadedFile: File | string | null = null;
  let panStart = { x: 0, y: 0 };
  let panOffset = { x: 0, y: 0 };
  let viewportTransform = { x: 0, y: 0, scale: 1 };
  let isRendering = false;
  let isCtrlPressed = false;
  let cursorOverCanvas = false;

  // Helper function to extract filename from URL
  function extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'document.pdf';
      return filename.toLowerCase().endsWith('.pdf') ? filename : filename + '.pdf';
    } catch {
      return 'document.pdf';
    }
  }

  // Debug prop changes
  $: console.log('PDFViewer prop pdfFile changed:', typeof pdfFile === 'string' ? pdfFile : (pdfFile?.name || 'null'));
  $: console.log('PDFViewer canvases ready:', canvasesReady);
  
  // Only load PDF when both conditions are met and it's a new file
  $: if (pdfFile && canvasesReady && pdfFile !== lastLoadedFile) {
    console.log('Loading PDF - file changed and canvases ready:', typeof pdfFile === 'string' ? pdfFile : pdfFile.name);
    loadPDF();
  }

  // Re-render drawing paths when they change
  $: if (drawingEngine && $currentPagePaths && canvasesReady) {
    drawingEngine.renderPaths($currentPagePaths);
  }
  
  
  // Update cursor and tool when drawing state changes
  $: if ($drawingState.tool && containerDiv) {
    console.log('TOOL CHANGED:', $drawingState.tool);
    updateCursor();
    
	if (['text', 'note', 'stamp', 'arrow'].includes($drawingState.tool)) {
		console.log(`${$drawingState.tool} tool selected - handled by overlay component`);
	} else if (['pencil', 'eraser', 'highlight'].includes($drawingState.tool)) {
		console.log(`${$drawingState.tool} tool selected - handled by drawing canvas`);
	}
  }

  onMount(async () => {
    console.log('PDFViewer mounted');
    pdfManager = new PDFManager();
    
    // Test cursor accessibility first
    await testCursorAccess();
    
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
        console.log('Drawing engines initialized successfully');
        
        // If there's a pending file, load it now
        if (pdfFile && pdfFile !== lastLoadedFile) {
          console.log('Loading pending PDF file:', typeof pdfFile === 'string' ? pdfFile : pdfFile.name);
          await loadPDF();
        }
      } catch (error) {
        console.error('Error initializing drawing engines:', error);
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
    console.log('loadPDF called with pdfFile:', typeof pdfFile, pdfFile);
    
    if (!pdfFile || !pdfCanvas) {
      console.log('Missing pdfFile or pdfCanvas:', { pdfFile: !!pdfFile, pdfCanvas: !!pdfCanvas });
      return;
    }

    const isUrl = typeof pdfFile === 'string';
    console.log('Loading PDF - isUrl:', isUrl, 'Value:', isUrl ? pdfFile : `${(pdfFile as File).name} (Size: ${(pdfFile as File).size})`);
    
    try {
      console.log('Setting loading state to true...');
      pdfState.update(state => ({ ...state, isLoading: true }));
      
      let document;
      if (isUrl) {
        console.log('Calling pdfManager.loadFromUrl with:', pdfFile);
        try {
          document = await pdfManager.loadFromUrl(pdfFile as string);
        } catch (urlError) {
          console.error('Error loading from URL:', urlError);
          
          // Check if it might be a CORS issue
          const error = urlError as Error;
          if (error.message?.includes('CORS') || error.message?.includes('fetch')) {
            throw new Error(`Failed to load PDF from URL: This might be a CORS issue. The PDF server doesn't allow cross-origin requests. Try using a PDF with CORS enabled or a direct download link.`);
          }
          
          throw new Error(`Failed to load PDF from URL: ${(urlError as Error).message}`);
        }
      } else {
        console.log('Calling pdfManager.loadFromFile...');
        document = await pdfManager.loadFromFile(pdfFile as File);
      }
      console.log('PDF loaded successfully, pages:', document.numPages);
      
      // Extract PDF title and update webpage title
      try {
        console.log('Attempting to extract PDF metadata...');
        const metadata = await document.getMetadata();
        console.log('PDF metadata extracted:', metadata);
        
        const pdfTitle = (metadata.info as any)?.Title;
        console.log('PDF Title from metadata:', pdfTitle);
        
        if (pdfTitle && pdfTitle.trim()) {
          const cleanTitle = pdfTitle.trim();
          window.document.title = `${cleanTitle} - LeedPDF`;
          console.log('✅ Updated webpage title to PDF title:', `${cleanTitle} - LeedPDF`);
        } else {
          // Fallback to filename if available
          const fallbackTitle = typeof pdfFile === 'string' 
            ? extractFilenameFromUrl(pdfFile).replace(/\.pdf$/i, '')
            : pdfFile.name.replace(/\.pdf$/i, '');
          window.document.title = `${fallbackTitle} - LeedPDF`;
          console.log('✅ No PDF title found, updated webpage title to filename:', `${fallbackTitle} - LeedPDF`);
        }
      } catch (titleError) {
        console.error('❌ Could not extract PDF title:', titleError);
        // Try fallback anyway
        try {
          const fallbackTitle = typeof pdfFile === 'string' 
            ? extractFilenameFromUrl(pdfFile).replace(/\.pdf$/i, '')
            : pdfFile.name.replace(/\.pdf$/i, '');
          window.document.title = `${fallbackTitle} - LeedPDF`;
          console.log('✅ Used fallback filename as title:', `${fallbackTitle} - LeedPDF`);
        } catch (fallbackError) {
          console.error('❌ Even fallback title failed:', fallbackError);
        }
      }
      
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
      
      // Auto-fit to height on first load for better initial view
      await fitToHeight();
      
      console.log('PDF render completed successfully');
    } catch (error) {
      console.error('Error loading PDF:', error);
      pdfState.update(state => ({ ...state, isLoading: false }));
      // Reset the tracking to allow retry
      lastLoadedFile = null;
      alert(`Failed to load PDF: ${(error as Error).message}`);
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

      // Sync drawing canvas and Konva stage sizes with PDF canvas
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
    console.log('Canvas handlePointerDown called:', $drawingState.tool, event.target);
    if (!drawingEngine) return;
    
    // If Ctrl is pressed, let the container handle panning
    if (event.ctrlKey) {
      console.log('Ctrl pressed, letting container handle panning');
      return; // Don't capture the event, let container handle it
    }
    
    // Only handle freehand drawing tools (pencil, eraser, highlight) here
    // Text and note tools are handled by overlay components
    // Arrow and stamp tools are handled by Konva
    if (!['pencil', 'eraser', 'highlight'].includes($drawingState.tool)) {
      console.log('Non-freehand tool detected:', $drawingState.tool);
      
      // Text and note tools are now handled by overlay components, not here
      if (['text', 'note'].includes($drawingState.tool)) {
        console.log(`${$drawingState.tool} tool click ignored - handled by overlay component`);
        return;
      }
      
      // Arrow tool should be handled by ArrowOverlay
      if (['arrow'].includes($drawingState.tool)) {
        console.log(`${$drawingState.tool} tool click ignored - handled by ArrowOverlay`);
        return;
      }
      
      // Stamp tool is handled by overlay
      if (['stamp'].includes($drawingState.tool)) {
        console.log(`${$drawingState.tool} tool click ignored - handled by stamp overlay`);
        return;
      }
      
      console.warn('Unknown tool event reached drawing canvas:', $drawingState.tool);
      return;
    }
    
    console.log('Freehand tool starting drawing:', $drawingState.tool);
    
    event.preventDefault();
    drawingCanvas.setPointerCapture(event.pointerId);

    isDrawing = true;
    const point = drawingEngine.getPointFromEvent(event);
    
    const size = $drawingState.tool === 'eraser' ? $drawingState.eraserSize : $drawingState.lineWidth;
    const color = $drawingState.tool === 'highlight' ? $drawingState.highlightColor : $drawingState.color;
    drawingEngine.startDrawing(
      point,
      $drawingState.tool,
      color,
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
        (contentWrapper as HTMLElement).style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
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
        // Add drawing path (pencil or highlight)
        const color = $drawingState.tool === 'highlight' ? $drawingState.highlightColor : $drawingState.color;
        const drawingPath: DrawingPath = {
          tool: $drawingState.tool,
          color: color,
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

  // Custom cursors using separate SVG files with fallbacks
  let cursorsLoaded = false;
  
  // Test if SVG cursors can be loaded
  async function testCursorAccess() {
    try {
      const response = await fetch('/cursors/pencil.svg');
      if (response.ok) {
        console.log('SVG cursor files are accessible');
        cursorsLoaded = true;
      } else {
        console.warn('SVG cursor files not accessible, status:', response.status);
        cursorsLoaded = false;
      }
    } catch (error) {
      console.warn('Error loading SVG cursor files:', error);
      cursorsLoaded = false;
    }
  }

  const pencilCursor = `url('/cursors/pencil.svg') 2 26, crosshair`;
  const eraserCursor = `url('/cursors/eraser.svg') 16 16, crosshair`;
  
  // Alternative: using built-in cursors as backup
  const pencilCursorFallback = 'crosshair';
  const eraserCursorFallback = 'grab';

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
            // Test if cursor was applied
            setTimeout(() => {
              console.log('Current drawing canvas cursor:', drawingCanvas.style.cursor);
            }, 100);
          } else if ($drawingState.tool === 'highlight') {
            // Use pencil cursor for highlight tool (similar drawing experience)
            console.log('Setting highlight cursor:', pencilCursor);
            drawingCanvas.style.cursor = pencilCursor;
          } else {
            console.log('Setting pencil cursor:', pencilCursor);
            drawingCanvas.style.cursor = pencilCursor;
            // Test if cursor was applied
            setTimeout(() => {
              console.log('Current drawing canvas cursor:', drawingCanvas.style.cursor);
            }, 100);
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
    console.log('Container handleContainerPointerDown called:', event.target, 'Ctrl pressed:', event.ctrlKey);
    // Only handle panning when Ctrl is pressed
    // Let drawing canvas handle its own events
    if (event.ctrlKey) {
      console.log('Container starting panning');
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
        (contentWrapper as HTMLElement).style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
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

  // Function to get merged canvas for a specific page
  // Helper function to check if a page has any annotations
  export async function pageHasAnnotations(pageNumber: number): Promise<boolean> {
    // Get current values from all annotation stores
    let hasDrawingPaths = false;
    let hasTextAnnotations = false;
    let hasArrowAnnotations = false;
    let hasStampAnnotations = false;
    let hasStickyNotes = false;
    
    // Check drawing paths
    const unsubscribePaths = drawingPaths.subscribe(paths => {
      const pagePaths = paths.get(pageNumber) || [];
      hasDrawingPaths = pagePaths.length > 0;
    });
    unsubscribePaths();
    
    // Check text annotations
    const unsubscribeText = textAnnotations.subscribe(annotations => {
      const pageTexts = annotations.get(pageNumber) || [];
      hasTextAnnotations = pageTexts.length > 0;
    });
    unsubscribeText();
    
    // Check arrow annotations
    const unsubscribeArrows = arrowAnnotations.subscribe(annotations => {
      const pageArrows = annotations.get(pageNumber) || [];
      hasArrowAnnotations = pageArrows.length > 0;
    });
    unsubscribeArrows();
    
    // Check stamp annotations
    const unsubscribeStamps = stampAnnotations.subscribe(annotations => {
      const pageStamps = annotations.get(pageNumber) || [];
      hasStampAnnotations = pageStamps.length > 0;
    });
    unsubscribeStamps();
    
    // Check sticky note annotations
    const unsubscribeStickyNotes = stickyNoteAnnotations.subscribe(annotations => {
      const pageStickyNotes = annotations.get(pageNumber) || [];
      hasStickyNotes = pageStickyNotes.length > 0;
    });
    unsubscribeStickyNotes();
    
    const hasAnyAnnotations = hasDrawingPaths || hasTextAnnotations || hasArrowAnnotations || hasStampAnnotations || hasStickyNotes;
    
    console.log(`Page ${pageNumber} annotations check:`, {
      hasDrawingPaths,
      hasTextAnnotations, 
      hasArrowAnnotations,
      hasStampAnnotations,
      hasStickyNotes,
      hasAnyAnnotations
    });
    
    return hasAnyAnnotations;
  }

  // Function to get merged canvas for a specific page
  export async function getMergedCanvasForPage(pageNumber: number): Promise<HTMLCanvasElement | null> {
    if (!$pdfState.document) {
      console.error('No PDF document loaded');
      return null;
    }

    try {
      // Create temporary canvases for this page
      const tempPdfCanvas = document.createElement('canvas');
      const tempDrawingCanvas = document.createElement('canvas');
      
      const page = await $pdfState.document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.0 }); // Use scale 1 for consistent export
      const outputScale = 2; // Higher resolution for export
      
      // Set canvas dimensions
      tempPdfCanvas.width = Math.floor(viewport.width * outputScale);
      tempPdfCanvas.height = Math.floor(viewport.height * outputScale);
      tempDrawingCanvas.width = viewport.width;
      tempDrawingCanvas.height = viewport.height;
      
      // Render PDF to temporary canvas
      const pdfContext = tempPdfCanvas.getContext('2d');
      if (pdfContext) {
        await pdfManager.renderPageToCanvas(page, {
          scale: 1, // Use scale 1 since the canvas is already sized with outputScale
          canvas: tempPdfCanvas
        });
      }
      
      // Render drawing paths to temporary canvas
      const drawingContext = tempDrawingCanvas.getContext('2d');
      if (drawingContext && drawingEngine) {
        // Get drawing paths for this specific page
        let pagePaths: any[] = [];
        const unsubscribePaths = drawingPaths.subscribe(paths => {
          pagePaths = paths.get(pageNumber) || [];
        });
        unsubscribePaths();
        
        // Create temporary drawing engine for this canvas
        const tempEngine = new DrawingEngine(tempDrawingCanvas);
        tempEngine.renderPaths(pagePaths);
      }
      
      // Now create the merged canvas with all annotations
      return await createMergedCanvasWithAnnotations(
        tempPdfCanvas, 
        tempDrawingCanvas, 
        pageNumber,
        viewport.width,
        viewport.height,
        outputScale
      );
    } catch (error) {
      console.error(`Error creating merged canvas for page ${pageNumber}:`, error);
      return null;
    }
  }

  // Helper function to create merged canvas with all annotations
  async function createMergedCanvasWithAnnotations(
    pdfCanvas: HTMLCanvasElement,
    drawingCanvas: HTMLCanvasElement,
    pageNumber: number,
    canvasWidth: number,
    canvasHeight: number,
    outputScale: number
  ): Promise<HTMLCanvasElement | null> {
    const mergedCanvas = document.createElement('canvas');
    const ctx = mergedCanvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context for merged canvas');
      return null;
    }

    // Set canvas size to match PDF canvas
    mergedCanvas.width = pdfCanvas.width;
    mergedCanvas.height = pdfCanvas.height;

    // Draw PDF canvas first (background)
    ctx.drawImage(pdfCanvas, 0, 0);

    // Scale the drawing canvas to match the PDF canvas scaling
    const scaleX = pdfCanvas.width / drawingCanvas.width;
    const scaleY = pdfCanvas.height / drawingCanvas.height;

    // Draw drawing canvas scaled to match PDF resolution
    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(drawingCanvas, 0, 0);
    ctx.restore();

    // Get all annotation types for this specific page
    let pageTextAnnotations: any[] = [];
    let pageArrowAnnotations: any[] = [];
    let pageStampAnnotations: any[] = [];
    let pageStickyNotes: any[] = [];
    
    // Subscribe to get annotations for this specific page
    const unsubscribeText = textAnnotations.subscribe(annotations => {
      pageTextAnnotations = annotations.get(pageNumber) || [];
    });
    const unsubscribeArrows = arrowAnnotations.subscribe(annotations => {
      pageArrowAnnotations = annotations.get(pageNumber) || [];
    });
    const unsubscribeStamps = stampAnnotations.subscribe(annotations => {
      pageStampAnnotations = annotations.get(pageNumber) || [];
    });
    const unsubscribeStickyNotes = stickyNoteAnnotations.subscribe(annotations => {
      pageStickyNotes = annotations.get(pageNumber) || [];
    });
    
    // Clean up subscriptions
    unsubscribeText();
    unsubscribeArrows();
    unsubscribeStamps();
    unsubscribeStickyNotes();

    // Draw text annotations
    if (pageTextAnnotations.length > 0) {
      ctx.save();
      ctx.scale(scaleX, scaleY);
      
      pageTextAnnotations.forEach(annotation => {
        const x = annotation.relativeX * canvasWidth;
        const y = annotation.relativeY * canvasHeight;
        
        ctx.font = `${annotation.fontSize}px ${annotation.fontFamily}`;
        ctx.fillStyle = annotation.color;
        ctx.textBaseline = 'top';
        
        const lines = annotation.text.split('\n');
        lines.forEach((line: string, index: number) => {
          ctx.fillText(line, x, y + (index * annotation.fontSize * 1.2));
        });
      });
      
      ctx.restore();
    }

    // Draw arrow annotations (same logic as in getMergedCanvas)
    if (pageArrowAnnotations.length > 0) {
      ctx.save();
      ctx.scale(scaleX, scaleY);
      
      pageArrowAnnotations.forEach(arrow => {
        const x1 = arrow.relativeX1 * canvasWidth;
        const y1 = arrow.relativeY1 * canvasHeight;
        const x2 = arrow.relativeX2 * canvasWidth;
        const y2 = arrow.relativeY2 * canvasHeight;
        
        ctx.strokeStyle = arrow.stroke;
        ctx.lineWidth = arrow.strokeWidth;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        if (arrow.arrowHead) {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 10;
          
          ctx.fillStyle = arrow.stroke;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      });
      
      ctx.restore();
    }

    // Draw stamp annotations
    if (pageStampAnnotations.length > 0) {
      console.log(`Rendering ${pageStampAnnotations.length} stamp annotations for export`);
      ctx.save();
      ctx.scale(scaleX, scaleY);
      
      // Load all stamp images in parallel and wait for them
        const stampPromises = pageStampAnnotations.map(async (stampAnnotation) => {
        // Handle backward compatibility: check if stamp has stampId or old SVG format
        let svgString: string;
        let stampName: string;
        
        if (stampAnnotation.stampId) {
          // New format: get SVG from stamp definition
          const stamp = getStampById(stampAnnotation.stampId);
          if (!stamp) {
            console.warn('Stamp not found:', stampAnnotation.stampId);
            return null;
          }
          svgString = stamp.svg;
          stampName = stamp.name;
        } else {
          // Old format: SVG is stored directly in stamp property  
          svgString = (stampAnnotation as any).stamp;
          stampName = 'Legacy Stamp';
          if (!svgString) {
            console.warn('No SVG found for legacy stamp:', stampAnnotation);
            return null;
          }
        }
        
        const x = stampAnnotation.relativeX * canvasWidth;
        const y = stampAnnotation.relativeY * canvasHeight;
        // Calculate stamp size the same way as StampAnnotation component
        const MIN_SIZE = 16;
        const MAX_SIZE = 120;
        const calculatedSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, stampAnnotation.relativeSize * Math.min(canvasWidth, canvasHeight)));
        const stampWidth = calculatedSize;
        const stampHeight = calculatedSize;
        
        try {
          // Convert SVG string to image
          const img = await svgToImage(svgString, stampWidth, stampHeight);
          
          console.log(`Drawing stamp "${stampName}" at (${x}, ${y}) size ${stampWidth}x${stampHeight}`);
          ctx.drawImage(img, x, y, stampWidth, stampHeight);
          
          return { success: true, stamp: stampName };
        } catch (error) {
          console.warn('Failed to convert SVG to image for export:', stampName, error);
          
          // Draw fallback rectangle
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fillRect(x, y, stampWidth, stampHeight);
          ctx.fillStyle = '#000';
          ctx.font = '12px Arial';
          ctx.fillText(stampName, x + 5, y + 20);
          
          return { success: false, stamp: stampName, error };
        }
      });
      
      // Wait for all stamps to be processed
      const results = await Promise.all(stampPromises);
      console.log('Stamp rendering results:', results);
      
      ctx.restore();
    }

    // Draw sticky note annotations
    if (pageStickyNotes.length > 0) {
      ctx.save();
      ctx.scale(scaleX, scaleY);
      
      pageStickyNotes.forEach(note => {
        const x = note.relativeX * canvasWidth;
        const y = note.relativeY * canvasHeight;
        const width = note.width || 200;
        const height = note.height || 150;
        
        ctx.fillStyle = note.color || '#FFF59D';
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        
        ctx.fillStyle = '#000';
        ctx.font = `${note.fontSize || 14}px Arial`;
        
        const words = note.text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        const maxWidth = width - 20;
        
        words.forEach((word: string) => {
          const testLine = currentLine + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = word + ' ';
          } else {
            currentLine = testLine;
          }
        });
        lines.push(currentLine);
        
        const lineHeight = (note.fontSize || 14) * 1.2;
        lines.forEach((line, index) => {
          ctx.fillText(line.trim(), x + 10, y + 20 + (index * lineHeight));
        });
      });
      
      ctx.restore();
    }

    return mergedCanvas;
  }

  export async function getMergedCanvas(): Promise<HTMLCanvasElement | null> {
    if (!pdfCanvas || !drawingCanvas) {
      console.error('Canvases not available for export');
      return null;
    }

    try {
      // Create a new canvas for merging
      const mergedCanvas = document.createElement('canvas');
      const ctx = mergedCanvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context for merged canvas');
        return null;
      }

      // Get the device pixel ratio used for PDF rendering
      const outputScale = window.devicePixelRatio || 1;
      
      // Set canvas size to match PDF canvas (already scaled by devicePixelRatio)
      mergedCanvas.width = pdfCanvas.width;
      mergedCanvas.height = pdfCanvas.height;

      // Draw PDF canvas first (background) - already properly scaled
      ctx.drawImage(pdfCanvas, 0, 0);

      // Scale the drawing canvas to match the PDF canvas scaling
      // The drawing canvas is at CSS size, but PDF canvas is at device pixel ratio size
      const scaleX = pdfCanvas.width / drawingCanvas.width;
      const scaleY = pdfCanvas.height / drawingCanvas.height;
      
      console.log('Export scaling:', { 
        pdfSize: [pdfCanvas.width, pdfCanvas.height], 
        drawingSize: [drawingCanvas.width, drawingCanvas.height],
        scale: [scaleX, scaleY],
        outputScale 
      });

      // Draw drawing canvas scaled to match PDF resolution
      ctx.save();
      ctx.scale(scaleX, scaleY);
      ctx.drawImage(drawingCanvas, 0, 0);
      ctx.restore();

      // Draw text annotations scaled to match PDF resolution
      const canvasWidth = parseFloat(pdfCanvas.style.width) || pdfCanvas.width / outputScale;
      const canvasHeight = parseFloat(pdfCanvas.style.height) || pdfCanvas.height / outputScale;
      
      // Get current page text annotations from the store
      let currentTextAnnotations: any[] = [];
      const unsubscribe = currentPageTextAnnotations.subscribe(annotations => {
        currentTextAnnotations = annotations;
      });
      unsubscribe();
      
      if (currentTextAnnotations.length > 0) {
        ctx.save();
        ctx.scale(scaleX, scaleY);
        
        currentTextAnnotations.forEach(annotation => {
          const x = annotation.relativeX * canvasWidth;
          const y = annotation.relativeY * canvasHeight;
          
          ctx.font = `${annotation.fontSize}px ${annotation.fontFamily}`;
          ctx.fillStyle = annotation.color;
          ctx.textBaseline = 'top';
          
          // Handle multi-line text
          const lines = annotation.text.split('\n');
          lines.forEach((line: string, index: number) => {
            ctx.fillText(line, x, y + (index * annotation.fontSize * 1.2));
          });
        });
        
        ctx.restore();
      }

      // Draw arrow annotations scaled to match PDF resolution
      let currentArrowAnnotations: any[] = [];
      const unsubscribeArrows = currentPageArrowAnnotations.subscribe(annotations => {
        currentArrowAnnotations = annotations;
      });
      unsubscribeArrows();
      
      if (currentArrowAnnotations.length > 0) {
        ctx.save();
        ctx.scale(scaleX, scaleY);
        
        currentArrowAnnotations.forEach(arrow => {
          const x1 = arrow.relativeX1 * canvasWidth;
          const y1 = arrow.relativeY1 * canvasHeight;
          const x2 = arrow.relativeX2 * canvasWidth;
          const y2 = arrow.relativeY2 * canvasHeight;
          
          // Draw arrow line
          ctx.strokeStyle = arrow.stroke;
          ctx.lineWidth = arrow.strokeWidth;
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          
          // Draw arrowhead if enabled
          if (arrow.arrowHead) {
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLength = 10;
            
            ctx.fillStyle = arrow.stroke;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(
              x2 - headLength * Math.cos(angle - Math.PI / 6),
              y2 - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              x2 - headLength * Math.cos(angle + Math.PI / 6),
              y2 - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }
        });
        
        ctx.restore();
      }

      // Draw stamp annotations scaled to match PDF resolution
      let currentStampAnnotations: any[] = [];
      const unsubscribeStamps = currentPageStampAnnotations.subscribe(annotations => {
        currentStampAnnotations = annotations;
      });
      unsubscribeStamps();
      
      if (currentStampAnnotations.length > 0) {
        console.log(`Rendering ${currentStampAnnotations.length} current page stamp annotations for export`);
        ctx.save();
        ctx.scale(scaleX, scaleY);
        
        // Load all stamp images in parallel and wait for them
        const stampPromises = currentStampAnnotations.map(async (stampAnnotation) => {
          // Handle backward compatibility: check if stamp has stampId or old SVG format
          let svgString: string;
          let stampName: string;
          
          if (stampAnnotation.stampId) {
            // New format: get SVG from stamp definition
            const stamp = getStampById(stampAnnotation.stampId);
            if (!stamp) {
              console.warn('Current page stamp not found:', stampAnnotation.stampId);
              return null;
            }
            svgString = stamp.svg;
            stampName = stamp.name;
          } else {
            // Old format: SVG is stored directly in stamp property  
            svgString = (stampAnnotation as any).stamp;
            stampName = 'Legacy Stamp';
            if (!svgString) {
              console.warn('No SVG found for current page legacy stamp:', stampAnnotation);
              return null;
            }
          }
          
          const x = stampAnnotation.relativeX * canvasWidth;
          const y = stampAnnotation.relativeY * canvasHeight;
          // Calculate stamp size the same way as StampAnnotation component
          const MIN_SIZE = 16;
          const MAX_SIZE = 120;
          const calculatedSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, stampAnnotation.relativeSize * Math.min(canvasWidth, canvasHeight)));
          const stampWidth = calculatedSize;
          const stampHeight = calculatedSize;
          
          try {
            // Convert SVG string to image
            const img = await svgToImage(svgString, stampWidth, stampHeight);
            
            console.log(`Drawing current page stamp "${stampName}" at (${x}, ${y}) size ${stampWidth}x${stampHeight}`);
            ctx.drawImage(img, x, y, stampWidth, stampHeight);
            
            return { success: true, stamp: stampName };
          } catch (error) {
            console.warn('Failed to convert SVG to image for current page export:', stampName, error);
            
            // Draw fallback rectangle
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(x, y, stampWidth, stampHeight);
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.fillText(stampName, x + 5, y + 20);
            
            return { success: false, stamp: stampName, error };
          }
        });
        
        // Wait for all stamps to be processed
        const results = await Promise.all(stampPromises);
        console.log('Current page stamp rendering results:', results);
        
        ctx.restore();
      }

      // Draw sticky note annotations scaled to match PDF resolution
      let currentStickyNotes: any[] = [];
      const unsubscribeStickyNotes = currentPageStickyNotes.subscribe(annotations => {
        currentStickyNotes = annotations;
      });
      unsubscribeStickyNotes();
      
      if (currentStickyNotes.length > 0) {
        ctx.save();
        ctx.scale(scaleX, scaleY);
        
        currentStickyNotes.forEach(note => {
          const x = note.relativeX * canvasWidth;
          const y = note.relativeY * canvasHeight;
          const width = note.width || 200;
          const height = note.height || 150;
          
          // Draw sticky note background
          ctx.fillStyle = note.color || '#FFF59D';
          ctx.fillRect(x, y, width, height);
          
          // Draw sticky note border
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, width, height);
          
          // Draw sticky note text
          ctx.fillStyle = '#000';
          ctx.font = `${note.fontSize || 14}px Arial`;
          
          // Handle multi-line text with word wrapping
          const words = note.text.split(' ');
          const lines: string[] = [];
          let currentLine = '';
          const maxWidth = width - 20;
          
          words.forEach((word: string) => {
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine !== '') {
              lines.push(currentLine);
              currentLine = word + ' ';
            } else {
              currentLine = testLine;
            }
          });
          lines.push(currentLine);
          
          // Draw lines with proper spacing
          const lineHeight = (note.fontSize || 14) * 1.2;
          lines.forEach((line, index) => {
            ctx.fillText(line.trim(), x + 10, y + 20 + (index * lineHeight));
          });
        });
        
        ctx.restore();
      }

      console.log('Merged canvas created successfully:', mergedCanvas.width, 'x', mergedCanvas.height);
      return mergedCanvas;
    } catch (error) {
      console.error('Error creating merged canvas:', error);
      return null;
    }
  }
</script>

<div bind:this={containerDiv} class="pdf-viewer relative w-full h-full overflow-hidden">
  <!-- Debug info logged to console -->
  
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
      
      
      <!-- Text Overlay for Custom Text Annotations -->
      {#if $pdfState.document && pdfCanvas}
        <TextOverlay 
          canvasWidth={pdfCanvas.style.width ? parseFloat(pdfCanvas.style.width) : 0}
          canvasHeight={pdfCanvas.style.height ? parseFloat(pdfCanvas.style.height) : 0}
        />
      {/if}
      
      <!-- Sticky Note Overlay for Custom Sticky Note Annotations -->
      {#if $pdfState.document && pdfCanvas}
        <StickyNoteOverlay 
          containerWidth={pdfCanvas.style.width ? parseFloat(pdfCanvas.style.width) : 0}
          containerHeight={pdfCanvas.style.height ? parseFloat(pdfCanvas.style.height) : 0}
          scale={$pdfState.scale}
        />
      {/if}
      
      <!-- Stamp Overlay for Custom Stamp Annotations -->
      {#if $pdfState.document && pdfCanvas}
        <StampOverlay 
          containerWidth={pdfCanvas.style.width ? parseFloat(pdfCanvas.style.width) : 0}
          containerHeight={pdfCanvas.style.height ? parseFloat(pdfCanvas.style.height) : 0}
          scale={$pdfState.scale}
        />
      {/if}
      
      <!-- Arrow Overlay for Custom Arrow Annotations -->
      {#if $pdfState.document && pdfCanvas}
        <ArrowOverlay 
          containerWidth={pdfCanvas.style.width ? parseFloat(pdfCanvas.style.width) : 0}
          containerHeight={pdfCanvas.style.height ? parseFloat(pdfCanvas.style.height) : 0}
          scale={$pdfState.scale}
        />
      {/if}
      
    </div>
  </div>

  {#if $pdfState.isLoading}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-sage border-t-transparent"></div>
      <span class="ml-3 text-charcoal dark:text-gray-200 font-medium">Opening your PDF...</span>
    </div>
  {:else if $pdfState.document && $pdfState.totalPages > 0}
    <!-- Page Info -->
    <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 floating-panel">
      <div class="flex items-center space-x-2 text-sm text-charcoal dark:text-gray-200">
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
        <h3 class="text-xl font-medium text-charcoal mb-2">Drop a PDF here or click to browse</h3>
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
  
  :global(.dark) .pdf-viewer {
    background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
  }
  
  /* Drawing canvas cursor is dynamically controlled by JavaScript */
</style>
