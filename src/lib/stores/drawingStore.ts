import { derived, writable } from 'svelte/store';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { DEFAULT_TEXT_FONT, BUNDLED_FONTS, getAllAvailableFonts, type FontOption } from '../config/fonts';

export type DrawingTool = 'pencil' | 'eraser' | 'text' | 'arrow' | 'highlight' | 'note' | 'stamp' | 'select';

export interface DrawingState {
	tool: DrawingTool;
	color: string;
	lineWidth: number;
	eraserSize: number;
	highlightColor: string;
	highlightOpacity: number;
	noteColor: string;
	isDrawing: boolean;
	stampId: string;
	textFontFamily: string;
}

export interface PDFState {
	document: PDFDocumentProxy | null;
	currentPage: number;
	totalPages: number;
	scale: number;
	rotation: 0 | 90 | 180 | 270;
	isLoading: boolean;
}

export interface Point {
	x: number;
	y: number;
	pressure?: number;
	relativeX?: number;
	relativeY?: number;
}

export interface DrawingPath {
	tool: DrawingTool;
	color: string;
	lineWidth: number;
	points: Point[];
	pageNumber: number;
	highlightColor?: string;
	highlightOpacity?: number;
	viewerScale?: number; // Store the viewer scale when the path was drawn
}

// Text annotation interface (custom text solution)
export interface TextAnnotation {
	id: string;
	pageNumber: number;
	x: number;
	y: number;
	text: string;
	fontSize: number;
	color: string;
	fontFamily: string;
	width?: number; // Optional width for resizable text boxes
	height?: number; // Optional height for resizable text boxes
	relativeX: number; // 0-1 range for scaling
	relativeY: number; // 0-1 range for scaling
	relativeWidth?: number; // 0-1 range for scaling
	relativeHeight?: number; // 0-1 range for scaling
	rotation?: number; // Rotation offset to keep text straight at creation time
}

// Sticky Note annotation interface (custom solution)
export interface StickyNoteAnnotation {
	id: string;
	pageNumber: number;
	x: number;
	y: number;
	text: string;
	fontSize: number;
	fontFamily: string;
	backgroundColor: string;
	width: number;
	height: number;
	relativeX: number; // 0-1 range for scaling
	relativeY: number; // 0-1 range for scaling
	relativeWidth: number; // 0-1 range for scaling
	relativeHeight: number; // 0-1 range for scaling
	rotation?: number; // Rotation offset to keep note straight at creation time
}

// Stamp annotation interface (custom solution)
export interface StampAnnotation {
	id: string;
	pageNumber: number;
	x: number;
	y: number;
	stampId: string; // ID of the stamp definition
	width?: number; // Optional width for export
	height?: number; // Optional height for export
	size: number;
	rotation: number;
	relativeX: number; // 0-1 range for scaling
	relativeY: number; // 0-1 range for scaling
	relativeSize: number; // 0-1 range for scaling
}

// Arrow annotation interface (custom solution)
export interface ArrowAnnotation {
	id: string;
	pageNumber: number;
	x1: number; // Start x coordinate
	y1: number; // Start y coordinate
	x2: number; // End x coordinate
	y2: number; // End y coordinate
	stroke: string;
	strokeWidth: number;
	arrowHead: boolean;
	relativeX1: number; // 0-1 range for scaling
	relativeY1: number; // 0-1 range for scaling
	relativeX2: number; // 0-1 range for scaling
	relativeY2: number; // 0-1 range for scaling
}

// Stamp definitions
export interface StampDefinition {
	id: string;
	name: string;
	category: 'stars' | 'checkmarks' | 'x-marks' | 'smileys' | 'hearts' | 'thumbs';
	svg: string;
}

