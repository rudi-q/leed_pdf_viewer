import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { PageSizes, PDFDocument } from 'pdf-lib';

// Dynamic import for pdf.js to avoid SSR issues
let pdfjsLib: any = null;
let isInitialized = false;

// Initialize PDF.js only on client side
if (typeof window !== 'undefined' && !import.meta.env?.TEST) {
	// Dynamic import to avoid SSR issues
	import('pdfjs-dist')
		.then((lib) => {
			pdfjsLib = lib;
			if (typeof window !== 'undefined' && import.meta.url) {
				// Only set worker in non-test environments
				try {
					const workerUrl = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
					pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
				} catch (e) {
					// Fallback for environments where URL construction fails
					pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
				}
				// Disable eval for security
				pdfjsLib.GlobalWorkerOptions.isEvalSupported = false;
			}
			isInitialized = true;
			console.log('PDF.js loaded successfully');
		})
		.catch((error) => {
			console.error('Failed to load PDF.js:', error);
		});
} else if (import.meta.env?.TEST) {
	// In test environment, use the mocked version
	import('pdfjs-dist').then((lib) => {
		pdfjsLib = lib;
		isInitialized = true;
	});
}

export interface RenderOptions {
	scale: number;
	canvas: HTMLCanvasElement;
}

// Custom error class to track retry information
export class PDFLoadError extends Error {
	attempts: number;
	originalUrl: string;

	constructor(message: string, attempts: number, originalUrl: string) {
		super(message);
		this.name = 'PDFLoadError';
		this.attempts = attempts;
		this.originalUrl = originalUrl;
	}
}

// CORS proxy helper
async function fetchWithCorsProxy(url: string, onRetry?: (attempt: number, total: number) => void): Promise<ArrayBuffer> {
	const urlObj = new URL(url);
	const needsProxy =
		!urlObj.hostname.includes('localhost') && !urlObj.hostname.includes('127.0.0.1');
	const proxies = needsProxy
		? [
				'', // Try direct first
				'https://corsproxy.io/?',
				'https://api.allorigins.win/raw?url='
			]
		: ['', 'https://corsproxy.io/?'];

	for (let i = 0; i < proxies.length; i++) {
		const proxy = proxies[i];
		try {
			// Notify about retry attempt
			if (onRetry && i > 0) {
				onRetry(i + 1, proxies.length);
			}

			const fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
			console.log(`Trying to fetch (attempt ${i + 1}/${proxies.length}): ${fetchUrl}`);

			const response = await fetch(fetchUrl);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const arrayBuffer = await response.arrayBuffer();

			// Verify it's a PDF
			const uint8Array = new Uint8Array(arrayBuffer);
			const pdfSignature = uint8Array.subarray(0, 4);
			const pdfHeader = String.fromCharCode(...pdfSignature);

			if (pdfHeader === '%PDF') {
				console.log(`Successfully fetched PDF via: ${proxy || 'direct'}`);
				return arrayBuffer;
			} else {
				throw new Error('Response is not a valid PDF');
			}
		} catch (error: any) {
			console.warn(`Failed with ${proxy || 'direct'}: ${error.message}`);
			if (i === proxies.length - 1) {
				// Last attempt failed, throw custom error with attempt count
				throw new PDFLoadError(
					`Failed to load PDF after ${proxies.length} attempts: ${error.message}`,
					proxies.length,
					url
				);
			}
		}
	}

	throw new PDFLoadError('All fetch attempts failed', proxies.length, url);
}

