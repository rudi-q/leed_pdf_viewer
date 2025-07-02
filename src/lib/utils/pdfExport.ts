import { PDFDocument, rgb } from 'pdf-lib';
import type { DrawingPath } from '../stores/drawingStore';
import type { ShapeObject } from './konvaShapeEngine';

export interface ExportOptions {
  includeOriginalPDF: boolean;
  format: 'pdf' | 'png' | 'jpeg';
  quality?: number;
}

export class PDFExporter {
  private originalPdfBytes: Uint8Array | null = null;
  private drawingPaths: Map<number, DrawingPath[]> = new Map();
  private shapeObjects: Map<number, ShapeObject[]> = new Map();

  setOriginalPDF(pdfBytes: Uint8Array) {
    this.originalPdfBytes = pdfBytes;
  }

  setDrawingPaths(paths: Map<number, DrawingPath[]>) {
    this.drawingPaths = new Map(paths);
  }

  setShapeObjects(shapes: Map<number, ShapeObject[]>) {
    this.shapeObjects = new Map(shapes);
  }

  async exportToPDF(): Promise<Uint8Array> {
    if (!this.originalPdfBytes) {
      throw new Error('No original PDF loaded');
    }

    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(this.originalPdfBytes);
      const pages = pdfDoc.getPages();

      // Add drawings and shapes to each page
      for (let pageNumber = 1; pageNumber <= pages.length; pageNumber++) {
        const page = pages[pageNumber - 1]; // PDF pages are 0-indexed
        
        // Add drawing paths
        const paths = this.drawingPaths.get(pageNumber) || [];
        if (paths.length > 0) {
          await this.addDrawingsToPage(page, paths);
        }
        
        // Add shape objects
        const shapes = this.shapeObjects.get(pageNumber) || [];
        if (shapes.length > 0) {
          await this.addShapesToPage(page, shapes);
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

  private async addShapesToPage(page: any, shapes: ShapeObject[]) {
    const { width, height } = page.getSize();

    for (const shape of shapes) {
      const color = this.hexToRgb(shape.fill || shape.stroke || '#2D3748');
      
      switch (shape.type) {
        case 'text':
          if (shape.text) {
            page.drawText(shape.text, {
              x: shape.x,
              y: height - shape.y - (shape.fontSize || 16), // Flip Y and account for text height
              size: shape.fontSize || 16,
              color: rgb(color.r, color.g, color.b),
            });
          }
          break;
        
        case 'rectangle':
          const rectWidth = shape.width || 100;
          const rectHeight = shape.height || 60;
          page.drawRectangle({
            x: shape.x,
            y: height - shape.y - rectHeight, // Flip Y coordinate
            width: rectWidth,
            height: rectHeight,
            borderColor: rgb(color.r, color.g, color.b),
            borderWidth: shape.strokeWidth || 2,
          });
          break;
        
        case 'circle':
          const radius = (shape.width || 60) / 2;
          page.drawCircle({
            x: shape.x + radius,
            y: height - shape.y - radius, // Flip Y coordinate
            size: radius,
            borderColor: rgb(color.r, color.g, color.b),
            borderWidth: shape.strokeWidth || 2,
          });
          break;
        
        case 'arrow':
          if (shape.points && shape.points.length === 4) {
            const [x1, y1, x2, y2] = shape.points;
            // Draw arrow as a line (PDF-lib doesn't have built-in arrow support)
            page.moveTo(x1, height - y1);
            page.lineTo(x2, height - y2);
            page.setStrokeColor(rgb(color.r, color.g, color.b));
            page.setLineWidth(shape.strokeWidth || 2);
            page.stroke();
            
            // Add simple arrowhead
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const arrowLength = 10;
            const arrowAngle = Math.PI / 6;
            
            const arrowX1 = x2 - arrowLength * Math.cos(angle - arrowAngle);
            const arrowY1 = y2 - arrowLength * Math.sin(angle - arrowAngle);
            const arrowX2 = x2 - arrowLength * Math.cos(angle + arrowAngle);
            const arrowY2 = y2 - arrowLength * Math.sin(angle + arrowAngle);
            
            page.moveTo(x2, height - y2);
            page.lineTo(arrowX1, height - arrowY1);
            page.moveTo(x2, height - y2);
            page.lineTo(arrowX2, height - arrowY2);
            page.stroke();
          }
          break;
      }
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
