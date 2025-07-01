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

export const addDrawingPath = (path: DrawingPath) => {
  drawingPaths.update(paths => {
    const pagePaths = paths.get(path.pageNumber) || [];
    pagePaths.push(path);
    paths.set(path.pageNumber, pagePaths);
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

export const undoLastPath = () => {
  pdfState.subscribe(state => {
    if (state.currentPage > 0) {
      drawingPaths.update(paths => {
        const pagePaths = paths.get(state.currentPage) || [];
        if (pagePaths.length > 0) {
          pagePaths.pop();
          if (pagePaths.length === 0) {
            paths.delete(state.currentPage);
          } else {
            paths.set(state.currentPage, pagePaths);
          }
        }
        return new Map(paths);
      });
    }
  })();
};
