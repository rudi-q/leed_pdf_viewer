import { invoke } from '@tauri-apps/api/core';
import { PDFDocument } from 'pdf-lib';
import { PDFExporter } from './pdfExport';
import { isTauri } from './tauriUtils';

/**
 * Extract a filename from a URL, with .pdf extension ensured.
 * Used as default when route pages don't provide their own extractor.
 */
function defaultFilenameExtractor(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const filename = pathname.split('/').pop() || 'document.pdf';
		return filename.toLowerCase().endsWith('.pdf') ? filename : filename + '.pdf';
	} catch {
		return 'document.pdf';
	}
}

/**
 * Get PDF bytes and base name from a currentFile reference.
 * Handles both File objects and URL strings.
 */
export async function getPdfBytesAndName(
	currentFile: File | string,
	filenameExtractor?: (url: string) => string
): Promise<{ pdfBytes: Uint8Array; originalName: string }> {
	let pdfBytes: Uint8Array;
	let originalName: string;

	if (typeof currentFile === 'string') {
		const response = await fetch(currentFile);
		if (!response.ok) {
			throw new Error(`Failed to fetch PDF: ${response.statusText}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		pdfBytes = new Uint8Array(arrayBuffer);
		const extractor = filenameExtractor || defaultFilenameExtractor;
		originalName = extractor(currentFile).replace(/\.pdf$/i, '');
	} else {
		const arrayBuffer = await currentFile.arrayBuffer();
		pdfBytes = new Uint8Array(arrayBuffer);
		originalName = currentFile.name.replace(/\.pdf$/i, '');
	}

	return { pdfBytes, originalName };
}

/**
 * Build a PDFExporter with merged annotation canvases for annotated pages (or all pages).
 * Re-usable across all export flows that need annotated PDF output.
 *
 * @param options.captureAllPages - If true, captures canvases for all pages, not just annotated ones.
 *                                   Useful for canvas-only exports. Defaults to false.
 */
export async function buildAnnotatedPdfExporter(
	pdfBytes: Uint8Array,
	pdfViewer: {
		pageHasAnnotations: (page: number) => Promise<boolean>;
		getMergedCanvasForPage: (page: number) => Promise<HTMLCanvasElement | null>;
	},
	totalPages: number,
	options?: { captureAllPages?: boolean }
): Promise<PDFExporter> {
	const exporter = new PDFExporter();
	exporter.setOriginalPDF(pdfBytes);

	const captureAllPages = options?.captureAllPages ?? false;

	for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
		const hasAnnotations = await pdfViewer.pageHasAnnotations(pageNumber);
		if (hasAnnotations || captureAllPages) {
			const mergedCanvas = await pdfViewer.getMergedCanvasForPage(pageNumber);
			if (mergedCanvas) {
				exporter.setPageCanvas(pageNumber, mergedCanvas);
			}
		}
	}

	return exporter;
}

/**
 * Compress PDF bytes using the best available method:
 * - In Tauri: lopdf Rust-side image recompression + stream compression
 * - In browser: pdf-lib's useObjectStreams for basic cross-ref compression
 * - Falls back to original bytes if all methods fail
 *
 * @param pdfBytes - The PDF file bytes to compress
 * @param quality  - Image quality 1-100 (lower = smaller file, more lossy). Default 75.
 */
export async function compressPdfBytes(pdfBytes: Uint8Array, quality = 75): Promise<Uint8Array> {
	if (isTauri) {
		try {
			const compressed = (await invoke('compress_pdf', {
				content: Array.from(pdfBytes),
				quality
			})) as number[];
			return new Uint8Array(compressed);
		} catch (error) {
			console.warn('Tauri PDF compression failed, falling back to basic compression:', error);
		}
	}

	// Fallback: use pdf-lib for basic compression (useObjectStreams)
	try {
		const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
		return await doc.save({ useObjectStreams: true });
	} catch (error) {
		console.warn('pdf-lib compression fallback failed, returning original:', error);
		return pdfBytes;
	}
}
