import { PDFDocument, PDFPage, degrees, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauriUtils';
import type { 
	DrawingPath, 
	TextAnnotation, 
	ArrowAnnotation, 
	StickyNoteAnnotation, 
	StampAnnotation,
	availableStamps
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
			const pageNumbers = Array.from(this.canvasElements.keys()).sort((a, b) => a - b);
			if (pageNumbers.length === 0) {
				throw new Error('No rendered pages available for export');
			}
			for (const pageNum of pageNumbers) {
				const canvas = this.canvasElements.get(pageNum);
				if (!canvas) throw new Error(`Canvas for page ${pageNum} is null`);
				if (!Number.isFinite(canvas.width) || canvas.width <= 0) {
					throw new Error(`Invalid canvas dimensions`);
				}

				const page = newDoc.addPage([
					PDFExporter.pixelsToPoints(canvas.width),
					PDFExporter.pixelsToPoints(canvas.height)
				]);

				const pageRotation = this.rotations.get(pageNum) || 0;
				await this.embedCanvasInPage(newDoc, page, canvas, pageRotation);
			}
			return await newDoc.save();
		} catch (fallbackError) {
			throw new Error(`Failed to export fallback PDF: ${fallbackError}`);
		}
	}
	
	private parseSvgPathToPdfCommands(svgPathStr: string): string {
		// Just returns the path string unmodified for now, since pdf-lib drawSvgPath
		// uses standard SVG path strings (M, L, C, Z, etc) directly.
		return svgPathStr;
	}

	private extractPathFromStamp(svgString: string): { pathData: string, fill: string, stroke: string } | null {
		// Extremely simple regex-based SVG extractor to pull out the first significant path for PDF-lib compatibility
		// This skips drop shadows/filters since pdf-lib doesn't support them natively 
		const pathRegex = /<path d="([^"]+)" fill="([^"]+)" stroke="([^"]+)"/g;
		let match;
		let bestPath = null;
		
		// Find the actual colored element, usually the second path or the one not filled "none" or "white"
		while ((match = pathRegex.exec(svgString)) !== null) {
			if (match[2] !== 'none' && match[2] !== 'white') {
				bestPath = { pathData: match[1], fill: match[2], stroke: match[3] };
			}
		}
		
		return bestPath;
	}

	private async loadCustomFont(pdfDoc: PDFDocument, fontFamily: string) {
		// Provide fallback mapping
		if (fontFamily.includes('sans-serif')) return pdfDoc.embedStandardFont(StandardFonts.Helvetica);
		if (fontFamily.includes('serif') && !fontFamily.includes('sans-serif')) return pdfDoc.embedStandardFont(StandardFonts.TimesRoman);
		if (fontFamily.includes('monospace')) return pdfDoc.embedStandardFont(StandardFonts.Courier);
		
		// Map known font families to static assets
		let fontPath = '';
		if (fontFamily.includes('ReenieBeanie')) fontPath = '/fonts/ReenieBeanie.ttf';
		else if (fontFamily.includes('Inter')) fontPath = '/fonts/inter-v20-latin-regular.woff2';
		else if (fontFamily.includes('Lora')) fontPath = '/fonts/additional-fonts/Lora-VariableFont_wght.woff2';
		else if (fontFamily.includes('Urbanist')) fontPath = '/fonts/additional-fonts/Urbanist-Regular.woff2';
		else if (fontFamily.includes('Dancing Script')) fontPath = '/fonts/dancing-script-v29-latin-600.woff2';
		else return pdfDoc.embedStandardFont(StandardFonts.Helvetica); // Ultimate fallback

		try {
			const fontBytes = await fetch(fontPath).then((res) => res.arrayBuffer());
			return await pdfDoc.embedFont(fontBytes);
		} catch (e) {
			console.warn(`Failed to heavily embed ${fontFamily}, falling back to Helvetica`, e);
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

		// 1. Draw Paths (Freehand / Highlighters)
		for (const path of annotations.drawingPaths) {
			if (!path.points || path.points.length < 2) continue;
			
			const rgbColor = this.hexToRgb(path.highlightColor || path.color);
			const pdfColor = rgb(rgbColor.r, rgbColor.g, rgbColor.b);
			const opacity = path.highlightOpacity || (path.tool === 'highlight' ? 0.4 : 1);
			
			// Group points into a single SVG path
			let pathData = `M ${path.points[0].x} ${flipY(path.points[0].y)}`;
			for (let i = 1; i < path.points.length; i++) {
				pathData += ` L ${path.points[i].x} ${flipY(path.points[i].y)}`;
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
			
			// Calculate position - convert top-left to bottom-left
			// Text position needs adjustment because pdf-lib text origin is bottom-left of the first line
			const yPos = flipY(textMod.y) - textMod.fontSize;

			page.drawText(textMod.text, {
				x: textMod.x,
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
			
			const rectY = flipY(note.y) - note.height;
			
			// Draw sticky note background
			page.drawRectangle({
				x: note.x,
				y: rectY,
				width: note.width,
				height: note.height,
				color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
				opacity: 0.9
			});

			// Draw sticky note text (simplified, real text wrapping might be necessary)
			const textYPos = flipY(note.y) - note.fontSize - 10; // offset from top
			page.drawText(note.text, {
				x: note.x + 10,
				y: textYPos,
				size: note.fontSize,
				font: font,
				color: rgb(0, 0, 0)
			});
		}

		// 4. Draw Arrows
		for (const arrow of annotations.arrowAnnotations) {
			const rgbColor = this.hexToRgb(arrow.stroke);
			const pdfColor = rgb(rgbColor.r, rgbColor.g, rgbColor.b);
			
			// Draw line
			page.drawLine({
				start: { x: arrow.x1, y: flipY(arrow.y1) },
				end: { x: arrow.x2, y: flipY(arrow.y2) },
				thickness: arrow.strokeWidth,
				color: pdfColor
			});

			// Draw arrowhead if needed
			if (arrow.arrowHead) {
				const angle = Math.atan2(flipY(arrow.y2) - flipY(arrow.y1), arrow.x2 - arrow.x1);
				const arrowLength = arrow.strokeWidth * 3;
				
				const x3 = arrow.x2 - arrowLength * Math.cos(angle - Math.PI / 6);
				const y3 = flipY(arrow.y2) - arrowLength * Math.sin(angle - Math.PI / 6);
				
				const x4 = arrow.x2 - arrowLength * Math.cos(angle + Math.PI / 6);
				const y4 = flipY(arrow.y2) - arrowLength * Math.sin(angle + Math.PI / 6);
				
				const arrowFill = `M ${arrow.x2} ${flipY(arrow.y2)} L ${x3} ${y3} L ${x4} ${y4} Z`;
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
				
				// Calculate dimensions. SVGs have internal viewBoxes, usually 100x100
				const scaleFactor = stamp.size / 100;
				
				// Some path data requires vertical flipping because PDF coordinates are reversed compared to SVG
				// The easiest fix without matrix math is simply rendering it. Note: SVG paths in general
				// assume top-left origin, so we might need a coordinate matrix specifically for stamps.
				page.drawSvgPath(parsedSvg.pathData, {
					x: stamp.x,
					y: flipY(stamp.y) - stamp.size,
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
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		if (!result) {
			return { r: 0, g: 0, b: 0 }; // Default to black
		}

		return {
			r: parseInt(result[1], 16) / 255,
			g: parseInt(result[2], 16) / 255,
			b: parseInt(result[3], 16) / 255
		};
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
