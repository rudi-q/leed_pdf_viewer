import JSZip from 'jszip';
import type {
	DrawingPath,
	TextAnnotation,
	StickyNoteAnnotation,
	StampAnnotation,
	ArrowAnnotation,
	StampDefinition
} from '$lib/stores/drawingStore';
import {
	drawingPaths,
	textAnnotations,
	stickyNoteAnnotations,
	stampAnnotations,
	arrowAnnotations,
	availableStamps,
	setCurrentPDF,
	forceSaveAllAnnotations
} from '$lib/stores/drawingStore';
import { pdfState } from '$lib/stores/drawingStore';
import { get } from 'svelte/store';
import { toastStore } from '$lib/stores/toastStore';
import { PDFExporter } from './pdfExport';

/**
 * Complete annotation data structure for .lpdf format
 * This matches the structure from your Python reference implementation
 */
export interface LPDFAnnotationData {
	// Drawing paths (freehand drawing, highlighting, etc.)
	drawings: {
		[pageNumber: string]: Array<{
			tool: string;
			color: string;
			lineWidth: number;
			points: Array<{
				x: number;
				y: number;
				pressure?: number;
				relativeX?: number;
				relativeY?: number;
			}>;
			highlightColor?: string;
			highlightOpacity?: number;
			viewerScale?: number;
		}>;
	};
	
	// Text annotations
	textAnnotations: {
		[pageNumber: string]: Array<{
			id: string;
			x: number;
			y: number;
			text: string;
			fontSize: number;
			color: string;
			fontFamily: string;
			relativeX: number;
			relativeY: number;
		}>;
	};
	
	// Sticky note annotations
	stickyNotes: {
		[pageNumber: string]: Array<{
			id: string;
			x: number;
			y: number;
			text: string;
			fontSize: number;
			fontFamily: string;
			backgroundColor: string;
			width: number;
			height: number;
			relativeX: number;
			relativeY: number;
			relativeWidth: number;
			relativeHeight: number;
		}>;
	};
	
	// Stamp annotations
	stamps: {
		[pageNumber: string]: Array<{
			id: string;
			x: number;
			y: number;
			stampId: string;
			size: number;
			rotation: number;
			relativeX: number;
			relativeY: number;
			relativeSize: number;
			width?: number;
			height?: number;
		}>;
	};
	
	// Arrow annotations
	arrows: {
		[pageNumber: string]: Array<{
			id: string;
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			stroke: string;
			strokeWidth: number;
			arrowHead: boolean;
			relativeX1: number;
			relativeY1: number;
			relativeX2: number;
			relativeY2: number;
		}>;
	};
	
	// Metadata
	metadata: {
		version: string;
		created: number;
		appVersion: string;
		totalPages: number;
		stamps?: StampDefinition[]; // Include available stamps for compatibility
	};
}

export class LPDFExporter {
	private originalPdfBytes: Uint8Array | null = null;
	private currentFileName: string = '';

	/**
	 * Set the original PDF data
	 */
	setOriginalPDF(pdfBytes: Uint8Array, fileName: string = 'document.pdf') {
		this.originalPdfBytes = pdfBytes;
		this.currentFileName = fileName;
	}

