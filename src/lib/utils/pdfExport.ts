import { PDFDocument, rgb } from 'pdf-lib';
import type { DrawingPath } from '../stores/drawingStore';

export interface ExportOptions {
  includeOriginalPDF: boolean;
  format: 'pdf' | 'png' | 'jpeg';
  quality?: number;
}

export class PDFExporter {
  private originalPdfBytes: Uint8Array | null = null;
  private drawingPaths: Map<number, DrawingPath[]> = new Map();

  setOriginalPDF(pdfBytes: Uint8Array) {
    this.originalPdfBytes = pdfBytes;
  }

  setDrawingPaths(paths: Map<number, DrawingPath[]>) {
    this.drawingPaths = new Map(paths);
  }

  async exportToPDF(): Promise<Uint8Array> {
    if (!this.originalPdfBytes) {
      throw new Error('No original PDF loaded');
    }

    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(this.originalPdfBytes);
      const pages = pdfDoc.getPages();

      // Add drawings to each page
      for (const [pageNumber, paths] of this.drawingPaths) {
        if (pageNumber > 0 && pageNumber <= pages.length) {
          const page = pages[pageNumber - 1]; // PDF pages are 0-indexed
          await this.addDrawingsToPage(page, paths);
        }
      }

      // Serialize the PDF
      return await pdfDoc.save();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      throw new Error('Failed to export annotated PDF');
    }
  }

  private async addDrawingsToPage(page: any, paths: DrawingPath[]) {
    const { width, height } = page.getSize();

    for (const path of paths) {
      if (path.tool === 'eraser') {
        // Erasers are more complex to implement in PDF
        // For now, we'll skip them or implement as white lines
        continue;
      }

      if (path.points.length < 2) continue;

      // Convert hex color to RGB
      const color = this.hexToRgb(path.color);
      
      // Start drawing the path
      page.moveTo(path.points[0].x, height - path.points[0].y); // Flip Y coordinate

      for (let i = 1; i < path.points.length; i++) {
        const point = path.points[i];
        page.lineTo(point.x, height - point.y); // Flip Y coordinate
      }

      // Set stroke properties
      page.setStrokeColor(color);
      page.setLineWidth(path.lineWidth);
      page.stroke();
    }
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return { r: 0, g: 0, b: 0 }; // Default to black
    }
    
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }

  async exportAsImages(canvases: HTMLCanvasElement[]): Promise<Blob[]> {
    const images: Blob[] = [];

    for (const canvas of canvases) {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/png', 1.0);
      });
      images.push(blob);
    }

    return images;
  }

  // Utility function to download a file
  static downloadFile(data: Uint8Array | Blob, filename: string, mimeType: string) {
    const blob = data instanceof Uint8Array ? new Blob([data], { type: mimeType }) : data;
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
export function mergeCanvases(pdfCanvas: HTMLCanvasElement, drawingCanvas: HTMLCanvasElement): HTMLCanvasElement {
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
