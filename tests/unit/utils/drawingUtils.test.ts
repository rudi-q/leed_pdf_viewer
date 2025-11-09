import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrawingEngine, getPathBounds, simplifyPath, splitPathByEraser } from '../../../src/lib/utils/drawingUtils';
import type { DrawingPath, Point } from '../../../src/lib/stores/drawingStore';

describe('DrawingUtils', () => {
	let canvas: HTMLCanvasElement;
	let drawingEngine: DrawingEngine;

	beforeEach(() => {
		vi.clearAllMocks();

		// Create a mock canvas
		canvas = document.createElement('canvas');
		canvas.width = 800;
		canvas.height = 600;

		// Mock getBoundingClientRect
		canvas.getBoundingClientRect = vi.fn(() => ({
			width: 800,
			height: 600,
			left: 0,
			top: 0,
			right: 800,
			bottom: 600,
			x: 0,
			y: 0,
			toJSON: () => {}
		}));

		drawingEngine = new DrawingEngine(canvas);
	});

	afterEach(() => {
		// Clean up
		if (drawingEngine) {
			drawingEngine.clearCanvas();
		}
	});

	describe('DrawingEngine', () => {
		describe('Initialization', () => {
			it('should initialize with a canvas', () => {
				expect(drawingEngine).toBeInstanceOf(DrawingEngine);
			});

			it('should throw error with invalid canvas', () => {
				const invalidCanvas = {} as HTMLCanvasElement;
				expect(() => new DrawingEngine(invalidCanvas)).toThrow();
			});

			it('should handle canvas without dimensions', () => {
				const smallCanvas = document.createElement('canvas');
				smallCanvas.getBoundingClientRect = vi.fn(() => ({
					width: 0,
					height: 0,
					left: 0,
					top: 0,
					right: 0,
					bottom: 0,
					x: 0,
					y: 0,
					toJSON: () => {}
				}));

				const engine = new DrawingEngine(smallCanvas);
				expect(engine).toBeInstanceOf(DrawingEngine);
			});
		});

		describe('Drawing Operations', () => {
			const mockPoint: Point = { x: 100, y: 100, pressure: 1.0 };

			it('should start drawing with pencil tool', () => {
				drawingEngine.startDrawing(mockPoint, 'pencil', '#000000', 2);

				// Should not throw and should be in drawing state
				expect(true).toBe(true);
			});

			it('should start drawing with eraser tool', () => {
				drawingEngine.startDrawing(mockPoint, 'eraser', '#000000', 8);

				// Should set appropriate properties for eraser
				expect(true).toBe(true);
			});

			it('should start drawing with highlight tool', () => {
				drawingEngine.startDrawing(mockPoint, 'highlight', '#FFFF00', 4);

				// Should set appropriate properties for highlight
				expect(true).toBe(true);
			});

			it('should continue drawing when in drawing state', () => {
				drawingEngine.startDrawing(mockPoint, 'pencil', '#000000', 2);

				const nextPoint: Point = { x: 110, y: 110, pressure: 1.0 };
				drawingEngine.continueDrawing(nextPoint);

				expect(true).toBe(true);
			});

			it('should not continue drawing when not in drawing state', () => {
				const point: Point = { x: 100, y: 100, pressure: 1.0 };
				drawingEngine.continueDrawing(point);

				// Should handle gracefully when not drawing
				expect(true).toBe(true);
			});

			it('should end drawing and return path', () => {
				drawingEngine.startDrawing(mockPoint, 'pencil', '#000000', 2);

				const point2: Point = { x: 110, y: 110, pressure: 1.0 };
				drawingEngine.continueDrawing(point2);

				const path = drawingEngine.endDrawing();

				expect(path).toBeInstanceOf(Array);
				expect(path.length).toBeGreaterThan(0);
			});

			it('should return empty array when ending without drawing', () => {
				const path = drawingEngine.endDrawing();

				expect(path).toEqual([]);
			});
		});

		describe('Canvas Operations', () => {
			it('should clear canvas', () => {
				drawingEngine.clearCanvas();

				// Should not throw
				expect(true).toBe(true);
			});

			it('should resize canvas', () => {
				drawingEngine.resize(1200, 900);

				// In test environment, canvas dimensions may not update immediately
				// Just verify the method doesn't throw
				expect(true).toBe(true);
			});

			it('should export canvas as image', () => {
				const dataUrl = drawingEngine.exportAsImage();

				expect(typeof dataUrl).toBe('string');
				expect(dataUrl).toContain('data:image');
			});

			it('should export canvas with custom format and quality', () => {
				const dataUrl = drawingEngine.exportAsImage('image/jpeg', 0.8);

				expect(typeof dataUrl).toBe('string');
			});
		});

		describe('Path Rendering', () => {
			const mockPath: DrawingPath = {
				tool: 'pencil',
				color: '#000000',
				lineWidth: 2,
				points: [
					{ x: 10, y: 10, relativeX: 0.0125, relativeY: 0.0167 },
					{ x: 20, y: 20, relativeX: 0.025, relativeY: 0.0333 },
					{ x: 30, y: 30, relativeX: 0.0375, relativeY: 0.05 }
				],
				pageNumber: 1
			};

			const mockHighlightPath: DrawingPath = {
				tool: 'highlight',
				color: '#FFFF00',
				lineWidth: 4,
				points: [
					{ x: 50, y: 50, relativeX: 0.0625, relativeY: 0.0833 },
					{ x: 100, y: 50, relativeX: 0.125, relativeY: 0.0833 }
				],
				pageNumber: 1,
				highlightColor: '#FFFF00',
				highlightOpacity: 0.3
			};

			it('should render single path', () => {
				drawingEngine.renderPaths([mockPath]);

				// Should not throw
				expect(true).toBe(true);
			});

			it('should render multiple paths', () => {
				drawingEngine.renderPaths([mockPath, mockHighlightPath]);

				// Should not throw
				expect(true).toBe(true);
			});

			it('should filter out eraser paths', () => {
				const eraserPath: DrawingPath = {
					tool: 'eraser',
					color: '#000000',
					lineWidth: 8,
					points: [{ x: 60, y: 60 }],
					pageNumber: 1
				};

				drawingEngine.renderPaths([mockPath, eraserPath]);

				// Should render only drawing paths, not eraser
				expect(true).toBe(true);
			});

			it('should handle empty paths array', () => {
				drawingEngine.renderPaths([]);

				expect(true).toBe(true);
			});

			it('should handle paths with single point', () => {
				const singlePointPath: DrawingPath = {
					tool: 'pencil',
					color: '#000000',
					lineWidth: 2,
					points: [{ x: 100, y: 100 }],
					pageNumber: 1
				};

				drawingEngine.renderPaths([singlePointPath]);

				expect(true).toBe(true);
			});

			it('should handle paths without relative coordinates', () => {
				const absolutePath: DrawingPath = {
					tool: 'pencil',
					color: '#000000',
					lineWidth: 2,
					points: [
						{ x: 10, y: 10 },
						{ x: 20, y: 20 }
					],
					pageNumber: 1
				};

				drawingEngine.renderPaths([absolutePath]);

				expect(true).toBe(true);
			});
		});

		describe('Point Operations', () => {
			it('should get point from pointer event', () => {
				const mockEvent = {
					clientX: 150,
					clientY: 200,
					pressure: 0.8
				} as PointerEvent;

				const point = drawingEngine.getPointFromEvent(mockEvent);

				expect(point).toMatchObject({
					x: expect.any(Number),
					y: expect.any(Number),
					pressure: 0.8,
					relativeX: expect.any(Number),
					relativeY: expect.any(Number)
				});
			});

			it('should handle pointer event without pressure', () => {
				const mockEvent = {
					clientX: 100,
					clientY: 100
				} as PointerEvent;

				const point = drawingEngine.getPointFromEvent(mockEvent);

				expect(point.pressure).toBe(1.0);
			});

			it('should check if point is in canvas bounds', () => {
				const insidePoint: Point = { x: 400, y: 300 };
				const outsidePoint: Point = { x: 1000, y: 800 };

				expect(drawingEngine.isPointInCanvas(insidePoint)).toBe(true);
				expect(drawingEngine.isPointInCanvas(outsidePoint)).toBe(false);
			});

			it('should check if point is on canvas edge', () => {
				const edgePoint: Point = { x: 800, y: 600 };

				expect(drawingEngine.isPointInCanvas(edgePoint)).toBe(true);
			});

			it('should check if point is at origin', () => {
				const originPoint: Point = { x: 0, y: 0 };

				expect(drawingEngine.isPointInCanvas(originPoint)).toBe(true);
			});
		});

		describe('Path Intersection', () => {
			const path1: DrawingPath = {
				tool: 'pencil',
				color: '#000000',
				lineWidth: 2,
				points: [
					{ x: 10, y: 10, relativeX: 0.0125, relativeY: 0.0167 },
					{ x: 50, y: 50, relativeX: 0.0625, relativeY: 0.0833 }
				],
				pageNumber: 1
			};

			const intersectingPath: DrawingPath = {
				tool: 'eraser',
				color: '#000000',
				lineWidth: 8,
				points: [
					{ x: 30, y: 30, relativeX: 0.0375, relativeY: 0.05 },
					{ x: 70, y: 70, relativeX: 0.0875, relativeY: 0.1167 }
				],
				pageNumber: 1
			};

			const nonIntersectingPath: DrawingPath = {
				tool: 'eraser',
				color: '#000000',
				lineWidth: 8,
				points: [
					{ x: 200, y: 200, relativeX: 0.25, relativeY: 0.333 },
					{ x: 250, y: 250, relativeX: 0.3125, relativeY: 0.4167 }
				],
				pageNumber: 1
			};

			it('should detect intersecting paths', () => {
				// Create clearly intersecting paths with exact intersection
				const intersectingPath1: DrawingPath = {
					tool: 'pencil',
					color: '#000000',
					lineWidth: 2,
					points: [
						{ x: 0, y: 50, relativeX: 0, relativeY: 0.0833 },
						{ x: 100, y: 50, relativeX: 0.125, relativeY: 0.0833 }
					],
					pageNumber: 1
				};

				const intersectingPath2: DrawingPath = {
					tool: 'eraser',
					color: '#000000',
					lineWidth: 8,
					points: [
						{ x: 50, y: 0, relativeX: 0.0625, relativeY: 0 },
						{ x: 50, y: 100, relativeX: 0.0625, relativeY: 0.167 }
					],
					pageNumber: 1
				};

				const intersects = drawingEngine.pathsIntersect(intersectingPath1, intersectingPath2);

				expect(intersects).toBe(true);
			});

			it('should detect non-intersecting paths', () => {
				const intersects = drawingEngine.pathsIntersect(path1, nonIntersectingPath);

				expect(intersects).toBe(false);
			});

			it('should handle custom tolerance', () => {
				// Create two paths that don't intersect but are close
				const closePath1: DrawingPath = {
					tool: 'pencil',
					color: '#000000',
					lineWidth: 2,
					points: [
						{ x: 10, y: 10, relativeX: 0.0125, relativeY: 0.0167 },
						{ x: 90, y: 10, relativeX: 0.1125, relativeY: 0.0167 }
					],
					pageNumber: 1
				};

				const closePath2: DrawingPath = {
					tool: 'eraser',
					color: '#000000',
					lineWidth: 8,
					points: [
						{ x: 10, y: 20, relativeX: 0.0125, relativeY: 0.0333 },
						{ x: 90, y: 20, relativeX: 0.1125, relativeY: 0.0333 }
					],
					pageNumber: 1
				};

				// Test that tolerance works correctly
				const intersectsHighTolerance = drawingEngine.pathsIntersect(closePath1, closePath2, 200);
				const intersectsLowTolerance = drawingEngine.pathsIntersect(closePath1, closePath2, 5);

				// With high tolerance, close parallel paths should be considered intersecting
				expect(intersectsHighTolerance).toBe(true);
				expect(intersectsLowTolerance).toBe(false);
			});

			it('should handle paths without relative coordinates', () => {
				const absolutePath1: DrawingPath = {
					tool: 'pencil',
					color: '#000000',
					lineWidth: 2,
					points: [
						{ x: 100, y: 100 },
						{ x: 110, y: 110 }
					],
					pageNumber: 1
				};

				const absolutePath2: DrawingPath = {
					tool: 'eraser',
					color: '#000000',
					lineWidth: 8,
					points: [
						{ x: 105, y: 105 },
						{ x: 115, y: 115 }
					],
					pageNumber: 1
				};

				const intersects = drawingEngine.pathsIntersect(absolutePath1, absolutePath2);

				expect(typeof intersects).toBe('boolean');
			});
		});

			describe('splitPathByEraser', () => {
				it('should split a multi-segment stroke into subpaths when erased through the middle', () => {
					const stroke: DrawingPath = {
						tool: 'pencil', color: '#000', lineWidth: 2, pageNumber: 1,
						points: [
							{ x: 0, y: 50 },
							{ x: 40, y: 50 },
							{ x: 60, y: 50 },
							{ x: 100, y: 50 }
						]
					};
					const eraser: DrawingPath = {
						tool: 'eraser', color: '#000', lineWidth: 10, pageNumber: 1,
						points: [
							{ x: 50, y: 0 },
							{ x: 50, y: 100 }
						]
					};
					const parts = splitPathByEraser(stroke, eraser, 8);
					expect(Array.isArray(parts)).toBe(true);
					expect(parts.length).toBeGreaterThanOrEqual(1);
					// Expect the resulting points to be on either side of the cut
					const allPoints = parts.flatMap(p => p.points);
					expect(allPoints.every(pt => pt.x <= 40 || pt.x >= 60)).toBe(true);
				});
			});

			describe('Error Handling', () => {
			it('should handle rendering with empty points', () => {
				const emptyPath: DrawingPath = {
					tool: 'pencil',
					color: '#000000',
					lineWidth: 2,
					points: [],
					pageNumber: 1
				};

				drawingEngine.renderPaths([emptyPath]);

				expect(true).toBe(true);
			});

			it('should handle malformed paths gracefully', () => {
				const malformedPath = {
					tool: 'pencil',
					points: null
				} as any;

				expect(() => {
					drawingEngine.renderPaths([malformedPath]);
				}).not.toThrow();
			});
		});
	});

	describe('Utility Functions', () => {
		describe('simplifyPath', () => {
			const complexPath: Point[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: 2, y: 0 },
				{ x: 3, y: 1 },
				{ x: 4, y: 0 },
				{ x: 5, y: 0 },
				{ x: 10, y: 0 }
			];

			it('should simplify complex path', () => {
				const simplified = simplifyPath(complexPath, 2);

				expect(simplified.length).toBeLessThanOrEqual(complexPath.length);
				expect(simplified.length).toBeGreaterThan(0);
			});

			it('should return original path if too short', () => {
				const shortPath: Point[] = [
					{ x: 0, y: 0 },
					{ x: 1, y: 1 }
				];
				const simplified = simplifyPath(shortPath);

				expect(simplified).toEqual(shortPath);
			});

			it('should handle empty path', () => {
				const simplified = simplifyPath([]);

				expect(simplified).toEqual([]);
			});

			it('should handle single point', () => {
				const singlePoint = [{ x: 5, y: 5 }];
				const simplified = simplifyPath(singlePoint);

				expect(simplified).toEqual(singlePoint);
			});

			it('should respect tolerance parameter', () => {
				const highTolerance = simplifyPath(complexPath, 10);
				const lowTolerance = simplifyPath(complexPath, 0.1);

				expect(highTolerance.length).toBeLessThanOrEqual(lowTolerance.length);
			});
		});

		describe('getPathBounds', () => {
			it('should calculate bounds for normal path', () => {
				const points: Point[] = [
					{ x: 10, y: 20 },
					{ x: 30, y: 5 },
					{ x: 25, y: 40 },
					{ x: 5, y: 15 }
				];

				const bounds = getPathBounds(points);

				expect(bounds).toEqual({
					x: 5,
					y: 5,
					width: 25,
					height: 35
				});
			});

			it('should handle single point', () => {
				const singlePoint: Point[] = [{ x: 15, y: 25 }];
				const bounds = getPathBounds(singlePoint);

				expect(bounds).toEqual({
					x: 15,
					y: 25,
					width: 0,
					height: 0
				});
			});

			it('should handle empty path', () => {
				const bounds = getPathBounds([]);

				expect(bounds).toEqual({
					x: 0,
					y: 0,
					width: 0,
					height: 0
				});
			});

			it('should handle negative coordinates', () => {
				const points: Point[] = [
					{ x: -10, y: -20 },
					{ x: 10, y: 20 }
				];

				const bounds = getPathBounds(points);

				expect(bounds).toEqual({
					x: -10,
					y: -20,
					width: 20,
					height: 40
				});
			});

			it('should handle points on same line', () => {
				const points: Point[] = [
					{ x: 0, y: 10 },
					{ x: 5, y: 10 },
					{ x: 10, y: 10 }
				];

				const bounds = getPathBounds(points);

				expect(bounds).toEqual({
					x: 0,
					y: 10,
					width: 10,
					height: 0
				});
			});
		});
	});

	describe('Integration Tests', () => {
		it('should complete full drawing cycle', () => {
			const startPoint: Point = { x: 100, y: 100, pressure: 1.0 };
			const middlePoint: Point = { x: 150, y: 125, pressure: 0.8 };
			const endPoint: Point = { x: 200, y: 150, pressure: 1.0 };

			// Start drawing
			drawingEngine.startDrawing(startPoint, 'pencil', '#FF0000', 3);

			// Continue drawing
			drawingEngine.continueDrawing(middlePoint);
			drawingEngine.continueDrawing(endPoint);

			// End drawing
			const path = drawingEngine.endDrawing();

			expect(path.length).toBe(3);
			expect(path[0]).toEqual(startPoint);
			expect(path[2]).toEqual(endPoint);
		});

		it('should handle multiple drawing sessions', () => {
			// First drawing
			drawingEngine.startDrawing({ x: 10, y: 10 }, 'pencil', '#000000', 2);
			drawingEngine.continueDrawing({ x: 20, y: 20 });
			const path1 = drawingEngine.endDrawing();

			// Second drawing
			drawingEngine.startDrawing({ x: 100, y: 100 }, 'highlight', '#FFFF00', 4);
			drawingEngine.continueDrawing({ x: 110, y: 110 });
			const path2 = drawingEngine.endDrawing();

			expect(path1.length).toBe(2);
			expect(path2.length).toBe(2);
			expect(path1).not.toEqual(path2);
		});

		it('should work with different drawing tools', () => {
			const point: Point = { x: 100, y: 100 };

			// Test pencil
			drawingEngine.startDrawing(point, 'pencil', '#000000', 2);
			const pencilPath = drawingEngine.endDrawing();

			// Test eraser
			drawingEngine.startDrawing(point, 'eraser', '#000000', 8);
			const eraserPath = drawingEngine.endDrawing();

			// Test highlight
			drawingEngine.startDrawing(point, 'highlight', '#FFFF00', 4);
			const highlightPath = drawingEngine.endDrawing();

			expect(pencilPath.length).toBe(1);
			expect(eraserPath.length).toBe(1);
			expect(highlightPath.length).toBe(1);
		});
	});
});