	/**
	 * Collect all annotation data from stores
	 */
	private collectAnnotationData(): LPDFAnnotationData {
		const currentPdfState = get(pdfState);
		
		// Get all annotation data from stores
		const allDrawingPaths = get(drawingPaths);
		const allTextAnnotations = get(textAnnotations);
		const allStickyNotes = get(stickyNoteAnnotations);
		const allStampAnnotations = get(stampAnnotations);
		const allArrowAnnotations = get(arrowAnnotations);

		// Convert drawing paths
		const drawings: LPDFAnnotationData['drawings'] = {};
		allDrawingPaths.forEach((paths, pageNumber) => {
			if (paths.length > 0) {
				drawings[pageNumber.toString()] = paths.map(path => ({
					tool: path.tool,
					color: path.color,
					lineWidth: path.lineWidth,
					points: path.points,
					highlightColor: path.highlightColor,
					highlightOpacity: path.highlightOpacity,
					viewerScale: path.viewerScale
				}));
			}
		});

		// Convert text annotations
		const textAnnotationsData: LPDFAnnotationData['textAnnotations'] = {};
		allTextAnnotations.forEach((annotations, pageNumber) => {
			if (annotations.length > 0) {
				textAnnotationsData[pageNumber.toString()] = annotations.map(annotation => ({
					id: annotation.id,
					x: annotation.x,
					y: annotation.y,
					text: annotation.text,
					fontSize: annotation.fontSize,
					color: annotation.color,
					fontFamily: annotation.fontFamily,
					relativeX: annotation.relativeX,
					relativeY: annotation.relativeY
				}));
			}
		});

		// Convert sticky notes
		const stickyNotesData: LPDFAnnotationData['stickyNotes'] = {};
		allStickyNotes.forEach((notes, pageNumber) => {
			if (notes.length > 0) {
				stickyNotesData[pageNumber.toString()] = notes.map(note => ({
					id: note.id,
					x: note.x,
					y: note.y,
					text: note.text,
					fontSize: note.fontSize,
					fontFamily: note.fontFamily,
					backgroundColor: note.backgroundColor,
					width: note.width,
					height: note.height,
					relativeX: note.relativeX,
					relativeY: note.relativeY,
					relativeWidth: note.relativeWidth,
					relativeHeight: note.relativeHeight
				}));
			}
		});

		// Convert stamps
		const stampsData: LPDFAnnotationData['stamps'] = {};
		allStampAnnotations.forEach((stamps, pageNumber) => {
			if (stamps.length > 0) {
				stampsData[pageNumber.toString()] = stamps.map(stamp => ({
					id: stamp.id,
					x: stamp.x,
					y: stamp.y,
					stampId: stamp.stampId,
					size: stamp.size,
					rotation: stamp.rotation,
					relativeX: stamp.relativeX,
					relativeY: stamp.relativeY,
					relativeSize: stamp.relativeSize,
					width: stamp.width,
					height: stamp.height
				}));
			}
		});

		// Convert arrows
		const arrowsData: LPDFAnnotationData['arrows'] = {};
		allArrowAnnotations.forEach((arrows, pageNumber) => {
			if (arrows.length > 0) {
				arrowsData[pageNumber.toString()] = arrows.map(arrow => ({
					id: arrow.id,
					x1: arrow.x1,
					y1: arrow.y1,
					x2: arrow.x2,
					y2: arrow.y2,
					stroke: arrow.stroke,
					strokeWidth: arrow.strokeWidth,
					arrowHead: arrow.arrowHead,
					relativeX1: arrow.relativeX1,
					relativeY1: arrow.relativeY1,
					relativeX2: arrow.relativeX2,
					relativeY2: arrow.relativeY2
				}));
			}
		});

		return {
			drawings,
			textAnnotations: textAnnotationsData,
			stickyNotes: stickyNotesData,
			stamps: stampsData,
			arrows: arrowsData,
			metadata: {
				version: '1.0',
				created: Date.now(),
				appVersion: '2.7.0', // From package.json
				totalPages: currentPdfState.totalPages,
				stamps: availableStamps // Include stamp definitions for compatibility
			}
		};
	}

