import type { DrawingPath, DrawingTool, Point } from '../stores/drawingStore';

export interface DrawingContext {
	canvas: HTMLCanvasElement;
	context: CanvasRenderingContext2D;
}

export class DrawingEngine {
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D;
	private isDrawing = false;
	private currentPath: Point[] = [];
	private smoothingFactor = 0.5; // For smoother lines

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Unable to get canvas context');
		}
		this.context = context;
		this.setupCanvas();
	}

	private setupCanvas(): void {
		// Set up canvas for high-DPI displays
		const rect = this.canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		// Only setup if canvas has dimensions
		if (rect.width > 0 && rect.height > 0) {
			this.canvas.width = rect.width * dpr;
			this.canvas.height = rect.height * dpr;

			this.context.scale(dpr, dpr);
		} else {
			// Default dimensions if canvas isn't sized yet
			console.log('Canvas has no dimensions yet, using defaults');
			this.canvas.width = 800;
			this.canvas.height = 600;
		}

		// Set default drawing properties for smooth lines
		this.context.lineCap = 'round';
		this.context.lineJoin = 'round';
		this.context.imageSmoothingEnabled = true;
	}

	startDrawing(point: Point, tool: DrawingTool, color: string, lineWidth: number): void {
		this.isDrawing = true;
		this.currentPath = [point];

		this.context.beginPath();
		this.context.moveTo(point.x, point.y);

		// Set drawing properties
		if (tool === 'eraser') {
			this.context.globalCompositeOperation = 'destination-out';
			this.context.lineWidth = lineWidth * 2; // Eraser is wider
		} else if (tool === 'highlight') {
			this.context.globalCompositeOperation = 'multiply';
			this.context.strokeStyle = color;
			this.context.lineWidth = lineWidth * 3; // Highlighter is wider
			this.context.globalAlpha = 0.3; // Semi-transparent for highlight effect
		} else {
			this.context.globalCompositeOperation = 'source-over';
			this.context.strokeStyle = color;
			this.context.lineWidth = lineWidth;
			this.context.globalAlpha = 1.0; // Reset alpha for pencil
		}
	}

	continueDrawing(point: Point): void {
		if (!this.isDrawing) return;

		this.currentPath.push(point);

		// Use quadratic curves for smoother lines
		if (this.currentPath.length >= 3) {
			const lastPoint = this.currentPath[this.currentPath.length - 2];
			const currentPoint = this.currentPath[this.currentPath.length - 1];

			const midPoint = {
				x: (lastPoint.x + currentPoint.x) / 2,
				y: (lastPoint.y + currentPoint.y) / 2
			};

			this.context.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
			this.context.stroke();
		}
	}

	endDrawing(): Point[] {
		if (!this.isDrawing) return [];

		this.isDrawing = false;
		this.context.stroke();

		const path = [...this.currentPath];
		this.currentPath = [];

		return path;
	}

	clearCanvas(): void {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	// Render all paths for a page
	renderPaths(paths: DrawingPath[]): void {
		this.clearCanvas();

		// Filter out eraser paths and only render drawing tool paths
		// Eraser paths will be handled by removing intersecting drawing paths
		const drawingPaths = paths.filter(
			(path) => path.tool === 'pencil' || path.tool === 'highlight'
		);

		for (const path of drawingPaths) {
			this.renderPath(path);
		}
	}

	// Render a single path, scaling coordinates if needed
	private renderPath(path: DrawingPath): void {
		if (path.points.length < 2) return;

		// Scale points to current canvas size if relative coordinates are available
		const scaledPoints = path.points.map((point) => {
			if (point.relativeX !== undefined && point.relativeY !== undefined) {
				// Use relative coordinates and scale to current canvas size
				return {
					x: point.relativeX * this.canvas.width,
					y: point.relativeY * this.canvas.height,
					pressure: point.pressure
				};
			} else {
				// Fallback to original coordinates
				return point;
			}
		});

		this.context.beginPath();
		this.context.moveTo(scaledPoints[0].x, scaledPoints[0].y);

		// Set drawing properties
		if (path.tool === 'eraser') {
			this.context.globalCompositeOperation = 'destination-out';
			this.context.lineWidth = path.lineWidth * 2;
		} else if (path.tool === 'highlight') {
			this.context.globalCompositeOperation = 'multiply';
			this.context.strokeStyle = path.color;
			this.context.lineWidth = path.lineWidth * 3; // Highlighter is wider
			this.context.globalAlpha = 0.3; // Semi-transparent for highlight effect
		} else {
			this.context.globalCompositeOperation = 'source-over';
			this.context.strokeStyle = path.color;
			this.context.lineWidth = path.lineWidth;
			this.context.globalAlpha = 1.0; // Reset alpha for pencil
		}

		// Draw smooth path
		for (let i = 1; i < scaledPoints.length - 1; i++) {
			const currentPoint = scaledPoints[i];
			const nextPoint = scaledPoints[i + 1];

			const midPoint = {
				x: (currentPoint.x + nextPoint.x) / 2,
				y: (currentPoint.y + nextPoint.y) / 2
			};

			this.context.quadraticCurveTo(currentPoint.x, currentPoint.y, midPoint.x, midPoint.y);
		}

		// Draw to the last point
		if (scaledPoints.length > 1) {
			const lastPoint = scaledPoints[scaledPoints.length - 1];
			this.context.lineTo(lastPoint.x, lastPoint.y);
		}

		this.context.stroke();
	}

	// Get point from pointer event in PDF-relative coordinates (0-1 range)
	getPointFromEvent(event: PointerEvent, pdfScale = 1): Point {
		const rect = this.canvas.getBoundingClientRect();

		// Get raw canvas coordinates
		const canvasX = event.clientX - rect.left;
		const canvasY = event.clientY - rect.top;

		// Convert to PDF-relative coordinates (0-1 range)
		// This makes drawings scale-independent
		const relativeX = canvasX / rect.width;
		const relativeY = canvasY / rect.height;

		// Convert to actual canvas coordinates at current scale
		const actualX = relativeX * this.canvas.width;
		const actualY = relativeY * this.canvas.height;

		return {
			x: actualX,
			y: actualY,
			pressure: event.pressure || 1.0,
			// Store relative coordinates for scaling
			relativeX,
			relativeY
		};
	}

	// Check if two paths intersect (for eraser functionality)
	pathsIntersect(path1: DrawingPath, path2: DrawingPath, tolerance: number = 20): boolean {
		// Normalize points to use relative coordinates for comparison
		const normalizePoint = (point: Point) => {
			if (point.relativeX !== undefined && point.relativeY !== undefined) {
				return { x: point.relativeX, y: point.relativeY };
			}
			// Convert absolute to relative using current canvas size
			return {
				x: point.x / this.canvas.width,
				y: point.y / this.canvas.height
			};
		};

		const path1Points = path1.points.map(normalizePoint);
		const path2Points = path2.points.map(normalizePoint);

		// Use relative tolerance (percentage of canvas)
		const relativeTolerance = tolerance / Math.min(this.canvas.width, this.canvas.height);

		for (const point1 of path1Points) {
			for (const point2 of path2Points) {
				const distance = Math.sqrt(
					Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
				);
				if (distance <= relativeTolerance) {
					return true;
				}
			}
		}
		return false;
	}

	// Resize canvas and maintain aspect ratio
	resize(width: number, height: number): void {
		// Store current drawing
		const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

		// Resize canvas
		this.canvas.width = width;
		this.canvas.height = height;

		// Restore drawing properties
		this.setupCanvas();

		// Restore drawing (optional - might want to redraw from paths instead)
		this.context.putImageData(imageData, 0, 0);
	}

	// Export canvas as image
	exportAsImage(format: string = 'image/png', quality: number = 1.0): string {
		return this.canvas.toDataURL(format, quality);
	}

	// Check if point is within canvas bounds
	isPointInCanvas(point: Point): boolean {
		return (
			point.x >= 0 && point.x <= this.canvas.width && point.y >= 0 && point.y <= this.canvas.height
		);
	}
}

