import { PDFDocument, PDFPage, LineCapStyle, LineJoinStyle, BlendMode, degrees, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauriUtils';
import type { 
	DrawingPath, 
	TextAnnotation, 
	ArrowAnnotation, 
	StickyNoteAnnotation, 
	StampAnnotation
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

// Font family to asset path mapping
const FONT_ASSETS: { [key: string]: string } = {
	'ReenieBeanie': '/fonts/ReenieBeanie.ttf',
	'Inter': '/fonts/inter-v20-latin-regular.woff2',
	'Lora': '/fonts/additional-fonts/Lora-VariableFont_wght.woff2',
	'Urbanist': '/fonts/additional-fonts/Urbanist-Regular.woff2',
	'Dancing Script': '/fonts/dancing-script-v29-latin-600.woff2'
};

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

		console.log('[PDFExport] Starting native vector export...');
		console.log(`[PDFExport] Pages with annotations: ${this.pageAnnotations.size}`);
		console.log(`[PDFExport] Pages with canvas fallback: ${this.canvasElements.size}`);

		// Primary path: load original PDF and overlay canvases / vectors
		try {
			const pdfDoc = await PDFDocument.load(this.originalPdfBytes, { ignoreEncryption: true });
			pdfDoc.registerFontkit(fontkit);
			console.log('[PDFExport] ✓ Loaded original PDF and registered fontkit');
			
			const pages = pdfDoc.getPages();
			let nativeAnnotationCount = 0;
			let canvasFallbackCount = 0;
			
			for (let pageNumber = 1; pageNumber <= pages.length; pageNumber++) {
				const page = pages[pageNumber - 1];
				const rotation = this.rotations.get(pageNumber) || 0;

				const annotations = this.pageAnnotations.get(pageNumber);
				if (annotations) {
					// Draw annotations using native vector graphics
					console.log(`[PDFExport] Page ${pageNumber}: Rendering ${annotations.drawingPaths.length} paths, ${annotations.textAnnotations.length} text, ${annotations.stickyNotes.length} sticky notes, ${annotations.stampAnnotations.length} stamps, ${annotations.arrowAnnotations.length} arrows (VECTOR)`);
					await this.drawAnnotationsNatively(pdfDoc, page, annotations, rotation);
					nativeAnnotationCount++;
				} else {
					// Fallback to canvas embedding if annotations weren't provided natively
					// This maintains backwards compatibility for exportHandlers
					const canvas = this.canvasElements.get(pageNumber);
					if (canvas) {
						console.log(`[PDFExport] Page ${pageNumber}: Using canvas fallback (RASTER)`);
						await this.embedCanvasInPage(pdfDoc, page, canvas, rotation);
						canvasFallbackCount++;
					} else {
						// No annotations and no canvas: just apply the page rotation
						page.setRotation(degrees(rotation));
						console.log(`[PDFExport] Page ${pageNumber}: No annotations or canvas, applied rotation ${rotation}°`);
					}
				}
			}
			
			console.log(`[PDFExport] ✓ Native export successful: ${nativeAnnotationCount} pages with vector annotations, ${canvasFallbackCount} pages with raster canvas`);
			const pdfBytes = await pdfDoc.save();
			console.log(`[PDFExport] ✓ PDF saved successfully (${(pdfBytes.length / 1024).toFixed(2)} KB)`);
			return pdfBytes;
		} catch (primaryError) {
			console.error('[PDFExport] ✗ Native export failed. Falling back to canvas-only merge.', primaryError);
			console.log(`[PDFExport] Fallback reason: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
			// Fallback path: build a brand-new PDF composed from merged canvases
			return this.fallbackCanvasExport();
		}
	}

	private async fallbackCanvasExport(): Promise<Uint8Array> {
		console.log('[PDFExport:Fallback] Starting canvas-only export (RASTER MODE)...');
		try {
			const newDoc = await PDFDocument.create();
			
			// Try to load original PDF for copying pages when canvas is missing
			let originalDoc: PDFDocument | null = null;
			let pageCount = this.canvasElements.size;
			
			if (this.originalPdfBytes) {
				try {
					originalDoc = await PDFDocument.load(this.originalPdfBytes, { ignoreEncryption: true });
					pageCount = Math.max(pageCount, originalDoc.getPageCount());
					console.log(`[PDFExport:Fallback] Original PDF has ${originalDoc.getPageCount()} pages`);
				} catch (e) {
					console.warn('[PDFExport:Fallback] Could not load original PDF for page count', e);
				}
			}
			
			if (pageCount === 0) {
				throw new Error('No rendered pages available for export');
			}
			
			console.log(`[PDFExport:Fallback] Creating ${pageCount} pages from canvas elements`);
			
			// Create pages for all pages in the document
			let pagesEmbedded = 0;
			let pagesCopied = 0;
			let blankPagesCreated = 0;
			let pagesSkippedAnnotated = 0;

			for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
				const canvas = this.canvasElements.get(pageNum);
				const hasAnnotations = this.pageAnnotations.has(pageNum);
				
				// Helper to check for existing PDF annotations on the original document
				let hasNativePDFAnnotations = false;
				if (originalDoc && pageNum <= originalDoc.getPageCount()) {
					try {
						const origPage = originalDoc.getPage(pageNum - 1);
						const annots = origPage.node.Annots();
						if (annots && annots.size() > 0) {
							hasNativePDFAnnotations = true;
						}
					} catch (e) {
						// Ignore
					}
				}
				
				if (canvas) {
					// Validate canvas dimensions
					if (!Number.isFinite(canvas.width) || canvas.width <= 0 || !Number.isFinite(canvas.height) || canvas.height <= 0) {
						console.warn(`[PDFExport:Fallback] Invalid canvas dimensions for page ${pageNum}: ${canvas.width}x${canvas.height}`);
						// Try to copy original page instead of creating blank
						if (originalDoc && pageNum <= originalDoc.getPageCount()) {
							try {
								const [copiedPage] = await newDoc.copyPages(originalDoc, [pageNum - 1]);
								newDoc.addPage(copiedPage);
								pagesCopied++;
								console.log(`[PDFExport:Fallback] Page ${pageNum}: Copied from original PDF (invalid canvas)`);
								continue;
							} catch (copyError) {
								console.warn(`[PDFExport:Fallback] Failed to copy page ${pageNum} from original:`, copyError);
							}
						}
						// If we couldn't copy and it has native PDF annotations, skip to prevent dataloss
						if (hasNativePDFAnnotations || hasAnnotations) {
							console.warn(`[PDFExport:Fallback] Page ${pageNum} has annotations but invalid canvas and could not be copied. Skipping page creation to prevent annotation loss.`);
							pagesSkippedAnnotated++;
							continue;
						}
						// Fall back to blank page only if no annotations are lost
						newDoc.addPage([612, 792]);
						blankPagesCreated++;
						continue;
					}

					console.log(`[PDFExport:Fallback] Page ${pageNum}: Embedding canvas (${canvas.width}x${canvas.height}px)`);
					const page = newDoc.addPage([
						PDFExporter.pixelsToPoints(canvas.width),
						PDFExporter.pixelsToPoints(canvas.height)
					]);

					const pageRotation = this.rotations.get(pageNum) || 0;
					await this.embedCanvasInPage(newDoc, page, canvas, pageRotation);
					pagesEmbedded++;
				} else {
					// Check if this page has native annotations that would be lost
					if (hasAnnotations) {
						// Page has drawn annotations but no canvas - this is an error condition
						throw new Error(`Page ${pageNum} has annotations but no rasterized canvas. Cannot export without losing annotations. Please ensure all annotated pages are rendered before export.`);
					}
					
					// No app annotations and no canvas - safe to copy original page
					if (originalDoc && pageNum <= originalDoc.getPageCount()) {
						try {
							const [copiedPage] = await newDoc.copyPages(originalDoc, [pageNum - 1]);
							newDoc.addPage(copiedPage);
							pagesCopied++;
							console.log(`[PDFExport:Fallback] Page ${pageNum}: Copied from original PDF (no canvas, no annotations)`);
							continue;
						} catch (copyError) {
							console.warn(`[PDFExport:Fallback] Failed to copy page ${pageNum} from original:`, copyError);
						}
					}
					
					// If we couldn't copy and the original PDF page had existing annotations, do not drop them by inserting a blank page
					if (hasNativePDFAnnotations) {
						console.warn(`[PDFExport:Fallback] Page ${pageNum} has existing native PDF annotations but no canvas and could not be copied. Skipping page creation to prevent annotation loss.`);
						pagesSkippedAnnotated++;
						continue;
					}
					
					// Fall back to blank page only if copy fails and there's no annotations to lose
					console.warn(`[PDFExport:Fallback] No canvas found for page ${pageNum}, creating blank page`);
					newDoc.addPage([612, 792]);
					blankPagesCreated++;
				}
			}
			
			console.log(`[PDFExport:Fallback] ✓ Fallback export complete: ${pagesEmbedded} canvas pages, ${pagesCopied} copied pages, ${blankPagesCreated} blank pages, ${pagesSkippedAnnotated} pages skipped to preserve annotations`);
			const pdfBytes = await newDoc.save();
			console.log(`[PDFExport:Fallback] ✓ Fallback PDF saved (${(pdfBytes.length / 1024).toFixed(2)} KB) - NOTE: This is RASTER, not vector!`);
			return pdfBytes;
		} catch (fallbackError) {
			console.error('[PDFExport:Fallback] ✗ Fallback export failed', fallbackError);
			throw new Error(`Failed to export fallback PDF: ${fallbackError}`, { cause: fallbackError });
		}
	}
	
	private convertShapesToPaths(svgString: string): string {
		let result = svgString.replace(/<circle([^>]*)>/g, (match, attrs) => {
			const cxMatch = /cx="([^"]+)"/.exec(attrs);
			const cyMatch = /cy="([^"]+)"/.exec(attrs);
			const rMatch = /r="([^"]+)"/.exec(attrs);
			if (!cxMatch || !cyMatch || !rMatch) return match;
			
			const cx = parseFloat(cxMatch[1]);
			const cy = parseFloat(cyMatch[1]);
			const r = parseFloat(rMatch[1]);
			
			const d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`;
			return `<path d="${d}" ${attrs} />`;
		});

		result = result.replace(/<ellipse([^>]*)>/g, (match, attrs) => {
			const cxMatch = /cx="([^"]+)"/.exec(attrs);
			const cyMatch = /cy="([^"]+)"/.exec(attrs);
			const rxMatch = /rx="([^"]+)"/.exec(attrs);
			const ryMatch = /ry="([^"]+)"/.exec(attrs);
			if (!cxMatch || !cyMatch || !rxMatch || !ryMatch) return match;
			
			const cx = parseFloat(cxMatch[1]);
			const cy = parseFloat(cyMatch[1]);
			const rx = parseFloat(rxMatch[1]);
			const ry = parseFloat(ryMatch[1]);
			
			const d = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
			return `<path d="${d}" ${attrs} />`;
		});

		return result;
	}

	private extractPathsFromStamp(svgString: string): Array<{ pathData: string, fill: string, stroke: string, strokeWidth: number }> {
		const convertedSvg = this.convertShapesToPaths(svgString);
		const pathRegex = /<path([^>]*)>/g;
		let match;
		const paths = [];
		
		while ((match = pathRegex.exec(convertedSvg)) !== null) {
			const attrs = match[1];
			
			// Skip shadows/borders which we handle manually
			if (attrs.includes('filter=') || attrs.includes('stroke="white"') || attrs.includes('fill="white"')) {
				continue;
			}
			
			const dMatch = /d="([^"]+)"/.exec(attrs);
			const fillMatch = /fill="([^"]+)"/.exec(attrs);
			const strokeMatch = /stroke="([^"]+)"/.exec(attrs);
			const strokeWidthMatch = /stroke-width="([^"]+)"/.exec(attrs);
			
			if (dMatch) {
				const fill = fillMatch ? fillMatch[1] : 'none';
				const stroke = strokeMatch ? strokeMatch[1] : 'none';
				const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 1.5;
				
				const hasColoredFill = fill !== 'none' && fill !== 'white';
				const hasColoredStroke = stroke !== 'none' && stroke !== 'white' && strokeWidth > 0;
				
				if (hasColoredFill || hasColoredStroke) {
					paths.push({ 
						pathData: dMatch[1], 
						fill: hasColoredFill ? fill : 'none', 
						stroke: hasColoredStroke ? stroke : 'none', 
						strokeWidth: hasColoredStroke ? strokeWidth : 0
					});
				}
			}
		}
		return paths;
	}

	private async loadCustomFont(pdfDoc: PDFDocument, fontFamily: string) {
		// Provide fallback mapping for generic families
		if (fontFamily.includes('sans-serif')) {
			console.log(`[PDFExport:Font] ${fontFamily} → Helvetica (generic sans-serif)`);
			return pdfDoc.embedStandardFont(StandardFonts.Helvetica);
		}
		if (fontFamily.includes('serif') && !fontFamily.includes('sans-serif')) {
			console.log(`[PDFExport:Font] ${fontFamily} → Times Roman (generic serif)`);
			return pdfDoc.embedStandardFont(StandardFonts.TimesRoman);
		}
		if (fontFamily.includes('monospace')) {
			console.log(`[PDFExport:Font] ${fontFamily} → Courier (generic monospace)`);
			return pdfDoc.embedStandardFont(StandardFonts.Courier);
		}
		
		// Look up font path from mapping
		let fontPath = '';
		for (const [fontName, path] of Object.entries(FONT_ASSETS)) {
			if (fontFamily.includes(fontName)) {
				fontPath = path;
				break;
			}
		}
		
		// If no match found, use standard font
		if (!fontPath) {
			console.log(`[PDFExport:Font] ${fontFamily} → Helvetica (no custom font found)`);
			return pdfDoc.embedStandardFont(StandardFonts.Helvetica);
		}

		try {
			console.log(`[PDFExport:Font] Fetching custom font: ${fontFamily} from ${fontPath}`);
			const response = await fetch(fontPath);
			if (!response.ok) {
				throw new Error(`Failed to fetch font: HTTP ${response.status} for ${fontPath}`);
			}
			const fontBytes = await response.arrayBuffer();
			const embeddedFont = await pdfDoc.embedFont(fontBytes);
			console.log(`[PDFExport:Font] ✓ Successfully embedded custom font: ${fontFamily} (${(fontBytes.byteLength / 1024).toFixed(2)} KB)`);
			return embeddedFont;
		} catch (e) {
			console.warn(`[PDFExport:Font] ✗ Failed to embed ${fontFamily}, falling back to Helvetica:`, e instanceof Error ? e.message : String(e));
			return pdfDoc.embedStandardFont(StandardFonts.Helvetica);
		}
	}

	private async drawAnnotationsNatively(
		pdfDoc: PDFDocument,
		page: PDFPage,
		annotations: PageAnnotations,
		rotationDegrees: number
	) {
		// Use getCropBox() instead of getSize() to handle PDFs where the origin is not (0,0)
		const cropBox = page.getCropBox();
		const baseWidth = cropBox.width;
		const baseHeight = cropBox.height;

		// We explicitly set the page rotation to whatever the user set visually in the viewer.
		// This ensures the original PDF content is visually rotated by the viewer correctly without clipping.
		// We DO NOT swap the page size (width/height), we let the PDF viewer handle the rotation.
		page.setRotation(degrees(rotationDegrees));

		console.log(`[PDFExport:Native] Drawing annotations on page (base ${baseWidth}x${baseHeight}pt, cropBox offset ${cropBox.x},${cropBox.y}, rotation set to: ${rotationDegrees}°)`);

		// The annotations are stored in unrotated base viewport coordinates.
		// Since we're drawing them onto the original unrotated page bounds and letting the viewer rotate it,
		// we just map the coordinates from top-left (web) to bottom-left (PDF).
		// We must also account for any cropBox offsets.
		const toPdf = (baseX: number, baseY: number) => {
			return { x: cropBox.x + baseX, y: cropBox.y + (baseHeight - baseY) };
		};

		// Convert relative coordinates (0-1) to base page coordinates (points)
		// Relative values are normalized to the unrotated page dimensions
		const relToBase = (relX: number, relY: number) => ({
			x: relX * baseWidth,
			y: relY * baseHeight
		});

		// Rotate an offset vector by angle (for placing lines within rotated text blocks)
		const rotateOffset = (dx: number, dy: number, rad: number) => ({
			x: dx * Math.cos(rad) - dy * Math.sin(rad),
			y: dx * Math.sin(rad) + dy * Math.cos(rad)
		});

		// 1. Draw Paths (Freehand / Highlighters - VECTOR)
		for (const path of annotations.drawingPaths) {
			if (!path.points || path.points.length < 2) continue;
			
			const rgbColor = this.hexToRgb(path.highlightColor || path.color);
			const pdfColor = rgb(rgbColor.r, rgbColor.g, rgbColor.b);
			const opacity = path.highlightOpacity ?? (path.tool === 'highlight' ? 0.4 : 1);
			// Apply the same lineWidth multiplier as the canvas renderer
			const lineWidthPt = path.tool === 'highlight' ? path.lineWidth * 3 : path.lineWidth;

			console.log(`[PDFExport:Native] Path: ${path.tool} with ${path.points.length} points, width ${lineWidthPt.toFixed(1)}pt, opacity ${opacity} (VECTOR)`);

			// Build a single SVG path string so that all segments are joined with
			// round line caps/joins, exactly like the canvas renderer.
			// We use x=cropBox.x, y=cropBox.y+baseHeight so the SVG coord (px, py) maps to
			// PDF coord (cropBox.x + px, cropBox.y + baseHeight - py), which is our standard Y-flip with offset.
			const pts = path.points.map((p) => ({
				x: p.relativeX !== undefined ? p.relativeX * baseWidth : p.x,
				y: p.relativeY !== undefined ? p.relativeY * baseHeight : p.y
			}));

			let svgPath = `M ${pts[0].x} ${pts[0].y}`;
			// Duplicate the quadratic curve logic from drawingUtils.ts to match smoothness
			for (let i = 1; i < pts.length - 1; i++) {
				const currentPoint = pts[i];
				const nextPoint = pts[i + 1];

				const midPoint = {
					x: (currentPoint.x + nextPoint.x) / 2,
					y: (currentPoint.y + nextPoint.y) / 2
				};

				// SVG Q command: control-point-x control-point-y end-point-x end-point-y
				svgPath += ` Q ${currentPoint.x} ${currentPoint.y} ${midPoint.x} ${midPoint.y}`;
			}
			
			// Draw to the last point if we have more than 1 point
			if (pts.length > 1) {
				const lastPoint = pts[pts.length - 1];
				svgPath += ` L ${lastPoint.x} ${lastPoint.y}`;
			}

			page.drawSvgPath(svgPath, {
				x: cropBox.x,
				y: cropBox.y + baseHeight, // Y-flip: SVG (px, py) → PDF (px, baseHeight - py) with crop offset
				borderColor: pdfColor,
				borderWidth: lineWidthPt,
				borderOpacity: opacity,
				borderLineCap: LineCapStyle.Round,
				blendMode: path.tool === 'highlight' ? BlendMode.Multiply : BlendMode.Normal,
			});
		}

		// 2. Draw Text Annotations (VECTOR - uses embedded fonts)
		for (const textMod of annotations.textAnnotations) {
			const font = await this.loadCustomFont(pdfDoc, textMod.fontFamily);
			const rgbColor = this.hexToRgb(textMod.color);

			// Always use relative coords mapped to PDF dimensions – the x/y pixel
			// fields are CSS-display-space and depend on the viewer zoom at the time
			// of creation, which can differ from PDF native point space.
			const baseX = textMod.relativeX * baseWidth;
			const baseY = textMod.relativeY * baseHeight;
			const pos = toPdf(baseX, baseY);

			// text.rotation is already the relative rotation needed on the base page to achieve the visual effect.
			// pdf-lib's drawText rotation is CCW positive, while our app's rotation is CW positive.
			const pdfRotation = -(textMod.rotation ?? 0);
			const rotRad = (pdfRotation * Math.PI) / 180;
			const lineHeight = textMod.fontSize * 1.2;
			
			// Handle width-aware wrapping if width is set
			let linesToDraw: string[];
			const textWidth = textMod.width !== undefined ? textMod.width : (textMod.relativeWidth !== undefined ? textMod.relativeWidth * baseWidth : undefined);
			
			if (textWidth) {
				// Wrap text to fit within width
				const padding = 4; // Small padding
				const maxWidth = textWidth - (padding * 2);
				const rawLines = textMod.text.split('\n');
				linesToDraw = [];
				
				for (const line of rawLines) {
					const words = line.split(' ');
					let currentLine = '';
					
					for (const word of words) {
						const testLine = currentLine ? `${currentLine} ${word}` : word;
						const testWidth = font.widthOfTextAtSize(testLine, textMod.fontSize);
						
						if (testWidth > maxWidth && currentLine) {
							linesToDraw.push(currentLine);
							currentLine = word;
						} else {
							currentLine = testLine;
						}
					}
					if (currentLine) linesToDraw.push(currentLine);
				}
			} else {
				linesToDraw = textMod.text.split('\n');
			}
			
			// Handle height-aware clipping if height is set
			const textHeight = textMod.height !== undefined ? textMod.height : (textMod.relativeHeight !== undefined ? textMod.relativeHeight * baseHeight : undefined);
			if (textHeight) {
				const padding = 4;
				const maxLines = Math.max(0, Math.floor((textHeight - padding * 2) / lineHeight));
				linesToDraw = linesToDraw.slice(0, maxLines);
			}

			console.log(`[PDFExport:Native] Text at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) size ${textMod.fontSize}pt, ${linesToDraw.length} lines, baseRotation ${textMod.rotation ?? 0}° (VECTOR)`);
			linesToDraw.forEach((line, index) => {
				// We want the first line's baseline to be about 0.85 * fontSize below the top of the container
				// to closely match how the browser renders HTML text without arbitrary padding.
				const dy = -(textMod.fontSize * 0.85 + index * lineHeight);
				const off = rotateOffset(0, dy, rotRad);

				page.drawText(line, {
					x: pos.x + off.x,
					y: pos.y + off.y,
					size: textMod.fontSize,
					font: font,
					color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
					rotate: degrees(pdfRotation)
				});
			});
		}

		// 3. Draw Sticky Notes (VECTOR - shapes + text)
		for (const note of annotations.stickyNotes) {
			const font = await this.loadCustomFont(pdfDoc, note.fontFamily);
			const bgRgb = this.hexToRgb(note.backgroundColor);

			// Always use relative coords mapped to PDF dimensions.
			const baseX = note.relativeX * baseWidth;
			const baseY = note.relativeY * baseHeight;
			const pos = toPdf(baseX, baseY);

			const noteWidth = note.relativeWidth * baseWidth;
			const noteHeight = note.relativeHeight * baseHeight;
			// note.rotation is already the relative rotation needed on the base page to achieve the visual effect.
			const pdfRotation = -(note.rotation ?? 0);
			const rotRad = (pdfRotation * Math.PI) / 180;

			// Rectangle bottom-left corner (pos is top-left in PDF-space after flip)
			const rectOff = rotateOffset(0, -noteHeight, rotRad);

			console.log(`[PDFExport:Native] Sticky Note: ${noteWidth.toFixed(1)}x${noteHeight.toFixed(1)}pt, baseRotation ${note.rotation ?? 0}° (VECTOR)`);

			page.drawRectangle({
				x: pos.x + rectOff.x,
				y: pos.y + rectOff.y,
				width: noteWidth,
				height: noteHeight,
				color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
				opacity: 0.9,
				rotate: degrees(pdfRotation)
			});

			const padding = 10;
			const lineHeight = note.fontSize * 1.2;
			const maxWidth = noteWidth - (padding * 2);
			const maxLines = Math.max(0, Math.floor((noteHeight - padding * 2) / lineHeight));

			const lines = note.text.split('\n');
			const wrappedLines: string[] = [];
			for (const line of lines) {
				const words = line.split(' ');
				let currentLine = '';
				for (const word of words) {
					const testLine = currentLine ? `${currentLine} ${word}` : word;
					const testWidth = font.widthOfTextAtSize(testLine, note.fontSize);
					if (testWidth > maxWidth && currentLine) {
						wrappedLines.push(currentLine);
						currentLine = word;
					} else {
						currentLine = testLine;
					}
				}
				if (currentLine) wrappedLines.push(currentLine);
			}

			for (let i = 0; i < wrappedLines.length && i < maxLines; i++) {
				const dy = -(padding + note.fontSize + i * lineHeight);
				const off = rotateOffset(padding, dy, rotRad);

				page.drawText(wrappedLines[i], {
					x: pos.x + off.x,
					y: pos.y + off.y,
					size: note.fontSize,
					font: font,
					color: rgb(0, 0, 0),
					rotate: degrees(pdfRotation)
				});
			}
		}

		// 4. Draw Arrows (VECTOR - lines + paths)
		for (const arrow of annotations.arrowAnnotations) {
			const rgbColor = this.hexToRgb(arrow.stroke);
			const pdfColor = rgb(rgbColor.r, rgbColor.g, rgbColor.b);

			const safeX1 = arrow.relativeX1 ?? 0;
			const safeY1 = arrow.relativeY1 ?? 0;
			const safeX2 = arrow.relativeX2 ?? safeX1;
			const safeY2 = arrow.relativeY2 ?? safeY1;

			const sAbs = relToBase(safeX1, safeY1);
			const eAbs = relToBase(safeX2, safeY2);
			const start = toPdf(sAbs.x, sAbs.y);
			const end = toPdf(eAbs.x, eAbs.y);

			console.log(`[PDFExport:Native] Arrow: from (${start.x.toFixed(1)}, ${start.y.toFixed(1)}) to (${end.x.toFixed(1)}, ${end.y.toFixed(1)}), width ${arrow.strokeWidth}px (VECTOR)`);

			page.drawLine({
				start,
				end,
				thickness: arrow.strokeWidth,
				color: pdfColor
			});

			if (arrow.arrowHead) {
				// Calculate angle using original Y-down space to match viewer exactly
				const angle = Math.atan2(eAbs.y - sAbs.y, eAbs.x - sAbs.x);
				const headLength = 10;
				
				// Points in Y-down space
				const x3 = eAbs.x - headLength * Math.cos(angle - Math.PI / 6);
				const y3 = eAbs.y - headLength * Math.sin(angle - Math.PI / 6);
				const x4 = eAbs.x - headLength * Math.cos(angle + Math.PI / 6);
				const y4 = eAbs.y - headLength * Math.sin(angle + Math.PI / 6);

				// pdf-lib's drawSvgPath maps (px, py) to (x + px*scale, y - py*scale).
				// By setting x=cropBox.x, y=cropBox.y+baseHeight, scale=1, it maps (px, py) to (cropBox.x + px, cropBox.y + baseHeight - py),
				// which exactly converts our Y-down web coordinates to Y-up PDF coordinates with crop offsets!
				page.drawSvgPath(`M ${eAbs.x} ${eAbs.y} L ${x3} ${y3} L ${x4} ${y4} Z`, {
					x: cropBox.x,
					y: cropBox.y + baseHeight,
					color: pdfColor,
					borderColor: pdfColor,
					borderWidth: 0
				});
			}
		}

		// 5. Draw Stamps (VECTOR - SVG paths)
		for (const stamp of annotations.stampAnnotations) {
			const stampDef = getStampById(stamp.stampId);
			if (!stampDef) {
				console.warn(`[PDFExport:Native] Stamp ID ${stamp.stampId} not found`);
				continue;
			}

			// Always prefer relative coords (scale-independent) mapped to PDF dimensions.
			const baseX = stamp.relativeX * baseWidth;
			const baseY = stamp.relativeY * baseHeight;
			
			// Calculate stamp size (same as canvas export)
			const MIN_SIZE = 16;
			const MAX_SIZE = 120;
			const stampSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE,
				stamp.size !== undefined ? stamp.size : stamp.relativeSize * Math.min(baseWidth, baseHeight)
			));

						// stamp.x and stamp.y are in base coordinates.
			const cxBase = baseX + stampSize / 2;
			const cyBase = baseY + stampSize / 2;
			
			// Convert base center to Y-up PDF unrotated space with crop offset
			const cxPdf = cropBox.x + cxBase;
			const cyPdf = cropBox.y + (baseHeight - cyBase);
			
			// stamp.rotation is already the relative rotation needed on the base page.
			const pdfRotation = -(stamp.rotation ?? 0);
			const radPdf = pdfRotation * Math.PI / 180;
			
			// Vector from center to SVG origin (-stampSize/2, +stampSize/2) in Y-up PDF space
			const vx = -stampSize / 2;
			const vy = stampSize / 2;
			
			// Rotate vector
			const vrx = vx * Math.cos(radPdf) - vy * Math.sin(radPdf);
			const vry = vx * Math.sin(radPdf) + vy * Math.cos(radPdf);
			
			const drawX = cxPdf + vrx;
			const drawY = cyPdf + vry;

			console.log(`[PDFExport:Native] Stamp: ${stamp.stampId} at (${drawX.toFixed(1)}, ${drawY.toFixed(1)}), center (${cxPdf.toFixed(1)}, ${cyPdf.toFixed(1)}), size ${stampSize.toFixed(1)}pt, baseRotation ${stamp.rotation ?? 0}° (VECTOR)`);

			const parsedPaths = this.extractPathsFromStamp(stampDef.svg);
			if (parsedPaths && parsedPaths.length > 0) {
				const scaleFactor = stampSize / 100;
				for (const parsedSvg of parsedPaths) {
					const rgbStroke = this.hexToRgb(parsedSvg.stroke);
					const isStrokeOnly = parsedSvg.fill === 'none';

					if (isStrokeOnly) {
						// Stroke-only stamps (checkmarks, x-marks, etc.)
						page.drawSvgPath(parsedSvg.pathData, {
							x: drawX,
							y: drawY,
							scale: scaleFactor,
							rotate: degrees(pdfRotation),
							borderColor: rgb(rgbStroke.r, rgbStroke.g, rgbStroke.b),
							borderWidth: parsedSvg.strokeWidth
						});
					} else {
						// Filled stamps (stars, hearts, smileys, etc.)
						const rgbFill = this.hexToRgb(parsedSvg.fill);
						page.drawSvgPath(parsedSvg.pathData, {
							x: drawX,
							y: drawY,
							scale: scaleFactor,
							rotate: degrees(pdfRotation),
							color: rgb(rgbFill.r, rgbFill.g, rgbFill.b),
							borderColor: rgb(rgbStroke.r, rgbStroke.g, rgbStroke.b),
							borderWidth: parsedSvg.strokeWidth
						});
					}
				}
			}
		}
	}

	private async embedCanvasInPage(
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
		// Common named colors lookup
		const namedColors: { [key: string]: { r: number; g: number; b: number } } = {
			'red': { r: 1, g: 0, b: 0 },
			'green': { r: 0, g: 0.5, b: 0 },
			'blue': { r: 0, g: 0, b: 1 },
			'yellow': { r: 1, g: 1, b: 0 },
			'gold': { r: 1, g: 0.843, b: 0 },
			'white': { r: 1, g: 1, b: 1 },
			'black': { r: 0, g: 0, b: 0 }
		};
		
		// Check for named color
		const lowerHex = hex.toLowerCase();
		if (namedColors[lowerHex]) {
			return namedColors[lowerHex];
		}
		
		// Support both 3-digit (#RGB) and 6-digit (#RRGGBB) hex colors
		const result = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(hex);
		if (!result) {
			console.warn(`Invalid hex color: "${hex}", defaulting to black`);
			return { r: 0, g: 0, b: 0 }; // Default to black
		}

		const hexValue = result[1];
		let r, g, b;
		
		if (hexValue.length === 3) {
			// Expand 3-digit hex to 6-digit by repeating each character
			r = parseInt(hexValue[0] + hexValue[0], 16) / 255;
			g = parseInt(hexValue[1] + hexValue[1], 16) / 255;
			b = parseInt(hexValue[2] + hexValue[2], 16) / 255;
		} else {
			// Parse 6-digit hex
			r = parseInt(hexValue.substring(0, 2), 16) / 255;
			g = parseInt(hexValue.substring(2, 4), 16) / 255;
			b = parseInt(hexValue.substring(4, 6), 16) / 255;
		}

		return { r, g, b };
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