export const availableStamps: StampDefinition[] = [
	// Stars
	{
		id: 'star',
		name: 'Star',
		category: 'stars',
		svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<filter id="sticker-shadow" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
				</filter>
			</defs>
			<!-- White sticker border following star shape -->
			<path d="M50 22 L55 38 L72 38 L59 48 L64 64 L50 54 L36 64 L41 48 L28 38 L45 38 Z" fill="white" stroke="white" stroke-width="6" stroke-linejoin="round" filter="url(#sticker-shadow)"/>
			<!-- Actual star -->
			<path d="M50 22 L55 38 L72 38 L59 48 L64 64 L50 54 L36 64 L41 48 L28 38 L45 38 Z" fill="#FFD700" stroke="#FFA500" stroke-width="1.5"/>
		</svg>`
	},
	// X Marks
	{
		id: 'x-mark',
		name: 'X Mark',
		category: 'x-marks',
		svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<filter id="xmark-shadow" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
				</filter>
			</defs>
			<!-- White sticker border following X shape -->
			<path d="M30 30 L70 70 M70 30 L30 70" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" filter="url(#xmark-shadow)"/>
			<!-- Actual X mark -->
			<path d="M30 30 L70 70 M70 30 L30 70" fill="none" stroke="#E53E3E" stroke-width="6" stroke-linecap="round"/>
		</svg>`
	},
	// Smiley Faces
	{
		id: 'smiley',
		name: 'Happy Face',
		category: 'smileys',
		svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<filter id="smiley-shadow" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
				</filter>
			</defs>
			<!-- White sticker border following circle shape -->
			<circle cx="50" cy="50" r="33" fill="white" stroke="white" stroke-width="6" filter="url(#smiley-shadow)"/>
			<!-- Actual smiley face -->
			<circle cx="50" cy="50" r="30" fill="#FFD700" stroke="#FFA500" stroke-width="2"/>
			<circle cx="42" cy="43" r="3" fill="#2D3748"/>
			<circle cx="58" cy="43" r="3" fill="#2D3748"/>
			<path d="M40 58 Q50 68 60 58" fill="none" stroke="#2D3748" stroke-width="2" stroke-linecap="round"/>
		</svg>`
	},
	// Hearts
	{
		id: 'heart',
		name: 'Heart',
		category: 'hearts',
		svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<filter id="heart-shadow" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
				</filter>
			</defs>
			<!-- White sticker border following heart shape -->
			<path d="M50 75 C50 75 28 58 28 42 C28 32 36 25 45 28 C47 29 49 31 50 33 C51 31 53 29 55 28 C64 25 72 32 72 42 C72 58 50 75 50 75 Z" fill="white" stroke="white" stroke-width="6" stroke-linejoin="round" filter="url(#heart-shadow)"/>
			<!-- Actual heart -->
			<path d="M50 75 C50 75 28 58 28 42 C28 32 36 25 45 28 C47 29 49 31 50 33 C51 31 53 29 55 28 C64 25 72 32 72 42 C72 58 50 75 50 75 Z" fill="#E53E3E" stroke="#C53030" stroke-width="1.5"/>
		</svg>`
	},
	// Checkmarks
	{
		id: 'checkmark',
		name: 'Checkmark',
		category: 'checkmarks',
		svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<filter id="check-shadow" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
				</filter>
			</defs>
			<!-- White sticker border following checkmark shape -->
			<path d="M25 52 L40 67 L75 32" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" filter="url(#check-shadow)"/>
			<!-- Actual checkmark -->
			<path d="M25 52 L40 67 L75 32" fill="none" stroke="#38A169" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>`
	},
	// Thumbs Up
	{
		id: 'thumbs-up',
		name: 'Thumbs Up',
		category: 'thumbs',
		svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<filter id="thumbs-shadow" x="-30%" y="-30%" width="160%" height="160%">
					<feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
				</filter>
			</defs>
			<!-- White sticker border following thumbs shape -->
			<path d="M40 30 C43 22 50 22 53 30 L53 42 L65 42 C68 42 71 45 71 48 L71 62 C71 65 68 68 65 68 L35 68 C32 68 29 65 29 62 L29 55 C29 52 30 49 32 47 L40 38 Z" fill="white" stroke="white" stroke-width="6" stroke-linejoin="round" filter="url(#thumbs-shadow)"/>
			<ellipse cx="46" cy="32" rx="6" ry="9" fill="white" stroke="white" stroke-width="6"/>
			<!-- Actual thumbs up -->
			<path d="M40 30 C43 22 50 22 53 30 L53 42 L65 42 C68 42 71 45 71 48 L71 62 C71 65 68 68 65 68 L35 68 C32 68 29 65 29 62 L29 55 C29 52 30 49 32 47 L40 38 Z" fill="#38A169" stroke="#2F855A" stroke-width="1.5"/>
			<ellipse cx="46" cy="32" rx="6" ry="9" fill="#48BB78" stroke="#2F855A" stroke-width="1"/>
		</svg>`
	}
];

// Drawing state store
export const drawingState = writable<DrawingState>({
	tool: 'pencil',
	color: '#2D3748', // charcoal color
	lineWidth: 2,
	eraserSize: 8,
	highlightColor: '#FFEB3B', // yellow
	highlightOpacity: 0.4,
	noteColor: '#FFF59D', // light yellow
	isDrawing: false,
	stampId: 'star', // default stamp
	textFontFamily: DEFAULT_TEXT_FONT // default text font from config
});

// PDF state store
export const pdfState = writable<PDFState>({
	document: null,
	currentPage: 1,
	totalPages: 0,
	scale: 1.2,
	rotation: 0,
	isLoading: false
});

// Debug the PDF state changes
if (typeof window !== 'undefined') {
	pdfState.subscribe((state) => {
		console.log('PDF State changed:', {
			hasDocument: !!state.document,
			currentPage: state.currentPage,
			totalPages: state.totalPages,
			scale: state.scale,
			isLoading: state.isLoading
		});
	});
}

// Drawing paths store - stores all drawing data per page
export const drawingPaths = writable<Map<number, DrawingPath[]>>(new Map());

// Text annotations store - stores all text annotations per page (custom implementation)
export const textAnnotations = writable<Map<number, TextAnnotation[]>>(new Map());

// Sticky note annotations store - stores all sticky note annotations per page (custom implementation)
export const stickyNoteAnnotations = writable<Map<number, StickyNoteAnnotation[]>>(new Map());

// Stamp annotations store - stores all stamp annotations per page (custom implementation)
export const stampAnnotations = writable<Map<number, StampAnnotation[]>>(new Map());

// Arrow annotations store - stores all arrow annotations per page (custom implementation)
export const arrowAnnotations = writable<Map<number, ArrowAnnotation[]>>(new Map());

// Auto-save functionality - Storage keys configuration
const STORAGE_KEYS = {
	drawings: 'leedpdf_drawings',
	textAnnotations: 'leedpdf_text_annotations',
	stickyNotes: 'leedpdf_sticky_note_annotations',
	stamps: 'leedpdf_stamp_annotations',
	arrows: 'leedpdf_arrow_annotations',
	pdfInfo: 'leedpdf_current_pdf'
} as const;

// Legacy exports for backward compatibility
const STORAGE_KEY = STORAGE_KEYS.drawings;
const STORAGE_KEY_TEXT = STORAGE_KEYS.textAnnotations;
const STORAGE_KEY_STICKY_NOTES = STORAGE_KEYS.stickyNotes;
const STORAGE_KEY_STAMP_ANNOTATIONS = STORAGE_KEYS.stamps;
const STORAGE_KEY_ARROW_ANNOTATIONS = STORAGE_KEYS.arrows;
const STORAGE_KEY_PDF_INFO = STORAGE_KEYS.pdfInfo;

// Track current PDF to associate drawings with specific files
let currentPDFKey: string | null = null;

// =============================================================================
// GENERIC ANNOTATION STORE UTILITIES (DRY refactoring)
// =============================================================================

/**
 * Generic factory to create a loader function for any annotation type.
 * Loads annotation data from localStorage into a Svelte store.
 */
function createAnnotationLoader<T>(
	storageKey: string,
	store: import('svelte/store').Writable<Map<number, T[]>>,
	annotationType: string
): () => void {
	return () => {
		if (!currentPDFKey || typeof window === 'undefined') return;

		try {
			const saved = localStorage.getItem(`${storageKey}_${currentPDFKey}`);
			if (saved) {
				const parsed = JSON.parse(saved);
				const map = new Map<number, T[]>();

				Object.entries(parsed).forEach(([pageNum, items]) => {
					map.set(parseInt(pageNum, 10), items as T[]);
				});

				store.set(map);
				console.log(`Loaded ${annotationType} for PDF ${currentPDFKey}:`, map);
			} else {
				store.set(new Map());
				console.log(`No saved ${annotationType} found for PDF ${currentPDFKey}`);
			}
		} catch (error) {
			console.error(`Error loading ${annotationType} for current PDF:`, error);
			store.set(new Map());
		}
	};
}

/**
 * Generic factory to set up auto-save subscription for any annotation type.
 * Automatically saves annotation data to localStorage when the store changes.
 */
function setupAnnotationAutoSave<T>(
	storageKey: string,
	store: import('svelte/store').Writable<Map<number, T[]>>,
	annotationType: string
): void {
	if (typeof window === 'undefined') return;

	store.subscribe((items) => {
		if (!currentPDFKey) return;

		try {
			const itemsObject: Record<string, T[]> = {};
			items.forEach((itemList, pageNum) => {
				if (itemList.length > 0) {
					itemsObject[pageNum.toString()] = itemList;
				}
			});

			localStorage.setItem(`${storageKey}_${currentPDFKey}`, JSON.stringify(itemsObject));
			console.log(`Auto-saved ${annotationType} for PDF ${currentPDFKey}`);
		} catch (error) {
			console.error(`Error saving ${annotationType} to localStorage:`, error);
		}
	});
}

/**
 * Generic factory to create CRUD operations for any annotation type.
 * Returns add, update, and delete functions for the given store.
 */
function createAnnotationCRUD<T extends { id: string; pageNumber: number }>(
	store: import('svelte/store').Writable<Map<number, T[]>>
) {
	return {
		add: (annotation: T) => {
			store.update((items) => {
				const current = items.get(annotation.pageNumber) || [];
				items.set(annotation.pageNumber, [...current, annotation]);
				return new Map(items);
			});
		},
		update: (annotation: T) => {
			store.update((items) => {
				const current = items.get(annotation.pageNumber) || [];
				const updated = current.map((item) =>
					item.id === annotation.id ? annotation : item
				);
				items.set(annotation.pageNumber, updated);
				return new Map(items);
			});
		},
		delete: (annotationId: string, pageNumber: number) => {
			store.update((items) => {
				const current = items.get(pageNumber) || [];
				const filtered = current.filter((item) => item.id !== annotationId);
				items.set(pageNumber, filtered);
				return new Map(items);
			});
		}
	};
}

/**
 * Generic helper to convert a Map store to an object for JSON serialization.
 * Used by forceSaveAllAnnotations.
 */
function mapToObject<T>(map: Map<number, T[]>): Record<string, T[]> {
	const obj: Record<string, T[]> = {};
	map.forEach((items, pageNum) => {
		if (items.length > 0) {
			obj[pageNum.toString()] = items;
		}
	});
	return obj;
}

// Generate a unique key for PDF based on name and size
export const generatePDFKey = (fileName: string, fileSize: number): string => {
	return `${fileName}_${fileSize}`;
};

// Set current PDF and load its drawings and shapes
export const setCurrentPDF = (fileName: string, fileSize: number) => {
	const pdfKey = generatePDFKey(fileName, fileSize);
	currentPDFKey = pdfKey;

	// Save current PDF info
	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem(STORAGE_KEY_PDF_INFO, JSON.stringify({ fileName, fileSize, pdfKey }));
		} catch (error) {
			console.warn('Failed to save PDF info to localStorage:', error);
		}
	}

	// Load drawings, shapes, text annotations, sticky notes, and stamps for this specific PDF
	loadDrawingsForCurrentPDF();
	loadTextAnnotationsForCurrentPDF();
	loadStickyNotesForCurrentPDF();
	loadStampAnnotationsForCurrentPDF();
	loadArrowAnnotationsForCurrentPDF();

	// Clear any text annotation selection from the previous PDF
	selectedTextAnnotationId.set(null);
};