// Utility functions for path operations
export function simplifyPath(points: Point[], tolerance: number = 2): Point[] {
	if (points.length <= 2) return points;

	// Simple Douglas-Peucker algorithm implementation
	function douglasPeucker(points: Point[], epsilon: number): Point[] {
		if (points.length <= 2) return points;

		// Find the point with maximum distance
		let maxDistance = 0;
		let index = 0;

		for (let i = 1; i < points.length - 1; i++) {
			const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
			if (distance > maxDistance) {
				index = i;
				maxDistance = distance;
			}
		}

		// If max distance is greater than epsilon, recursively simplify
		if (maxDistance > epsilon) {
			const leftPart = douglasPeucker(points.slice(0, index + 1), epsilon);
			const rightPart = douglasPeucker(points.slice(index), epsilon);

			return [...leftPart.slice(0, -1), ...rightPart];
		} else {
			return [points[0], points[points.length - 1]];
		}
	}

	return douglasPeucker(points, tolerance);
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
	const dx = lineEnd.x - lineStart.x;
	const dy = lineEnd.y - lineStart.y;

	if (dx === 0 && dy === 0) {
		return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
	}

	const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
	const projection = {
		x: lineStart.x + t * dx,
		y: lineStart.y + t * dy
	};

	return Math.sqrt((point.x - projection.x) ** 2 + (point.y - projection.y) ** 2);
}

// Calculate bounding box for a path
export function getPathBounds(points: Point[]): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	if (points.length === 0) {
		return { x: 0, y: 0, width: 0, height: 0 };
	}

	let minX = points[0].x;
	let maxX = points[0].x;
	let minY = points[0].y;
	let maxY = points[0].y;

	for (const point of points) {
		minX = Math.min(minX, point.x);
		maxX = Math.max(maxX, point.x);
		minY = Math.min(minY, point.y);
		maxY = Math.max(maxY, point.y);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	};
}