	/**
	 * Export current PDF and annotations to .lpdf format
	 */
	async exportToLPDF(): Promise<Uint8Array> {
		if (!this.originalPdfBytes) {
			throw new Error('No original PDF loaded. Please set the PDF data first.');
		}

		try {
			console.log('Starting .lpdf export...');
			
			// Force save all annotations to ensure we have the latest data
			forceSaveAllAnnotations();
			
			// Collect all annotation data
			const annotationData = this.collectAnnotationData();
			
			console.log('Collected annotation data:', {
				drawingsPages: Object.keys(annotationData.drawings).length,
				textAnnotationsPages: Object.keys(annotationData.textAnnotations).length,
				stickyNotesPages: Object.keys(annotationData.stickyNotes).length,
				stampsPages: Object.keys(annotationData.stamps).length,
				arrowsPages: Object.keys(annotationData.arrows).length,
				totalPages: annotationData.metadata.totalPages
			});

			// Create ZIP file
			const zip = new JSZip();
			
			// Add original PDF
			zip.file('original.pdf', this.originalPdfBytes);
			
			// Add annotations as JSON
			const annotationsJson = JSON.stringify(annotationData, null, 2);
			zip.file('annotations.json', annotationsJson);
			
			console.log('Created ZIP with original.pdf and annotations.json');
			
			// Generate the .lpdf file
			const lpdfBytes = await zip.generateAsync({
				type: 'uint8array',
				compression: 'DEFLATE',
				compressionOptions: {
					level: 6
				}
			});
			
			console.log(`Successfully generated .lpdf file (${lpdfBytes.length} bytes)`);
			return lpdfBytes;
		} catch (error) {
			console.error('Error creating .lpdf file:', error);
			throw new Error(`Failed to create .lpdf file: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Read and parse an .lpdf file
	 */
	static async importFromLPDF(lpdfFile: File): Promise<{
		pdfFile: File;
		annotations: LPDFAnnotationData;
	}> {
		try {
			console.log('Starting .lpdf import...');
			
			// Read the ZIP file
			const zip = await JSZip.loadAsync(lpdfFile);
			
			// Extract original PDF
			const pdfZipEntry = zip.file('original.pdf');
			if (!pdfZipEntry) {
				throw new Error('Invalid .lpdf file: missing original.pdf');
			}
			
			const pdfBytes = await pdfZipEntry.async('uint8array');
			const pdfFile = new File([pdfBytes.buffer as ArrayBuffer], 'document.pdf', { type: 'application/pdf' });
			
			// Extract annotations
			const annotationsZipEntry = zip.file('annotations.json');
			if (!annotationsZipEntry) {
				throw new Error('Invalid .lpdf file: missing annotations.json');
			}
			
			const annotationsJson = await annotationsZipEntry.async('text');
			const annotations: LPDFAnnotationData = JSON.parse(annotationsJson);
			
			console.log('Successfully parsed .lpdf file:', {
				pdfSize: pdfBytes.length,
				annotationPages: Object.keys(annotations.drawings).length + 
					Object.keys(annotations.textAnnotations).length + 
					Object.keys(annotations.stickyNotes).length + 
					Object.keys(annotations.stamps).length + 
					Object.keys(annotations.arrows).length
			});
			
			return { pdfFile, annotations };
		} catch (error) {
			console.error('Error reading .lpdf file:', error);
			throw new Error(`Failed to read .lpdf file: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Load annotations from LPDF data into the application stores
	 */
	static async loadAnnotationsIntoStores(annotations: LPDFAnnotationData, fileName: string, fileSize: number) {
		try {
			console.log('Loading annotations into stores...');
			
			// Set current PDF to associate annotations with the correct PDF
			setCurrentPDF(fileName, fileSize);
			
			// Clear existing annotations
			drawingPaths.set(new Map());
			textAnnotations.set(new Map());
			stickyNoteAnnotations.set(new Map());
			stampAnnotations.set(new Map());
			arrowAnnotations.set(new Map());
			
			// Load drawing paths
			if (annotations.drawings) {
				const drawingPathsMap = new Map<number, DrawingPath[]>();
				Object.entries(annotations.drawings).forEach(([pageNum, paths]) => {
					const pageNumber = parseInt(pageNum);
					const convertedPaths: DrawingPath[] = paths.map(path => ({
						tool: path.tool as any,
						color: path.color,
						lineWidth: path.lineWidth,
						points: path.points,
						pageNumber,
						highlightColor: path.highlightColor,
						highlightOpacity: path.highlightOpacity,
						viewerScale: path.viewerScale
					}));
					drawingPathsMap.set(pageNumber, convertedPaths);
				});
				drawingPaths.set(drawingPathsMap);
			}
			
			// Load text annotations
			if (annotations.textAnnotations) {
				const textAnnotationsMap = new Map<number, TextAnnotation[]>();
				Object.entries(annotations.textAnnotations).forEach(([pageNum, texts]) => {
					const pageNumber = parseInt(pageNum);
					const convertedTexts: TextAnnotation[] = texts.map(text => ({
						...text,
						pageNumber
					}));
					textAnnotationsMap.set(pageNumber, convertedTexts);
				});
				textAnnotations.set(textAnnotationsMap);
			}
			
			// Load sticky notes
			if (annotations.stickyNotes) {
				const stickyNotesMap = new Map<number, StickyNoteAnnotation[]>();
				Object.entries(annotations.stickyNotes).forEach(([pageNum, notes]) => {
					const pageNumber = parseInt(pageNum);
					const convertedNotes: StickyNoteAnnotation[] = notes.map(note => ({
						...note,
						pageNumber
					}));
					stickyNotesMap.set(pageNumber, convertedNotes);
				});
				stickyNoteAnnotations.set(stickyNotesMap);
			}
			
			// Load stamps
			if (annotations.stamps) {
				const stampsMap = new Map<number, StampAnnotation[]>();
				Object.entries(annotations.stamps).forEach(([pageNum, stamps]) => {
					const pageNumber = parseInt(pageNum);
					const convertedStamps: StampAnnotation[] = stamps.map(stamp => ({
						...stamp,
						pageNumber
					}));
					stampsMap.set(pageNumber, convertedStamps);
				});
				stampAnnotations.set(stampsMap);
			}
			
			// Load arrows
			if (annotations.arrows) {
				const arrowsMap = new Map<number, ArrowAnnotation[]>();
				Object.entries(annotations.arrows).forEach(([pageNum, arrows]) => {
					const pageNumber = parseInt(pageNum);
					const convertedArrows: ArrowAnnotation[] = arrows.map(arrow => ({
						...arrow,
						pageNumber
					}));
					arrowsMap.set(pageNumber, convertedArrows);
				});
				arrowAnnotations.set(arrowsMap);
			}
			
			console.log('Successfully loaded all annotations into stores');
			
			// Force save to localStorage to persist the imported data
			forceSaveAllAnnotations();
			
			toastStore.success(
				'LPDF Imported',
				`Loaded ${fileName} with all annotations restored`
			);
		} catch (error) {
			console.error('Error loading annotations into stores:', error);
			throw new Error(`Failed to load annotations: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Export .lpdf file using the existing file export system
	 */
	async exportLPDFFile(defaultFilename?: string): Promise<boolean> {
		try {
			const lpdfBytes = await this.exportToLPDF();
			const filename = defaultFilename || this.getDefaultLPDFFilename();
			
			return await PDFExporter.exportFile(
				lpdfBytes,
				filename,
				'application/zip' // .lpdf files are ZIP files
			);
		} catch (error) {
			console.error('Error exporting .lpdf file:', error);
			toastStore.error('Export Failed', `Could not create .lpdf file: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return false;
		}
	}

	/**
	 * Generate default filename for .lpdf export
	 */
	private getDefaultLPDFFilename(): string {
		const baseName = this.currentFileName.replace('.pdf', '') || 'document';
		const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
		return `${baseName}_annotated_${timestamp}.lpdf`;
	}

	/**
	 * Import .lpdf file and load it into the application
	 */
	static async importLPDFFile(lpdfFile: File): Promise<{ success: boolean; pdfFile?: File }> {
		try {
			// Parse the .lpdf file
			const { pdfFile, annotations } = await LPDFExporter.importFromLPDF(lpdfFile);
			
			// Load the annotations into stores
			await LPDFExporter.loadAnnotationsIntoStores(annotations, pdfFile.name, pdfFile.size);
			
			return { success: true, pdfFile };
		} catch (error) {
			console.error('Error importing .lpdf file:', error);
			toastStore.error('Import Failed', `Could not load .lpdf file: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return { success: false };
		}
	}
}

// Convenience functions for easy usage
export async function exportCurrentPDFAsLPDF(pdfBytes: Uint8Array, fileName: string = 'document.pdf'): Promise<boolean> {
	const exporter = new LPDFExporter();
	exporter.setOriginalPDF(pdfBytes, fileName);
	return await exporter.exportLPDFFile();
}

export async function importLPDFFile(lpdfFile: File): Promise<{ success: boolean; pdfFile?: File }> {
	return await LPDFExporter.importLPDFFile(lpdfFile);
}
