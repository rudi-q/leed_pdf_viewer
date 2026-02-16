<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import {
		addDrawingPath,
		arrowAnnotations,
		clearTextAnnotationSelection,
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
		textAnnotations,
		updatePagePathsWithUndo
	} from '../stores/drawingStore';
	import { PDFManager, PDFLoadError } from '../utils/pdfUtils';
	import { DrawingEngine, splitPathByEraser } from '../utils/drawingUtils';
	import { toastStore } from '../stores/toastStore';
	import { openExternalUrl } from '../utils/navigationUtils';
	import {
		trackPdfUpload,
		trackPdfLoadTime,
		trackError,
		trackFirstAnnotation
	} from '../utils/analytics';
	import TextOverlay from './TextOverlay.svelte';
	import StickyNoteOverlay from './StickyNoteOverlay.svelte';
	import StampOverlay from './StampOverlay.svelte';
	import ArrowOverlay from './ArrowOverlay.svelte';
	import TextSelectionOverlay from './TextSelectionOverlay.svelte';
	import { TOOLBAR_HEIGHT } from '$lib/constants';
	import { setWindowTitle } from '$lib/utils/tauriUtils';

	// Helper function to convert SVG string to image
	async function svgToImage(
		svgString: string,
		width: number,
		height: number
	): Promise<HTMLImageElement> {
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

	export let pdfFile: File | string | null = null;
	export let viewOnlyMode = false;
	export let presentationMode = false;

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
	let isLoadingPdf = false; // Guard to prevent multiple simultaneous loads

	// Eraser gesture modifier: Alt for partial erase
	let isAltEraseMode = false;

	// Canvas dimensions for overlays - will be updated manually
	let canvasDisplayWidth = 0;
	let canvasDisplayHeight = 0;

	// Text extraction state
	let extractedPageText = '';
	let isExtractingText = false;
	let overlayHeight = 0;

	// Calculate overlay height to match container height minus toolbar
	$: if (containerDiv) {
		overlayHeight = containerDiv.clientHeight - (presentationMode ? 0 : TOOLBAR_HEIGHT);
	}

	// Debug canvas dimensions
	$: if (canvasDisplayWidth > 0 && canvasDisplayHeight > 0) {
		console.log('Canvas display dimensions updated:', {
			width: canvasDisplayWidth,
			height: canvasDisplayHeight,
			scale: $pdfState.scale
		});
	}

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
	$: console.log(
		'PDFViewer prop pdfFile changed:',
		typeof pdfFile === 'string' ? pdfFile : pdfFile?.name || 'null'
	);
	$: console.log('PDFViewer canvases ready:', canvasesReady);

	// Only load PDF when both conditions are met and it's a new file
	$: if (pdfFile && canvasesReady && pdfFile !== lastLoadedFile) {
		console.log(
			'Loading PDF - file changed and canvases ready:',
			typeof pdfFile === 'string' ? pdfFile : pdfFile.name
		);
		loadPDF();
	}

	// Re-render drawing paths when they change
	$: if (drawingEngine && $currentPagePaths && canvasesReady) {
		drawingEngine.renderPaths($currentPagePaths, $pdfState.scale);
	}

	// Update cursor and tool when drawing state changes
	$: if ($drawingState.tool && containerDiv) {
		console.log('TOOL CHANGED:', $drawingState.tool);
		updateCursor();

		if (['text', 'note', 'stamp', 'arrow'].includes($drawingState.tool)) {
			console.log(`${$drawingState.tool} tool selected - handled by overlay component`);
		} else if (['pencil', 'eraser', 'highlight'].includes($drawingState.tool)) {
			console.log(`${$drawingState.tool} tool selected - handled by drawing canvas`);
		} else if ($drawingState.tool === 'select') {
			console.log('select tool selected - extracting text');
			extractTextFromCurrentPage();
		}
	}

	// Extract text when page changes if select tool is active
	$: if ($pdfState.currentPage && $drawingState.tool === 'select' && $pdfState.document) {
		extractTextFromCurrentPage();
	}

	async function extractTextFromCurrentPage() {
		if (!$pdfState.document || isExtractingText) return;

		isExtractingText = true;
		extractedPageText = '';

		try {
			const page = await $pdfState.document.getPage($pdfState.currentPage);
			const textContent = await page.getTextContent();

			// Use PDF.js positioning data to preserve layout
			let lastY = -1;
			let text = '';
			const lineHeight = 12; // Threshold for detecting new lines

			textContent.items.forEach((item: any, index: number) => {
				// Skip TextMarkedContent items (they don't have str property)
				if (!('str' in item)) return;

				const currentY = item.transform[5]; // Y position

				// Detect new line if Y position changes significantly
				if (lastY !== -1 && Math.abs(currentY - lastY) > lineHeight) {
					// Check if it's a large gap (paragraph break)
					if (Math.abs(currentY - lastY) > lineHeight * 2) {
						text += '\n\n'; // Paragraph break
					} else {
						text += '\n'; // Line break
					}
				} else if (index > 0 && item.str.trim() !== '') {
					// Add space between words on the same line
					const prevItem = textContent.items[index - 1];
					if ('str' in prevItem && prevItem.str.trim() !== '' && !prevItem.str.endsWith(' ')) {
						text += ' ';
					}
				}

				text += item.str;
				lastY = currentY;
			});

			// Clean up excessive whitespace while preserving intentional breaks
			text = text
				.replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
				.replace(/\n{3,}/g, '\n\n') // Max 2 consecutive line breaks
				.trim();

			extractedPageText = text || 'No text found on this page';
			console.log('Extracted text with formatting, length:', text.length);
		} catch (error) {
			console.error('Error extracting text:', error);
			extractedPageText = 'Error extracting text from this page';
		} finally {
			isExtractingText = false;
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
					console.log(
						'Loading pending PDF file:',
						typeof pdfFile === 'string' ? pdfFile : pdfFile.name
					);
					await loadPDF();
				}
			} catch (error) {
				console.error('Error initializing drawing engines:', error);
			}
		} else {
			console.log('Canvases not ready yet:', {
				pdfCanvas: !!pdfCanvas,
				drawingCanvas: !!drawingCanvas
			});
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

		// Prevent multiple simultaneous loads
		if (isLoadingPdf) {
			console.log('Already loading a PDF, skipping...');
			return;
		}
		isLoadingPdf = true;

		const isUrl = typeof pdfFile === 'string';
		const loadStartTime = performance.now();
		console.log(
			'Loading PDF - isUrl:',
			isUrl,
			'Value:',
			isUrl ? pdfFile : `${(pdfFile as File).name} (Size: ${(pdfFile as File).size})`
		);

		// Track PDF upload if it's a file
		if (!isUrl && pdfFile instanceof File) {
			trackPdfUpload(pdfFile, 'drag_drop'); // You can customize upload method based on how it was uploaded
		}

		try {
			console.log('Setting loading state to true...');
			pdfState.update((state) => ({ ...state, isLoading: true }));

			let document;
			if (isUrl) {
				console.log('Calling pdfManager.loadFromUrl with:', pdfFile);
				try {
					// Pass retry callback to show toast notifications
					document = await pdfManager.loadFromUrl(
						pdfFile as string,
						(attempt: number, total: number) => {
							toastStore.info(
								'Retrying PDF Load',
								`Attempting to load PDF (${attempt}/${total})...`,
								{ duration: 3000 }
							);
						}
					);
				} catch (urlError) {
					console.error('Error loading from URL:', urlError);
					console.log('Error type check:', urlError instanceof PDFLoadError, urlError);

					// Check if it's our custom PDFLoadError with retry information
					if (urlError instanceof PDFLoadError) {
						// Re-throw with updated message but preserve the PDFLoadError type
						throw new PDFLoadError(
							`Unable to load this PDF due to restrictions from the host website. The server doesn't allow loading PDFs through external tools like LeedPDF.`,
							urlError.attempts,
							urlError.originalUrl
						);
					}

					// Check if it might be a CORS issue
					const error = urlError as Error;
					if (error.message?.includes('CORS') || error.message?.includes('fetch')) {
						throw new Error(
							`Failed to load PDF from URL: This might be a CORS issue. The PDF server doesn't allow cross-origin requests. Try using a PDF with CORS enabled or a direct download link.`
						);
					}

					// Re-throw as-is to avoid wrapping
					throw urlError;
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
					setWindowTitle(`${cleanTitle} - LeedPDF`);
					console.log('✅ Updated webpage title to PDF title:', `${cleanTitle} - LeedPDF`);
				} else {
					// Fallback to filename if available
					const fallbackTitle =
						typeof pdfFile === 'string'
							? extractFilenameFromUrl(pdfFile).replace(/\.pdf$/i, '')
							: pdfFile.name.replace(/\.pdf$/i, '');
					window.document.title = `${fallbackTitle} - LeedPDF`;
					setWindowTitle(`${fallbackTitle} - LeedPDF`);
					console.log(
						'✅ No PDF title found, updated webpage title to filename:',
						`${fallbackTitle} - LeedPDF`
					);
				}
			} catch (titleError) {
				console.error('❌ Could not extract PDF title:', titleError);
				// Try fallback anyway
				try {
					const fallbackTitle =
						typeof pdfFile === 'string'
							? extractFilenameFromUrl(pdfFile).replace(/\.pdf$/i, '')
							: pdfFile.name.replace(/\.pdf$/i, '');
					window.document.title = `${fallbackTitle} - LeedPDF`;
					setWindowTitle(`${fallbackTitle} - LeedPDF`);
					console.log('✅ Used fallback filename as title:', `${fallbackTitle} - LeedPDF`);
				} catch (fallbackError) {
					console.error('❌ Even fallback title failed:', fallbackError);
				}
			}

			pdfState.update((state) => ({
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

			// Calculate the proper scale BEFORE first render to avoid position jumps
			// Auto-fit to height on first load for better initial view
			if (containerDiv) {
				const page = await document.getPage(1);
				const viewport = page.getViewport({ scale: 1 });
				const containerHeight = containerDiv.clientHeight - TOOLBAR_HEIGHT; // Account for toolbar and page info
				const fitHeightScale = containerHeight / viewport.height;

				// Update scale without rendering yet
				pdfState.update((state) => ({ ...state, scale: fitHeightScale }));
				console.log('Initial scale set to fit height:', fitHeightScale);

				// Pre-calculate canvas dimensions at the new scale to avoid position jumps
				const scaledViewport = page.getViewport({ scale: fitHeightScale });
				canvasDisplayWidth = scaledViewport.width;
				canvasDisplayHeight = scaledViewport.height;
				console.log('Initial canvas dimensions set:', {
					width: canvasDisplayWidth,
					height: canvasDisplayHeight,
					scale: fitHeightScale
				});
			}

			// Now render with the correct scale from the start
			await renderCurrentPage();

			// Track PDF load performance
			const loadTime = performance.now() - loadStartTime;
			const fileSize = isUrl ? undefined : (pdfFile as File).size;
			trackPdfLoadTime(loadTime, fileSize, isUrl ? 'url' : 'file_upload');

			console.log('PDF render completed successfully');
			isLoadingPdf = false;
		} catch (error) {
			console.error('Error loading PDF:', error);
			console.log('Error is PDFLoadError?', error instanceof PDFLoadError);
			console.log('Error has originalUrl?', (error as any).originalUrl);
			console.log('Error details:', {
				name: (error as any).name,
				message: (error as any).message,
				originalUrl: (error as any).originalUrl,
				attempts: (error as any).attempts
			});

			pdfState.update((state) => ({ ...state, isLoading: false }));
			isLoadingPdf = false;

			// Don't reset lastLoadedFile to prevent retrigger
			// lastLoadedFile = null;

			// Track the error
			trackError(error as Error, 'pdf_loading');

			// Clear any existing toasts first to avoid duplicates
			toastStore.clearAll();

			// Check if it's a PDFLoadError with retry information and original URL
			if (error instanceof PDFLoadError && error.originalUrl) {
				console.log('✅ Showing fallback button for PDFLoadError');
				toastStore.error('PDF Loading Failed', (error as Error).message, {
					duration: 0, // Don't auto-dismiss
					actions: [
						{
							label: 'Launch Without LeedPDF',
							onClick: async () => {
								// Add query parameter to prevent browser extension from redirecting back to Leed
								const url = new URL(error.originalUrl);
								url.searchParams.set('ignore-leedpdf-redirect', 'true');
								const finalUrl = url.toString();
								console.log('Opening original URL with ignore parameter:', finalUrl);
								await openExternalUrl(finalUrl);
							}
						}
					]
				});
			} else {
				console.log('❌ Not showing fallback button - not a PDFLoadError or no originalUrl');
				toastStore.error('PDF Loading Failed', (error as Error).message);
			}
		}
	}

	async function renderCurrentPage(newScale?: number) {
		if (!pdfCanvas || !$pdfState.document || isRendering) return;

		isRendering = true;
		try {
			const scaleToRender = newScale !== undefined ? newScale : $pdfState.scale;

			const page = await $pdfState.document.getPage($pdfState.currentPage);
			const viewport = page.getViewport({ scale: scaleToRender });
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
				scale: scaleToRender * outputScale,
				canvas: pdfCanvas
			});

			// Sync drawing canvas sizes with PDF canvas
			if (drawingCanvas) {
				drawingCanvas.width = viewport.width;
				drawingCanvas.height = viewport.height;
				drawingCanvas.style.width = `${viewport.width}px`;
				drawingCanvas.style.height = `${viewport.height}px`;

				// Re-render drawing paths for current page
				if (drawingEngine) {
					drawingEngine.renderPaths($currentPagePaths, scaleToRender);
				}
			}

			// Update canvas display dimensions for overlays
			canvasDisplayWidth = viewport.width;
			canvasDisplayHeight = viewport.height;
			console.log('Canvas dimensions set after render:', {
				width: canvasDisplayWidth,
				height: canvasDisplayHeight,
				scale: scaleToRender
			});
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

		// Add keyboard events for Ctrl key tracking
		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('keyup', handleKeyUp);

		// Prevent context menu on right click
		drawingCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
		containerDiv.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	function handlePointerDown(event: PointerEvent) {
		console.log('Canvas handlePointerDown called:', $drawingState.tool, event.target);
		if (!drawingEngine || viewOnlyMode) return;

		// If Ctrl is pressed, let the container handle panning
		if (event.ctrlKey) {
			console.log('Ctrl pressed, letting container handle panning');
			return; // Don't capture the event, let container handle it
		}

		// Only handle freehand drawing tools (pencil, eraser, highlight) here
		// Text and note tools are handled by overlay components
		// Arrow and stamp tools are handled by overlay components
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

			// Select tool is handled by TextSelectionOverlay
			if (['select'].includes($drawingState.tool)) {
				console.log(`${$drawingState.tool} tool click ignored - text selection mode`);
				return;
			}

			console.warn('Unknown tool event reached drawing canvas:', $drawingState.tool);
			return;
		}

		console.log('Freehand tool starting drawing:', $drawingState.tool);

		event.preventDefault();
		drawingCanvas.setPointerCapture(event.pointerId);

		isDrawing = true;
		// Capture Alt state at gesture start when using eraser
		isAltEraseMode = $drawingState.tool === 'eraser' ? !!event.altKey : false;

		// Get point and convert to base viewport coordinates (scale 1.0)
		const canvasPoint = drawingEngine.getPointFromEvent(event);
		const basePoint = {
			x: canvasPoint.x / $pdfState.scale,
			y: canvasPoint.y / $pdfState.scale,
			pressure: canvasPoint.pressure
		};

		const size =
			$drawingState.tool === 'eraser' ? $drawingState.eraserSize : $drawingState.lineWidth;
		const color =
			$drawingState.tool === 'highlight' ? $drawingState.highlightColor : $drawingState.color;
		drawingEngine.startDrawing(
			canvasPoint, // Use canvas point for immediate visual feedback
			$drawingState.tool,
			color,
			size
		);

		currentDrawingPath = [basePoint]; // Store base viewport coordinates
	}

	function handlePointerMove(event: PointerEvent) {
		if (isPanning) {
			panOffset = { x: event.clientX - panStart.x, y: event.clientY - panStart.y };
			// Apply the transform to the content wrapper
			const contentWrapper = containerDiv.querySelector('.flex');
			if (contentWrapper) {
				(contentWrapper as HTMLElement).style.transform =
					`translate(${panOffset.x}px, ${panOffset.y}px)`;
			}
			return;
		}

		if (!isDrawing || !drawingEngine) return;

		event.preventDefault();
		// Get point and convert to base viewport coordinates (scale 1.0)
		const canvasPoint = drawingEngine.getPointFromEvent(event);
		const basePoint = {
			x: canvasPoint.x / $pdfState.scale,
			y: canvasPoint.y / $pdfState.scale,
			pressure: canvasPoint.pressure
		};

		drawingEngine.continueDrawing(canvasPoint); // Use canvas point for immediate visual feedback
		currentDrawingPath.push(basePoint); // Store base viewport coordinates
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
				// Use base-viewport coordinates for eraser path (consistent with stored paths)
				const eraserBasePath = {
					tool: 'eraser' as const,
					color: '#000000',
					lineWidth: $drawingState.eraserSize,
					points: currentDrawingPath, // already in base viewport coords (CSS px at scale 1)
					pageNumber: $pdfState.currentPage
				};

				// Convert eraser size to base-viewport tolerance (divide by current scale)
				const tolerance = $drawingState.eraserSize / $pdfState.scale;

				if (isAltEraseMode) {
					// Partial erase: split intersecting strokes into subpaths
					updatePagePathsWithUndo($pdfState.currentPage, (pagePaths) => {
						console.log('Partial erase (Alt) on', pagePaths.length, 'paths');
						const updated = pagePaths.flatMap((path, index) => {
							// Only split freehand strokes
							if (path.tool !== 'pencil' && path.tool !== 'highlight') return [path];
							if (!drawingEngine.pathsIntersect(path, eraserBasePath, tolerance)) return [path];
							const parts = splitPathByEraser(path, eraserBasePath, tolerance);
							if (parts.length === 0) {
								console.log(`Path ${index} fully erased by partial eraser`);
							} else {
								console.log(`Path ${index} split into`, parts.length, 'subpaths');
							}
							return parts;
						});
						return updated;
					});
				} else {
					// Default: erase whole intersecting strokes
					updatePagePathsWithUndo($pdfState.currentPage, (pagePaths) => {
						console.log('Checking eraser intersections with', pagePaths.length, 'paths');
						return pagePaths.filter((path, index) => {
							const intersects = drawingEngine.pathsIntersect(path, eraserBasePath, tolerance);
							if (intersects) {
								console.log(`Path ${index} intersects with eraser - removing`);
							}
							return !intersects;
						});
					});
				}
			} else {
				// Add drawing path (pencil or highlight)
				const color =
					$drawingState.tool === 'highlight' ? $drawingState.highlightColor : $drawingState.color;
				// Convert final path points to base viewport coordinates
				const basePathPoints = finalPath.map((point) => ({
					x: point.x / $pdfState.scale,
					y: point.y / $pdfState.scale,
					pressure: point.pressure
				}));
				const drawingPath: DrawingPath = {
					tool: $drawingState.tool,
					color: color,
					lineWidth: $drawingState.lineWidth,
					points: basePathPoints, // Store base viewport coordinates
					pageNumber: $pdfState.currentPage
					// No need for viewerScale anymore - all coords are at scale 1.0
				};

				// Track first annotation creation
				trackFirstAnnotation($drawingState.tool);

				addDrawingPath(drawingPath);
			}
		}
		currentDrawingPath = [];
		isAltEraseMode = false; // reset gesture modifier
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
		console.log(
			'Container handleContainerPointerDown called:',
			event.target,
			'Ctrl pressed:',
			event.ctrlKey
		);
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
				(contentWrapper as HTMLElement).style.transform =
					`translate(${panOffset.x}px, ${panOffset.y}px)`;
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
		if (event.ctrlKey) {
			// Ctrl + scroll = zoom
			event.preventDefault();

			// deltaY < 0 means scroll up (zoom in)
			if (event.deltaY < 0) {
				zoomIn();
			} else {
				zoomOut();
			}
		} else {
			// Plain scroll = page navigation
			event.preventDefault();

			// deltaY > 0 means scroll down (next page)
			if (event.deltaY > 0) {
				nextPage();
			} else if (event.deltaY < 0) {
				previousPage();
			}
		}
	}

	export async function goToPage(pageNumber: number) {
		if (pageNumber < 1 || pageNumber > $pdfState.totalPages) return;

		clearTextAnnotationSelection();
		pdfState.update((state) => ({ ...state, currentPage: pageNumber }));
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
		// CRITICAL: Render FIRST, update state AFTER
		await renderCurrentPage(newScale);
		pdfState.update((state) => ({ ...state, scale: newScale }));
	}

	export async function zoomOut() {
		const newScale = Math.max($pdfState.scale / 1.2, 0.1); // Allow much more zoom out
		// CRITICAL: Render FIRST, update state AFTER
		await renderCurrentPage(newScale);
		pdfState.update((state) => ({ ...state, scale: newScale }));
	}

	export async function resetZoom() {
		// Reset both zoom and pan position to center the PDF
		panOffset = { x: 0, y: 0 };
		const newScale = 1.2;
		// CRITICAL: Render FIRST, update state AFTER
		await renderCurrentPage(newScale);
		pdfState.update((state) => ({ ...state, scale: newScale }));
	}

	export async function fitToWidth() {
		if (!$pdfState.document || !containerDiv) return;

		try {
			const page = await $pdfState.document.getPage($pdfState.currentPage);
			const viewport = page.getViewport({ scale: 1 });
			const containerWidth = containerDiv.clientWidth - (presentationMode ? 0 : 40); // Account for padding
			const newScale = containerWidth / viewport.width;

			panOffset = { x: 0, y: 0 };
			// CRITICAL: Render FIRST, update state AFTER
			await renderCurrentPage(newScale);
			pdfState.update((state) => ({ ...state, scale: newScale }));
		} catch (error) {
			console.error('Error fitting to width:', error);
		}
	}

	export async function fitToHeight() {
		if (!$pdfState.document || !containerDiv) return;

		try {
			const page = await $pdfState.document.getPage($pdfState.currentPage);
			const viewport = page.getViewport({ scale: 1 });
			const containerHeight = containerDiv.clientHeight - (presentationMode ? 0 : TOOLBAR_HEIGHT); // Account for toolbar and page info
			const newScale = containerHeight / viewport.height;

			panOffset = { x: 0, y: 0 };
			// CRITICAL: Render FIRST, update state AFTER
			await renderCurrentPage(newScale);
			pdfState.update((state) => ({ ...state, scale: newScale }));
		} catch (error) {
			console.error('Error fitting to height:', error);
		}
	}

	// Track previous presentation mode to detect actual changes
	let previousPresentationMode = false;

	// React to presentation mode changes - only when actually entering presentation mode
	$: if (presentationMode && !previousPresentationMode && $pdfState.document) {
		// When entering presentation mode, wait for full screen and resize
		// We use setTimeout to allow the browser to transition to fullscreen and layout to update
		previousPresentationMode = true;
		setTimeout(() => {
			fitToHeight();
		}, 100);
	} else if (!presentationMode && previousPresentationMode) {
		// Track when exiting presentation mode
		previousPresentationMode = false;
	}
	export async function pageHasAnnotations(pageNumber: number): Promise<boolean> {
		// Get current values from all annotation stores
		let hasDrawingPaths = false;
		let hasTextAnnotations = false;
		let hasArrowAnnotations = false;
		let hasStampAnnotations = false;
		let hasStickyNotes = false;

		// Check drawing paths
		const unsubscribePaths = drawingPaths.subscribe((paths) => {
			const pagePaths = paths.get(pageNumber) || [];
			hasDrawingPaths = pagePaths.length > 0;
		});
		unsubscribePaths();

		// Check text annotations
		const unsubscribeText = textAnnotations.subscribe((annotations) => {
			const pageTexts = annotations.get(pageNumber) || [];
			hasTextAnnotations = pageTexts.length > 0;
		});
		unsubscribeText();

		// Check arrow annotations
		const unsubscribeArrows = arrowAnnotations.subscribe((annotations) => {
			const pageArrows = annotations.get(pageNumber) || [];
			hasArrowAnnotations = pageArrows.length > 0;
		});
		unsubscribeArrows();

		// Check stamp annotations
		const unsubscribeStamps = stampAnnotations.subscribe((annotations) => {
			const pageStamps = annotations.get(pageNumber) || [];
			hasStampAnnotations = pageStamps.length > 0;
		});
		unsubscribeStamps();

		// Check sticky note annotations
		const unsubscribeStickyNotes = stickyNoteAnnotations.subscribe((annotations) => {
			const pageStickyNotes = annotations.get(pageNumber) || [];
			hasStickyNotes = pageStickyNotes.length > 0;
		});
		unsubscribeStickyNotes();

		const hasAnyAnnotations =
			hasDrawingPaths ||
			hasTextAnnotations ||
			hasArrowAnnotations ||
			hasStampAnnotations ||
			hasStickyNotes;

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
	export async function getMergedCanvasForPage(
		pageNumber: number
	): Promise<HTMLCanvasElement | null> {
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

			// Set BOTH canvases to the same scaled dimensions for consistency
			const scaledWidth = Math.floor(viewport.width * outputScale);
			const scaledHeight = Math.floor(viewport.height * outputScale);

			tempPdfCanvas.width = scaledWidth;
			tempPdfCanvas.height = scaledHeight;
			tempDrawingCanvas.width = scaledWidth; // Same as PDF canvas
			tempDrawingCanvas.height = scaledHeight; // Same as PDF canvas

			// Render PDF to temporary canvas with proper scaling
			const pdfContext = tempPdfCanvas.getContext('2d');
			if (pdfContext) {
				// Scale the context to match the output scaling
				pdfContext.scale(outputScale, outputScale);

				await pdfManager.renderPageToCanvas(page, {
					scale: 1, // Base scale since scaling is handled by context transform
					canvas: tempPdfCanvas
				});
			}

			// Skip rendering drawing paths to temporary canvas - we'll render them directly in createMergedCanvasWithAnnotations
			// This avoids duplication since we render them properly with correct scaling there

			// Now create the merged canvas with all annotations
			// IMPORTANT: Use base viewport dimensions (scale 1.0) for consistent coordinate transformation
			// Annotations should be calculated relative to the base document dimensions
			const actualCanvasWidth = viewport.width;
			const actualCanvasHeight = viewport.height;

			return await createMergedCanvasWithAnnotations(
				tempPdfCanvas,
				tempDrawingCanvas,
				pageNumber,
				actualCanvasWidth,
				actualCanvasHeight,
				outputScale
			);
		} catch (error) {
			console.error(`Error creating merged canvas for page ${pageNumber}:`, error);
			return null;
		}
	}

	// Helper function to get annotations from localStorage for export
	function getAnnotationsFromStorage(pageNumber: number) {
		// Get current PDF key
		let currentPDFKey: string | null = null;
		try {
			const savedPDFInfo = localStorage.getItem('leedpdf_current_pdf');
			if (savedPDFInfo) {
				const { pdfKey } = JSON.parse(savedPDFInfo);
				currentPDFKey = pdfKey;
			}
		} catch (error) {
			console.error('Error reading PDF info from localStorage:', error);
			return {
				pageTextAnnotations: [],
				pageArrowAnnotations: [],
				pageStampAnnotations: [],
				pageStickyNotes: []
			};
		}

		if (!currentPDFKey) {
			return {
				pageTextAnnotations: [],
				pageArrowAnnotations: [],
				pageStampAnnotations: [],
				pageStickyNotes: []
			};
		}

		// Load all annotation types from localStorage
		let pageTextAnnotations: any[] = [];
		let pageArrowAnnotations: any[] = [];
		let pageStampAnnotations: any[] = [];
		let pageStickyNotes: any[] = [];

		try {
			// Load text annotations
			const savedTextAnnotations = localStorage.getItem(
				`leedpdf_text_annotations_${currentPDFKey}`
			);
			if (savedTextAnnotations) {
				const parsedTextAnnotations = JSON.parse(savedTextAnnotations);
				pageTextAnnotations = parsedTextAnnotations[pageNumber.toString()] || [];
			}

			// Load arrow annotations
			const savedArrowAnnotations = localStorage.getItem(
				`leedpdf_arrow_annotations_${currentPDFKey}`
			);
			if (savedArrowAnnotations) {
				const parsedArrowAnnotations = JSON.parse(savedArrowAnnotations);
				pageArrowAnnotations = parsedArrowAnnotations[pageNumber.toString()] || [];
			}

			// Load stamp annotations
			const savedStampAnnotations = localStorage.getItem(
				`leedpdf_stamp_annotations_${currentPDFKey}`
			);
			if (savedStampAnnotations) {
				const parsedStampAnnotations = JSON.parse(savedStampAnnotations);
				pageStampAnnotations = parsedStampAnnotations[pageNumber.toString()] || [];
			}

			// Load sticky note annotations
			const savedStickyNotes = localStorage.getItem(
				`leedpdf_sticky_note_annotations_${currentPDFKey}`
			);
			if (savedStickyNotes) {
				const parsedStickyNotes = JSON.parse(savedStickyNotes);
				pageStickyNotes = parsedStickyNotes[pageNumber.toString()] || [];
			}
		} catch (error) {
			console.error('Error loading annotations from localStorage:', error);
		}

		return { pageTextAnnotations, pageArrowAnnotations, pageStampAnnotations, pageStickyNotes };
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
		console.log(`Creating merged canvas for page ${pageNumber}:`, {
			pdfCanvasSize: [pdfCanvas.width, pdfCanvas.height],
			drawingCanvasSize: [drawingCanvas.width, drawingCanvas.height],
			referenceCanvasSize: [canvasWidth, canvasHeight],
			outputScale,
			currentViewerScale: $pdfState.scale
		});

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

		// Since both canvases now have the same dimensions, draw directly without scaling
		ctx.drawImage(drawingCanvas, 0, 0);

		// FIXED: Also render drawing paths directly for this specific page (same as getMergedCanvas)
		// Get drawing paths for this specific page and render them with proper coordinate transformation
		let pageDrawingPaths: any[] = [];
		const unsubscribePageDrawingPaths = drawingPaths.subscribe((paths) => {
			pageDrawingPaths = paths.get(pageNumber) || [];
		});
		unsubscribePageDrawingPaths();

		if (pageDrawingPaths.length > 0) {
			console.log(
				`Rendering ${pageDrawingPaths.length} drawing paths directly for page ${pageNumber} export`
			);

			ctx.save();
			// Use the same scaling as other annotations (output scale only)
			ctx.scale(outputScale, outputScale);

			// Render each drawing path directly onto the export canvas
			pageDrawingPaths.forEach((path) => {
				if (path.points && path.points.length > 1) {
					ctx.strokeStyle = path.color || '#000000';
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';

					// Set blend mode and line width for highlight tool
					if (path.tool === 'highlight') {
						ctx.globalCompositeOperation = 'multiply';
						ctx.lineWidth = (path.lineWidth || 2) * 3; // Highlighter is wider
						ctx.globalAlpha = 0.3;
					} else {
						ctx.globalCompositeOperation = 'source-over';
						ctx.lineWidth = path.lineWidth || 2;
						ctx.globalAlpha = 1.0;
					}

					// SIMPLIFIED: Drawing paths are now stored at base viewport coordinates (scale 1.0)
					// No transformation needed - just draw at the stored coordinates
					ctx.beginPath();
					ctx.moveTo(path.points[0].x, path.points[0].y);

					for (let i = 1; i < path.points.length; i++) {
						ctx.lineTo(path.points[i].x, path.points[i].y);
					}

					ctx.stroke();

					// Reset blend mode and alpha
					ctx.globalCompositeOperation = 'source-over';
					ctx.globalAlpha = 1.0;
				}
			});

			ctx.restore();
			console.log(
				`Successfully rendered ${pageDrawingPaths.length} drawing paths for page ${pageNumber} export`
			);
		}

		// Get all annotation types for this specific page from localStorage
		const { pageTextAnnotations, pageArrowAnnotations, pageStampAnnotations, pageStickyNotes } =
			getAnnotationsFromStorage(pageNumber);

		console.log(`Page ${pageNumber} annotation counts:`, {
			textAnnotations: pageTextAnnotations.length,
			arrowAnnotations: pageArrowAnnotations.length,
			stampAnnotations: pageStampAnnotations.length,
			stickyNotes: pageStickyNotes.length
		});

		// Debug: Show sample annotation data
		if (pageTextAnnotations.length > 0) {
			console.log('Sample text annotation data:', {
				relativeX: pageTextAnnotations[0].relativeX,
				relativeY: pageTextAnnotations[0].relativeY,
				x: pageTextAnnotations[0].x,
				y: pageTextAnnotations[0].y,
				text: pageTextAnnotations[0].text
			});
		}

		// Debug: Show sample annotation data
		if (pageTextAnnotations.length > 0) {
			console.log('Sample text annotation:', pageTextAnnotations[0]);
		}

		// The correct canvas dimensions for coordinate transformation
		// Annotations were saved using relative coordinates based on the actual CSS canvas size
		// canvasWidth and canvasHeight are now already the actual canvas dimensions used during annotation saving
		// No additional scaling needed since we're passing the correct dimensions from getMergedCanvasForPage

		console.log('Canvas dimensions for coordinate transformation:', {
			passedCanvasSize: [canvasWidth, canvasHeight],
			viewerScale: $pdfState.scale
		});

		// Draw text annotations - Apply outputScale to match the scaled canvas
		if (pageTextAnnotations.length > 0) {
			console.log('Drawing text annotations with passed canvas dimensions:', {
				canvasSize: [canvasWidth, canvasHeight]
			});
			ctx.save();
			ctx.scale(outputScale, outputScale);

			pageTextAnnotations.forEach((annotation) => {
				// FIXED: Use the stored absolute coordinates when they exist instead of computing from relative
				// This ensures annotations appear exactly where they were placed originally
				let x, y;
				if (annotation.x !== undefined && annotation.y !== undefined) {
					// Use absolute coordinates directly - these were stored at annotation creation time
					x = annotation.x;
					y = annotation.y;
					console.log(`Text annotation: Using absolute coordinates x=${x}, y=${y}`);
				} else {
					// Fallback to relative coordinates if absolute ones aren't available
					x = annotation.relativeX * canvasWidth;
					y = annotation.relativeY * canvasHeight;
					console.log(
						`Text annotation: Using computed relative coordinates - relativeX=${annotation.relativeX}, relativeY=${annotation.relativeY}, computed x=${x}, y=${y}`
					);
				}

				ctx.font = `${annotation.fontSize}px ${annotation.fontFamily}`;
				ctx.fillStyle = annotation.color;
				ctx.textBaseline = 'top';

				const lines = annotation.text.split('\n');
				lines.forEach((line: string, index: number) => {
					ctx.fillText(line, x, y + index * annotation.fontSize * 1.2);
				});
			});

			ctx.restore();
		}

		// Draw arrow annotations - Apply outputScale to match the scaled canvas
		if (pageArrowAnnotations.length > 0) {
			ctx.save();
			ctx.scale(outputScale, outputScale);

			pageArrowAnnotations.forEach((arrow) => {
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

		// Draw stamp annotations - Apply outputScale to match the scaled canvas
		if (pageStampAnnotations.length > 0) {
			console.log(`Rendering ${pageStampAnnotations.length} stamp annotations for export`);
			ctx.save();
			ctx.scale(outputScale, outputScale);

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
				const calculatedSize = Math.max(
					MIN_SIZE,
					Math.min(MAX_SIZE, stampAnnotation.relativeSize * Math.min(canvasWidth, canvasHeight))
				);
				const stampWidth = calculatedSize;
				const stampHeight = calculatedSize;

				try {
					// Convert SVG string to image
					const img = await svgToImage(svgString, stampWidth, stampHeight);

					console.log(
						`Drawing stamp "${stampName}" at (${x}, ${y}) size ${stampWidth}x${stampHeight}`
					);
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

		// Draw sticky note annotations - Apply outputScale to match the scaled canvas
		if (pageStickyNotes.length > 0) {
			ctx.save();
			ctx.scale(outputScale, outputScale);

			pageStickyNotes.forEach((note) => {
				const x = note.relativeX * canvasWidth;
				const y = note.relativeY * canvasHeight;
				const width = note.width || 200;
				const height = note.height || 150;
				const borderRadius = 8; // Match the border-radius from StickyNote.svelte

				// Save context for shadow
				ctx.save();

				// Apply shadow (matching StickyNote.svelte box-shadow)
				ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
				ctx.shadowBlur = 8;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 4;

				// Create path for rounded rectangle
				ctx.beginPath();
				ctx.moveTo(x + borderRadius, y);
				ctx.lineTo(x + width - borderRadius, y);
				ctx.quadraticCurveTo(x + width, y, x + width, y + borderRadius);
				ctx.lineTo(x + width, y + height - borderRadius);
				ctx.quadraticCurveTo(x + width, y + height, x + width - borderRadius, y + height);
				ctx.lineTo(x + borderRadius, y + height);
				ctx.quadraticCurveTo(x, y + height, x, y + height - borderRadius);
				ctx.lineTo(x, y + borderRadius);
				ctx.quadraticCurveTo(x, y, x + borderRadius, y);
				ctx.closePath();

				// Fill with shadow
				ctx.fillStyle = note.color || '#FFF59D';
				ctx.fill();

				// Reset shadow for border
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = 0;

				// Draw rounded rectangle border
				ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
				ctx.lineWidth = 1;
				ctx.stroke();

				// Restore context after shadow
				ctx.restore();

				// Set clipping region for text to stay within rounded rectangle
				ctx.save();
				ctx.clip();

				ctx.fillStyle = '#000';
				ctx.font = `${note.fontSize || 14}px ${note.fontFamily || 'ReenieBeanie, cursive'}`;

				const words = note.text.split(' ');
				const lines: string[] = [];
				let currentLine = '';
				// Container padding: left 8px + right 8px + note-content padding-right 24px = 32px total
				const maxWidth = width - 32;

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
					// Container has 8px padding on all sides, so text starts at (8, 8) from container edge
					// But we need to match the visual appearance, so let's add more top padding
					ctx.fillText(line.trim(), x + 8, y + 32 + index * lineHeight);
				});

				// Restore clipping
				ctx.restore();
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

			// Calculate canvas dimensions for coordinate transformation
			const canvasWidth = parseFloat(pdfCanvas.style.width) || pdfCanvas.width / outputScale;
			const canvasHeight = parseFloat(pdfCanvas.style.height) || pdfCanvas.height / outputScale;

			// FIXED: Instead of scaling the drawing canvas (which causes misalignment),
			// render the drawing paths directly at the correct coordinates, same as other annotations
			// The drawing paths are stored with coordinates relative to the canvas size when they were created

			// Get current page drawing paths and render them directly
			let currentPageDrawingPaths: any[] = [];
			const unsubscribeDrawingPaths = currentPagePaths.subscribe((paths) => {
				currentPageDrawingPaths = paths;
			});
			unsubscribeDrawingPaths();

			if (currentPageDrawingPaths.length > 0) {
				console.log(
					`Rendering ${currentPageDrawingPaths.length} drawing paths directly for export`
				);
				console.log('Drawing path coordinate debugging:', {
					canvasWidth,
					canvasHeight,
					outputScale,
					scaleX,
					scaleY,
					currentViewerScale: $pdfState.scale,
					drawingCanvasSize: [drawingCanvas.width, drawingCanvas.height],
					pdfCanvasStyleSize: [
						parseFloat(pdfCanvas.style.width),
						parseFloat(pdfCanvas.style.height)
					]
				});

				// Show sample drawing path coordinates
				if (
					currentPageDrawingPaths[0] &&
					currentPageDrawingPaths[0].points &&
					currentPageDrawingPaths[0].points[0]
				) {
					console.log('Sample drawing path first point:', currentPageDrawingPaths[0].points[0]);
				}

				// FIXED: Don't use scaleX/scaleY - use the same coordinate logic as text annotations
				// Drawing paths were created with coordinates relative to the CSS canvas size
				// We need to scale them the same way as other annotations

				ctx.save();
				// Use the same scaling as text annotations (device pixel ratio only)
				ctx.scale(outputScale, outputScale);

				// Render each drawing path directly onto the export canvas
				currentPageDrawingPaths.forEach((path) => {
					if (path.points && path.points.length > 1) {
						ctx.strokeStyle = path.color || '#000000';
						ctx.lineCap = 'round';
						ctx.lineJoin = 'round';

						// Set blend mode and line width for highlight tool
						if (path.tool === 'highlight') {
							ctx.globalCompositeOperation = 'multiply';
							ctx.lineWidth = (path.lineWidth || 2) * 3; // Highlighter is wider
							ctx.globalAlpha = 0.3;
						} else {
							ctx.globalCompositeOperation = 'source-over';
							ctx.lineWidth = path.lineWidth || 2;
							ctx.globalAlpha = 1.0;
						}

						// SIMPLIFIED: Drawing paths are now stored at base viewport coordinates (scale 1.0)
						// We need to scale them for current viewer scale
						const viewerScale = $pdfState.scale;

						ctx.beginPath();
						// Scale from base viewport to current canvas size
						ctx.moveTo(path.points[0].x * viewerScale, path.points[0].y * viewerScale);

						for (let i = 1; i < path.points.length; i++) {
							ctx.lineTo(path.points[i].x * viewerScale, path.points[i].y * viewerScale);
						}

						ctx.stroke();

						// Reset blend mode and alpha
						ctx.globalCompositeOperation = 'source-over';
						ctx.globalAlpha = 1.0;
					}
				});

				ctx.restore();
				console.log(
					`Successfully rendered ${currentPageDrawingPaths.length} drawing paths for export`
				);
			}

			// Draw text annotations scaled to match PDF resolution
			// Get current page text annotations from the store
			let currentTextAnnotations: any[] = [];
			const unsubscribe = currentPageTextAnnotations.subscribe((annotations) => {
				currentTextAnnotations = annotations;
			});
			unsubscribe();

			if (currentTextAnnotations.length > 0) {
				ctx.save();
				ctx.scale(scaleX, scaleY);

				currentTextAnnotations.forEach((annotation) => {
					const x = annotation.relativeX * canvasWidth;
					const y = annotation.relativeY * canvasHeight;

					ctx.font = `${annotation.fontSize}px ${annotation.fontFamily}`;
					ctx.fillStyle = annotation.color;
					ctx.textBaseline = 'top';

					// Handle multi-line text
					const lines = annotation.text.split('\n');
					lines.forEach((line: string, index: number) => {
						ctx.fillText(line, x, y + index * annotation.fontSize * 1.2);
					});
				});

				ctx.restore();
			}

			// Draw arrow annotations scaled to match PDF resolution
			let currentArrowAnnotations: any[] = [];
			const unsubscribeArrows = currentPageArrowAnnotations.subscribe((annotations) => {
				currentArrowAnnotations = annotations;
			});
			unsubscribeArrows();

			if (currentArrowAnnotations.length > 0) {
				ctx.save();
				ctx.scale(scaleX, scaleY);

				currentArrowAnnotations.forEach((arrow) => {
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
			const unsubscribeStamps = currentPageStampAnnotations.subscribe((annotations) => {
				currentStampAnnotations = annotations;
			});
			unsubscribeStamps();

			if (currentStampAnnotations.length > 0) {
				console.log(
					`Rendering ${currentStampAnnotations.length} current page stamp annotations for export`
				);
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
					const calculatedSize = Math.max(
						MIN_SIZE,
						Math.min(MAX_SIZE, stampAnnotation.relativeSize * Math.min(canvasWidth, canvasHeight))
					);
					const stampWidth = calculatedSize;
					const stampHeight = calculatedSize;

					try {
						// Convert SVG string to image
						const img = await svgToImage(svgString, stampWidth, stampHeight);

						console.log(
							`Drawing current page stamp "${stampName}" at (${x}, ${y}) size ${stampWidth}x${stampHeight}`
						);
						ctx.drawImage(img, x, y, stampWidth, stampHeight);

						return { success: true, stamp: stampName };
					} catch (error) {
						console.warn(
							'Failed to convert SVG to image for current page export:',
							stampName,
							error
						);

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
			const unsubscribeStickyNotes = currentPageStickyNotes.subscribe((annotations) => {
				currentStickyNotes = annotations;
			});
			unsubscribeStickyNotes();

			if (currentStickyNotes.length > 0) {
				ctx.save();
				ctx.scale(scaleX, scaleY);

				currentStickyNotes.forEach((note) => {
					const x = note.relativeX * canvasWidth;
					const y = note.relativeY * canvasHeight;
					const width = note.width || 200;
					const height = note.height || 150;
					const borderRadius = 8; // Match the border-radius from StickyNote.svelte

					// Save context for shadow
					ctx.save();

					// Apply shadow (matching StickyNote.svelte box-shadow)
					ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
					ctx.shadowBlur = 8;
					ctx.shadowOffsetX = 0;
					ctx.shadowOffsetY = 4;

					// Create path for rounded rectangle
					ctx.beginPath();
					ctx.moveTo(x + borderRadius, y);
					ctx.lineTo(x + width - borderRadius, y);
					ctx.quadraticCurveTo(x + width, y, x + width, y + borderRadius);
					ctx.lineTo(x + width, y + height - borderRadius);
					ctx.quadraticCurveTo(x + width, y + height, x + width - borderRadius, y + height);
					ctx.lineTo(x + borderRadius, y + height);
					ctx.quadraticCurveTo(x, y + height, x, y + height - borderRadius);
					ctx.lineTo(x, y + borderRadius);
					ctx.quadraticCurveTo(x, y, x + borderRadius, y);
					ctx.closePath();

					// Fill with shadow
					ctx.fillStyle = note.color || '#FFF59D';
					ctx.fill();

					// Reset shadow for border
					ctx.shadowColor = 'transparent';
					ctx.shadowBlur = 0;
					ctx.shadowOffsetX = 0;
					ctx.shadowOffsetY = 0;

					// Draw rounded rectangle border
					ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
					ctx.lineWidth = 1;
					ctx.stroke();

					// Restore context after shadow
					ctx.restore();

					// Set clipping region for text to stay within rounded rectangle
					ctx.save();
					ctx.clip();

					// Draw sticky note text
					ctx.fillStyle = '#000';
					ctx.font = `${note.fontSize || 14}px ${note.fontFamily || 'ReenieBeanie, cursive'}`;

					// Handle multi-line text with word wrapping
					const words = note.text.split(' ');
					const lines: string[] = [];
					let currentLine = '';
					// Container padding: left 8px + right 8px + note-content padding-right 24px = 32px total
					const maxWidth = width - 32;

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
						// Container has 8px padding on all sides, so text starts at (8, 8) from container edge
						// But we need to match the visual appearance, so let's add more top padding
						ctx.fillText(line.trim(), x + 8, y + 32 + index * lineHeight);
					});

					// Restore clipping
					ctx.restore();
				});

				ctx.restore();
			}

			console.log(
				'Merged canvas created successfully:',
				mergedCanvas.width,
				'x',
				mergedCanvas.height
			);
			return mergedCanvas;
		} catch (error) {
			console.error('Error creating merged canvas:', error);
			return null;
		}
	}
</script>

<svelte:window on:wheel|nonpassive={handleWheel} />

<div bind:this={containerDiv} class="pdf-viewer relative w-full h-full overflow-hidden">
	<!-- Debug info logged to console -->

	<!-- Simple centered canvas -->
	<div
		class="flex items-center justify-center w-full h-full"
		style="transform: translate({panOffset.x}px, {panOffset.y}px);"
	>
		<div class="relative">
			<!-- PDF Canvas -->
			<canvas
				bind:this={pdfCanvas}
				class="shadow-lg"
				class:rounded-lg={!presentationMode}
				class:hidden={!$pdfState.document}
				style="z-index: 1;"
			></canvas>

			<!-- Drawing Canvas Overlay -->
			<canvas
				bind:this={drawingCanvas}
				class="absolute top-0 left-0 drawing-canvas"
				class:rounded-lg={!presentationMode}
				class:eraser={$drawingState.tool === 'eraser'}
				class:hidden={!$pdfState.document}
				style="z-index: 2;"
			></canvas>

			<!-- Text Overlay for Custom Text Annotations -->
			{#if $pdfState.document && canvasDisplayWidth > 0 && canvasDisplayHeight > 0}
				<TextOverlay
					canvasWidth={canvasDisplayWidth}
					canvasHeight={canvasDisplayHeight}
					currentScale={$pdfState.scale}
					{viewOnlyMode}
				/>
			{/if}

			<!-- Sticky Note Overlay for Custom Sticky Note Annotations -->
			{#if $pdfState.document && canvasDisplayWidth > 0 && canvasDisplayHeight > 0}
				<StickyNoteOverlay
					containerWidth={canvasDisplayWidth}
					containerHeight={canvasDisplayHeight}
					scale={$pdfState.scale}
					{viewOnlyMode}
				/>
			{/if}

			<!-- Stamp Overlay for Custom Stamp Annotations -->
			{#if $pdfState.document && canvasDisplayWidth > 0 && canvasDisplayHeight > 0}
				<StampOverlay
					containerWidth={canvasDisplayWidth}
					containerHeight={canvasDisplayHeight}
					scale={$pdfState.scale}
					{viewOnlyMode}
				/>
			{/if}

			<!-- Arrow Overlay for Custom Arrow Annotations -->
			{#if $pdfState.document && canvasDisplayWidth > 0 && canvasDisplayHeight > 0}
				<ArrowOverlay
					containerWidth={canvasDisplayWidth}
					containerHeight={canvasDisplayHeight}
					scale={$pdfState.scale}
					{viewOnlyMode}
				/>
			{/if}
		</div>
	</div>

	<!-- Text Selection Overlay - Shows when select tool is active -->
	{#if $drawingState.tool === 'select' && $pdfState.document}
		<TextSelectionOverlay
			extractedText={extractedPageText}
			currentPage={$pdfState.currentPage}
			isLoading={isExtractingText}
			containerHeight={overlayHeight}
		/>
	{/if}

	{#if $pdfState.isLoading}
		<div class="absolute inset-0 flex items-center justify-center">
			<div
				class="animate-spin rounded-full h-12 w-12 border-4 border-sage border-t-transparent"
			></div>
			<span class="ml-3 text-charcoal dark:text-gray-200 font-medium">Opening your PDF...</span>
		</div>
	{:else if $pdfState.document && $pdfState.totalPages > 0 && !presentationMode}
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
			{#if !presentationMode}
				<div class="text-center">
					<div class="text-6xl mb-4">📄</div>
					<h3 class="text-xl font-medium text-charcoal mb-2">Drop a PDF here or click to browse</h3>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.pdf-viewer {
		background: linear-gradient(135deg, #fdf6e3 0%, #f7f3e9 100%);
		position: relative;
	}

	:global(.dark) .pdf-viewer {
		background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
	}

	/* Drawing canvas cursor is dynamically controlled by JavaScript */
</style>