// Create loaders using the generic factory (DRY refactoring)
const loadDrawingsForCurrentPDF = createAnnotationLoader<DrawingPath>(
	STORAGE_KEY, drawingPaths, 'drawings'
);
const loadTextAnnotationsForCurrentPDF = createAnnotationLoader<TextAnnotation>(
	STORAGE_KEY_TEXT, textAnnotations, 'text annotations'
);
const loadStickyNotesForCurrentPDF = createAnnotationLoader<StickyNoteAnnotation>(
	STORAGE_KEY_STICKY_NOTES, stickyNoteAnnotations, 'sticky notes'
);
const loadStampAnnotationsForCurrentPDF = createAnnotationLoader<StampAnnotation>(
	STORAGE_KEY_STAMP_ANNOTATIONS, stampAnnotations, 'stamp annotations'
);
const loadArrowAnnotationsForCurrentPDF = createAnnotationLoader<ArrowAnnotation>(
	STORAGE_KEY_ARROW_ANNOTATIONS, arrowAnnotations, 'arrow annotations'
);

// Load last PDF info on initialization
if (typeof window !== 'undefined') {
	try {
		const savedPDFInfo = localStorage.getItem(STORAGE_KEY_PDF_INFO);
		if (savedPDFInfo) {
			const { pdfKey } = JSON.parse(savedPDFInfo);
			currentPDFKey = pdfKey;
			loadDrawingsForCurrentPDF();
			loadTextAnnotationsForCurrentPDF();
			loadStickyNotesForCurrentPDF();
			loadStampAnnotationsForCurrentPDF();
			loadArrowAnnotationsForCurrentPDF();
		}
	} catch (error) {
		console.error('Error loading PDF info from localStorage:', error);
	}
}

