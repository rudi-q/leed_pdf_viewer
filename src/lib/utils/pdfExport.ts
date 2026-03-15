import { PDFDocument, PDFPage, degrees, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauriUtils';
import type { 
	DrawingPath, 
	TextAnnotation, 
	ArrowAnnotation, 
	StickyNoteAnnotation, 
	StampAnnotation
} from '../stores/drawingStore';
import { getStampById } from '../stores/drawingStore';
import { transformPoint } from './rotationUtils';

export interface PageAnnotations {
	drawingPaths: DrawingPath[];
	textAnnotations: TextAnnotation[];
	stickyNotes: StickyNoteAnnotation[];
	stampAnnotations: StampAnnotation[];
	arrowAnnotations: ArrowAnnotation[];
}

export interface ExportOptions {
	includeOriginalPDF: boolean;
	format: 'pdf' | 'png' | 'jpeg';
	quality?: number;
}

// Font family to asset path mapping
const FONT_ASSETS: { [key: string]: string } = {
	'ReenieBeanie': '/fonts/ReenieBeanie.ttf',
	'Inter': '/fonts/inter-v20-latin-regular.woff2',
	'Lora': '/fonts/additional-fonts/Lora-VariableFont_wght.woff2',
	'Urbanist': '/fonts/additional-fonts/Urbanist-Regular.woff2',
	'Dancing Script': '/fonts/dancing-script-v29-latin-600.woff2'
};

export class PDFExporter {
	private originalPdfBytes: Uint8Array | null = null;
	private canvasElements: Map<number, HTMLCanvasElement> = new Map();
	private pageAnnotations: Map<number, PageAnnotations> = new Map();
	private rotations: Map<number, number> = new Map();

	/**
	 * Convert CSS pixels to PDF points (1/72 inch)
	 * Assumes standard 96 DPI for CSS pixels
	 */
	private static pixelsToPoints(pixels: number): number {
		return (pixels * 72) / 96;
	}

	setOriginalPDF(pdfBytes: Uint8Array) {
		this.originalPdfBytes = pdfBytes;
	}

	setPageCanvas(pageNumber: number, canvas: HTMLCanvasElement) {
		this.canvasElements.set(pageNumber, canvas);
	}

	setPageAnnotations(pageNumber: number, annotations: PageAnnotations) {
		this.pageAnnotations.set(pageNumber, annotations);
	}

	setPageRotation(pageNumber: number, rotation: number) {
		this.setRotation(pageNumber, rotation);
	}

	setRotation(pageNumber: number, rotationDegrees: number) {
		if (rotationDegrees % 90 !== 0) {
			console.warn(`[PDFExport] non-orthogonal rotation ${rotationDegrees} passed; normalising to nearest 90.`);
		}

		// Normalize rotation to 0, 90, 180, or 270 degrees
		const normalized = ((rotationDegrees % 360) + 360) % 360;
		const roundedRotation = Math.round(normalized / 90) * 90;
		this.rotations.set(pageNumber, roundedRotation);
	}

	async exportToPDF(): Promise<Uint8Array> {
		if (!this.originalPdfBytes) {
			throw new Error('No original PDF loaded');
		}

		// Primary path: load original PDF and overlay canvases / vectors
		try {
			const pdfDoc = await PDFDocument.load(this.originalPdfBytes, { ignoreEncryption: true });
			pdfDoc.registerFontkit(fontkit);
			
			const pages = pdfDoc.getPages();
			for (let pageNumber = 1; pageNumber <= pages.length; pageNumber++) {
				const page = pages[pageNumber - 1];
				const rotation = this.rotations.get(pageNumber) || 0;

				const annotations = this.pageAnnotations.get(pageNumber);
				if (annotations) {
					// Draw annotations using native vector graphics
					await this.drawAnnotationsNatively(pdfDoc, page, annotations, rotation);
				} else {
					// Fallback to canvas embedding if annotations weren't provided natively
					// This maintains backwards compatibility for exportHandlers
					const canvas = this.canvasElements.get(pageNumber);
					if (canvas) {
						await this.embedCanvasInPage(pdfDoc, page, canvas, rotation);
					}
				}
			}
			return await pdfDoc.save();
		} catch (primaryError) {
			console.error('PDF native export failed. Falling back to canvas merge.', primaryError);
			// Fallback path: build a brand-new PDF composed from merged canvases
			return this.fallbackCanvasExport();
		}
	}

	private async fallbackCanvasExport(): Promise<Uint8Array> {
		try {
			const newDoc = await PDFDocument.create();
			
			// Determine page count from original PDF or canvas elements
			let pageCount = this.canvasElements.size;
			if (this.originalPdfBytes) {
				try {
					const originalDoc = await PDFDocument.load(this.originalPdfBytes, { ignoreEncryption: true });
					pageCount = Math.max(pageCount, originalDoc.getPageCount());
				} catch (e) {
					console.warn('Could not load original PDF for page count', e);
				}
			}
			
			if (pageCount === 0) {
				throw new Error('No rendered pages available for export');
			}
			
			// Create pages for all pages in the document
			for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
				const canvas = this.canvasElements.get(pageNum);
				
				if (canvas) {
					// Validate canvas dimensions
					if (!Number.isFinite(canvas.width) || canvas.width <= 0 || !Number.isFinite(canvas.height) || canvas.height <= 0) {
						console.warn(`Invalid canvas dimensions for page ${pageNum}: ${canvas.width}x${canvas.height}`);
						// Create blank page instead of failing
						newDoc.addPage([612, 792]); // Standard letter size
						continue;
					}

					const page = newDoc.addPage([
						PDFExporter.pixelsToPoints(canvas.width),
						PDFExporter.pixelsToPoints(canvas.height)
					]);

					const pageRotation = this.rotations.get(pageNum) || 0;
					await this.embedCanvasInPage(newDoc, page, canvas, pageRotation);
				} else {
					// Create blank page for missing canvas
					console.warn(`No canvas found for page ${pageNum}, creating blank page`);
					newDoc.addPage([612, 792]); // Standard letter size
				}
			}
			return await newDoc.save();
		} catch (fallbackError) {
			throw new Error(`Failed to export fallback PDF: ${fallbackError}`, { cause: fallbackError });
		}
	}
	
	private extractPathFromStamp(svgString: string): { pathData: string, fill: string, stroke: string } | null {
		// Extract path elements and parse attributes regardless of order
		const pathTagRegex = /<path[^>]*>/g;
		let match;
		
		while ((match = pathTagRegex.exec(svgString)) !== null) {
			const pathTag = match[0];
			
			// Extract attributes by name
			const dMatch = /d="([^"]+)"/.exec(pathTag);
			const fillMatch = /fill="([^"]+)"/.exec(pathTag);
			const strokeMatch = /stroke="([^"]+)"/.exec(pathTag);
			
			if (dMatch && fillMatch && strokeMatch) {
				const fill = fillMatch[1];
				// Return the first colored element (not filled "none" or "white")
				if (fill !== 'none' && fill !== 'white') {
					return { pathData: dMatch[1], fill: fill, stroke: strokeMatch[1] };
				}
			}
		}
		
		return null;
	}

	private async loadCustomFont(pdfDoc: PDFDocument, fontFamily: string) {
		// Provide fallback mapping for generic families
		if (fontFamily.includes('sans-serif')) return pdfDoc.embedStandardFont(StandardFonts.Helvetica);
		if (fontFamily.includes('serif') && !fontFamily.includes('sans-serif')) return pdfDoc.embedStandardFont(StandardFonts.TimesRoman);
		if (fontFamily.includes('monospace')) return pdfDoc.embedStandardFont(StandardFonts.Courier);
		
		// Look up font path from mapping
		let fontPath = '';
		for (const [fontName, path] of Object.entries(FONT_ASSETS)) {
			if (fontFamily.includes(fontName)) {
				fontPath = path;
				break;
			}
		}
		
		// If no match found, use standard font
		if (!fontPath) {
			return pdfDoc.embedStandardFont(StandardFonts.Helvetica);
		}

		try {
			const fontBytes = await fetch(fontPath).then((res) => res.arrayBuffer());
			return await pdfDoc.embedFont(fontBytes);
		} catch (e) {
			console.warn(`Failed to embed ${fontFamily}, falling back to Helvetica`, e);
			return pdfDoc.embedStandardFont(StandardFonts.Helvetica);
		}
	}

	private async drawAnnotationsNatively(
		pdfDoc: PDFDocument,
		page: PDFPage,
		annotations: PageAnnotations,
		rotationDegrees: number
	) {
		const { width, height } = page.getSize();
		// pdf-lib origin (0,0) is bottom-left. We must flip Y.
		const flipY = (y: number) => height - y;
		
		// Transform point based on rotation (annotations are stored in rotation-0 coordinates)
		const transformAnnotationPoint = (x: number, y: number) => {
			const transformed = transformPoint(
				x,
				y,
				rotationDegrees as 0 | 90 | 180 | 270,
				width,
				height
			);
			return { x: transformed.x, y: flipY(transformed.y) };
		};

		// 1. Draw Paths (Freehand / Highlighters)
		for (const path of annotations.drawingPaths) {
			if (!path.points || path.points.length < 2) continue;
			
			const rgbColor = this.hexToRgb(path.highlightColor || path.color);
			const pdfColor = rgb(rgbColor.r, rgbColor.g, rgbColor.b);
			const opacity = path.highlightOpacity || (path.tool === 'highlight' ? 0.4 : 1);
			
			// Transform and group points into a single SVG path
			const firstPt = transformAnnotationPoint(path.points[0].x, path.points[0].y);
			let pathData = `M ${firstPt.x} ${firstPt.y}`;
			for (let i = 1; i < path.points.length; i++) {
				const pt = transformAnnotationPoint(path.points[i].x, path.points[i].y);
				pathData += ` L ${pt.x} ${pt.y}`;
			}

			page.drawSvgPath(pathData, {
				borderColor: pdfColor,
				borderWidth: path.lineWidth,
				borderOpacity: opacity,
			});
		}

		// 2. Draw Text Annotations
		for (const textMod of annotations.textAnnotations) {
			const font = await this.loadCustomFont(pdfDoc, textMod.fontFamily);
			const rgbColor = this.hexToRgb(textMod.color);
			
			// Transform position and adjust for text baseline
			const pos = transformAnnotationPoint(textMod.x, textMod.y);
			const yPos = pos.y - textMod.fontSize;

			page.drawText(textMod.text, {
				x: pos.x,
				y: yPos,
				size: textMod.fontSize,
				font: font,
				color: rgb(rgbColor.r, rgbColor.g, rgbColor.b)
			});
		}

		// 3. Draw Sticky Notes
		for (const note of annotations.stickyNotes) {
			const font = await this.loadCustomFont(pdfDoc, note.fontFamily);
			const bgRgb = this.hexToRgb(note.backgroundColor);
			
			const pos = transformAnnotationPoint(note.x, note.y);
			
			// Apply rotated dimensions: swap width/height for 90° and 270° rotations
			const isRotated90or270 = (rotationDegrees / 90) % 2 !== 0;
			const noteWidth = isRotated90or270 ? note.height : note.width;
			const noteHeight = isRotated90or270 ? note.width : note.height;
			
			const rectY = pos.y - noteHeight;
			
			// Draw sticky note background
			page.drawRectangle({
				x: pos.x,
				y: rectY,
				width: noteWidth,
				height: noteHeight,
				color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
				opacity: 0.9
			});

			// Draw sticky note text with wrapping
			const padding = 10;
			const lineHeight = note.fontSize * 1.2;
			const maxWidth = noteWidth - (padding * 2);
			const maxHeight = noteHeight - (padding * 2);
			
			const lines = note.text.split('\n');
			const wrappedLines: string[] = [];
			
			// Word wrap each line
			for (const line of lines) {
				const words = line.split(' ');
				let currentLine = '';
				
				for (const word of words) {
					const testLine = currentLine ? `${currentLine} ${word}` : word;
					const testWidth = font.widthOfTextAtSize(testLine, note.fontSize);
					
					if (testWidth > maxWidth && currentLine) {
						wrappedLines.push(currentLine);
						currentLine = word;
					} else {
						currentLine = testLine;
					}
				}
				if (currentLine) wrappedLines.push(currentLine);
			}
			
			// Draw each line, respecting height bounds
			let currentY = pos.y - note.fontSize - padding;
			for (let i = 0; i < wrappedLines.length; i++) {
				if (currentY < rectY) break; // Stop if exceeds bottom
				
				page.drawText(wrappedLines[i], {
					x: pos.x + padding,
					y: currentY,
					size: note.fontSize,
					font: font,
					color: rgb(0, 0, 0)
				});
				
				currentY -= lineHeight;
			}
		}

		// 4. Draw Arrows
		for (const arrow of annotations.arrowAnnotations) {
			const rgbColor = this.hexToRgb(arrow.stroke);
			const pdfColor = rgb(rgbColor.r, rgbColor.g, rgbColor.b);
			
			// Transform arrow endpoints
			const start = transformAnnotationPoint(arrow.x1, arrow.y1);
			const end = transformAnnotationPoint(arrow.x2, arrow.y2);
			
			// Draw line
			page.drawLine({
				start: { x: start.x, y: start.y },
				end: { x: end.x, y: end.y },
				thickness: arrow.strokeWidth,
				color: pdfColor
			});

			// Draw arrowhead if needed
			if (arrow.arrowHead) {
				const angle = Math.atan2(end.y - start.y, end.x - start.x);
				const arrowLength = arrow.strokeWidth * 3;
				
				const x3 = end.x - arrowLength * Math.cos(angle - Math.PI / 6);
				const y3 = end.y - arrowLength * Math.sin(angle - Math.PI / 6);
				
				const x4 = end.x - arrowLength * Math.cos(angle + Math.PI / 6);
				const y4 = end.y - arrowLength * Math.sin(angle + Math.PI / 6);
				
				const arrowFill = `M ${end.x} ${end.y} L ${x3} ${y3} L ${x4} ${y4} Z`;
				page.drawSvgPath(arrowFill, {
					color: pdfColor,
					borderWidth: 0
				});
			}
		}

		// 5. Draw Stamps
		for (const stamp of annotations.stampAnnotations) {
			const stampDef = getStampById(stamp.stampId);
			if (!stampDef) continue;
			
			const parsedSvg = this.extractPathFromStamp(stampDef.svg);
			if (parsedSvg) {
				const rgbFill = this.hexToRgb(parsedSvg.fill);
				const rgbStroke = this.hexToRgb(parsedSvg.stroke);
				
				// Transform stamp position
				const pos = transformAnnotationPoint(stamp.x, stamp.y);
				
				// Calculate dimensions. SVGs have internal viewBoxes, usually 100x100
				const scaleFactor = stamp.size / 100;
				
				page.drawSvgPath(parsedSvg.pathData, {
					x: pos.x,
					y: pos.y - stamp.size,
					scale: scaleFactor,
					color: rgb(rgbFill.r, rgbFill.g, rgbFill.b),
					borderColor: rgb(rgbStroke.r, rgbStroke.g, rgbStroke.b),
					borderWidth: 1.5
				});
			}
		}
	}

	async embedCanvasInPage(
		pdfDoc: PDFDocument,
		page: PDFPage,
		canvas: HTMLCanvasElement,
		rotationDegrees: number
	) {
		const pngBytes = await new Promise<Uint8Array>((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Canvas toBlob failed'));
					return;
				}
				const reader = new FileReader();
				reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
				reader.onerror = reject;
				reader.readAsArrayBuffer(blob);
			}, 'image/png');
		});

		const image = await pdfDoc.embedPng(pngBytes);

		// PDF pages can have a rotation attribute.
		// Instead of drawing rotated content, we set the page size to the visual dimensions
		// and draw the image to fill it. This is more robust for export.
		const { width, height } = page.getSize();

		// If the visual rotation is 90 or 270 degrees, swap dimensions
		const isRotated90or270 = (rotationDegrees / 90) % 2 !== 0;
		const targetWidth = isRotated90or270 ? height : width;
		const targetHeight = isRotated90or270 ? width : height;

		// Update page size to match visual orientation
		page.setSize(targetWidth, targetHeight);

		// Reset rotation attribute since we've already oriented the page via Size
		// Actually, some users might expect the rotation attribute.
		// But for a merged canvas, Size swap is usually cleaner.
		page.setRotation(degrees(0));

		// Draw the image over the existing page content
		page.drawImage(image, {
			x: 0,
			y: 0,
			width: targetWidth,
			height: targetHeight
		});
	}

	private hexToRgb(hex: string): { r: number; g: number; b: number } {
		// Common named colors lookup
		const namedColors: { [key: string]: { r: number; g: number; b: number } } = {
			'red': { r: 1, g: 0, b: 0 },
			'green': { r: 0, g: 0.5, b: 0 },
			'blue': { r: 0, g: 0, b: 1 },
			'yellow': { r: 1, g: 1, b: 0 },
			'gold': { r: 1, g: 0.843, b: 0 },
			'white': { r: 1, g: 1, b: 1 },
			'black': { r: 0, g: 0, b: 0 }
		};
		
		// Check for named color
		const lowerHex = hex.toLowerCase();
		if (namedColors[lowerHex]) {
			return namedColors[lowerHex];
		}
		
		// Support both 3-digit (#RGB) and 6-digit (#RRGGBB) hex colors
		const result = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(hex);
		if (!result) {
			console.warn(`Invalid hex color: "${hex}", defaulting to black`);
			return { r: 0, g: 0, b: 0 }; // Default to black
		}

		const hexValue = result[1];
		let r, g, b;
		
		if (hexValue.length === 3) {
			// Expand 3-digit hex to 6-digit by repeating each character
			r = parseInt(hexValue[0] + hexValue[0], 16) / 255;
			g = parseInt(hexValue[1] + hexValue[1], 16) / 255;
			b = parseInt(hexValue[2] + hexValue[2], 16) / 255;
		} else {
			// Parse 6-digit hex
			r = parseInt(hexValue.substring(0, 2), 16) / 255;
			g = parseInt(hexValue.substring(2, 4), 16) / 255;
			b = parseInt(hexValue.substring(4, 6), 16) / 255;
		}

		return { r, g, b };
	}


	async exportAsImages(canvases: HTMLCanvasElement[]): Promise<Blob[]> {
		const images: Blob[] = [];

		for (const canvas of canvases) {
			const blob = await new Promise<Blob>((resolve) => {
				canvas.toBlob(
					(blob) => {
						resolve(blob!);
					},
					'image/png',
					1.0
				);
			});
			images.push(blob);
		}

		return images;
	}

	// Enhanced export method that uses Tauri backend when available
	static async exportFile(
		data: Uint8Array | Blob,
		defaultFilename: string,
		mimeType: string
	): Promise<boolean> {
		if (isTauri) {
			return await PDFExporter.exportWithTauri(data, defaultFilename, mimeType);
		} else {
			PDFExporter.downloadFile(data, defaultFilename, mimeType);
			return true;
		}
	}

	// Tauri-specific export using file dialog and file system
	static async exportWithTauri(
		data: Uint8Array | Blob,
		defaultFilename: string,
		mimeType: string
	): Promise<boolean> {
		try {
			console.log('Using Tauri backend for file export');

			// Convert data to Uint8Array if it's a Blob
			let bytes: Uint8Array;
			if (data instanceof Uint8Array) {
				bytes = data;
			} else {
				try {
					const arrayBuffer = await data.arrayBuffer();
					bytes = new Uint8Array(arrayBuffer);
				} catch (blobError) {
					console.error('Failed to convert blob to array buffer:', blobError);
					throw new Error('Invalid file data format');
				}
			}

			// Validate data size
			if (bytes.length === 0) {
				throw new Error('File data is empty');
			}

			// First test Tauri connection
			try {
				const testResult = await invoke('test_tauri_detection');
				console.log('Tauri connection test:', testResult);
			} catch (testError) {
				console.error('Tauri connection test failed:', testError);
				throw new Error('Tauri backend not available');
			}

			// Get file extension from MIME type
			const extension = PDFExporter.getFileExtension(mimeType).replace('.', '');
			const filterName = PDFExporter.getFilterName(mimeType);

			// Use custom Tauri export command
			const filePath = await invoke('export_file', {
				content: Array.from(bytes),
				defaultFilename,
				filterName,
				extension
			});

			if (!filePath) {
				console.log('User cancelled file save dialog');
				return false; // User cancelled
			}

			console.log('File saved to:', filePath);

			console.log('✅ File saved successfully via Tauri backend');
			return true;
		} catch (error: any) {
			console.error('Failed to export file with Tauri:', error);

			// Check if this is a critical Tauri API failure
			if (
				error?.message?.includes('dialog') ||
				error?.message?.includes('Tauri') ||
				error?.message?.includes('plugin')
			) {
				console.error('Critical Tauri API failure, falling back to browser download');
				PDFExporter.downloadFile(data, defaultFilename, mimeType);
				return true;
			}

			// For user-friendly errors (like permission denied), show the error but also offer fallback
			if (typeof window !== 'undefined' && window.confirm) {
				const fallbackMessage = `${error.message}\n\nWould you like to try downloading the file through your browser instead?`;
				const useFallback = window.confirm(fallbackMessage);

				if (useFallback) {
					console.log('User chose browser download fallback');
					PDFExporter.downloadFile(data, defaultFilename, mimeType);
					return true;
				} else {
					console.log('User declined fallback, export cancelled');
					return false;
				}
			} else {
				// Fallback if window.confirm is not available
				console.log('No user confirmation available, falling back to browser download');
				PDFExporter.downloadFile(data, defaultFilename, mimeType);
				return true;
			}
		}
	}

	// Get user-friendly filter name for file dialog
	static getFilterName(mimeType: string): string {
		const filterNames: { [key: string]: string } = {
			'application/pdf': 'PDF Documents',
			'image/png': 'PNG Images',
			'image/jpeg': 'JPEG Images',
			'image/webp': 'WebP Images',
			'application/zip': 'LPDF Files',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
				'Microsoft Word (.docx)'
		};
		return filterNames[mimeType] || 'All Files';
	}

	// Legacy browser download method (kept for backward compatibility and fallback)
	static downloadFile(data: Uint8Array | Blob, filename: string, mimeType: string) {
		const blob =
			data instanceof Uint8Array ? new Blob([new Uint8Array(data)], { type: mimeType }) : data;
		const url = URL.createObjectURL(blob);

		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		URL.revokeObjectURL(url);
	}

	// Utility function to get file extension from MIME type
	static getFileExtension(mimeType: string): string {
		const extensions: { [key: string]: string } = {
			'application/pdf': '.pdf',
			'image/png': '.png',
			'image/jpeg': '.jpg',
			'image/webp': '.webp',
			'application/zip': '.lpdf',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
		};
		return extensions[mimeType] || '.bin';
	}
}

// Helper function to create a ZIP file with multiple images
export async function createZipWithImages(images: Blob[], baseName: string): Promise<Blob> {
	// This is a simplified version - in a real app you'd use a ZIP library like JSZip
	// For now, we'll just return the first image
	return images[0] || new Blob();
}

// Helper function to merge drawing canvas with PDF canvas
export function mergeCanvases(
	pdfCanvas: HTMLCanvasElement,
	drawingCanvas: HTMLCanvasElement
): HTMLCanvasElement {
	const mergedCanvas = document.createElement('canvas');
	const ctx = mergedCanvas.getContext('2d')!;

	mergedCanvas.width = pdfCanvas.width;
	mergedCanvas.height = pdfCanvas.height;

	// Draw PDF first
	ctx.drawImage(pdfCanvas, 0, 0);

	// Draw annotations on top
	ctx.drawImage(drawingCanvas, 0, 0);

	return mergedCanvas;
}
