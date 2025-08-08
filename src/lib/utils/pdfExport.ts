import { PDFDocument } from 'pdf-lib';

export interface ExportOptions {
	includeOriginalPDF: boolean;
	format: 'pdf' | 'png' | 'jpeg';
	quality?: number;
}

export class PDFExporter {
	private originalPdfBytes: Uint8Array | null = null;
	private canvasElements: Map<number, HTMLCanvasElement> = new Map();

	setOriginalPDF(pdfBytes: Uint8Array) {
		this.originalPdfBytes = pdfBytes;
	}

	setPageCanvas(pageNumber: number, canvas: HTMLCanvasElement) {
		this.canvasElements.set(pageNumber, canvas);
	}

	async exportToPDF(): Promise<Uint8Array> {
		if (!this.originalPdfBytes) {
			throw new Error('No original PDF loaded');
		}

		try {
			console.log('Loading original PDF document');
			const pdfDoc = await PDFDocument.load(this.originalPdfBytes);
			const pages = pdfDoc.getPages();
			console.log('Total pages in document:', pages.length);

			// Embed images from canvases into PDF
			for (let pageNumber = 1; pageNumber <= pages.length; pageNumber++) {
				const canvas = this.canvasElements.get(pageNumber);
				if (canvas) {
					console.log('Adding canvas annotations to page', pageNumber);
					await this.embedCanvasInPage(pdfDoc, pages[pageNumber - 1], canvas);
				}
			}

			console.log('Saving annotated PDF');
			return await pdfDoc.save();
		} catch (error) {
			console.error('Error exporting PDF:', error);
			throw new Error('Failed to export annotated PDF');
		}
	}

	private async embedCanvasInPage(pdfDoc: any, page: any, canvas: HTMLCanvasElement) {
		// Convert canvas to PNG data
		const imageData = canvas.toDataURL('image/png');
		const imageBytes = Uint8Array.from(atob(imageData.split(',')[1]), (c) => c.charCodeAt(0));

		// Embed the image in the PDF
		const image = await pdfDoc.embedPng(imageBytes);

		// Get page dimensions
		const { width, height } = page.getSize();

		// Draw the image over the existing page content
		page.drawImage(image, {
			x: 0,
			y: 0,
			width: width,
			height: height
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

	// Utility function to download a file
	static downloadFile(data: Uint8Array | Blob, filename: string, mimeType: string) {
		const blob = data instanceof Uint8Array ? new Blob([new Uint8Array(data)], { type: mimeType }) : data;
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
			'image/webp': '.webp'
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