// Set up auto-save subscriptions using the generic factory (DRY refactoring)
setupAnnotationAutoSave<DrawingPath>(STORAGE_KEY, drawingPaths, 'drawings');
setupAnnotationAutoSave<TextAnnotation>(STORAGE_KEY_TEXT, textAnnotations, 'text annotations');
setupAnnotationAutoSave<StickyNoteAnnotation>(STORAGE_KEY_STICKY_NOTES, stickyNoteAnnotations, 'sticky notes');
setupAnnotationAutoSave<StampAnnotation>(STORAGE_KEY_STAMP_ANNOTATIONS, stampAnnotations, 'stamp annotations');
setupAnnotationAutoSave<ArrowAnnotation>(STORAGE_KEY_ARROW_ANNOTATIONS, arrowAnnotations, 'arrow annotations');

// Undo/redo functionality
export const undoStack = writable<Array<{ pageNumber: number; paths: DrawingPath[] }>>([]);
export const redoStack = writable<Array<{ pageNumber: number; paths: DrawingPath[] }>>([]);

// Selected text annotation ID (for applying font/color changes to existing annotations)
export const selectedTextAnnotationId = writable<string | null>(null);

// Available colors for the color palette
export const availableColors = [
	'#2D3748', // charcoal
	'#87A96B', // sage
	'#C4A5E7', // lavender
	'#FFB5A7', // peach
	'#A8E6CF', // mint
	'#64748B', // slate
	'#EF4444', // red
	'#3B82F6', // blue
	'#10B981', // emerald
	'#F59E0B', // amber
	'#8B5CF6', // violet
	'#EC4899' // pink
];