// Enhanced Dropbox URL converter
function convertDropboxUrl(url: string): string {
	try {
		const urlObj = new URL(url);

		if (!urlObj.hostname.includes('dropbox.com')) {
			return url;
		}

		// Remove problematic parameters
		urlObj.searchParams.delete('st');
		urlObj.searchParams.set('dl', '1');

		// For /scl/fi/ format, try to convert to dropboxusercontent.com
		if (urlObj.pathname.includes('/scl/fi/')) {
			const pathMatch = urlObj.pathname.match(/\/scl\/fi\/([^\/]+)\/(.+)/);
			if (pathMatch) {
				const fileId = pathMatch[1];
				const fileName = pathMatch[2];
				const rlkey = urlObj.searchParams.get('rlkey');

				if (rlkey) {
					return `https://dl.dropboxusercontent.com/scl/fi/${fileId}/${fileName}?rlkey=${rlkey}&dl=1`;
				}
			}
		}

		return urlObj.toString();
	} catch (error) {
		console.warn('Error converting Dropbox URL:', error);
		return url;
	}
}

export class PDFManager {
	private document: PDFDocumentProxy | null = null;
	private currentPageProxy: PDFPageProxy | null = null;

	private async ensurePDFJSLoaded(): Promise<void> {
		if (!pdfjsLib || !isInitialized) {
			console.log('Waiting for PDF.js to load...');
			// Wait for PDF.js to load with timeout
			return new Promise((resolve, reject) => {
				let attempts = 0;
				const maxAttempts = 100; // 5 seconds timeout

				const checkInterval = setInterval(() => {
					attempts++;

					if (pdfjsLib && isInitialized) {
						clearInterval(checkInterval);
						console.log('PDF.js is ready!');
						resolve();
					} else if (attempts >= maxAttempts) {
						clearInterval(checkInterval);
						reject(new Error('PDF.js failed to load within timeout'));
					}
				}, 50);
			});
		} else {
			console.log('PDF.js already loaded and ready');
		}
	}

	async loadFromFile(file: File): Promise<PDFDocumentProxy> {
		await this.ensurePDFJSLoaded();

		try {
			const arrayBuffer = await file.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);

			this.document = await pdfjsLib.getDocument({
				data: uint8Array,
				cMapUrl: '/pdfjs/cmaps/',
				cMapPacked: true,
				isEvalSupported: false
			}).promise;

			return this.document!;
		} catch (error) {
			console.error('Error loading PDF:', error);
			throw new Error('Failed to load PDF file');
		}
	}

	async loadFromUrl(
		url: string,
		onRetry?: (attempt: number, total: number) => void
	): Promise<PDFDocumentProxy> {
		await this.ensurePDFJSLoaded();

		try {
			console.log('Loading PDF from URL:', url);

			// Convert Dropbox URLs to direct download format
			const directUrl = convertDropboxUrl(url);
			console.log('Using direct URL:', directUrl);

			// Fetch the PDF data with CORS proxy fallbacks
			const arrayBuffer = await fetchWithCorsProxy(directUrl, onRetry);
			const uint8Array = new Uint8Array(arrayBuffer);

			this.document = await pdfjsLib.getDocument({
				data: uint8Array,
				cMapUrl: '/pdfjs/cmaps/',
				cMapPacked: true,
				isEvalSupported: false
			}).promise;

			console.log('PDF loaded successfully from URL');
			return this.document!;
		} catch (error: any) {
			console.error('Error loading PDF from URL:', error);
			// Re-throw PDFLoadError as-is to preserve retry information
			if (error instanceof PDFLoadError) {
				throw error;
			}
			throw new Error(`Failed to load PDF from URL: ${error.message}`);
		}
	}

	async renderPage(pageNumber: number, options: RenderOptions): Promise<void> {
		if (!this.document) {
			throw new Error('No PDF document loaded');
		}

		try {
			// Get the page
			this.currentPageProxy = await this.document.getPage(pageNumber);

			// Get viewport with desired scale
			const viewport = this.currentPageProxy.getViewport({ scale: options.scale });

			// Set canvas dimensions
			const canvas = options.canvas;
			const context = canvas.getContext('2d');
			if (!context) {
				throw new Error('Unable to get canvas context');
			}

			// Set canvas size
			canvas.width = viewport.width;
			canvas.height = viewport.height;

			// Clear canvas
			context.clearRect(0, 0, canvas.width, canvas.height);

			// Render the page
			const renderContext = {
				canvasContext: context,
				viewport: viewport,
				canvas: canvas
			};

			await this.currentPageProxy.render(renderContext).promise;
		} catch (error) {
			console.error('Error rendering page:', error);
			throw new Error(`Failed to render page ${pageNumber}`);
		}
	}

	// Render a page proxy directly to a canvas (used for exports)
	async renderPageToCanvas(pageProxy: PDFPageProxy, options: RenderOptions): Promise<void> {
		if (!pageProxy) {
			throw new Error('No page proxy provided');
		}

		try {
			// Get viewport with scale 1 as the context scaling is already handled externally
			const viewport = pageProxy.getViewport({ scale: 1 });

			// Set canvas dimensions
			const canvas = options.canvas;
			const context = canvas.getContext('2d');
			if (!context) {
				throw new Error('Unable to get canvas context');
			}

			// Don't clear canvas or modify size as it might already be set for export scaling
			// The context might already have scaling applied

			// Render the page with the base viewport (scaling handled by existing context transform)
			const renderContext = {
				canvasContext: context,
				viewport: viewport,
				canvas: canvas
			};

			await pageProxy.render(renderContext).promise;
		} catch (error) {
			console.error('Error rendering page to canvas:', error);
			throw new Error('Failed to render page to canvas');
		}
	}

	getPageCount(): number {
		return this.document?.numPages || 0;
	}

	getDocument(): PDFDocumentProxy | null {
		return this.document;
	}

	getCurrentPageProxy(): PDFPageProxy | null {
		return this.currentPageProxy;
	}

	async getPageDimensions(
		pageNumber: number,
		scale: number = 1
	): Promise<{ width: number; height: number }> {
		if (!this.document) {
			throw new Error('No PDF document loaded');
		}

		try {
			const page = await this.document.getPage(pageNumber);
			const viewport = page.getViewport({ scale });
			return {
				width: viewport.width,
				height: viewport.height
			};
		} catch (error) {
			console.error('Error getting page dimensions:', error);
			throw new Error(`Failed to get dimensions for page ${pageNumber}`);
		}
	}

	destroy(): void {
		this.currentPageProxy = null;
		if (this.document) {
			this.document.destroy();
			this.document = null;
		}
	}
}

