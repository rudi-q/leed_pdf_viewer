import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
	try {
		const workerUrl = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
		pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
	} catch (e) {
		pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
	}
}

export interface PDFPageInfo {
	id: string;
	sourceFileId: string;
	sourceFileName: string;
	pageNumber: number;
	thumbnailDataUrl?: string;
}

export interface PDFFileInfo {
	id: string;
	file: File;
	pageCount: number;
}

/**
 * Load a PDF file and get its page count
 */
export async function loadPDFInfo(file: File): Promise<PDFFileInfo> {
	const arrayBuffer = await file.arrayBuffer();
	const pdfDoc = await PDFDocument.load(arrayBuffer);
	
	return {
		id: generateId(),
		file,
		pageCount: pdfDoc.getPageCount()
	};
}

/**
 * Generate a thumbnail for a specific page of a PDF
 */
export async function generateThumbnail(
	file: File,
	pageNumber: number,
	width: number = 150
): Promise<string> {
	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
	const pdf = await loadingTask.promise;
	const page = await pdf.getPage(pageNumber);
	
	// Calculate scale to fit desired width
	const viewport = page.getViewport({ scale: 1 });
	const scale = width / viewport.width;
	const scaledViewport = page.getViewport({ scale });
	
	// Create canvas for rendering
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	if (!context) {
		throw new Error('Could not get canvas context');
	}
	
	canvas.width = scaledViewport.width;
	canvas.height = scaledViewport.height;
	
	// Render page to canvas
	await page.render({
		canvasContext: context,
		viewport: scaledViewport,
		canvas: canvas
	}).promise;
	
	// Convert canvas to data URL
	const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
	
	// Cleanup
	pdf.destroy();
	
	return dataUrl;
}

/**
 * Extract specific pages from a PDF and return a new PDF document
 */
export async function extractPages(
	file: File,
	pageNumbers: number[]
): Promise<PDFDocument> {
	const arrayBuffer = await file.arrayBuffer();
	const sourcePdf = await PDFDocument.load(arrayBuffer);
	const newPdf = await PDFDocument.create();
	
	// Copy selected pages (pageNumbers are 1-indexed)
	for (const pageNum of pageNumbers) {
		const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
		newPdf.addPage(copiedPage);
	}
	
	return newPdf;
}

/**
 * Merge multiple PDFs into a single PDF based on page order
 */
export async function mergePDFs(pages: PDFPageInfo[]): Promise<Uint8Array> {
	const mergedPdf = await PDFDocument.create();
	
	// Group pages by source file for efficient loading
	const fileGroups = new Map<string, PDFPageInfo[]>();
	for (const page of pages) {
		if (!fileGroups.has(page.sourceFileId)) {
			fileGroups.set(page.sourceFileId, []);
		}
		fileGroups.get(page.sourceFileId)!.push(page);
	}
	
	// Load each source file once and copy its pages
	const loadedPdfs = new Map<string, PDFDocument>();
	
	for (const page of pages) {
		// Load source PDF if not already loaded
		if (!loadedPdfs.has(page.sourceFileId)) {
			// Find the file info from the page (we'll need to pass files separately)
			// For now, we'll handle this in the calling code
			throw new Error('File loading needs to be handled by caller');
		}
	}
	
	return mergedPdf.save();
}

/**
 * Merge PDFs with file map for efficient loading
 */
export async function mergePDFsWithFiles(
	pages: PDFPageInfo[],
	filesMap: Map<string, File>
): Promise<Uint8Array> {
	const mergedPdf = await PDFDocument.create();
	const loadedPdfs = new Map<string, PDFDocument>();
	
	// Process pages in order
	for (const page of pages) {
		// Load source PDF if not already loaded
		if (!loadedPdfs.has(page.sourceFileId)) {
			const file = filesMap.get(page.sourceFileId);
			if (!file) {
				throw new Error(`File not found for ID: ${page.sourceFileId}`);
			}
			
			const arrayBuffer = await file.arrayBuffer();
			const sourcePdf = await PDFDocument.load(arrayBuffer);
			loadedPdfs.set(page.sourceFileId, sourcePdf);
		}
		
		const sourcePdf = loadedPdfs.get(page.sourceFileId)!;
		
		// Copy the specific page (pageNumber is 1-indexed)
		const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [page.pageNumber - 1]);
		mergedPdf.addPage(copiedPage);
	}
	
	return mergedPdf.save();
}

/**
 * Reorder pages within a single PDF
 */
export async function reorderPDFPages(
	file: File,
	newOrder: number[]
): Promise<Uint8Array> {
	const arrayBuffer = await file.arrayBuffer();
	const sourcePdf = await PDFDocument.load(arrayBuffer);
	const reorderedPdf = await PDFDocument.create();
	
	// Copy pages in new order (newOrder contains 1-indexed page numbers)
	for (const pageNum of newOrder) {
		const [copiedPage] = await reorderedPdf.copyPages(sourcePdf, [pageNum - 1]);
		reorderedPdf.addPage(copiedPage);
	}
	
	return reorderedPdf.save();
}

/**
 * Delete specific pages from a PDF
 */
export async function deletePDFPages(
	file: File,
	pageNumbersToDelete: number[]
): Promise<Uint8Array> {
	const arrayBuffer = await file.arrayBuffer();
	const sourcePdf = await PDFDocument.load(arrayBuffer);
	const newPdf = await PDFDocument.create();
	
	const totalPages = sourcePdf.getPageCount();
	const pagesToKeep: number[] = [];
	
	// Build list of pages to keep
	for (let i = 1; i <= totalPages; i++) {
		if (!pageNumbersToDelete.includes(i)) {
			pagesToKeep.push(i);
		}
	}
	
	// Copy pages to keep (converting to 0-indexed)
	for (const pageNum of pagesToKeep) {
		const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNum - 1]);
		newPdf.addPage(copiedPage);
	}
	
	return newPdf.save();
}

/**
 * Download a PDF file
 */
export function downloadPDF(pdfBytes: Uint8Array, filename: string): void {
	const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	
	// Cleanup
	setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Generate a unique ID
 */
function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate if a file is a PDF
 */
export function isValidPDF(file: File): boolean {
	return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
