import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Dynamic import for pdf.js to avoid SSR issues
let pdfjsLib: any = null;
let isInitialized = false;

// Initialize PDF.js only on client side
if (typeof window !== 'undefined') {
  // Dynamic import to avoid SSR issues
  import('pdfjs-dist').then((lib) => {
    pdfjsLib = lib;
    if (typeof window !== 'undefined') {
	  import('pdfjs-dist/build/pdf.worker.mjs').then((worker) => {
		pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
		  'pdfjs-dist/build/pdf.worker.mjs', 
		  import.meta.url
		).toString();
	  });
	}
    isInitialized = true;
    console.log('PDF.js loaded successfully');
  }).catch((error) => {
    console.error('Failed to load PDF.js:', error);
  });
}

export interface RenderOptions {
  scale: number;
  canvas: HTMLCanvasElement;
}

// CORS proxy helper
async function fetchWithCorsProxy(url: string): Promise<ArrayBuffer> {
  const proxies = [
    '', // Try direct first
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ];

  for (const proxy of proxies) {
    try {
      const fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
      console.log(`Trying to fetch: ${fetchUrl}`);

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
      if (proxy === proxies[proxies.length - 1]) {
        throw error;
      }
    }
  }

  throw new Error('All fetch attempts failed');
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
      }).promise;
      
      return this.document;
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw new Error('Failed to load PDF file');
    }
  }

  async loadFromUrl(url: string): Promise<PDFDocumentProxy> {
    await this.ensurePDFJSLoaded();
    
    try {
      console.log('Loading PDF from URL:', url);
      
      // Convert Dropbox URLs to direct download format
      const directUrl = convertDropboxUrl(url);
      console.log('Using direct URL:', directUrl);
      
      // Fetch the PDF data with CORS proxy fallbacks
      const arrayBuffer = await fetchWithCorsProxy(directUrl);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      this.document = await pdfjsLib.getDocument({
        data: uint8Array,
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
      }).promise;
      
      console.log('PDF loaded successfully from URL');
      return this.document;
    } catch (error: any) {
      console.error('Error loading PDF from URL:', error);
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
      };
      
      await this.currentPageProxy.render(renderContext).promise;
    } catch (error) {
      console.error('Error rendering page:', error);
      throw new Error(`Failed to render page ${pageNumber}`);
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

  async getPageDimensions(pageNumber: number, scale: number = 1): Promise<{ width: number; height: number }> {
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

// Utility function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}