// Available line widths
export const availableLineWidths = [1, 2, 3, 5, 8, 12];

// Available eraser sizes
export const availableEraserSizes = [4, 8, 12, 16, 24, 32];

// Available highlight colors
export const availableHighlightColors = [
	'#FFEB3B', // yellow
	'#FF9800', // orange
	'#E91E63', // pink
	'#9C27B0', // purple
	'#2196F3', // blue
	'#4CAF50', // green
	'#FF5722', // red
	'#607D8B' // blue grey
];

// Available fonts store - starts with bundled fonts, updated with system fonts in Tauri
export const availableFonts = writable<FontOption[]>(BUNDLED_FONTS);

// Flag to track if system fonts have been loaded
let systemFontsLoaded = false;

/**
 * Initialize fonts by loading system fonts if running in Tauri (Windows)
 * Call this once at app startup
 */
export const initializeFonts = async (): Promise<void> => {
	if (systemFontsLoaded) return;

	try {
		const allFonts = await getAllAvailableFonts();
		if (allFonts.length > BUNDLED_FONTS.length) {
			availableFonts.set(allFonts);
			console.log(`Loaded ${allFonts.length - BUNDLED_FONTS.length} system fonts`);
		}
		systemFontsLoaded = true;
	} catch (error) {
		console.log('System fonts not available:', error);
		systemFontsLoaded = true; // Prevent retry
	}
};

