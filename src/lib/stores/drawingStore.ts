import { derived, writable } from 'svelte/store';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type DrawingTool =
	| 'pencil'
	| 'eraser'
	| 'text'
	| 'rectangle'
	| 'circle'
	| 'arrow'
	| 'star'
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
}

// Import ShapeObject from KonvaShapeEngine
export type { ShapeObject } from '../utils/konvaShapeEngine';

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
					<feDropShadow dx="3" dy="3" stdDeviation="3" flood-opacity="0.25"/>
				</filter>
			</defs>
			<rect x="8" y="8" width="84" height="84" rx="12" fill="white" stroke="#E2E8F0" stroke-width="1" filter="url(#sticker-shadow)"/>
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
					<feDropShadow dx="3" dy="3" stdDeviation="3" flood-opacity="0.25"/>
				</filter>
			</defs>
			<rect x="10" y="10" width="80" height="80" rx="16" fill="white" stroke="#E2E8F0" stroke-width="1" filter="url(#xmark-shadow)"/>
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
					<feDropShadow dx="3" dy="3" stdDeviation="3" flood-opacity="0.25"/>
				</filter>
			</defs>
			<circle cx="50" cy="50" r="45" fill="white" stroke="#E2E8F0" stroke-width="1" filter="url(#smiley-shadow)"/>
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
					<feDropShadow dx="3" dy="3" stdDeviation="3" flood-opacity="0.25"/>
				</filter>
			</defs>
			<ellipse cx="50" cy="52" rx="42" ry="38" fill="white" stroke="#E2E8F0" stroke-width="1" filter="url(#heart-shadow)"/>
			<path d="M50 75 C50 75 28 58 28 42 C28 32 36 25 45 28 C47 29 49 31 50 33 C51 31 53 29 55 28 C64 25 72 32 72 42 C72 58 50 75 50 75 Z" fill="#E53E3E" stroke="#C53030" stroke-width="1.5"/>
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
					<feDropShadow dx="3" dy="3" stdDeviation="3" flood-opacity="0.25"/>
				</filter>
			</defs>
			<rect x="12" y="15" width="76" height="70" rx="18" fill="white" stroke="#E2E8F0" stroke-width="1" filter="url(#thumbs-shadow)"/>
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

// Shape objects store - stores all shape data per page
export const shapeObjects = writable<Map<number, any[]>>(new Map());

// Auto-save functionality
const STORAGE_KEY = 'leedpdf_drawings';
const STORAGE_KEY_PDF_INFO = 'leedpdf_current_pdf';

// Track current PDF to associate drawings with specific files
let currentPDFKey: string | null = null;

// Generate a unique key for PDF based on name and size
export const generatePDFKey = (fileName: string, fileSize: number): string => {
	return `${fileName}_${fileSize}`;
};

// Set current PDF and load its drawings
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

	// Load drawings for this specific PDF
	loadDrawingsForCurrentPDF();
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

// Load last PDF info on initialization
if (typeof window !== 'undefined') {
	try {
		const savedPDFInfo = localStorage.getItem(STORAGE_KEY_PDF_INFO);
		if (savedPDFInfo) {
			const { pdfKey } = JSON.parse(savedPDFInfo);
			currentPDFKey = pdfKey;
			loadDrawingsForCurrentPDF();
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

// Shape object management functions
export const addShapeObject = (shape: any) => {
	shapeObjects.update((shapes) => {
		const currentShapes = shapes.get(shape.pageNumber) || [];
		const newShapes = [...currentShapes, shape];
		shapes.set(shape.pageNumber, newShapes);
		return new Map(shapes);
	});
};

export const updateShapeObject = (updatedShape: any) => {
	shapeObjects.update((shapes) => {
		const currentShapes = shapes.get(updatedShape.pageNumber) || [];
		const newShapes = currentShapes.map((shape) =>
			shape.id === updatedShape.id ? updatedShape : shape
		);
		shapes.set(updatedShape.pageNumber, newShapes);
		return new Map(shapes);
	});
};

export const deleteShapeObject = (shapeId: string, pageNumber: number) => {
	shapeObjects.update((shapes) => {
		const currentShapes = shapes.get(pageNumber) || [];
		const newShapes = currentShapes.filter((shape) => shape.id !== shapeId);
		shapes.set(pageNumber, newShapes);
		return new Map(shapes);
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