// Utility function to check if PDF.js is supported
export function isPDFSupported(): boolean {
	return typeof pdfjsLib !== 'undefined';
}

// Utility function to validate PDF file
export function isValidPDFFile(file: File): boolean {
	return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

// Utility function to validate markdown file
export function isValidMarkdownFile(file: File): boolean {
	const validTypes = ['text/markdown', 'text/x-markdown', 'text/plain'];
	const validExtensions = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'];

	// Check MIME type
	if (validTypes.includes(file.type)) {
		return true;
	}

	// Check file extension
	const fileName = file.name.toLowerCase();
	return validExtensions.some((ext) => fileName.endsWith(ext));
}

// Utility function to validate LPDF file
export function isValidLPDFFile(file: File): boolean {
	// Check file extension (LPDF files should end with .lpdf)
	const fileName = file.name.toLowerCase();
	return fileName.endsWith('.lpdf');
}

// Utility function to format file size
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Utility function to create a blank PDF document
export async function createBlankPDF(): Promise<File> {
	try {
		// Create a new PDF document
		const pdfDoc = await PDFDocument.create();

		// Add a blank page with standard US Letter size (8.5 x 11 inches)
		const page = pdfDoc.addPage(PageSizes.Letter);

		// Optionally, you can add more pages or customize the page
		// For now, we'll just keep it as a single blank page

		// Serialize the PDF to bytes
		const pdfBytes = await pdfDoc.save();

		// Create a File object from the PDF bytes
		const file = new File([new Uint8Array(pdfBytes)], 'blank.pdf', {
			type: 'application/pdf',
			lastModified: Date.now()
		});

		console.log('Created blank PDF:', file.name, file.size, 'bytes');
		return file;
	} catch (error) {
		console.error('Error creating blank PDF:', error);
		throw new Error('Failed to create blank PDF');
	}
}