// Available sticky note colors
export const availableNoteColors = [
	'#FFF59D', // light yellow
	'#FFCC80', // light orange
	'#F8BBD9', // light pink
	'#CE93D8', // light purple
	'#90CAF9', // light blue
	'#A5D6A7', // light green
	'#FFAB91', // light coral
	'#B0BEC5' // light grey
];

// Derived store for current page paths
export const currentPagePaths = derived([drawingPaths, pdfState], ([$drawingPaths, $pdfState]) => {
	return $drawingPaths.get($pdfState.currentPage) || [];
});

// Helper functions
export const setTool = (tool: DrawingTool) => {
	clearTextAnnotationSelection();
	drawingState.update((state) => ({ ...state, tool }));
};

export const setColor = (color: string) => {
	drawingState.update((state) => ({ ...state, color }));
};

export const setLineWidth = (lineWidth: number) => {
	drawingState.update((state) => ({ ...state, lineWidth }));
};

export const setEraserSize = (eraserSize: number) => {
	drawingState.update((state) => ({ ...state, eraserSize }));
};

export const setHighlightColor = (highlightColor: string) => {
	drawingState.update((state) => ({ ...state, highlightColor }));
};

export const setHighlightOpacity = (highlightOpacity: number) => {
	drawingState.update((state) => ({ ...state, highlightOpacity }));
};

export const setNoteColor = (noteColor: string) => {
	drawingState.update((state) => ({ ...state, noteColor }));
};

export const setIsDrawing = (isDrawing: boolean) => {
	drawingState.update((state) => ({ ...state, isDrawing }));
};

export const setRotation = (rotation: 0 | 90 | 180 | 270) => {
	pdfState.update((state) => ({ ...state, rotation }));
};

export const setStampId = (stampId: string) => {
	drawingState.update((state) => ({ ...state, stampId }));
};

export const setTextFontFamily = (textFontFamily: string) => {
	drawingState.update((state) => ({ ...state, textFontFamily }));
};

// Select a text annotation
export const selectTextAnnotation = (annotationId: string | null) => {
	selectedTextAnnotationId.set(annotationId);
};

// Clear text annotation selection
export const clearTextAnnotationSelection = () => {
	selectedTextAnnotationId.set(null);
};

// Update font family for a specific text annotation
export const updateTextAnnotationFont = (annotationId: string, pageNumber: number, fontFamily: string) => {
	textAnnotations.update((texts) => {
		const currentTexts = texts.get(pageNumber) || [];
		const newTexts = currentTexts.map((text) =>
			text.id === annotationId ? { ...text, fontFamily } : text
		);
		texts.set(pageNumber, newTexts);
		return new Map(texts);
	});
};

// Helper function to get stamp by ID
export const getStampById = (stampId: string): StampDefinition | undefined => {
	return availableStamps.find((stamp) => stamp.id === stampId);
};

