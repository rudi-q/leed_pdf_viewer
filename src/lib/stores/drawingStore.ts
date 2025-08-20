import { derived, writable } from 'svelte/store';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type DrawingTool =
	| 'pencil'
	| 'eraser'
	| 'text'
	| 'arrow'
	| 'highlight'
	| 'note'
	| 'stamp';

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
}

export interface PDFState {
	document: PDFDocumentProxy | null;
	currentPage: number;
	totalPages: number;
	scale: number;
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
	width?: number; // Optional width for scaling
	height?: number; // Optional height for scaling
	relativeX: number; // 0-1 range for scaling
	relativeY: number; // 0-1 range for scaling
	relativeWidth?: number; // 0-1 range for scaling
	relativeHeight?: number; // 0-1 range for scaling
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
	stampId: 'star' // default stamp
});

// PDF state store
export const pdfState = writable<PDFState>({
	document: null,
	currentPage: 1,
	totalPages: 0,
	scale: 1.2,
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

// Auto-save functionality
const STORAGE_KEY = 'leedpdf_drawings';
const STORAGE_KEY_TEXT = 'leedpdf_text_annotations';
const STORAGE_KEY_STICKY_NOTES = 'leedpdf_sticky_note_annotations';
const STORAGE_KEY_STAMP_ANNOTATIONS = 'leedpdf_stamp_annotations';
const STORAGE_KEY_ARROW_ANNOTATIONS = 'leedpdf_arrow_annotations';
const STORAGE_KEY_PDF_INFO = 'leedpdf_current_pdf';

// Track current PDF to associate drawings with specific files
let currentPDFKey: string | null = null;

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
};

// Load drawings for current PDF
const loadDrawingsForCurrentPDF = () => {
	if (!currentPDFKey || typeof window === 'undefined') return;

	try {
		const savedDrawings = localStorage.getItem(`${STORAGE_KEY}_${currentPDFKey}`);
		if (savedDrawings) {
			const parsedDrawings = JSON.parse(savedDrawings);
			const drawingsMap = new Map();

			Object.entries(parsedDrawings).forEach(([pageNum, paths]) => {
				drawingsMap.set(parseInt(pageNum), paths as DrawingPath[]);
			});

			drawingPaths.set(drawingsMap);
			console.log(`Loaded drawings for PDF ${currentPDFKey}:`, drawingsMap);
		} else {
			// No saved drawings for this PDF, start fresh
			drawingPaths.set(new Map());
			console.log(`No saved drawings found for PDF ${currentPDFKey}`);
		}
	} catch (error) {
		console.error('Error loading drawings for current PDF:', error);
		drawingPaths.set(new Map());
	}
};


// Load text annotations for current PDF
const loadTextAnnotationsForCurrentPDF = () => {
	if (!currentPDFKey || typeof window === 'undefined') return;

	try {
		const savedTextAnnotations = localStorage.getItem(`${STORAGE_KEY_TEXT}_${currentPDFKey}`);
		if (savedTextAnnotations) {
			const parsedTextAnnotations = JSON.parse(savedTextAnnotations);
			const textMap = new Map();

			Object.entries(parsedTextAnnotations).forEach(([pageNum, texts]) => {
				textMap.set(parseInt(pageNum), texts as TextAnnotation[]);
			});

			textAnnotations.set(textMap);
			console.log(`Loaded text annotations for PDF ${currentPDFKey}:`, textMap);
		} else {
			// No saved text annotations for this PDF, start fresh
			textAnnotations.set(new Map());
			console.log(`No saved text annotations found for PDF ${currentPDFKey}`);
		}
	} catch (error) {
		console.error('Error loading text annotations for current PDF:', error);
		textAnnotations.set(new Map());
	}
};

// Load sticky notes for current PDF
const loadStickyNotesForCurrentPDF = () => {
	if (!currentPDFKey || typeof window === 'undefined') return;

	try {
		const savedStickyNotes = localStorage.getItem(`${STORAGE_KEY_STICKY_NOTES}_${currentPDFKey}`);
		if (savedStickyNotes) {
			const parsedStickyNotes = JSON.parse(savedStickyNotes);
			const stickyNotesMap = new Map();

			Object.entries(parsedStickyNotes).forEach(([pageNum, notes]) => {
				stickyNotesMap.set(parseInt(pageNum), notes as StickyNoteAnnotation[]);
			});

			stickyNoteAnnotations.set(stickyNotesMap);
			console.log(`Loaded sticky notes for PDF ${currentPDFKey}:`, stickyNotesMap);
		} else {
			// No saved sticky notes for this PDF, start fresh
			stickyNoteAnnotations.set(new Map());
			console.log(`No saved sticky notes found for PDF ${currentPDFKey}`);
		}
	} catch (error) {
		console.error('Error loading sticky notes for current PDF:', error);
		stickyNoteAnnotations.set(new Map());
	}
};

// Load stamp annotations for current PDF
const loadStampAnnotationsForCurrentPDF = () => {
	if (!currentPDFKey || typeof window === 'undefined') return;

	try {
		const savedStampAnnotations = localStorage.getItem(`${STORAGE_KEY_STAMP_ANNOTATIONS}_${currentPDFKey}`);
		if (savedStampAnnotations) {
			const parsedStampAnnotations = JSON.parse(savedStampAnnotations);
			const stampAnnotationsMap = new Map();

			Object.entries(parsedStampAnnotations).forEach(([pageNum, stamps]) => {
				stampAnnotationsMap.set(parseInt(pageNum), stamps as StampAnnotation[]);
			});

			stampAnnotations.set(stampAnnotationsMap);
			console.log(`Loaded stamp annotations for PDF ${currentPDFKey}:`, stampAnnotationsMap);
		} else {
			// No saved stamp annotations for this PDF, start fresh
			stampAnnotations.set(new Map());
			console.log(`No saved stamp annotations found for PDF ${currentPDFKey}`);
		}
	} catch (error) {
		console.error('Error loading stamp annotations for current PDF:', error);
		stampAnnotations.set(new Map());
	}
};

// Load arrow annotations for current PDF
const loadArrowAnnotationsForCurrentPDF = () => {
	if (!currentPDFKey || typeof window === 'undefined') return;

	try {
		const savedArrowAnnotations = localStorage.getItem(`${STORAGE_KEY_ARROW_ANNOTATIONS}_${currentPDFKey}`);
		if (savedArrowAnnotations) {
			const parsedArrowAnnotations = JSON.parse(savedArrowAnnotations);
			const arrowAnnotationsMap = new Map();

			Object.entries(parsedArrowAnnotations).forEach(([pageNum, arrows]) => {
				arrowAnnotationsMap.set(parseInt(pageNum), arrows as ArrowAnnotation[]);
			});

			arrowAnnotations.set(arrowAnnotationsMap);
			console.log(`Loaded arrow annotations for PDF ${currentPDFKey}:`, arrowAnnotationsMap);
		} else {
			// No saved arrow annotations for this PDF, start fresh
			arrowAnnotations.set(new Map());
			console.log(`No saved arrow annotations found for PDF ${currentPDFKey}`);
		}
	} catch (error) {
		console.error('Error loading arrow annotations for current PDF:', error);
		arrowAnnotations.set(new Map());
	}
};

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

// Save drawings to localStorage whenever they change (PDF-specific)
if (typeof window !== 'undefined') {
	drawingPaths.subscribe((paths) => {
		if (!currentPDFKey) return;

		try {
			// Convert Map to object for JSON serialization
			const pathsObject: Record<string, DrawingPath[]> = {};
			paths.forEach((pathList, pageNum) => {
				if (pathList.length > 0) {
					pathsObject[pageNum.toString()] = pathList;
				}
			});

			localStorage.setItem(`${STORAGE_KEY}_${currentPDFKey}`, JSON.stringify(pathsObject));
			console.log(`Auto-saved drawings for PDF ${currentPDFKey}`);
		} catch (error) {
			console.error('Error saving drawings to localStorage:', error);
		}
	});
}


// Save text annotations to localStorage whenever they change (PDF-specific)
if (typeof window !== 'undefined') {
	textAnnotations.subscribe((texts) => {
		if (!currentPDFKey) return;

		try {
			// Convert Map to object for JSON serialization
			const textsObject: Record<string, TextAnnotation[]> = {};
			texts.forEach((textList, pageNum) => {
				if (textList.length > 0) {
					textsObject[pageNum.toString()] = textList;
				}
			});

			localStorage.setItem(`${STORAGE_KEY_TEXT}_${currentPDFKey}`, JSON.stringify(textsObject));
			console.log(`Auto-saved text annotations for PDF ${currentPDFKey}`);
		} catch (error) {
			console.error('Error saving text annotations to localStorage:', error);
		}
	});
}

// Save sticky note annotations to localStorage whenever they change (PDF-specific)
if (typeof window !== 'undefined') {
	stickyNoteAnnotations.subscribe((notes) => {
		if (!currentPDFKey) return;

		try {
			// Convert Map to object for JSON serialization
			const notesObject: Record<string, StickyNoteAnnotation[]> = {};
			notes.forEach((noteList, pageNum) => {
				if (noteList.length > 0) {
					notesObject[pageNum.toString()] = noteList;
				}
			});

			localStorage.setItem(`${STORAGE_KEY_STICKY_NOTES}_${currentPDFKey}`, JSON.stringify(notesObject));
			console.log(`Auto-saved sticky notes for PDF ${currentPDFKey}`);
		} catch (error) {
			console.error('Error saving sticky notes to localStorage:', error);
		}
	});
}

// Save stamp annotations to localStorage whenever they change (PDF-specific)
if (typeof window !== 'undefined') {
	stampAnnotations.subscribe((stamps) => {
		if (!currentPDFKey) return;

		try {
			// Convert Map to object for JSON serialization
			const stampsObject: Record<string, StampAnnotation[]> = {};
			stamps.forEach((stampList, pageNum) => {
				if (stampList.length > 0) {
					stampsObject[pageNum.toString()] = stampList;
				}
			});

			localStorage.setItem(`${STORAGE_KEY_STAMP_ANNOTATIONS}_${currentPDFKey}`, JSON.stringify(stampsObject));
			console.log(`Auto-saved stamp annotations for PDF ${currentPDFKey}`);
		} catch (error) {
			console.error('Error saving stamp annotations to localStorage:', error);
		}
	});
}

// Save arrow annotations to localStorage whenever they change (PDF-specific)
if (typeof window !== 'undefined') {
	arrowAnnotations.subscribe((arrows) => {
		if (!currentPDFKey) return;

		try {
			// Convert Map to object for JSON serialization
			const arrowsObject: Record<string, ArrowAnnotation[]> = {};
			arrows.forEach((arrowList, pageNum) => {
				if (arrowList.length > 0) {
					arrowsObject[pageNum.toString()] = arrowList;
				}
			});

			localStorage.setItem(`${STORAGE_KEY_ARROW_ANNOTATIONS}_${currentPDFKey}`, JSON.stringify(arrowsObject));
			console.log(`Auto-saved arrow annotations for PDF ${currentPDFKey}`);
		} catch (error) {
			console.error('Error saving arrow annotations to localStorage:', error);
		}
	});
}

// Undo/redo functionality
export const undoStack = writable<Array<{ pageNumber: number; paths: DrawingPath[] }>>([]);
export const redoStack = writable<Array<{ pageNumber: number; paths: DrawingPath[] }>>([]);

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

export const setStampId = (stampId: string) => {
	drawingState.update((state) => ({ ...state, stampId }));
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


export const clearCurrentPageDrawings = () => {
	pdfState.subscribe((state) => {
		if (state.currentPage > 0) {
			drawingPaths.update((paths) => {
				paths.delete(state.currentPage);
				return new Map(paths);
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

// Text annotation management functions
export const addTextAnnotation = (annotation: TextAnnotation) => {
	textAnnotations.update((texts) => {
		const currentTexts = texts.get(annotation.pageNumber) || [];
		const newTexts = [...currentTexts, annotation];
		texts.set(annotation.pageNumber, newTexts);
		return new Map(texts);
	});
};

export const updateTextAnnotation = (updatedAnnotation: TextAnnotation) => {
	textAnnotations.update((texts) => {
		const currentTexts = texts.get(updatedAnnotation.pageNumber) || [];
		const newTexts = currentTexts.map((text) =>
			text.id === updatedAnnotation.id ? updatedAnnotation : text
		);
		texts.set(updatedAnnotation.pageNumber, newTexts);
		return new Map(texts);
	});
};

export const deleteTextAnnotation = (annotationId: string, pageNumber: number) => {
	textAnnotations.update((texts) => {
		const currentTexts = texts.get(pageNumber) || [];
		const newTexts = currentTexts.filter((text) => text.id !== annotationId);
		texts.set(pageNumber, newTexts);
		return new Map(texts);
	});
};

// Derived store for current page text annotations
export const currentPageTextAnnotations = derived([textAnnotations, pdfState], ([$textAnnotations, $pdfState]) => {
	return $textAnnotations.get($pdfState.currentPage) || [];
});

// Sticky note annotation management functions
export const addStickyNoteAnnotation = (annotation: StickyNoteAnnotation) => {
	stickyNoteAnnotations.update((notes) => {
		const currentNotes = notes.get(annotation.pageNumber) || [];
		const newNotes = [...currentNotes, annotation];
		notes.set(annotation.pageNumber, newNotes);
		return new Map(notes);
	});
};

export const updateStickyNoteAnnotation = (updatedAnnotation: StickyNoteAnnotation) => {
	stickyNoteAnnotations.update((notes) => {
		const currentNotes = notes.get(updatedAnnotation.pageNumber) || [];
		const newNotes = currentNotes.map((note) =>
			note.id === updatedAnnotation.id ? updatedAnnotation : note
		);
		notes.set(updatedAnnotation.pageNumber, newNotes);
		return new Map(notes);
	});
};

export const deleteStickyNoteAnnotation = (annotationId: string, pageNumber: number) => {
	stickyNoteAnnotations.update((notes) => {
		const currentNotes = notes.get(pageNumber) || [];
		const newNotes = currentNotes.filter((note) => note.id !== annotationId);
		notes.set(pageNumber, newNotes);
		return new Map(notes);
	});
};

// Derived store for current page sticky note annotations
export const currentPageStickyNotes = derived([stickyNoteAnnotations, pdfState], ([$stickyNoteAnnotations, $pdfState]) => {
	return $stickyNoteAnnotations.get($pdfState.currentPage) || [];
});

// Stamp annotation management functions
export const addStampAnnotation = (annotation: StampAnnotation) => {
	stampAnnotations.update((stamps) => {
		const currentStamps = stamps.get(annotation.pageNumber) || [];
		const newStamps = [...currentStamps, annotation];
		stamps.set(annotation.pageNumber, newStamps);
		return new Map(stamps);
	});
};

export const updateStampAnnotation = (updatedAnnotation: StampAnnotation) => {
	stampAnnotations.update((stamps) => {
		const currentStamps = stamps.get(updatedAnnotation.pageNumber) || [];
		const newStamps = currentStamps.map((stamp) =>
			stamp.id === updatedAnnotation.id ? updatedAnnotation : stamp
		);
		stamps.set(updatedAnnotation.pageNumber, newStamps);
		return new Map(stamps);
	});
};

export const deleteStampAnnotation = (annotationId: string, pageNumber: number) => {
	stampAnnotations.update((stamps) => {
		const currentStamps = stamps.get(pageNumber) || [];
		const newStamps = currentStamps.filter((stamp) => stamp.id !== annotationId);
		stamps.set(pageNumber, newStamps);
		return new Map(stamps);
	});
};

// Derived store for current page stamp annotations
export const currentPageStampAnnotations = derived([stampAnnotations, pdfState], ([$stampAnnotations, $pdfState]) => {
	return $stampAnnotations.get($pdfState.currentPage) || [];
});

// Arrow annotation management functions
export const addArrowAnnotation = (annotation: ArrowAnnotation) => {
	arrowAnnotations.update((arrows) => {
		const currentArrows = arrows.get(annotation.pageNumber) || [];
		const newArrows = [...currentArrows, annotation];
		arrows.set(annotation.pageNumber, newArrows);
		return new Map(arrows);
	});
};

export const updateArrowAnnotation = (updatedAnnotation: ArrowAnnotation) => {
	arrowAnnotations.update((arrows) => {
		const currentArrows = arrows.get(updatedAnnotation.pageNumber) || [];
		const newArrows = currentArrows.map((arrow) =>
			arrow.id === updatedAnnotation.id ? updatedAnnotation : arrow
		);
		arrows.set(updatedAnnotation.pageNumber, newArrows);
		return new Map(arrows);
	});
};

export const deleteArrowAnnotation = (annotationId: string, pageNumber: number) => {
	arrowAnnotations.update((arrows) => {
		const currentArrows = arrows.get(pageNumber) || [];
		const newArrows = currentArrows.filter((arrow) => arrow.id !== annotationId);
		arrows.set(pageNumber, newArrows);
		return new Map(arrows);
	});
};

// Force save all annotation data to localStorage immediately
// This ensures all pending changes are persisted before operations like export
export const forceSaveAllAnnotations = (): void => {
	if (!currentPDFKey || typeof window === 'undefined') {
		console.warn('Cannot force save: no current PDF key or not in browser environment');
		return;
	}

	try {
		// Force save drawing paths
		drawingPaths.subscribe((paths) => {
			const pathsObject: Record<string, DrawingPath[]> = {};
			paths.forEach((pathList, pageNum) => {
				if (pathList.length > 0) {
					pathsObject[pageNum.toString()] = pathList;
				}
			});
			localStorage.setItem(`${STORAGE_KEY}_${currentPDFKey}`, JSON.stringify(pathsObject));
		})();

		// Force save text annotations
		textAnnotations.subscribe((texts) => {
			const textsObject: Record<string, TextAnnotation[]> = {};
			texts.forEach((textList, pageNum) => {
				if (textList.length > 0) {
					textsObject[pageNum.toString()] = textList;
				}
			});
			localStorage.setItem(`${STORAGE_KEY_TEXT}_${currentPDFKey}`, JSON.stringify(textsObject));
		})();

		// Force save sticky note annotations
		stickyNoteAnnotations.subscribe((notes) => {
			const notesObject: Record<string, StickyNoteAnnotation[]> = {};
			notes.forEach((noteList, pageNum) => {
				if (noteList.length > 0) {
					notesObject[pageNum.toString()] = noteList;
				}
			});
			localStorage.setItem(`${STORAGE_KEY_STICKY_NOTES}_${currentPDFKey}`, JSON.stringify(notesObject));
		})();

		// Force save stamp annotations
		stampAnnotations.subscribe((stamps) => {
			const stampsObject: Record<string, StampAnnotation[]> = {};
			stamps.forEach((stampList, pageNum) => {
				if (stampList.length > 0) {
					stampsObject[pageNum.toString()] = stampList;
				}
			});
			localStorage.setItem(`${STORAGE_KEY_STAMP_ANNOTATIONS}_${currentPDFKey}`, JSON.stringify(stampsObject));
		})();

		// Force save arrow annotations
		arrowAnnotations.subscribe((arrows) => {
			const arrowsObject: Record<string, ArrowAnnotation[]> = {};
			arrows.forEach((arrowList, pageNum) => {
				if (arrowList.length > 0) {
					arrowsObject[pageNum.toString()] = arrowList;
				}
			});
			localStorage.setItem(`${STORAGE_KEY_ARROW_ANNOTATIONS}_${currentPDFKey}`, JSON.stringify(arrowsObject));
		})();

		console.log(`Force saved all annotations for PDF ${currentPDFKey}`);
	} catch (error) {
		console.error('Error force saving annotations to localStorage:', error);
	}
};

// Derived store for current page arrow annotations
export const currentPageArrowAnnotations = derived([arrowAnnotations, pdfState], ([$arrowAnnotations, $pdfState]) => {
	return $arrowAnnotations.get($pdfState.currentPage) || [];
});
