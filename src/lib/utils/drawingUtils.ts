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
	renderPaths(paths: DrawingPath[], currentScale?: number): void {
		this.clearCanvas();

		// Filter out eraser paths and only render drawing tool paths
		// Eraser paths will be handled by removing intersecting drawing paths
		const drawingPaths = paths.filter(
			(path) => path.tool === 'pencil' || path.tool === 'highlight'
		);

		for (const path of drawingPaths) {
			// Skip malformed paths
			if (!path || !path.points || !Array.isArray(path.points)) {
				console.warn('Skipping malformed path:', path);
				continue;
			}
			this.renderPath(path, currentScale);
		}
	}

	// Render a single path, scaling coordinates if needed
	private renderPath(path: DrawingPath, currentScale?: number): void {
		if (path.points.length < 2) return;

		// Scale points from base viewport coordinates to current canvas size
		// If currentScale is provided, use it to transform from base coordinates
		const scaledPoints = path.points.map((point) => {
			if (currentScale) {
				// Points are stored at base viewport (scale 1.0)
				// Transform to current canvas scale
				return {
					x: point.x * currentScale,
					y: point.y * currentScale,
					pressure: point.pressure
				};
			} else if (point.relativeX !== undefined && point.relativeY !== undefined) {
				// Legacy: Use relative coordinates and scale to current canvas CSS size
				const rect = this.canvas.getBoundingClientRect();
				return {
					x: point.relativeX * rect.width,
					y: point.relativeY * rect.height,
					pressure: point.pressure
				};
			} else {
				// Use coordinates as-is
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

		// Get raw canvas coordinates in CSS pixels
		const canvasX = event.clientX - rect.left;
		const canvasY = event.clientY - rect.top;

		// Convert to PDF-relative coordinates (0-1 range)
		// This makes drawings scale-independent
		const relativeX = rect.width > 0 ? canvasX / rect.width : 0;
		const relativeY = rect.height > 0 ? canvasY / rect.height : 0;

		// Use CSS pixel coordinates directly; the context is already scaled for DPR
		const actualX = canvasX;
		const actualY = canvasY;

		return {
			x: actualX,
			y: actualY,
			pressure: event.pressure || 1.0,
			// Store relative coordinates for scaling/legacy support
			relativeX,
			relativeY
		};
	}

	// Check if two paths intersect (for eraser functionality)
	pathsIntersect(path1: DrawingPath, path2: DrawingPath, tolerance: number = 20): boolean {
		if (!path1.points || !path2.points || path1.points.length < 2 || path2.points.length < 2) {
			return false;
		}

		// Normalize points to use consistent CSS pixel coordinates for comparison
		const normalizePoint = (point: Point) => {
			if (point.relativeX !== undefined && point.relativeY !== undefined) {
				const rect = this.canvas.getBoundingClientRect();
				return {
					x: point.relativeX * rect.width,
					y: point.relativeY * rect.height
				};
			}
			// Use absolute coordinates directly (assumed CSS px)
			return { x: point.x, y: point.y };
		};

		const path1Points = path1.points.map(normalizePoint);
		const path2Points = path2.points.map(normalizePoint);

		// Check for intersection between line segments of the two paths
		for (let i = 0; i < path1Points.length - 1; i++) {
			for (let j = 0; j < path2Points.length - 1; j++) {
				const line1 = {
					start: path1Points[i],
					end: path1Points[i + 1]
				};
				const line2 = {
					start: path2Points[j],
					end: path2Points[j + 1]
				};

				if (this.lineSegmentsIntersect(line1, line2, tolerance)) {
					return true;
				}
			}
		}
		return false;
	}

	// Helper method to check if two line segments intersect
	private lineSegmentsIntersect(
		line1: { start: { x: number; y: number }; end: { x: number; y: number } },
		line2: { start: { x: number; y: number }; end: { x: number; y: number } },
		tolerance: number = 20
	): boolean {
		// First check if lines are close enough based on tolerance
		const minDist = this.minimumDistanceBetweenLines(line1, line2);
		if (minDist <= tolerance) {
			return true;
		}

		// Then check for actual geometric intersection
		const denominator =
			(line1.end.x - line1.start.x) * (line2.end.y - line2.start.y) -
			(line1.end.y - line1.start.y) * (line2.end.x - line2.start.x);

		// Lines are parallel or coincident
		if (Math.abs(denominator) < 0.0001) {
			return false;
		}

		const ua =
			((line2.end.x - line2.start.x) * (line1.start.y - line2.start.y) -
				(line2.end.y - line2.start.y) * (line1.start.x - line2.start.x)) /
			denominator;

		const ub =
			((line1.end.x - line1.start.x) * (line1.start.y - line2.start.y) -
				(line1.end.y - line1.start.y) * (line1.start.x - line2.start.x)) /
			denominator;

		// Check if intersection point lies within both line segments
		return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
	}

	// Calculate minimum distance between two line segments
	private minimumDistanceBetweenLines(
		line1: { start: { x: number; y: number }; end: { x: number; y: number } },
		line2: { start: { x: number; y: number }; end: { x: number; y: number } }
	): number {
		const distances = [
			this.pointToLineSegmentDistance(line1.start, line2),
			this.pointToLineSegmentDistance(line1.end, line2),
			this.pointToLineSegmentDistance(line2.start, line1),
			this.pointToLineSegmentDistance(line2.end, line1)
		];
		return Math.min(...distances);
	}

	// Calculate distance from point to line segment
	private pointToLineSegmentDistance(
		point: { x: number; y: number },
		line: { start: { x: number; y: number }; end: { x: number; y: number } }
	): number {
		const dx = line.end.x - line.start.x;
		const dy = line.end.y - line.start.y;
		const length = Math.sqrt(dx * dx + dy * dy);

		if (length === 0) {
			// Line segment is actually a point
			const px = point.x - line.start.x;
			const py = point.y - line.start.y;
			return Math.sqrt(px * px + py * py);
		}

		const t = Math.max(
			0,
			Math.min(
				1,
				((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / (length * length)
			)
		);
		const projectionX = line.start.x + t * dx;
		const projectionY = line.start.y + t * dy;
		const distX = point.x - projectionX;
		const distY = point.y - projectionY;
		return Math.sqrt(distX * distX + distY * distY);
	}

	// Resize canvas and maintain aspect ratio
	resize(width: number, height: number): void {
		// Handle test environment where canvas dimensions might not change immediately
		if (typeof window !== 'undefined' && window.HTMLCanvasElement) {
			// Store current drawing
			const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

			// Resize canvas
			this.canvas.width = width;
			this.canvas.height = height;

			// Restore drawing properties
			this.setupCanvas();

			// Restore drawing (optional - might want to redraw from paths instead)
			this.context.putImageData(imageData, 0, 0);
		} else {
			// In test environment, set properties directly
			(this.canvas as any).width = width;
			(this.canvas as any).height = height;
		}
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

// Split a stroke path into subpaths by eraser path within tolerance (all in the same coordinate space)
export function splitPathByEraser(
	stroke: DrawingPath,
	eraser: DrawingPath,
	tolerance: number
): DrawingPath[] {
	if (!stroke.points || stroke.points.length < 2 || !eraser.points || eraser.points.length < 2) {
		return [stroke];
	}

	// Quick reject via expanded bounds overlap
	const sb = getPathBounds(stroke.points);
	const eb = getPathBounds(eraser.points);
	const expanded = (b: { x: number; y: number; width: number; height: number }, pad: number) => ({
		x: b.x - pad,
		y: b.y - pad,
		width: b.width + 2 * pad,
		height: b.height + 2 * pad
	});
	const sbe = expanded(sb, tolerance);
	const ebe = expanded(eb, tolerance);
	const overlap = !(
		sbe.x + sbe.width < ebe.x ||
		ebe.x + ebe.width < sbe.x ||
		sbe.y + sbe.height < ebe.y ||
		ebe.y + ebe.height < sbe.y
	);
	if (!overlap) return [stroke];

	// Build eraser segments once
	const eraserSegs = [] as { start: { x: number; y: number }; end: { x: number; y: number } }[];
	for (let j = 0; j < eraser.points.length - 1; j++) {
		eraserSegs.push({ start: eraser.points[j], end: eraser.points[j + 1] });
	}

	// Helper: min distance between two segments
	const minDistBetweenSegments = (
		l1: { start: { x: number; y: number }; end: { x: number; y: number } },
		l2: { start: { x: number; y: number }; end: { x: number; y: number } }
	): number => {
		const pointToLineSegmentDistance = (
			p: { x: number; y: number },
			l: { start: { x: number; y: number }; end: { x: number; y: number } }
		): number => {
			const dx = l.end.x - l.start.x;
			const dy = l.end.y - l.start.y;
			const length = Math.sqrt(dx * dx + dy * dy);
			if (length === 0) return Math.hypot(p.x - l.start.x, p.y - l.start.y);
			const t = Math.max(
				0,
				Math.min(1, ((p.x - l.start.x) * dx + (p.y - l.start.y) * dy) / (length * length))
			);
			const projX = l.start.x + t * dx;
			const projY = l.start.y + t * dy;
			return Math.hypot(p.x - projX, p.y - projY);
		};
		return Math.min(
			pointToLineSegmentDistance(l1.start, l2),
			pointToLineSegmentDistance(l1.end, l2),
			pointToLineSegmentDistance(l2.start, l1),
			pointToLineSegmentDistance(l2.end, l1)
		);
	};

	// Label each stroke segment as kept (true) or erased (false)
	const keptMask: boolean[] = [];
	for (let i = 0; i < stroke.points.length - 1; i++) {
		const seg = { start: stroke.points[i], end: stroke.points[i + 1] };
		let minDist = Infinity;
		for (const e of eraserSegs) {
			const d = minDistBetweenSegments(seg, e);
			if (d < minDist) minDist = d;
			if (minDist <= tolerance) break;
		}
		keptMask[i] = minDist > tolerance;
	}

	// Build subpaths from contiguous kept segments
	const subpaths: DrawingPath[] = [];
	let current: Point[] | null = null;
	for (let i = 0; i < keptMask.length; i++) {
		const keep = keptMask[i];
		const a = stroke.points[i];
		const b = stroke.points[i + 1];
		if (keep) {
			if (!current) current = [a];
			current.push(b);
		} else if (current) {
			if (current.length >= 2) {
				subpaths.push({ ...stroke, points: current });
			}
			current = null;
		}
	}
	if (current && current.length >= 2) {
		subpaths.push({ ...stroke, points: current });
	}

	return subpaths;
}