// Save state for undo functionality
const saveUndoState = (pageNumber: number, paths: DrawingPath[]) => {
	undoStack.update((stack) => {
		const newState = { pageNumber, paths: [...paths] };
		stack.push(newState);
		// Limit undo stack size
		if (stack.length > 50) {
			stack.shift();
		}
		return stack;
	});
	// Clear redo stack when new action is performed
	redoStack.set([]);
};

export const addDrawingPath = (path: DrawingPath) => {
	drawingPaths.update((paths) => {
		const currentPaths = paths.get(path.pageNumber) || [];
		// Save current state for undo
		saveUndoState(path.pageNumber, currentPaths);

		const newPaths = [...currentPaths, path];
		paths.set(path.pageNumber, newPaths);
		return new Map(paths);
	});
};

// Generic helper to update a page's paths with undo/redo tracking
export const updatePagePathsWithUndo = (
	pageNumber: number,
	updater: (paths: DrawingPath[]) => DrawingPath[]
) => {
	drawingPaths.update((paths) => {
		const currentPaths = paths.get(pageNumber) || [];
		// Save current state for undo
		saveUndoState(pageNumber, currentPaths);

		const newPaths = updater(currentPaths);
		paths.set(pageNumber, newPaths);
		return new Map(paths);
	});
};

// Clear all annotations on current page - this operation is NOT undoable
// (undo/redo system only tracks drawing paths, not all annotation types)
// Users should be aware that clearing all changes cannot be undone
export const clearCurrentPageDrawings = () => {
	pdfState.subscribe((state) => {
		if (state.currentPage > 0) {
			const currentPage = state.currentPage;
			
			// Clear drawing paths
			drawingPaths.update((paths) => {
				paths.delete(currentPage);
				return new Map(paths);
			});
			
			// Clear text annotations
			textAnnotations.update((annotations) => {
				annotations.delete(currentPage);
				return new Map(annotations);
			});
			
			// Clear arrow annotations
			arrowAnnotations.update((annotations) => {
				annotations.delete(currentPage);
				return new Map(annotations);
			});
			
			// Clear stamp annotations
			stampAnnotations.update((annotations) => {
				annotations.delete(currentPage);
				return new Map(annotations);
			});
			
			// Clear sticky note annotations
			stickyNoteAnnotations.update((annotations) => {
				annotations.delete(currentPage);
				return new Map(annotations);
			});
		}
	})();
};

// Clear all drawings for current PDF
export const clearAllDrawings = () => {
	drawingPaths.set(new Map());
	undoStack.set([]);
	redoStack.set([]);

	// Also clear from localStorage
	if (currentPDFKey && typeof window !== 'undefined') {
		localStorage.removeItem(`${STORAGE_KEY}_${currentPDFKey}`);
		console.log(`Cleared all drawings for PDF ${currentPDFKey}`);
	}
};

// Undo function
export const undo = () => {
	undoStack.update((stack) => {
		const lastState = stack.pop();
		if (lastState) {
			// Save current state to redo stack
			redoStack.update((redoStack) => {
				drawingPaths.subscribe((paths) => {
					const currentPaths = paths.get(lastState.pageNumber) || [];
					redoStack.push({ pageNumber: lastState.pageNumber, paths: [...currentPaths] });
				})();
				return redoStack;
			});

			// Restore previous state
			drawingPaths.update((paths) => {
				// Always set the paths array, even if empty
				paths.set(lastState.pageNumber, lastState.paths);
				return new Map(paths);
			});
		}
		return stack;
	});
};

// Redo function
export const redo = () => {
	redoStack.update((stack) => {
		const nextState = stack.pop();
		if (nextState) {
			// Save current state to undo stack
			undoStack.update((undoStack) => {
				drawingPaths.subscribe((paths) => {
					const currentPaths = paths.get(nextState.pageNumber) || [];
					undoStack.push({ pageNumber: nextState.pageNumber, paths: [...currentPaths] });
				})();
				return undoStack;
			});

			// Restore next state
			drawingPaths.update((paths) => {
				// Always set the paths array, even if empty
				paths.set(nextState.pageNumber, nextState.paths);
				return new Map(paths);
			});
		}
		return stack;
	});
};

