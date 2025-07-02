import { writable, derived } from 'svelte/store';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export type DrawingTool = 'pencil' | 'eraser';

export interface DrawingState {
  tool: DrawingTool;
  color: string;
  lineWidth: number;
  eraserSize: number;
  isDrawing: boolean;
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
}

// Drawing state store
export const drawingState = writable<DrawingState>({
  tool: 'pencil',
  color: '#2D3748', // charcoal color
  lineWidth: 2,
  eraserSize: 8,
  isDrawing: false
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
  pdfState.subscribe(state => {
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
    localStorage.setItem(STORAGE_KEY_PDF_INFO, JSON.stringify({ fileName, fileSize, pdfKey }));
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
  drawingPaths.subscribe(paths => {
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
  '#EC4899'  // pink
];

// Available line widths
export const availableLineWidths = [1, 2, 3, 5, 8, 12];

// Available eraser sizes
export const availableEraserSizes = [4, 8, 12, 16, 24, 32];

// Derived store for current page paths
export const currentPagePaths = derived(
  [drawingPaths, pdfState],
  ([$drawingPaths, $pdfState]) => {
    return $drawingPaths.get($pdfState.currentPage) || [];
  }
);

// Helper functions
export const setTool = (tool: DrawingTool) => {
  drawingState.update(state => ({ ...state, tool }));
};

export const setColor = (color: string) => {
  drawingState.update(state => ({ ...state, color }));
};

export const setLineWidth = (lineWidth: number) => {
  drawingState.update(state => ({ ...state, lineWidth }));
};

export const setEraserSize = (eraserSize: number) => {
  drawingState.update(state => ({ ...state, eraserSize }));
};

export const setIsDrawing = (isDrawing: boolean) => {
  drawingState.update(state => ({ ...state, isDrawing }));
};

// Save state for undo functionality
const saveUndoState = (pageNumber: number, paths: DrawingPath[]) => {
  undoStack.update(stack => {
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
  drawingPaths.update(paths => {
    const currentPaths = paths.get(path.pageNumber) || [];
    // Save current state for undo
    saveUndoState(path.pageNumber, currentPaths);
    
    const newPaths = [...currentPaths, path];
    paths.set(path.pageNumber, newPaths);
    return new Map(paths);
  });
};

export const clearCurrentPageDrawings = () => {
  pdfState.subscribe(state => {
    if (state.currentPage > 0) {
      drawingPaths.update(paths => {
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
  undoStack.update(stack => {
    const lastState = stack.pop();
    if (lastState) {
      // Save current state to redo stack
      redoStack.update(redoStack => {
        drawingPaths.subscribe(paths => {
          const currentPaths = paths.get(lastState.pageNumber) || [];
          redoStack.push({ pageNumber: lastState.pageNumber, paths: [...currentPaths] });
        })();
        return redoStack;
      });
      
      // Restore previous state
      drawingPaths.update(paths => {
        if (lastState.paths.length === 0) {
          paths.delete(lastState.pageNumber);
        } else {
          paths.set(lastState.pageNumber, lastState.paths);
        }
        return new Map(paths);
      });
    }
    return stack;
  });
};

// Redo function
export const redo = () => {
  redoStack.update(stack => {
    const nextState = stack.pop();
    if (nextState) {
      // Save current state to undo stack
      undoStack.update(undoStack => {
        drawingPaths.subscribe(paths => {
          const currentPaths = paths.get(nextState.pageNumber) || [];
          undoStack.push({ pageNumber: nextState.pageNumber, paths: [...currentPaths] });
        })();
        return undoStack;
      });
      
      // Restore next state
      drawingPaths.update(paths => {
        if (nextState.paths.length === 0) {
          paths.delete(nextState.pageNumber);
        } else {
          paths.set(nextState.pageNumber, nextState.paths);
        }
        return new Map(paths);
      });
    }
    return stack;
  });
};

// Legacy function - keeping for backward compatibility
export const undoLastPath = undo;
