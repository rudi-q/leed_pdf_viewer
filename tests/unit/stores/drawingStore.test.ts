import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	addDrawingPath,
	addShapeObject,
	clearAllDrawings,
	deleteShapeObject,
	type DrawingPath,
	drawingPaths,
	drawingState,
	generatePDFKey,
	pdfState,
	redo,
	setColor,
	setCurrentPDF,
	setEraserSize,
	setLineWidth,
	setTool,
	type ShapeObject,
	shapeObjects,
	undo,
	updateShapeObject
} from '../../../src/lib/stores/drawingStore';

describe('DrawingStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(globalThis as any).testHelpers.localStorageMock.clear.mockClear();
		(globalThis as any).testHelpers.localStorageMock.getItem.mockClear();
		(globalThis as any).testHelpers.localStorageMock.setItem.mockClear();
		(globalThis as any).testHelpers.localStorageMock.removeItem.mockClear();
		// Reset stores to initial state
		clearAllDrawings();
		drawingPaths.set(new Map());
		shapeObjects.set(new Map());
	});

	afterEach(() => {
		// Clear state after each test to prevent test pollution
		clearAllDrawings();
		drawingPaths.set(new Map());
		shapeObjects.set(new Map());
	});

	describe('Initial State', () => {
		it('should have correct initial drawing state', () => {
			const state = get(drawingState);
			expect(state).toEqual({
				tool: 'pencil',
				color: '#2D3748',
				lineWidth: 2,
				eraserSize: 8,
				highlightColor: '#FFEB3B',
				highlightOpacity: 0.4,
				noteColor: '#FFF59D',
				isDrawing: false
			});
		});

		it('should have correct initial PDF state', () => {
			const state = get(pdfState);
			expect(state).toEqual({
				document: null,
				currentPage: 1,
				totalPages: 0,
				scale: 1.2,
				isLoading: false
			});
		});

		it('should initialize with empty drawing paths', () => {
			const paths = get(drawingPaths);
			expect(paths.size).toBe(0);
		});

		it('should initialize with empty shape objects', () => {
			const shapes = get(shapeObjects);
			expect(shapes.size).toBe(0);
		});
	});

	describe('Drawing State Updates', () => {
		it('should update tool correctly', () => {
			setTool('eraser');
			const state = get(drawingState);
			expect(state.tool).toBe('eraser');
		});

		it('should update color correctly', () => {
			setColor('#FF0000');
			const state = get(drawingState);
			expect(state.color).toBe('#FF0000');
		});

		it('should update line width correctly', () => {
			setLineWidth(5);
			const state = get(drawingState);
			expect(state.lineWidth).toBe(5);
		});

		it('should update eraser size correctly', () => {
			setEraserSize(12);
			const state = get(drawingState);
			expect(state.eraserSize).toBe(12);
		});
	});

	describe('PDF Key Generation', () => {
		it('should generate consistent PDF keys', () => {
			const key1 = generatePDFKey('test.pdf', 1024);
			const key2 = generatePDFKey('test.pdf', 1024);
			expect(key1).toBe(key2);
			expect(key1).toBe('test.pdf_1024');
		});

		it('should generate different keys for different files', () => {
			const key1 = generatePDFKey('test1.pdf', 1024);
			const key2 = generatePDFKey('test2.pdf', 1024);
			expect(key1).not.toBe(key2);
		});

		it('should generate different keys for different sizes', () => {
			const key1 = generatePDFKey('test.pdf', 1024);
			const key2 = generatePDFKey('test.pdf', 2048);
			expect(key1).not.toBe(key2);
		});
	});

	describe('Drawing Paths Management', () => {
		const mockPath: DrawingPath = {
			tool: 'pencil',
			color: '#000000',
			lineWidth: 2,
			points: [
				{ x: 10, y: 10 },
				{ x: 20, y: 20 },
				{ x: 30, y: 30 }
			],
			pageNumber: 1
		};

		it('should add drawing paths correctly', () => {
			addDrawingPath(mockPath);

			const paths = get(drawingPaths);
			const pagePaths = paths.get(1);

			expect(pagePaths).toBeDefined();
			expect(pagePaths?.length).toBe(1);
			expect(pagePaths?.[0]).toEqual(mockPath);
		});

		it('should add multiple paths to the same page', () => {
			const path1 = { ...mockPath };
			const path2 = { ...mockPath, color: '#FF0000' };

			addDrawingPath(path1);
			addDrawingPath(path2);

			const paths = get(drawingPaths);
			const pagePaths = paths.get(1);

			expect(pagePaths?.length).toBe(2);
			expect(pagePaths?.[0].color).toBe('#000000');
			expect(pagePaths?.[1].color).toBe('#FF0000');
		});

		it('should handle paths on different pages', () => {
			const path1 = { ...mockPath, pageNumber: 1 };
			const path2 = { ...mockPath, pageNumber: 2 };

			addDrawingPath(path1);
			addDrawingPath(path2);

			const paths = get(drawingPaths);
			expect(paths.get(1)?.length).toBe(1);
			expect(paths.get(2)?.length).toBe(1);
		});
	});

	describe('Shape Objects Management', () => {
		const mockShape: ShapeObject = {
			id: 'shape_123',
			type: 'rectangle',
			pageNumber: 1,
			x: 100,
			y: 100,
			width: 200,
			height: 150,
			relativeX: 0.1,
			relativeY: 0.1,
			relativeWidth: 0.2,
			relativeHeight: 0.15,
			stroke: '#000000',
			strokeWidth: 2,
			fill: 'transparent'
		};

		it('should add shape objects correctly', () => {
			addShapeObject(mockShape);

			const shapes = get(shapeObjects);
			const pageShapes = shapes.get(1);

			expect(pageShapes).toBeDefined();
			expect(pageShapes?.length).toBe(1);
			expect(pageShapes?.[0]).toEqual(mockShape);
		});

		it('should update shape objects correctly', () => {
			addShapeObject(mockShape);

			const updatedShape = { ...mockShape, x: 150, y: 150 };
			updateShapeObject(updatedShape);

			const shapes = get(shapeObjects);
			const pageShapes = shapes.get(1);

			expect(pageShapes?.[0].x).toBe(150);
			expect(pageShapes?.[0].y).toBe(150);
		});

		it('should delete shape objects correctly', () => {
			addShapeObject(mockShape);

			let shapes = get(shapeObjects);
			expect(shapes.get(1)?.length).toBe(1);

			deleteShapeObject('shape_123', 1);

			shapes = get(shapeObjects);
			expect(shapes.get(1)?.length).toBe(0);
		});

		it('should handle multiple shapes on the same page', () => {
			const shape1 = { ...mockShape, id: 'shape_1' };
			const shape2 = { ...mockShape, id: 'shape_2' };

			addShapeObject(shape1);
			addShapeObject(shape2);

			const shapes = get(shapeObjects);
			const pageShapes = shapes.get(1);

			expect(pageShapes?.length).toBe(2);
			expect(pageShapes?.some((s) => s.id === 'shape_1')).toBe(true);
			expect(pageShapes?.some((s) => s.id === 'shape_2')).toBe(true);
		});
	});

	describe('PDF Management', () => {
		it('should set current PDF and store info in localStorage', () => {
			setCurrentPDF('test.pdf', 1024);

			expect((globalThis as any).testHelpers.localStorageMock.setItem).toHaveBeenCalledWith(
				'leedpdf_current_pdf',
				JSON.stringify({
					fileName: 'test.pdf',
					fileSize: 1024,
					pdfKey: 'test.pdf_1024'
				})
			);
		});

		it('should load drawings for the current PDF from localStorage', () => {
			const mockDrawings = {
				'1': [
					{
						tool: 'pencil',
						color: '#000000',
						lineWidth: 2,
						points: [{ x: 10, y: 10 }],
						pageNumber: 1
					}
				]
			};

			(globalThis as any).testHelpers.localStorageMock.getItem.mockReturnValue(
				JSON.stringify(mockDrawings)
			);

			setCurrentPDF('test.pdf', 1024);

			// Check that getItem was called for the specific PDF
			expect((globalThis as any).testHelpers.localStorageMock.getItem).toHaveBeenCalledWith(
				'leedpdf_drawings_test.pdf_1024'
			);
		});
	});

	describe('Clear Functions', () => {
		beforeEach(() => {
			// Add some test data
			const mockPath: DrawingPath = {
				tool: 'pencil',
				color: '#000000',
				lineWidth: 2,
				points: [{ x: 10, y: 10 }],
				pageNumber: 1
			};

			const mockShape: ShapeObject = {
				id: 'shape_123',
				type: 'rectangle',
				pageNumber: 1,
				x: 100,
				y: 100,
				relativeX: 0.1,
				relativeY: 0.1
			};

			addDrawingPath(mockPath);
			addShapeObject(mockShape);
		});

		it('should clear all drawings and localStorage', () => {
			setCurrentPDF('test.pdf', 1024);
			clearAllDrawings();

			const paths = get(drawingPaths);
			expect(paths.size).toBe(0);

			expect((globalThis as any).testHelpers.localStorageMock.removeItem).toHaveBeenCalledWith(
				'leedpdf_drawings_test.pdf_1024'
			);
		});
	});

	describe('Undo/Redo Functionality', () => {
		it('should implement undo functionality for drawing paths', () => {
			const mockPath: DrawingPath = {
				tool: 'pencil',
				color: '#000000',
				lineWidth: 2,
				points: [{ x: 10, y: 10 }],
				pageNumber: 1
			};

			// Add a path
			addDrawingPath(mockPath);
			let paths = get(drawingPaths);
			expect(paths.get(1)?.length).toBe(1);

			// Undo should remove the path
			undo();
			paths = get(drawingPaths);
			expect(paths.get(1)?.length).toBe(0);
		});

		it('should implement redo functionality', () => {
			const mockPath: DrawingPath = {
				tool: 'pencil',
				color: '#000000',
				lineWidth: 2,
				points: [{ x: 10, y: 10 }],
				pageNumber: 1
			};

			// Add a path, then undo, then redo
			addDrawingPath(mockPath);
			undo();
			redo();

			const paths = get(drawingPaths);
			expect(paths.get(1)?.length).toBe(1);
		});

		it('should handle multiple undo operations', () => {
			const path1: DrawingPath = {
				tool: 'pencil',
				color: '#000000',
				lineWidth: 2,
				points: [{ x: 10, y: 10 }],
				pageNumber: 1
			};

			const path2: DrawingPath = {
				tool: 'pencil',
				color: '#FF0000',
				lineWidth: 3,
				points: [{ x: 20, y: 20 }],
				pageNumber: 1
			};

			// Add two paths
			addDrawingPath(path1);
			addDrawingPath(path2);

			let paths = get(drawingPaths);
			expect(paths.get(1)?.length).toBe(2);

			// Undo twice
			undo();
			paths = get(drawingPaths);
			expect(paths.get(1)?.length).toBe(1);

			undo();
			paths = get(drawingPaths);
			expect(paths.get(1)?.length).toBe(0);
		});
	});

	describe('LocalStorage Integration', () => {
		it('should save drawings to localStorage when paths change', () => {
			setCurrentPDF('test.pdf', 1024);

			const mockPath: DrawingPath = {
				tool: 'pencil',
				color: '#000000',
				lineWidth: 2,
				points: [{ x: 10, y: 10 }],
				pageNumber: 1
			};

			addDrawingPath(mockPath);

			// Should save to localStorage with PDF-specific key
			expect((globalThis as any).testHelpers.localStorageMock.setItem).toHaveBeenCalledWith(
				'leedpdf_drawings_test.pdf_1024',
				expect.stringContaining('"tool":"pencil"')
			);
		});

		it('should handle localStorage errors gracefully', () => {
			(globalThis as any).testHelpers.localStorageMock.setItem.mockImplementation(() => {
				throw new Error('Storage full');
			});

			setCurrentPDF('test.pdf', 1024);

			const mockPath: DrawingPath = {
				tool: 'pencil',
				color: '#000000',
				lineWidth: 2,
				points: [{ x: 10, y: 10 }],
				pageNumber: 1
			};

			// Should not throw error even if localStorage fails
			expect(() => addDrawingPath(mockPath)).not.toThrow();
		});
	});

	describe('Constants and Arrays', () => {
		it('should export available colors array', async () => {
			const { availableColors } = await import('../../../src/lib/stores/drawingStore');
			expect(availableColors).toBeInstanceOf(Array);
			expect(availableColors.length).toBeGreaterThan(0);
			expect(availableColors).toContain('#2D3748'); // charcoal
		});

		it('should export available line widths array', async () => {
			const { availableLineWidths } = await import('../../../src/lib/stores/drawingStore');
			expect(availableLineWidths).toBeInstanceOf(Array);
			expect(availableLineWidths).toEqual([1, 2, 3, 5, 8, 12]);
		});

		it('should export available eraser sizes array', async () => {
			const { availableEraserSizes } = await import('../../../src/lib/stores/drawingStore');
			expect(availableEraserSizes).toBeInstanceOf(Array);
			expect(availableEraserSizes).toEqual([4, 8, 12, 16, 24, 32]);
		});

		it('should export available highlight colors array', async () => {
			const { availableHighlightColors } = await import('../../../src/lib/stores/drawingStore');
			expect(availableHighlightColors).toBeInstanceOf(Array);
			expect(availableHighlightColors.length).toBeGreaterThan(0);
			expect(availableHighlightColors).toContain('#FFEB3B'); // yellow
		});

		it('should export available note colors array', async () => {
			const { availableNoteColors } = await import('../../../src/lib/stores/drawingStore');
			expect(availableNoteColors).toBeInstanceOf(Array);
			expect(availableNoteColors.length).toBeGreaterThan(0);
			expect(availableNoteColors).toContain('#FFF59D'); // light yellow
		});
	});
});
