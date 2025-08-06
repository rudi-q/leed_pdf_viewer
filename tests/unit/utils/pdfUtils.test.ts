import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFManager, isPDFSupported, isValidPDFFile, formatFileSize } from '../../../src/lib/utils/pdfUtils';

describe('PDFUtils', () => {
  let pdfManager: PDFManager;

  beforeEach(() => {
    pdfManager = new PDFManager();
    vi.clearAllMocks();
  });

  describe('PDFManager', () => {
    describe('loadFromFile', () => {
      it('should load a PDF file successfully', async () => {
        const mockFile = (globalThis as any).testHelpers.createMockFile('test.pdf', 1024);
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(5);
        
        // Mock pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist');
        vi.mocked(pdfjsLib.getDocument).mockReturnValue({
          promise: Promise.resolve(mockPDF)
        } as any);

        const result = await pdfManager.loadFromFile(mockFile);
        
        expect(result).toBe(mockPDF);
        expect(pdfjsLib.getDocument).toHaveBeenCalledWith({
          data: expect.any(Uint8Array),
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true
        });
      });

      it('should handle PDF loading errors', async () => {
        const mockFile = (globalThis as any).testHelpers.createMockFile('test.pdf', 1024);
        
        // Mock pdfjs-dist to throw error
        const pdfjsLib = await import('pdfjs-dist');
        vi.mocked(pdfjsLib.getDocument).mockReturnValue({
          promise: Promise.reject(new Error('Invalid PDF'))
        } as any);

        await expect(pdfManager.loadFromFile(mockFile)).rejects.toThrow('Failed to load PDF file');
      });

      it('should handle file reading errors', async () => {
        const mockFile = {
          ...(globalThis as any).testHelpers.createMockFile('test.pdf', 1024),
          arrayBuffer: vi.fn().mockRejectedValue(new Error('Read error'))
        };

        await expect(pdfManager.loadFromFile(mockFile as any)).rejects.toThrow('Failed to load PDF file');
      });
    });

    describe('loadFromUrl', () => {
      it('should load a PDF from URL successfully', async () => {
        const testUrl = 'https://example.com/test.pdf';
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);

        // Create a valid PDF header
        const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(1020).fill(0)]);
        
        // Mock fetch
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: vi.fn().mockResolvedValue(pdfData.buffer)
        });

        // Mock pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist');
        vi.mocked(pdfjsLib.getDocument).mockReturnValue({
          promise: Promise.resolve(mockPDF)
        } as any);

        const result = await pdfManager.loadFromUrl(testUrl);
        
        expect(result).toBe(mockPDF);
        expect(fetch).toHaveBeenCalled();
      });

      it('should handle Dropbox URL conversion', async () => {
        const dropboxUrl = 'https://dropbox.com/scl/fi/abc123/test.pdf?rlkey=xyz789&st=123';
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);

        // Create a valid PDF header
        const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(1020).fill(0)]);
        
        // Mock fetch
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: vi.fn().mockResolvedValue(pdfData.buffer)
        });

        // Mock pdfjs-dist
        const pdfjsLib = await import('pdfjs-dist');
        vi.mocked(pdfjsLib.getDocument).mockReturnValue({
          promise: Promise.resolve(mockPDF)
        } as any);

        await pdfManager.loadFromUrl(dropboxUrl);
        
        // Should convert the URL format
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('dl=1'));
      });

      it('should handle CORS proxy fallbacks', async () => {
        const testUrl = 'https://example.com/test.pdf';
        
        // Create a valid PDF header
        const pdfData = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(1020).fill(0)]);
        
        // Mock fetch to fail first, succeed on proxy
        globalThis.fetch = vi.fn()
          .mockRejectedValueOnce(new Error('CORS error'))
          .mockResolvedValueOnce({
            ok: true,
            arrayBuffer: vi.fn().mockResolvedValue(pdfData.buffer)
          });

        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);
        const pdfjsLib = await import('pdfjs-dist');
        vi.mocked(pdfjsLib.getDocument).mockReturnValue({
          promise: Promise.resolve(mockPDF)
        } as any);

        const result = await pdfManager.loadFromUrl(testUrl);
        
        expect(result).toBe(mockPDF);
        expect(fetch).toHaveBeenCalledTimes(2);
      });

      it('should handle network errors', async () => {
        const testUrl = 'https://example.com/test.pdf';
        
        // Mock fetch to always fail
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        await expect(pdfManager.loadFromUrl(testUrl)).rejects.toThrow('Failed to load PDF from URL');
      });
    });

    describe('renderPage', () => {
      it('should render a page successfully', async () => {
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);
        const mockPage = {
          getViewport: vi.fn(() => ({ width: 612, height: 792 })),
          render: vi.fn(() => ({ promise: Promise.resolve() }))
        };
        mockPDF.getPage.mockResolvedValue(mockPage);

        // Set up manager with document
        (pdfManager as any).document = mockPDF;

        const canvas = document.createElement('canvas');
        const options = { scale: 1.5, canvas };

        await pdfManager.renderPage(1, options);

        expect(mockPDF.getPage).toHaveBeenCalledWith(1);
        expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.5 });
        expect(mockPage.render).toHaveBeenCalled();
        expect(canvas.width).toBe(612);
        expect(canvas.height).toBe(792);
      });

      it('should throw error when no document is loaded', async () => {
        const canvas = document.createElement('canvas');
        const options = { scale: 1.0, canvas };

        await expect(pdfManager.renderPage(1, options)).rejects.toThrow('No PDF document loaded');
      });

      it('should handle page rendering errors', async () => {
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);
        mockPDF.getPage.mockRejectedValue(new Error('Page not found'));

        (pdfManager as any).document = mockPDF;

        const canvas = document.createElement('canvas');
        const options = { scale: 1.0, canvas };

        await expect(pdfManager.renderPage(99, options)).rejects.toThrow('Failed to render page 99');
      });
    });

    describe('getPageCount', () => {
      it('should return correct page count', () => {
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(5);
        (pdfManager as any).document = mockPDF;

        expect(pdfManager.getPageCount()).toBe(5);
      });

      it('should return 0 when no document is loaded', () => {
        expect(pdfManager.getPageCount()).toBe(0);
      });
    });

    describe('getDocument', () => {
      it('should return the loaded document', () => {
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);
        (pdfManager as any).document = mockPDF;

        expect(pdfManager.getDocument()).toBe(mockPDF);
      });

      it('should return null when no document is loaded', () => {
        expect(pdfManager.getDocument()).toBeNull();
      });
    });

    describe('getPageDimensions', () => {
      it('should return page dimensions', async () => {
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);
        const mockPage = {
          getViewport: vi.fn(() => ({ width: 612, height: 792 }))
        };
        mockPDF.getPage.mockResolvedValue(mockPage);
        (pdfManager as any).document = mockPDF;

        const dimensions = await pdfManager.getPageDimensions(1, 1.5);

        expect(dimensions).toEqual({ width: 612, height: 792 });
        expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1.5 });
      });

      it('should handle errors when getting dimensions', async () => {
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);
        mockPDF.getPage.mockRejectedValue(new Error('Page error'));
        (pdfManager as any).document = mockPDF;

        await expect(pdfManager.getPageDimensions(1)).rejects.toThrow('Failed to get dimensions for page 1');
      });
    });

    describe('destroy', () => {
      it('should clean up resources', () => {
        const mockPDF = (globalThis as any).testHelpers.createMockPDF(3);
        (pdfManager as any).document = mockPDF;
        (pdfManager as any).currentPageProxy = { destroy: vi.fn() };

        pdfManager.destroy();

        expect(mockPDF.destroy).toHaveBeenCalled();
        expect(pdfManager.getDocument()).toBeNull();
      });
    });
  });

  describe('Utility Functions', () => {
    describe('isPDFSupported', () => {
      it('should return true when PDF.js is available', () => {
        // PDF.js is mocked in setup, so it should be supported
        expect(isPDFSupported()).toBe(true);
      });
    });

    describe('isValidPDFFile', () => {
      it('should validate PDF files by type', () => {
        const pdfFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        expect(isValidPDFFile(pdfFile)).toBe(true);
      });

      it('should validate PDF files by extension', () => {
        const pdfFile = new File(['content'], 'test.pdf', { type: 'text/plain' });
        expect(isValidPDFFile(pdfFile)).toBe(true);
      });

      it('should reject non-PDF files', () => {
        const txtFile = new File(['content'], 'test.txt', { type: 'text/plain' });
        expect(isValidPDFFile(txtFile)).toBe(false);
      });

      it('should handle uppercase extensions', () => {
        const pdfFile = new File(['content'], 'test.PDF', { type: 'text/plain' });
        expect(isValidPDFFile(pdfFile)).toBe(true);
      });
    });

    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1024 * 1024)).toBe('1 MB');
        expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      });

      it('should format partial sizes correctly', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB'); // 1.5 KB
        expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
      });

      it('should handle large numbers', () => {
        expect(formatFileSize(5.5 * 1024 * 1024 * 1024)).toBe('5.5 GB');
      });
    });
  });
});
