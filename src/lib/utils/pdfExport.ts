import { PDFDocument, PDFPage, degrees, rgb, StandardFonts } from 'pdf-lib';
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
			
			for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
				const canvas = this.canvasElements.get(pageNum);
				
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
						// Fall back to blank page only if copy fails
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
					// Try to copy original page instead of creating blank
					if (originalDoc && pageNum <= originalDoc.getPageCount()) {
						try {
							const [copiedPage] = await newDoc.copyPages(originalDoc, [pageNum - 1]);
							newDoc.addPage(copiedPage);
							pagesCopied++;
							console.log(`[PDFExport:Fallback] Page ${pageNum}: Copied from original PDF (no canvas)`);
							continue;
						} catch (copyError) {
							console.warn(`[PDFExport:Fallback] Failed to copy page ${pageNum} from original:`, copyError);
						}
					}
					// Fall back to blank page only if copy fails
					console.warn(`[PDFExport:Fallback] No canvas found for page ${pageNum}, creating blank page`);
					newDoc.addPage([612, 792]);
					blankPagesCreated++;
				}
			}
			
			console.log(`[PDFExport:Fallback] ✓ Fallback export complete: ${pagesEmbedded} canvas pages, ${pagesCopied} copied pages, ${blankPagesCreated} blank pages`);
			const pdfBytes = await newDoc.save();
			console.log(`[PDFExport:Fallback] ✓ Fallback PDF saved (${(pdfBytes.length / 1024).toFixed(2)} KB) - NOTE: This is RASTER, not vector!`);
			return pdfBytes;
		} catch (fallbackError) {
			console.error('[PDFExport:Fallback] ✗ Fallback export failed', fallbackError);
			throw new Error(`Failed to export fallback PDF: ${fallbackError}`, { cause: fallbackError });
		}
	}
	
	private extractPathFromStamp(svgString: string): { pathData: string, fill: string, stroke: string, strokeWidth: number } | null {
		// Extract path elements and parse attributes regardless of order
		const pathTagRegex = /<path[^>]*>/g;
		let match;
		
		while ((match = pathTagRegex.exec(svgString)) !== null) {
			const pathTag = match[0];
			
			// Extract attributes by name
			const dMatch = /d="([^"]+)"/.exec(pathTag);
			const fillMatch = /fill="([^"]+)"/.exec(pathTag);
			const strokeMatch = /stroke="([^"]+)"/.exec(pathTag);
			const strokeWidthMatch = /stroke-width="([^"]+)"/.exec(pathTag);
			
			if (dMatch && strokeMatch) {
				const fill = fillMatch ? fillMatch[1] : 'none';
				const stroke = strokeMatch[1];
				const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 1.5;
				
				// Return the first element that has a visible color (not white background/shadow)
				const hasColoredFill = fill !== 'none' && fill !== 'white';
				const hasColoredStroke = stroke !== 'none' && stroke !== 'white';
				
				if (hasColoredFill || hasColoredStroke) {
					return { pathData: dMatch[1], fill, stroke, strokeWidth };
				}
			}
		}
		
		return null;
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
		// Match embedCanvasInPage / createMergedCanvasWithAnnotations approach exactly:
		// 1. Get unrotated (base) page dimensions
		// 2. Swap dimensions for 90°/270° and reset /Rotate to 0
		// 3. Use transformPoint to convert base coords → rotated display coords
		// 4. Text rotation = pageRotation + annotation.rotation (cancels to 0 for upright text)
		// This is identical to how the canvas export renders, just using pdf-lib primitives.
		const originalSize = page.getSize();
		const baseWidth = originalSize.width;
		const baseHeight = originalSize.height;

		// Swap page dimensions for 90°/270° and reset rotation, same as embedCanvasInPage
		const isRotated90or270 = (rotationDegrees / 90) % 2 !== 0;
		const displayWidth = isRotated90or270 ? baseHeight : baseWidth;
		const displayHeight = isRotated90or270 ? baseWidth : baseHeight;

		if (isRotated90or270) {
			page.setSize(displayWidth, displayHeight);
		}
		page.setRotation(degrees(0));

		console.log(`[PDFExport:Native] Drawing annotations on page (base ${baseWidth}x${baseHeight}pt → display ${displayWidth}x${displayHeight}pt, rotation: ${rotationDegrees}°)`);

		// pdf-lib Y-flip: origin is bottom-left, viewer origin is top-left
		const flipY = (y: number) => displayHeight - y;

		// Transform a point from base (rotation-0) coords to rotated display coords, then flip Y for PDF.
		// This matches exactly what the canvas export does with transformPoint.
		const toPdf = (baseX: number, baseY: number) => {
			const rotated = transformPoint(
				baseX, baseY,
				rotationDegrees as 0 | 90 | 180 | 270,
				baseWidth, baseHeight
			);
			return { x: rotated.x, y: flipY(rotated.y) };
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
			
			// Drawing paths are stored in base viewport coordinates (PDF points at scale 1.0, rotation 0)
			// Transform to rotated display coords via toPdf (same as canvas export)
			const lineWidthPt = path.lineWidth;

			console.log(`[PDFExport:Native] Path: ${path.tool} with ${path.points.length} points, width ${lineWidthPt.toFixed(1)}pt, opacity ${opacity} (VECTOR)`);

			for (let i = 1; i < path.points.length; i++) {
				const prev = toPdf(path.points[i - 1].x, path.points[i - 1].y);
				const curr = toPdf(path.points[i].x, path.points[i].y);

				page.drawLine({
					start: prev,
					end: curr,
					thickness: lineWidthPt,
					color: pdfColor,
					opacity: opacity,
				});
			}
		}

		// 2. Draw Text Annotations (VECTOR - uses embedded fonts)
		for (const textMod of annotations.textAnnotations) {
			const font = await this.loadCustomFont(pdfDoc, textMod.fontFamily);
			const rgbColor = this.hexToRgb(textMod.color);

			// Get base coordinates and transform to rotated display space
			const baseX = textMod.x !== undefined ? textMod.x : textMod.relativeX * baseWidth;
			const baseY = textMod.y !== undefined ? textMod.y : textMod.relativeY * baseHeight;
			const pos = toPdf(baseX, baseY);

			// Combined rotation = pageRotation + annotation.rotation
			// annotation.rotation stores -pageRotation, so this cancels to 0 for upright text.
			// This matches the canvas export: ctx.rotate((currentRotation + annotation.rotation) * Math.PI / 180)
			const combinedRotation = rotationDegrees + (textMod.rotation ?? 0);
			const rotRad = (combinedRotation * Math.PI) / 180;
			const lineHeight = textMod.fontSize * 1.2;
			const lines = textMod.text.split('\n');

			console.log(`[PDFExport:Native] Text at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) size ${textMod.fontSize}pt, combinedRotation ${combinedRotation}° (VECTOR)`);
			lines.forEach((line, index) => {
				// Offset each line downward from anchor, rotated if text has rotation
				const dy = -(textMod.fontSize + index * lineHeight);
				const off = rotateOffset(0, dy, rotRad);

				page.drawText(line, {
					x: pos.x + off.x,
					y: pos.y + off.y,
					size: textMod.fontSize,
					font: font,
					color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
					rotate: degrees(combinedRotation)
				});
			});
		}

		// 3. Draw Sticky Notes (VECTOR - shapes + text)
		for (const note of annotations.stickyNotes) {
			const font = await this.loadCustomFont(pdfDoc, note.fontFamily);
			const bgRgb = this.hexToRgb(note.backgroundColor);

			// Get base coordinates and transform to rotated display space
			const baseX = note.x !== undefined ? note.x : note.relativeX * baseWidth;
			const baseY = note.y !== undefined ? note.y : note.relativeY * baseHeight;
			const pos = toPdf(baseX, baseY);

			const noteWidth = note.relativeWidth * baseWidth;
			const noteHeight = note.relativeHeight * baseHeight;
			// Combined rotation cancels to 0 for upright notes (same as text)
			const combinedRotation = rotationDegrees + (note.rotation ?? 0);
			const rotRad = (combinedRotation * Math.PI) / 180;

			// Rectangle bottom-left corner (pos is top-left in PDF-space after flip)
			const rectOff = rotateOffset(0, -noteHeight, rotRad);

			console.log(`[PDFExport:Native] Sticky Note: ${noteWidth.toFixed(1)}x${noteHeight.toFixed(1)}pt, combinedRotation ${combinedRotation}° (VECTOR)`);

			page.drawRectangle({
				x: pos.x + rectOff.x,
				y: pos.y + rectOff.y,
				width: noteWidth,
				height: noteHeight,
				color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
				opacity: 0.9,
				rotate: degrees(combinedRotation)
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
					rotate: degrees(combinedRotation)
				});
			}
		}

		// 4. Draw Arrows (VECTOR - lines + paths)
		for (const arrow of annotations.arrowAnnotations) {
			const rgbColor = this.hexToRgb(arrow.stroke);
			const pdfColor = rgb(rgbColor.r, rgbColor.g, rgbColor.b);

			const sAbs = relToBase(arrow.relativeX1, arrow.relativeY1);
			const eAbs = relToBase(arrow.relativeX2, arrow.relativeY2);
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
				const angle = Math.atan2(end.y - start.y, end.x - start.x);
				const arrowLength = arrow.strokeWidth * 3;
				const x3 = end.x - arrowLength * Math.cos(angle - Math.PI / 6);
				const y3 = end.y - arrowLength * Math.sin(angle - Math.PI / 6);
				const x4 = end.x - arrowLength * Math.cos(angle + Math.PI / 6);
				const y4 = end.y - arrowLength * Math.sin(angle + Math.PI / 6);

				page.drawSvgPath(`M ${end.x} ${end.y} L ${x3} ${y3} L ${x4} ${y4} Z`, {
					color: pdfColor,
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

			const sAbs = relToBase(stamp.relativeX, stamp.relativeY);
			const pos = toPdf(sAbs.x, sAbs.y);
			const stampSize = stamp.relativeSize * Math.min(baseWidth, baseHeight);

			// Combined rotation = pageRotation + stamp.rotation (cancels to 0 for upright stamps)
			// stamp.rotation stores -pageRotation, matching text/sticky note behavior
			const combinedRotation = rotationDegrees + (stamp.rotation ?? 0);

			console.log(`[PDFExport:Native] Stamp: ${stamp.stampId} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), size ${stampSize.toFixed(1)}pt, combinedRotation ${combinedRotation}° (VECTOR)`);

			const parsedSvg = this.extractPathFromStamp(stampDef.svg);
			if (parsedSvg) {
				const rgbStroke = this.hexToRgb(parsedSvg.stroke);
				const scaleFactor = stampSize / 100;
				const isStrokeOnly = parsedSvg.fill === 'none';

				if (isStrokeOnly) {
					// Stroke-only stamps (checkmarks, x-marks, etc.)
					page.drawSvgPath(parsedSvg.pathData, {
						x: pos.x,
						y: pos.y,
						scale: scaleFactor,
						rotate: degrees(combinedRotation),
						borderColor: rgb(rgbStroke.r, rgbStroke.g, rgbStroke.b),
						borderWidth: parsedSvg.strokeWidth
					});
				} else {
					// Filled stamps (stars, hearts, smileys, etc.)
					const rgbFill = this.hexToRgb(parsedSvg.fill);
					page.drawSvgPath(parsedSvg.pathData, {
						x: pos.x,
						y: pos.y,
						scale: scaleFactor,
						rotate: degrees(combinedRotation),
						color: rgb(rgbFill.r, rgbFill.g, rgbFill.b),
						borderColor: rgb(rgbStroke.r, rgbStroke.g, rgbStroke.b),
						borderWidth: parsedSvg.strokeWidth
					});
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
