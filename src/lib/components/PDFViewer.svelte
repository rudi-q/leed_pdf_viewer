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
	import {
		transformPoint,
		inverseTransformPoint,
		type RotationAngle
	} from '../utils/rotationUtils';
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
	import LinkOverlay from './LinkOverlay.svelte';
	import TextSelectionOverlay from './TextSelectionOverlay.svelte';
	import { TOOLBAR_HEIGHT } from '$lib/constants';
	import { setWindowTitle } from '$lib/utils/tauriUtils';
	import { GestureTracker, PanInertia } from '$lib/utils/gestureUtils';
	import GestureHint from './GestureHint.svelte';

	// Helper function to build window title with page info
	function buildWindowTitle(baseTitle: string, currentPage: number, totalPages: number): string {
		if (totalPages > 1) {
			return `${baseTitle} (Page ${currentPage} of ${totalPages}) - LeedPDF`;
		}
		return `${baseTitle} - LeedPDF`;
	}

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
	let pendingRotation: 0 | 90 | 180 | 270 | null = null; // Queue rotation changes during render
	let isCtrlPressed = false;
	let cursorOverCanvas = false;
	let isLoadingPdf = false; // Guard to prevent multiple simultaneous loads
	let pdfBaseTitle = ''; // Stores the cleaned PDF title for reactive title updates

	// ── Touch / gesture state ──────────────────────────────────
	let gestureTracker: GestureTracker;
	let panInertia: PanInertia;
	let pinchStartDistance = 0;
	let pinchStartScale = 0;
	let lastPinchScale = 0; // updated every move; avoids regex-parsing CSS on pinch end
	let pinchStartMidpoint = { x: 0, y: 0 }; // midpoint at gesture start for two-finger pan
	let pinchStartPanOffset = { x: 0, y: 0 }; // panOffset snapshot at gesture start
	let lastPinchPanX = 0; // visual-only pan X during pinch (committed on end)
	let lastPinchPanY = 0; // visual-only pan Y during pinch (committed on end)
	let pinchRafId: number | null = null; // rAF handle for batching two-finger updates
	let contentWrapperDiv: HTMLDivElement; // cached ref to the .flex wrapper (bound in template)
	let panStartRaw = { x: 0, y: 0 }; // raw down position for dead-zone check
	let isPanConfirmed = false; // true once 5 px threshold exceeded
	let isPinching = false;
	const PAN_THRESHOLD = 5; // px dead zone before pan activates
	let isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

	// Eraser gesture modifier: Alt for partial erase
	let isAltEraseMode = false;

	// Canvas dimensions for overlays - will be updated manually
	let canvasDisplayWidth = 0;
	let canvasDisplayHeight = 0;

	// Base page dimensions at scale 1, rotation 0 — used for coordinate transforms
	let basePageWidth = 0;
	let basePageHeight = 0;

	// Text extraction state
	let extractedPageText = '';
	let isExtractingText = false;
	let overlayHeight = 0;

	// PDF link annotations for the current page
	let pageLinks: Array<{
		url: string;
		rect: { left: number; top: number; width: number; height: number };
		isInternal: boolean;
		destPage?: number;
	}> = [];

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

	// Helper function to get fallback PDF title from file object or URL
	function getFallbackPdfTitle(file: File | string): string {
		try {
			const filename = typeof file === 'string' ? extractFilenameFromUrl(file) : file.name;
			return filename.replace(/\.pdf$/i, '');
		} catch (error) {
			console.error('Error generating fallback title:', error);
			return 'document';
		}
	}

	// Helper to check if title is valid/useful
	function isValidTitle(title: string | null | undefined): boolean {
		if (!title || !title.trim()) return false;
		const lower = title.toLowerCase();
		// Filter out common auto-generated/system titles
		if (lower.startsWith('converted from')) return false;
		if (lower.startsWith('microsoft word -')) return false;
		if (lower === 'untitled') return false;
		// Filter out paths
		if (title.startsWith('/') || (title.length > 2 && title[1] === ':')) return false;
		return true;
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
	$: if (
		drawingEngine &&
		$currentPagePaths &&
		canvasesReady &&
		basePageWidth > 0 &&
		basePageHeight > 0
	) {
		const transformedPaths = $currentPagePaths.map((path) => ({
			...path,
			points: path.points.map((pt) => {
				const transformed = transformPoint(
					pt.x,
					pt.y,
					$pdfState.rotation as RotationAngle,
					basePageWidth,
					basePageHeight
				);
				return { ...pt, x: transformed.x, y: transformed.y };
			})
		}));
		drawingEngine.renderPaths(transformedPaths, $pdfState.scale);
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

	// Update window title when page changes
	$: if (
		$pdfState.currentPage &&
		$pdfState.totalPages &&
		pdfBaseTitle &&
		typeof window !== 'undefined'
	) {
		const newTitle = buildWindowTitle(pdfBaseTitle, $pdfState.currentPage, $pdfState.totalPages);
		window.document.title = newTitle;
		setWindowTitle(newTitle);
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
		// Cancel any pending pinch rAF so it doesn't fire after teardown
		if (pinchRafId !== null) {
			cancelAnimationFrame(pinchRafId);
			pinchRafId = null;
		}

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
				gestureTracker = new GestureTracker();
				panInertia = new PanInertia();

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

				if (isValidTitle(pdfTitle)) {
					pdfBaseTitle = pdfTitle.trim();
				} else {
					// Fallback to filename if available
					if (pdfFile) {
						pdfBaseTitle = getFallbackPdfTitle(pdfFile);
						if (!pdfTitle || !pdfTitle.trim()) {
							console.log('✅ No PDF title found, using filename:', pdfBaseTitle);
						} else {
							console.log(
								'⚠️ Ignored generic/system PDF title ("' + pdfTitle + '"), using filename:',
								pdfBaseTitle
							);
						}
					}
				}
			} catch (titleError) {
				console.error('❌ Could not extract PDF title:', titleError);
				// Try fallback anyway
				try {
					if (pdfFile) {
						pdfBaseTitle = getFallbackPdfTitle(pdfFile);
						console.log('✅ Used fallback filename as title:', pdfBaseTitle);
					}
				} catch (fallbackError) {
					console.error('❌ Even fallback title failed:', fallbackError);
				}
			}

			// Set initial window title
			if (pdfBaseTitle) {
				const title = buildWindowTitle(pdfBaseTitle, 1, document.numPages);
				window.document.title = title;
				setWindowTitle(title);
				console.log('✅ Updated webpage title:', title);
			}

			pdfState.update((state) => ({
				...state,
				document,
				totalPages: document.numPages,
				currentPage: 1,
				isLoading: false,
				rotation: 0
			}));

			// Mark this file as loaded
			lastLoadedFile = pdfFile;

			// Reset pan offset to center the PDF
			panOffset = { x: 0, y: 0 };

			// Calculate the proper scale BEFORE first render to avoid position jumps
			// Auto-fit to page on first load for better initial view of both portrait and landscape
			if (containerDiv) {
				const page = await document.getPage(1);
				const viewport = page.getViewport({ scale: 1, rotation: $pdfState.rotation });
				const containerHeight = containerDiv.clientHeight - TOOLBAR_HEIGHT; // Account for toolbar and page info
				const containerWidth = containerDiv.clientWidth - 40; // Account for padding

				const fitHeightScale = containerHeight / viewport.height;
				const fitWidthScale = containerWidth / viewport.width;
				const fitPageScale = Math.min(fitHeightScale, fitWidthScale);

				// Update scale without rendering yet
				pdfState.update((state) => ({ ...state, scale: fitPageScale }));
				console.log('Initial scale set to fit page:', fitPageScale);

				// Pre-calculate canvas dimensions at the new scale to avoid position jumps
				const scaledViewport = page.getViewport({
					scale: fitPageScale,
					rotation: $pdfState.rotation
				});

				// Track unrotated base dimensions for coordinate transforms
				const baseViewport = page.getViewport({ scale: 1, rotation: 0 });
				basePageWidth = baseViewport.width;
				basePageHeight = baseViewport.height;
				canvasDisplayWidth = scaledViewport.width;
				canvasDisplayHeight = scaledViewport.height;
				console.log('Initial canvas dimensions set:', {
					width: canvasDisplayWidth,
					height: canvasDisplayHeight,
					scale: fitPageScale
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
			const viewport = page.getViewport({ scale: scaleToRender, rotation: $pdfState.rotation });
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
				canvas: pdfCanvas,
				rotation: $pdfState.rotation
			});

			// Sync drawing canvas sizes with PDF canvas
			if (drawingCanvas) {
				drawingCanvas.width = viewport.width;
				drawingCanvas.height = viewport.height;
				drawingCanvas.style.width = `${viewport.width}px`;
				drawingCanvas.style.height = `${viewport.height}px`;

				// Update base page dimensions (unrotated) for coordinate transforms
				const baseViewport = page.getViewport({ scale: 1, rotation: 0 });
				basePageWidth = baseViewport.width;
				basePageHeight = baseViewport.height;

				// Re-render drawing paths for current page with rotation transform
				if (drawingEngine) {
					// Transform paths from rotation-0 storage space to current rotation display space
					const transformedPaths = $currentPagePaths.map((path) => ({
						...path,
						points: path.points.map((pt) => {
							const transformed = transformPoint(
								pt.x,
								pt.y,
								$pdfState.rotation as RotationAngle,
								basePageWidth,
								basePageHeight
							);
							return { ...pt, x: transformed.x, y: transformed.y };
						})
					}));
					drawingEngine.renderPaths(transformedPaths, scaleToRender);
				}
			}

			// Update canvas display dimensions for overlays
			canvasDisplayWidth = viewport.width;
			canvasDisplayHeight = viewport.height;

			// Extract PDF link annotations for this page
			try {
				const annotations = await page.getAnnotations();
				const extractedLinks: typeof pageLinks = [];

				for (const annot of annotations) {
					if (annot.subtype !== 'Link' || !annot.rect) continue;

					// Convert PDF rect [x1, y1, x2, y2] to viewport coordinates
					const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(annot.rect);
					const left = Math.min(x1, x2);
					const top = Math.min(y1, y2);
					const width = Math.abs(x2 - x1);
					const height = Math.abs(y2 - y1);

					// Determine if it's an external URL or internal page link
					if (annot.url) {
						extractedLinks.push({
							url: annot.url,
							rect: { left, top, width, height },
							isInternal: false
						});
					} else if (annot.dest) {
						// Internal link — resolve destination to page number
						let destPage: number | undefined;
						try {
							if (typeof annot.dest === 'string' && $pdfState.document) {
								const dest = await $pdfState.document.getDestination(annot.dest);
								if (dest && dest[0]) {
									const pageIndex = await $pdfState.document.getPageIndex(dest[0]);
									destPage = pageIndex + 1; // 0-indexed → 1-indexed
								}
							} else if (Array.isArray(annot.dest) && annot.dest[0]) {
								const pageIndex = await $pdfState.document!.getPageIndex(annot.dest[0]);
								destPage = pageIndex + 1;
							}
						} catch {
							// Could not resolve destination — skip
						}
						if (destPage) {
							extractedLinks.push({
								url: '',
								rect: { left, top, width, height },
								isInternal: true,
								destPage
							});
						}
					}
				}

				pageLinks = extractedLinks;
			} catch (linkError) {
				console.warn('Could not extract link annotations:', linkError);
				pageLinks = [];
			}
		} catch (error) {
			console.error('Error rendering page:', error);
		} finally {
			isRendering = false;
			
			// If rotation was queued during rendering, apply it now
			if (pendingRotation !== null) {
				const queuedRotation = pendingRotation;
				pendingRotation = null;
				pdfState.update((state) => ({ ...state, rotation: queuedRotation }));
				panOffset = { x: 0, y: 0 };
				await renderCurrentPage();
			}
		}
	}

	function setupDrawingEvents() {
		if (!drawingCanvas || !containerDiv) return;

		// Add drawing events to the drawing canvas
		drawingCanvas.addEventListener('pointerdown', handlePointerDown);
		drawingCanvas.addEventListener('pointermove', handlePointerMove);
		drawingCanvas.addEventListener('pointerup', handlePointerUp);
		drawingCanvas.addEventListener('pointerleave', handlePointerUp);
		drawingCanvas.addEventListener('pointercancel', handlePointerUp);

		// Add canvas hover events for cursor tracking
		drawingCanvas.addEventListener('pointerenter', handleCanvasEnter);
		drawingCanvas.addEventListener('pointerleave', handleCanvasLeave);

		// Add panning events to the entire container for infinite canvas feel
		containerDiv.addEventListener('pointerdown', handleContainerPointerDown);
		containerDiv.addEventListener('pointermove', handleContainerPointerMove);
		containerDiv.addEventListener('pointerup', handleContainerPointerUp);
		containerDiv.addEventListener('pointerleave', handleContainerPointerUp);
		containerDiv.addEventListener('pointercancel', handleContainerPointerUp);

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

		// Two-finger touch: yield to container for pan/pinch (don't draw)
		if (event.pointerType === 'touch' && gestureTracker && gestureTracker.count >= 1) {
			console.log('Second touch finger on canvas, yielding to gesture handler');
			return;
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
		// Convert canvas point to base viewport coords (scale 1.0), then inverse-rotate to rotation-0 space
		const scaledPoint = { x: canvasPoint.x / $pdfState.scale, y: canvasPoint.y / $pdfState.scale };
		const rotatedBase = inverseTransformPoint(
			scaledPoint.x,
			scaledPoint.y,
			$pdfState.rotation as RotationAngle,
			basePageWidth,
			basePageHeight
		);
		const basePoint = {
			x: rotatedBase.x,
			y: rotatedBase.y,
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
			// Apply the transform to the cached content wrapper
			if (contentWrapperDiv) {
				contentWrapperDiv.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
			}
			return;
		}

		if (!isDrawing || !drawingEngine) return;

		event.preventDefault();
		// Get point and convert to base viewport coordinates (scale 1.0)
		const canvasPoint = drawingEngine.getPointFromEvent(event);
		// Convert to rotation-0 base viewport coordinates for storage
		const scaledPoint = { x: canvasPoint.x / $pdfState.scale, y: canvasPoint.y / $pdfState.scale };
		const rotatedBase = inverseTransformPoint(
			scaledPoint.x,
			scaledPoint.y,
			$pdfState.rotation as RotationAngle,
			basePageWidth,
			basePageHeight
		);
		const basePoint = {
			x: rotatedBase.x,
			y: rotatedBase.y,
			pressure: canvasPoint.pressure
		};

		drawingEngine.continueDrawing(canvasPoint); // Use canvas point for immediate visual feedback
		currentDrawingPath.push(basePoint); // Store base viewport coordinates
	}

	function handlePointerUp(event: PointerEvent) {
		if (!isDrawing || !drawingEngine) return;

		event.preventDefault();
		try {
			drawingCanvas.releasePointerCapture(event.pointerId);
		} catch {
			/* pointer may already be released (e.g. pointercancel) */
		}

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
				const basePathPoints = finalPath.map((point) => {
					const scaled = { x: point.x / $pdfState.scale, y: point.y / $pdfState.scale };
					const base = inverseTransformPoint(
						scaled.x,
						scaled.y,
						$pdfState.rotation as RotationAngle,
						basePageWidth,
						basePageHeight
					);
					return { x: base.x, y: base.y, pressure: point.pressure };
				});
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

		// On touch devices, skip custom cursor logic to avoid iOS cursor flicker
		if (isTouchDevice) {
			containerDiv.style.cursor = '';
			if (drawingCanvas) drawingCanvas.style.cursor = '';
			return;
		}

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
	/** Is a freehand drawing tool currently selected? */
	function hasActiveFreehandTool(): boolean {
		return ['pencil', 'eraser', 'highlight'].includes($drawingState.tool);
	}

	function handleContainerPointerDown(event: PointerEvent) {
		if (gestureTracker) gestureTracker.track(event);
		if (panInertia) panInertia.cancel();

		// ── Two-finger gesture starts (pinch / two-finger pan) ──
		if (gestureTracker && gestureTracker.count === 2) {
			// Cancel any single-finger pan that was in progress
			isPanning = false;
			isPanConfirmed = false;
			isPinching = true;
			pinchStartDistance = gestureTracker.getPinchDistance();
			pinchStartScale = $pdfState.scale;
			pinchStartMidpoint = gestureTracker.getPinchMidpoint();
			pinchStartPanOffset = { ...panOffset };
			lastPinchPanX = panOffset.x;
			lastPinchPanY = panOffset.y;
			event.preventDefault();

			// Also cancel any drawing that may have started from the first finger
			if (isDrawing && drawingEngine) {
				isDrawing = false;
				drawingEngine.endDrawing();
				currentDrawingPath = [];
			}
			return;
		}

		// ── Single-pointer pan eligibility ──
		// Desktop: Ctrl+drag (unchanged)
		// Touch, no freehand tool: single-finger pan
		const isTouchPan = event.pointerType === 'touch' && !hasActiveFreehandTool();

		if (event.ctrlKey || isTouchPan) {
			event.preventDefault();
			isPanning = true;
			isPanConfirmed = !isTouchPan; // Desktop Ctrl: no dead zone needed
			panStartRaw = { x: event.clientX, y: event.clientY };
			panStart = { x: event.clientX - panOffset.x, y: event.clientY - panOffset.y };
			containerDiv.setPointerCapture(event.pointerId);
			if (!isTouchDevice) containerDiv.style.cursor = 'grabbing';
		}
	}

	/**
	 * rAF callback: compute pinch scale + two-finger pan in one batched frame.
	 * By the time this fires, both fingers' pointermove events have been
	 * processed by gestureTracker, so midpoint & distance are stable.
	 */
	function applyPinchFrame() {
		pinchRafId = null; // allow next frame to be scheduled
		if (!gestureTracker || gestureTracker.count < 2 || pinchStartDistance <= 0) return;

		// Scale
		const currentDist = gestureTracker.getPinchDistance();
		const scaleRatio = currentDist / pinchStartDistance;
		const newScale = Math.max(0.1, Math.min(10, pinchStartScale * scaleRatio));

		// Pan: simple midpoint delta from gesture start
		const currentMidpoint = gestureTracker.getPinchMidpoint();
		lastPinchPanX = pinchStartPanOffset.x + (currentMidpoint.x - pinchStartMidpoint.x);
		lastPinchPanY = pinchStartPanOffset.y + (currentMidpoint.y - pinchStartMidpoint.y);

		// Apply CSS transform for smooth visual feedback
		const cssScale = newScale / $pdfState.scale;
		lastPinchScale = newScale;
		if (contentWrapperDiv) {
			contentWrapperDiv.style.transform = `translate(${lastPinchPanX}px, ${lastPinchPanY}px) scale(${cssScale})`;
		}
	}

	function handleContainerPointerMove(event: PointerEvent) {
		if (gestureTracker) gestureTracker.track(event);

		// ── Pinch-to-zoom + two-finger pan ──
		// We only mark the rAF as needed here; the actual computation is
		// deferred to applyPinchFrame() so that BOTH fingers' pointermove
		// events are processed before we compute midpoint & distance.
		if (isPinching && gestureTracker && gestureTracker.count >= 2 && pinchStartDistance > 0) {
			event.preventDefault();
			if (pinchRafId === null) {
				pinchRafId = requestAnimationFrame(applyPinchFrame);
			}
			return;
		}

		// ── Single-pointer pan ──
		if (isPanning) {
			event.preventDefault();

			// Dead-zone check for touch pans to avoid mistaking taps for pans
			if (!isPanConfirmed) {
				const dx = event.clientX - panStartRaw.x;
				const dy = event.clientY - panStartRaw.y;
				if (Math.sqrt(dx * dx + dy * dy) < PAN_THRESHOLD) return;
				isPanConfirmed = true;
			}

			const newOffset = { x: event.clientX - panStart.x, y: event.clientY - panStart.y };

			// Feed velocity tracker for touch inertia
			if (event.pointerType === 'touch' && panInertia) {
				panInertia.addSample(newOffset.x - panOffset.x, newOffset.y - panOffset.y);
			}

			panOffset = newOffset;
			if (contentWrapperDiv) {
				contentWrapperDiv.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
			}
		}
	}

	async function handleContainerPointerUp(event: PointerEvent) {
		// Snapshot midpoint BEFORE untracking so we can compute final pan position
		let freshMid: { x: number; y: number } | null = null;
		if (gestureTracker && gestureTracker.count >= 2) {
			freshMid = gestureTracker.getPinchMidpoint();
		}
		if (gestureTracker) gestureTracker.untrack(event);

		// ── Pinch ended: commit the final scale + pan ──
		if (isPinching && gestureTracker && gestureTracker.count < 2) {
			// Cancel any pending rAF so it doesn't fire after we commit
			if (pinchRafId !== null) {
				cancelAnimationFrame(pinchRafId);
				pinchRafId = null;
			}

			if (pinchStartDistance > 0) {
				// Compute final scale and render once
				const currentDist =
					gestureTracker.count === 1
						? 0 // last finger lifted — use last known ratio
						: gestureTracker.getPinchDistance();
				let finalScale = $pdfState.scale;
				if (currentDist > 0) {
					const scaleRatio = currentDist / pinchStartDistance;
					finalScale = Math.max(0.1, Math.min(10, pinchStartScale * scaleRatio));
				} else if (lastPinchScale > 0) {
					// Use last recorded scale value — no CSS parsing needed
					finalScale = Math.max(0.1, Math.min(10, lastPinchScale));
				}

				// Use the midpoint snapshot (captured before untrack) to recompute
				// pan position if the rAF was cancelled and values are stale
				if (freshMid) {
					lastPinchPanX = pinchStartPanOffset.x + (freshMid.x - pinchStartMidpoint.x);
					lastPinchPanY = pinchStartPanOffset.y + (freshMid.y - pinchStartMidpoint.y);
				}

				// Commit the visual pan position accumulated during the gesture
				panOffset = { x: lastPinchPanX, y: lastPinchPanY };

				// Reset CSS transform scale (back to translate-only)
				if (contentWrapperDiv) {
					contentWrapperDiv.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
				}

				// Re-render at final scale
				// CRITICAL: Render FIRST, update state AFTER so subscribers
				// read the new scale only after the canvas is painted.
				await renderCurrentPage(finalScale);
				pdfState.update((s) => ({ ...s, scale: finalScale }));
			}

			pinchStartDistance = 0;
			pinchStartScale = 0;
			lastPinchScale = 0; // reset so stale value isn't reused next gesture
			pinchStartMidpoint = { x: 0, y: 0 };
			pinchStartPanOffset = { x: 0, y: 0 };
			lastPinchPanX = 0;
			lastPinchPanY = 0;

			isPinching = false;
			if (gestureTracker.count === 0) {
				gestureTracker.reset(); // failsafe: clear any ghost pointers
			} else if (gestureTracker.count === 1 && !hasActiveFreehandTool()) {
				// Remaining finger transitions into a single-finger pan
				const remaining = gestureTracker.getFirstPointer();
				if (remaining) {
					isPanning = true;
					isPanConfirmed = true; // no dead zone — already in gesture
					panStart = { x: remaining.x - panOffset.x, y: remaining.y - panOffset.y };
				}
			}
			return;
		}

		// ── Pan ended ──
		if (isPanning) {
			isPanning = false;
			isPanConfirmed = false;
			try {
				containerDiv.releasePointerCapture(event.pointerId);
			} catch {
				/* pointer may already be released */
			}

			// Start inertia for touch pans
			if (event.pointerType === 'touch' && panInertia) {
				panInertia.start((dx, dy) => {
					panOffset = { x: panOffset.x + dx, y: panOffset.y + dy };
					if (contentWrapperDiv) {
						contentWrapperDiv.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
					}
				});
			}

			updateCursor();
		}
	}

	/**
	 * Shared scroll logic: pans when zoomed in, navigates pages otherwise.
	 * Positive delta = scroll down, negative delta = scroll up.
	 * Called by both handleWheel and arrow key handlers.
	 */
	function scrollByDelta(delta: number) {
		if (!pdfCanvas || !containerDiv) return;

		const canvasHeight = parseFloat(pdfCanvas.style.height) || 0;
		const viewportHeight = containerDiv.clientHeight;
		const overflow = canvasHeight - viewportHeight;

		// Buffer zone past the page edge — shows the background briefly
		// before navigating, so the user sees a visual "page gap"
		const PAGE_GAP_BUFFER = 60;

		if (overflow > 0) {
			// Zoomed in: canvas is taller than viewport — pan first
			const scrollAmount = Math.min(Math.abs(delta), 100);
			const maxPanUp = overflow / 2;
			const maxPanDown = -(overflow / 2);
			// Extended bounds include the buffer zone past the page edge
			const extendedPanDown = maxPanDown - PAGE_GAP_BUFFER;
			const extendedPanUp = maxPanUp + PAGE_GAP_BUFFER;

			if (delta > 0) {
				// Scrolling down
				if (panOffset.y > extendedPanDown) {
					panOffset = { ...panOffset, y: Math.max(panOffset.y - scrollAmount, extendedPanDown) };
				} else if ($pdfState.currentPage < $pdfState.totalPages) {
					panOffset = { x: 0, y: maxPanUp };
					nextPage();
				}
			} else if (delta < 0) {
				// Scrolling up
				if (panOffset.y < extendedPanUp) {
					panOffset = { ...panOffset, y: Math.min(panOffset.y + scrollAmount, extendedPanUp) };
				} else if ($pdfState.currentPage > 1) {
					panOffset = { x: 0, y: maxPanDown };
					previousPage();
				}
			}
		} else {
			// Zoom ≤ 100%: canvas fits in viewport — navigate pages directly
			if (delta > 0) {
				nextPage();
			} else if (delta < 0) {
				previousPage();
			}
		}
	}

	// Fixed scroll amount for arrow key presses (in pixels)
	const ARROW_KEY_SCROLL_PX = 60;

	export function scrollDown() {
		scrollByDelta(ARROW_KEY_SCROLL_PX);
	}

	export function scrollUp() {
		scrollByDelta(-ARROW_KEY_SCROLL_PX);
	}

	function handleWheel(event: WheelEvent) {
		// Only handle wheel events that originate inside the PDF container.
		// This prevents blocking scrolling on toolbar, thumbnails, modals, etc.
		if (!containerDiv?.contains(event.target as Node)) return;

		if (event.ctrlKey) {
			// Ctrl + scroll = zoom
			event.preventDefault();

			if (event.deltaY < 0) {
				zoomIn();
			} else {
				zoomOut();
			}
			return;
		}

		// Plain scroll: pan when zoomed in, navigate pages otherwise
		event.preventDefault();

		if (!pdfCanvas || !containerDiv) return;

		// Normalize deltaY to pixels across browsers.
		// Firefox reports deltaMode=1 (lines), most others report deltaMode=0 (pixels).
		const LINE_HEIGHT = 16;
		let pixelDelta = event.deltaY;
		if (event.deltaMode === 1) pixelDelta *= LINE_HEIGHT;
		else if (event.deltaMode === 2) pixelDelta *= containerDiv.clientHeight;

		scrollByDelta(pixelDelta);
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
		const newScale = 1.0;
		// CRITICAL: Render FIRST, update state AFTER
		await renderCurrentPage(newScale);
		pdfState.update((state) => ({ ...state, scale: newScale }));
	}

	export async function fitToWidth() {
		if (!$pdfState.document || !containerDiv) return;

		try {
			const page = await $pdfState.document.getPage($pdfState.currentPage);
			const viewport = page.getViewport({ scale: 1, rotation: $pdfState.rotation });
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
			const viewport = page.getViewport({ scale: 1, rotation: $pdfState.rotation });
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

	export async function fitToPage() {
		if (!$pdfState.document || !containerDiv) return;

		try {
			const page = await $pdfState.document.getPage($pdfState.currentPage);
			const viewport = page.getViewport({ scale: 1, rotation: $pdfState.rotation });

			const containerHeight = containerDiv.clientHeight - (presentationMode ? 0 : TOOLBAR_HEIGHT); // Account for toolbar and page info
			const containerWidth = containerDiv.clientWidth - (presentationMode ? 0 : 40); // Account for padding

			const heightScale = containerHeight / viewport.height;
			const widthScale = containerWidth / viewport.width;
			const newScale = Math.min(heightScale, widthScale);

			panOffset = { x: 0, y: 0 };
			// CRITICAL: Render FIRST, update state AFTER
			await renderCurrentPage(newScale);
			pdfState.update((state) => ({ ...state, scale: newScale }));
		} catch (error) {
			console.error('Error fitting to page:', error);
		}
	}

	// ── Rotation functions ──────────────────────────────────
	export async function rotateLeft() {
		// Use pendingRotation if set (queued during render), otherwise use current pdfState rotation
		const current = (pendingRotation ?? $pdfState.rotation) as number;
		const newRotation = ((current - 90 + 360) % 360) as 0 | 90 | 180 | 270;
		
		// If rendering, queue the rotation for later; otherwise apply immediately
		if (isRendering) {
			pendingRotation = newRotation;
			return;
		}
		
		pdfState.update((state) => ({ ...state, rotation: newRotation }));
		panOffset = { x: 0, y: 0 };
		await renderCurrentPage();
	}

	export async function rotateRight() {
		// Use pendingRotation if set (queued during render), otherwise use current pdfState rotation
		const current = (pendingRotation ?? $pdfState.rotation) as number;
		const newRotation = ((current + 90) % 360) as 0 | 90 | 180 | 270;
		
		// If rendering, queue the rotation for later; otherwise apply immediately
		if (isRendering) {
			pendingRotation = newRotation;
			return;
		}
		
		pdfState.update((state) => ({ ...state, rotation: newRotation }));
		panOffset = { x: 0, y: 0 };
		await renderCurrentPage();
	}

	// Track previous presentation mode to detect actual changes
	let previousPresentationMode = false;

	// React to presentation mode changes - only when actually entering presentation mode
	$: if (presentationMode && !previousPresentationMode && $pdfState.document) {
		// When entering presentation mode, wait for full screen and resize
		// We use setTimeout to allow the browser to transition to fullscreen and layout to update
		previousPresentationMode = true;
		setTimeout(() => {
			fitToPage();
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

	// Function to get rotation for a specific page
	export function getPageRotation(pageNumber: number): number {
		const pages = ($pdfState as any).pages;
		const perPageRotation =
			pages?.[pageNumber]?.rotation ??
			pages?.[pageNumber - 1]?.rotation ??
			pages?.[String(pageNumber)]?.rotation;

		if (typeof perPageRotation === 'number') {
			return perPageRotation;
		}

		return $pdfState.rotation || 0;
	}

	// Function to get all native annotations for a specific page
	export function getPageAnnotations(pageNumber: number) {
		return {
			drawingPaths: $drawingPaths.get(pageNumber) || [],
			textAnnotations: $textAnnotations.get(pageNumber) || [],
			stickyNotes: $stickyNoteAnnotations.get(pageNumber) || [],
			stampAnnotations: $stampAnnotations.get(pageNumber) || [],
			arrowAnnotations: $arrowAnnotations.get(pageNumber) || []
		};
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
			// Use page-specific rotation instead of global rotation
			const targetRotation = (getPageRotation(pageNumber) || 0) as RotationAngle;
			const viewport = page.getViewport({ scale: 1.0, rotation: targetRotation }); // Use scale 1 with page-specific rotation for export
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
					canvas: tempPdfCanvas,
					rotation: targetRotation
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

		// Get unrotated base dimensions for coordinate transformation
		let basePageWidth = 0;
		let basePageHeight = 0;
		let currentRotation: RotationAngle = 0;
		if ($pdfState.document) {
			try {
				const page = await $pdfState.document.getPage(pageNumber);
				const baseViewport = page.getViewport({ scale: 1.0, rotation: 0 });
				basePageWidth = baseViewport.width;
				basePageHeight = baseViewport.height;
				// Use per-page rotation instead of global rotation
				currentRotation = (getPageRotation(pageNumber) || 0) as RotationAngle;
			} catch (e) {
				console.error('Failed to get base viewport for export', e);
				// Fallback: compute unrotated dimensions from rotated canvasWidth/canvasHeight
				// If rotation is 90 or 270, dimensions are swapped
				const pageRotation = (getPageRotation(pageNumber) || 0) as RotationAngle;
				if (pageRotation === 90 || pageRotation === 270) {
					basePageWidth = canvasHeight;
					basePageHeight = canvasWidth;
				} else {
					basePageWidth = canvasWidth;
					basePageHeight = canvasHeight;
				}
			}
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

					// Transform drawing path points for rotation (same as other annotations)
					// Drawing paths are stored at base viewport coordinates (scale 1.0)
					const transformedPoints = path.points.map((point: Point) =>
						transformPoint(point.x, point.y, currentRotation, basePageWidth, basePageHeight)
					);

					ctx.beginPath();
					ctx.moveTo(transformedPoints[0].x, transformedPoints[0].y);

					for (let i = 1; i < transformedPoints.length; i++) {
						ctx.lineTo(transformedPoints[i].x, transformedPoints[i].y);
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
			console.log('Drawing text annotations with base dimensions:', {
				baseDimensions: [basePageWidth, basePageHeight],
				canvasDimensions: [canvasWidth, canvasHeight],
				rotation: currentRotation
			});
			ctx.save();
			ctx.scale(outputScale, outputScale);

			pageTextAnnotations.forEach((annotation) => {
				// Annotations are stored in unrotated (base) coordinates
				// Transform them to the rotated coordinate space for rendering on the rotated PDF
				let baseX =
					annotation.x !== undefined ? annotation.x : annotation.relativeX * basePageWidth;
				let baseY =
					annotation.y !== undefined ? annotation.y : annotation.relativeY * basePageHeight;

				const pt = transformPoint(baseX, baseY, currentRotation, basePageWidth, basePageHeight);
				const x = pt.x;
				const y = pt.y;

				console.log(`Text annotation base: (${baseX}, ${baseY}) -> rotated: (${x}, ${y}), rotation: ${currentRotation}`);

				ctx.save();
				// Translate to text position and apply combined rotation (page + text offset)
				ctx.translate(x, y);
				const textRotation = currentRotation + (annotation.rotation || 0);
				ctx.rotate((textRotation * Math.PI) / 180);
				ctx.translate(-x, -y);

				ctx.font = `${annotation.fontSize}px ${annotation.fontFamily}`;
				ctx.fillStyle = annotation.color;
				ctx.textBaseline = 'top';

				const lines = annotation.text.split('\n');
				lines.forEach((line: string, index: number) => {
					ctx.fillText(line, x, y + index * annotation.fontSize * 1.2);
				});
				ctx.restore();
			});

			ctx.restore();
		}

		// Draw arrow annotations - Apply outputScale to match the scaled canvas
		if (pageArrowAnnotations.length > 0) {
			ctx.save();
			ctx.scale(outputScale, outputScale);

			pageArrowAnnotations.forEach((arrow) => {
				// Annotations are stored in unrotated (base) coordinates
				const baseX1 = arrow.x1 !== undefined ? arrow.x1 : arrow.relativeX1 * basePageWidth;
				const baseY1 = arrow.y1 !== undefined ? arrow.y1 : arrow.relativeY1 * basePageHeight;
				const baseX2 = arrow.x2 !== undefined ? arrow.x2 : arrow.relativeX2 * basePageWidth;
				const baseY2 = arrow.y2 !== undefined ? arrow.y2 : arrow.relativeY2 * basePageHeight;

				const pt1 = transformPoint(baseX1, baseY1, currentRotation, basePageWidth, basePageHeight);
				const pt2 = transformPoint(baseX2, baseY2, currentRotation, basePageWidth, basePageHeight);

				const x1 = pt1.x;
				const y1 = pt1.y;
				const x2 = pt2.x;
				const y2 = pt2.y;

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

				const baseX =
					stampAnnotation.x !== undefined
						? stampAnnotation.x
						: stampAnnotation.relativeX * basePageWidth;
				const baseY =
					stampAnnotation.y !== undefined
						? stampAnnotation.y
						: stampAnnotation.relativeY * basePageHeight;

				const pt = transformPoint(baseX, baseY, currentRotation, basePageWidth, basePageHeight);
				// Use base coordinates directly - the canvas context is already scaled by outputScale
				const x = pt.x;
				const y = pt.y;

				// Calculate stamp size the same way as StampAnnotation component
				const MIN_SIZE = 16;
				const MAX_SIZE = 120;
				const calculatedSize = Math.max(
					MIN_SIZE,
					Math.min(
						MAX_SIZE,
						stampAnnotation.size !== undefined
							? stampAnnotation.size
							: stampAnnotation.relativeSize * Math.min(basePageWidth, basePageHeight)
					)
				);
				const stampWidth = calculatedSize;
				const stampHeight = calculatedSize;

				try {
					// Convert SVG string to image
					const img = await svgToImage(svgString, stampWidth, stampHeight);

					console.log(
						`Drawing stamp "${stampName}" at (${x}, ${y}) size ${stampWidth}x${stampHeight}, pageRotation: ${currentRotation}, stampRotation: ${stampAnnotation.rotation}`
					);
					
					ctx.save();
					// Apply both page rotation and stamp's own rotation around top-left corner
					// This matches the viewer: outer div rotates by page rotation (transform-origin: top left)
					// and inner content adds stamp's own rotation
					ctx.translate(x, y);
					const totalRotation = currentRotation + (stampAnnotation.rotation || 0);
					ctx.rotate((totalRotation * Math.PI) / 180);
					ctx.translate(-x, -y);
					
					ctx.drawImage(img, x, y, stampWidth, stampHeight);
					ctx.restore();

					return { success: true, stamp: stampName };
				} catch (error) {
					console.warn('Failed to convert SVG to image for export:', stampName, error);

					// Draw fallback rectangle
					ctx.save();
					ctx.translate(x, y);
					const totalFallbackRotation = currentRotation + (stampAnnotation.rotation || 0);
					ctx.rotate((totalFallbackRotation * Math.PI) / 180);
					ctx.translate(-x, -y);
					
					ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
					ctx.fillRect(x, y, stampWidth, stampHeight);
					ctx.fillStyle = '#000';
					ctx.font = '12px Arial';
					ctx.fillText(stampName, x + 5, y + 20);
					ctx.restore();

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
				const baseX = note.x !== undefined ? note.x : note.relativeX * basePageWidth;
				const baseY = note.y !== undefined ? note.y : note.relativeY * basePageHeight;

				const pt = transformPoint(baseX, baseY, currentRotation, basePageWidth, basePageHeight);
				const x = pt.x;
				const y = pt.y;

				const width = note.width || 200;
				const height = note.height || 150;
				const borderRadius = 8; // Match the border-radius from StickyNote.svelte

				// Save context for shadow and combined rotation
				ctx.save();

				// Apply combined rotation (page rotation + note's rotation offset) around top-left corner
				ctx.translate(x, y);
				const combinedRotation = currentRotation + (note.rotation || 0);
				ctx.rotate((combinedRotation * Math.PI) / 180);
				ctx.translate(-x, -y);

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
				ctx.fillStyle = note.backgroundColor || '#FFF59D';
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

				// Set clipping region for text to stay within rounded rectangle
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

				// Restore context and clipping
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

						// Paths are stored in unrotated base coordinates: rotate + scale to current viewer space
						const viewerScale = $pdfState.scale;
						const currentRotation = $pdfState.rotation as RotationAngle;
						const transformedPoints = path.points.map((point: Point) => {
							const rotated = transformPoint(
								point.x,
								point.y,
								currentRotation,
								basePageWidth,
								basePageHeight
							);
							return {
								x: rotated.x * viewerScale,
								y: rotated.y * viewerScale
							};
						});

						ctx.beginPath();
						ctx.moveTo(transformedPoints[0].x, transformedPoints[0].y);

						for (let i = 1; i < transformedPoints.length; i++) {
							ctx.lineTo(transformedPoints[i].x, transformedPoints[i].y);
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
				const viewerScale = $pdfState.scale;
				const currentRotation = $pdfState.rotation as RotationAngle;

				currentTextAnnotations.forEach((annotation) => {
					const baseX =
						annotation.x !== undefined ? annotation.x : annotation.relativeX * basePageWidth;
					const baseY =
						annotation.y !== undefined ? annotation.y : annotation.relativeY * basePageHeight;

					const pt = transformPoint(
						baseX,
						baseY,
						currentRotation,
						basePageWidth,
						basePageHeight
					);
					const x = pt.x * viewerScale;
					const y = pt.y * viewerScale;
					const scaledFontSize = annotation.fontSize * viewerScale;

					ctx.save();
					ctx.translate(x, y);
					const textRotation = currentRotation + (annotation.rotation || 0);
					ctx.rotate((textRotation * Math.PI) / 180);
					ctx.translate(-x, -y);

					ctx.font = `${scaledFontSize}px ${annotation.fontFamily}`;
					ctx.fillStyle = annotation.color;
					ctx.textBaseline = 'top';

					// Handle multi-line text
					const lines = annotation.text.split('\n');
					lines.forEach((line: string, index: number) => {
						ctx.fillText(line, x, y + index * scaledFontSize * 1.2);
					});

					ctx.restore();
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
				const viewerScale = $pdfState.scale;
				const currentRotation = $pdfState.rotation as RotationAngle;

				currentArrowAnnotations.forEach((arrow) => {
					const baseX1 = arrow.x1 !== undefined ? arrow.x1 : arrow.relativeX1 * basePageWidth;
					const baseY1 = arrow.y1 !== undefined ? arrow.y1 : arrow.relativeY1 * basePageHeight;
					const baseX2 = arrow.x2 !== undefined ? arrow.x2 : arrow.relativeX2 * basePageWidth;
					const baseY2 = arrow.y2 !== undefined ? arrow.y2 : arrow.relativeY2 * basePageHeight;

					const pt1 = transformPoint(
						baseX1,
						baseY1,
						currentRotation,
						basePageWidth,
						basePageHeight
					);
					const pt2 = transformPoint(
						baseX2,
						baseY2,
						currentRotation,
						basePageWidth,
						basePageHeight
					);

					const x1 = pt1.x * viewerScale;
					const y1 = pt1.y * viewerScale;
					const x2 = pt2.x * viewerScale;
					const y2 = pt2.y * viewerScale;

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
				const viewerScale = $pdfState.scale;
				const currentRotation = $pdfState.rotation as RotationAngle;

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

					const baseX =
						stampAnnotation.x !== undefined
							? stampAnnotation.x
							: stampAnnotation.relativeX * basePageWidth;
					const baseY =
						stampAnnotation.y !== undefined
							? stampAnnotation.y
							: stampAnnotation.relativeY * basePageHeight;

					const pt = transformPoint(
						baseX,
						baseY,
						currentRotation,
						basePageWidth,
						basePageHeight
					);
					const x = pt.x * viewerScale;
					const y = pt.y * viewerScale;

					// Calculate stamp size the same way as StampAnnotation component
					const MIN_SIZE = 16;
					const MAX_SIZE = 120;
					const calculatedSize = Math.max(
						MIN_SIZE,
						Math.min(
							MAX_SIZE,
							stampAnnotation.size !== undefined
								? stampAnnotation.size
								: stampAnnotation.relativeSize * Math.min(basePageWidth, basePageHeight)
						)
					);
					const stampWidth = calculatedSize * viewerScale;
					const stampHeight = calculatedSize * viewerScale;

					try {
						// Convert SVG string to image
						const img = await svgToImage(svgString, stampWidth, stampHeight);

						console.log(
							`Drawing current page stamp "${stampName}" at (${x}, ${y}) size ${stampWidth}x${stampHeight}`
						);
						ctx.save();
						// Apply both page rotation and stamp's own rotation around top-left corner
						ctx.translate(x, y);
						const totalRotation = currentRotation + (stampAnnotation.rotation || 0);
						ctx.rotate((totalRotation * Math.PI) / 180);
						ctx.translate(-x, -y);
						ctx.drawImage(img, x, y, stampWidth, stampHeight);
						ctx.restore();

						return { success: true, stamp: stampName };
					} catch (error) {
						console.warn(
							'Failed to convert SVG to image for current page export:',
							stampName,
							error
						);

						// Draw fallback rectangle
						ctx.save();
						if (stampAnnotation.rotation && stampAnnotation.rotation !== 0) {
							const centerX = x + stampWidth / 2;
							const centerY = y + stampHeight / 2;
							ctx.translate(centerX, centerY);
							ctx.rotate((stampAnnotation.rotation * Math.PI) / 180);
							ctx.translate(-centerX, -centerY);
						}

						ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
						ctx.fillRect(x, y, stampWidth, stampHeight);
						ctx.fillStyle = '#000';
						ctx.font = '12px Arial';
						ctx.fillText(stampName, x + 5, y + 20);
						ctx.restore();

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
				const viewerScale = $pdfState.scale;
				const currentRotation = $pdfState.rotation as RotationAngle;

				currentStickyNotes.forEach((note) => {
					const baseX = note.x !== undefined ? note.x : note.relativeX * basePageWidth;
					const baseY = note.y !== undefined ? note.y : note.relativeY * basePageHeight;

					const pt = transformPoint(
						baseX,
						baseY,
						currentRotation,
						basePageWidth,
						basePageHeight
					);
					const x = pt.x * viewerScale;
					const y = pt.y * viewerScale;

					const width = (note.width || 200) * viewerScale;
					const height = (note.height || 150) * viewerScale;
					const borderRadius = 8 * viewerScale; // Match the border-radius from StickyNote.svelte

					// Save context for shadow and combined rotation
					ctx.save();

					// Apply combined rotation (page rotation + note's rotation offset) around top-left corner
					ctx.translate(x, y);
					const combinedRotation = currentRotation + (note.rotation || 0);
					ctx.rotate((combinedRotation * Math.PI) / 180);
					ctx.translate(-x, -y);

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
					ctx.fillStyle = note.backgroundColor || '#FFF59D';
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

					// Set clipping region for text to stay within rounded rectangle (before restore)
					ctx.clip();

					// Draw sticky note text (inside transformed context with rotation and scale)
					ctx.fillStyle = '#000';
					ctx.font = `${note.fontSize * viewerScale || 14}px ${note.fontFamily || 'ReenieBeanie, cursive'}`;

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
					const lineHeight = (note.fontSize * viewerScale || 14) * 1.2;
					lines.forEach((line, index) => {
						// Container has 8px padding on all sides, so text starts at (8, 8) from container edge
						// But we need to match the visual appearance, so let's add more top padding
						ctx.fillText(line.trim(), x + 8, y + 32 + index * lineHeight);
					});

					// Restore context (includes clipping and rotation transforms)
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
		bind:this={contentWrapperDiv}
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
					rotation={$pdfState.rotation}
					{basePageWidth}
					{basePageHeight}
				/>
			{/if}

			<!-- Sticky Note Overlay for Custom Sticky Note Annotations -->
			{#if $pdfState.document && canvasDisplayWidth > 0 && canvasDisplayHeight > 0}
				<StickyNoteOverlay
					containerWidth={canvasDisplayWidth}
					containerHeight={canvasDisplayHeight}
					scale={$pdfState.scale}
					{viewOnlyMode}
					rotation={$pdfState.rotation}
					{basePageWidth}
					{basePageHeight}
				/>
			{/if}

			<!-- Stamp Overlay for Custom Stamp Annotations -->
			{#if $pdfState.document && canvasDisplayWidth > 0 && canvasDisplayHeight > 0}
				<StampOverlay
					containerWidth={canvasDisplayWidth}
					containerHeight={canvasDisplayHeight}
					scale={$pdfState.scale}
					{viewOnlyMode}
					rotation={$pdfState.rotation}
					{basePageWidth}
					{basePageHeight}
				/>
			{/if}

			<!-- Arrow Overlay for Custom Arrow Annotations -->
			{#if $pdfState.document && canvasDisplayWidth > 0 && canvasDisplayHeight > 0}
				<ArrowOverlay
					containerWidth={canvasDisplayWidth}
					containerHeight={canvasDisplayHeight}
					scale={$pdfState.scale}
					{viewOnlyMode}
					rotation={$pdfState.rotation}
					{basePageWidth}
					{basePageHeight}
				/>
			{/if}

			<!-- PDF Link Overlay for clickable hyperlinks -->
			{#if $pdfState.document && canvasDisplayWidth > 0 && canvasDisplayHeight > 0 && pageLinks.length > 0}
				<LinkOverlay
					links={pageLinks}
					containerWidth={canvasDisplayWidth}
					containerHeight={canvasDisplayHeight}
					onGoToPage={goToPage}
				/>
			{/if}
		</div>
	</div>

	<!-- Gesture hint for touch users -->
	<GestureHint />

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
		touch-action: none;
	}

	:global(.dark) .pdf-viewer {
		background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
	}

	/* Drawing canvas cursor is dynamically controlled by JavaScript */
</style>
