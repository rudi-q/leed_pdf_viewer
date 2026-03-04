import { PDFDocument, PDFPage, degrees } from 'pdf-lib';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauriUtils';

export interface ExportOptions {
	includeOriginalPDF: boolean;
	format: 'pdf' | 'png' | 'jpeg';
	quality?: number;
}

export class PDFExporter {
	private originalPdfBytes: Uint8Array | null = null;
	private canvasElements: Map<number, HTMLCanvasElement> = new Map();
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

	setPageRotation(pageNumber: number, rotation: number) {
		this.setRotation(pageNumber, rotation);
	}

	setRotation(pageNumber: number, rotationDegrees: number) {
		this.rotations.set(pageNumber, rotationDegrees);
	}

	async exportToPDF(): Promise<Uint8Array> {
		if (!this.originalPdfBytes) {
			throw new Error('No original PDF loaded');
		}

		// Primary path: load original PDF and overlay canvases
		try {
			const pdfDoc = await PDFDocument.load(this.originalPdfBytes, { ignoreEncryption: true });
			const pages = pdfDoc.getPages();
			for (let pageNumber = 1; pageNumber <= pages.length; pageNumber++) {
				const page = pages[pageNumber - 1];
				const rotation = this.rotations.get(pageNumber);
				if (rotation !== undefined) {
					page.setRotation(degrees(rotation));
				}

				const canvas = this.canvasElements.get(pageNumber);
				if (canvas) {
					await this.embedCanvasInPage(pdfDoc, page, canvas, rotation || 0);
				}
			}
			return await pdfDoc.save();
		} catch (primaryError) {
			// Fallback path: build a brand-new PDF composed from merged canvases
			try {
				const newDoc = await PDFDocument.create();
				const pageNumbers = Array.from(this.canvasElements.keys()).sort((a, b) => a - b);
				if (pageNumbers.length === 0) {
					throw new Error('No rendered pages available for export');
				}
				for (const pageNum of pageNumbers) {
					// Safely retrieve and validate canvas
					if (!this.canvasElements.has(pageNum)) {
						throw new Error(`Canvas for page ${pageNum} not found in export buffer`);
					}
					const canvas = this.canvasElements.get(pageNum);
					if (!canvas) {
						throw new Error(`Canvas for page ${pageNum} is null`);
					}
					// Validate canvas dimensions
					if (
						!Number.isFinite(canvas.width) ||
						!Number.isFinite(canvas.height) ||
						canvas.width <= 0 ||
						canvas.height <= 0
					) {
						throw new Error(
							`Invalid canvas dimensions for page ${pageNum}: width=${canvas.width}, height=${canvas.height}`
						);
					}
					// Convert pixel dimensions to PDF points (72 DPI)
					const page = newDoc.addPage([
						PDFExporter.pixelsToPoints(canvas.width),
						PDFExporter.pixelsToPoints(canvas.height)
					]);

					await this.embedCanvasInPage(newDoc, page, canvas, 0);
				}
				return await newDoc.save();
			} catch (fallbackError) {
				const primaryMsg =
					primaryError instanceof Error
						? `${primaryError.message}${primaryError.stack ? '\n' + primaryError.stack : ''}`
						: String(primaryError);
				const fallbackMsg =
					fallbackError instanceof Error
						? `${fallbackError.message}${fallbackError.stack ? '\n' + fallbackError.stack : ''}`
						: String(fallbackError);
				console.error('PDF export failed. Primary:', primaryMsg, '| Fallback:', fallbackMsg);
				throw new Error(
					`Failed to export annotated PDF: Primary load error: ${primaryMsg}. Fallback error: ${fallbackMsg}`
				);
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