// Legacy function - keeping for backward compatibility
export const undoLastPath = undo;

// =============================================================================
// ANNOTATION CRUD OPERATIONS (using generic factory for DRY)
// =============================================================================

// Create CRUD operations using the generic factory
const textAnnotationsCRUD = createAnnotationCRUD(textAnnotations);
const stickyNotesCRUD = createAnnotationCRUD(stickyNoteAnnotations);
const stampsCRUD = createAnnotationCRUD(stampAnnotations);
const arrowsCRUD = createAnnotationCRUD(arrowAnnotations);

// Text annotation management functions (exported for backward compatibility)
export const addTextAnnotation = textAnnotationsCRUD.add;
export const updateTextAnnotation = textAnnotationsCRUD.update;
export const deleteTextAnnotation = textAnnotationsCRUD.delete;

// Derived store for current page text annotations
export const currentPageTextAnnotations = derived(
	[textAnnotations, pdfState],
	([$textAnnotations, $pdfState]) => {
		return $textAnnotations.get($pdfState.currentPage) || [];
	}
);

// Sticky note annotation management functions (exported for backward compatibility)
export const addStickyNoteAnnotation = stickyNotesCRUD.add;
export const updateStickyNoteAnnotation = stickyNotesCRUD.update;
export const deleteStickyNoteAnnotation = stickyNotesCRUD.delete;

// Derived store for current page sticky note annotations
export const currentPageStickyNotes = derived(
	[stickyNoteAnnotations, pdfState],
	([$stickyNoteAnnotations, $pdfState]) => {
		return $stickyNoteAnnotations.get($pdfState.currentPage) || [];
	}
);

// Stamp annotation management functions (exported for backward compatibility)
export const addStampAnnotation = stampsCRUD.add;
export const updateStampAnnotation = stampsCRUD.update;
export const deleteStampAnnotation = stampsCRUD.delete;

// Derived store for current page stamp annotations
export const currentPageStampAnnotations = derived(
	[stampAnnotations, pdfState],
	([$stampAnnotations, $pdfState]) => {
		return $stampAnnotations.get($pdfState.currentPage) || [];
	}
);

// Arrow annotation management functions (exported for backward compatibility)
export const addArrowAnnotation = arrowsCRUD.add;
export const updateArrowAnnotation = arrowsCRUD.update;
export const deleteArrowAnnotation = arrowsCRUD.delete;

// Force save all annotation data to localStorage immediately
// This ensures all pending changes are persisted before operations like export
export const forceSaveAllAnnotations = (): void => {
	if (!currentPDFKey || typeof window === 'undefined') {
		console.warn('Cannot force save: no current PDF key or not in browser environment');
		return;
	}

	try {
		// Helper to force save a single store (DRY refactoring)
		const forceSaveStore = <T>(
			store: import('svelte/store').Writable<Map<number, T[]>>,
			storageKey: string
		) => {
			store.subscribe((items) => {
				localStorage.setItem(`${storageKey}_${currentPDFKey}`, JSON.stringify(mapToObject(items)));
			})();
		};

		// Force save all annotation stores
		forceSaveStore(drawingPaths, STORAGE_KEY);
		forceSaveStore(textAnnotations, STORAGE_KEY_TEXT);
		forceSaveStore(stickyNoteAnnotations, STORAGE_KEY_STICKY_NOTES);
		forceSaveStore(stampAnnotations, STORAGE_KEY_STAMP_ANNOTATIONS);
		forceSaveStore(arrowAnnotations, STORAGE_KEY_ARROW_ANNOTATIONS);

		console.log(`Force saved all annotations for PDF ${currentPDFKey}`);
	} catch (error) {
		console.error('Error force saving annotations to localStorage:', error);
	}
};

// Derived store for current page arrow annotations
export const currentPageArrowAnnotations = derived(
	[arrowAnnotations, pdfState],
	([$arrowAnnotations, $pdfState]) => {
		return $arrowAnnotations.get($pdfState.currentPage) || [];
	}
);
