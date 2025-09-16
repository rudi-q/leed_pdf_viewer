// JSZip will be dynamically imported when needed to reduce initial bundle size
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
import { LPDF_MAX_PDF_SIZE, LPDF_MAX_JSON_SIZE, LPDF_MAX_TOTAL_UNCOMPRESSED } from '$lib/constants';

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
		originalFilename?: string; // Original PDF filename before LPDF export
		originalSize?: number; // Original PDF size in bytes
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
				stamps: availableStamps, // Include stamp definitions for compatibility
				originalFilename: this.currentFileName || 'document.pdf', // Preserve original filename
				originalSize: this.originalPdfBytes ? this.originalPdfBytes.length : undefined // Preserve original size
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
			
			// Dynamically import JSZip to reduce initial bundle size
			console.log('Loading JSZip...');
			const JSZip = (await import('jszip')).default;
			
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
		console.log('Starting secure .lpdf import...');
		
		// Dynamically import JSZip to reduce initial bundle size
		console.log('Loading JSZip...');
		const JSZip = (await import('jszip')).default;
		
		// Read the ZIP file
		const zip = await JSZip.loadAsync(lpdfFile);
		
		// SECURITY: Enumerate and validate all entries first
		const allowedFiles = ['original.pdf', 'annotations.json'];
		const entries = Object.keys(zip.files);
		
		console.log('ZIP entries found:', entries);
		
		// Validate all entries
		for (const filename of entries) {
			const entry = zip.files[filename];
			
			// SECURITY: Only allow exact filenames we expect
			if (!allowedFiles.includes(filename)) {
				throw new Error(`Invalid .lpdf file: unexpected file '${filename}'. Only 'original.pdf' and 'annotations.json' are allowed.`);
			}
			
			// SECURITY: Check for path traversal attacks
			if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
				throw new Error(`Invalid .lpdf file: filename '${filename}' contains path separators or directory traversal sequences.`);
			}
			
			// SECURITY: Ensure it's not a directory entry
			if (entry.dir) {
				throw new Error(`Invalid .lpdf file: '${filename}' is a directory entry, only files are allowed.`);
			}
		}
		
		// Ensure we have exactly the required files
		if (!entries.includes('original.pdf')) {
			throw new Error('Invalid .lpdf file: missing original.pdf');
		}
		if (!entries.includes('annotations.json')) {
			throw new Error('Invalid .lpdf file: missing annotations.json');
		}
		
		console.log('ZIP structure validation passed');
		
		// Extract and validate original PDF
		const pdfZipEntry = zip.files['original.pdf'];
		
		// SECURITY: Extract PDF and check actual size after decompression
		const pdfBytes = await pdfZipEntry.async('uint8array');
		
		// SECURITY: Check actual PDF size after extraction
		if (pdfBytes.length > LPDF_MAX_PDF_SIZE) {
			throw new Error(`Invalid .lpdf file: original.pdf size (${Math.round(pdfBytes.length / (1024 * 1024))}MB) exceeds limit of ${Math.round(LPDF_MAX_PDF_SIZE / (1024 * 1024))}MB.`);
		}
		// Create a new Uint8Array to ensure proper typing and avoid potential ArrayBufferLike issues
		const pdfUint8Array = new Uint8Array(pdfBytes);
		
		// NOTE: We'll determine the filename after parsing annotations to access metadata
		
		// Extract and validate annotations JSON
		const annotationsZipEntry = zip.files['annotations.json'];
		
		// SECURITY: Extract JSON and check actual size after decompression
		const annotationsJson = await annotationsZipEntry.async('text');
		
		// SECURITY: Check actual JSON size after extraction
		if (annotationsJson.length > LPDF_MAX_JSON_SIZE) {
			throw new Error(`Invalid .lpdf file: annotations.json size (${Math.round(annotationsJson.length / (1024 * 1024))}MB) exceeds limit of ${Math.round(LPDF_MAX_JSON_SIZE / (1024 * 1024))}MB.`);
		}
		
		// SECURITY: Parse JSON with try/catch and validation
		let annotations: LPDFAnnotationData;
		try {
			annotations = JSON.parse(annotationsJson);
			
			// Basic structure validation
			if (!annotations || typeof annotations !== 'object') {
				throw new Error('Annotations data is not a valid object');
			}
			
			// Ensure required properties exist
			if (!annotations.metadata || !annotations.drawings || !annotations.textAnnotations || !annotations.stickyNotes || !annotations.stamps || !annotations.arrows) {
				throw new Error('Annotations data is missing required properties');
			}
			
		} catch (jsonError) {
			throw new Error(`Invalid .lpdf file: annotations.json contains invalid JSON data - ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
		}
		
		// Determine the filename: prefer metadata.originalFilename, fallback to LPDF basename
		let restoredFilename = 'document.pdf'; // Final fallback
		
		if (annotations.metadata?.originalFilename) {
			// Use the preserved original filename from metadata
			restoredFilename = annotations.metadata.originalFilename;
			// Ensure it has .pdf extension
			if (!restoredFilename.toLowerCase().endsWith('.pdf')) {
				restoredFilename += '.pdf';
			}
		} else {
			// Fallback: use LPDF file basename with .pdf extension
			const lpdfBasename = lpdfFile.name.replace(/\.lpdf$/i, '');
			if (lpdfBasename && lpdfBasename !== lpdfFile.name) {
				restoredFilename = `${lpdfBasename}.pdf`;
			}
		}
		
		// Create the PDF file with the restored filename
		const pdfFile = new File([pdfUint8Array], restoredFilename, { type: 'application/pdf' });
		
		console.log('Successfully parsed .lpdf file:', {
			pdfSize: pdfBytes.length,
			restoredFilename: restoredFilename,
			originalFilename: annotations.metadata?.originalFilename || 'not available',
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
			
			// Use original size from metadata if available, otherwise use current file size
			const originalSize = annotations.metadata?.originalSize ?? pdfFile.size;
			
			// Load the annotations into stores with preserved filename and size
			await LPDFExporter.loadAnnotationsIntoStores(annotations, pdfFile.name, originalSize);
			
			return { success: true, pdfFile };
		} catch (error) {
			console.error('Error importing .lpdf file:', error);
			toastStore.error('Import Failed', `Could not load .lpdf file: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return { success: false };
		}
	}
}

// Convenience functions for easy usage
export async function exportCurrentPDFAsLPDF(pdfBytes: Uint8Array, fileName: string = 'document.pdf', returnData: boolean = false): Promise<boolean | Uint8Array> {
	const exporter = new LPDFExporter();
	exporter.setOriginalPDF(pdfBytes, fileName);
	
	if (returnData) {
		// Return the LPDF data instead of downloading
		return await exporter.exportToLPDF();
	} else {
		// Download the file
		return await exporter.exportLPDFFile();
	}
}

export async function importLPDFFile(lpdfFile: File): Promise<{ success: boolean; pdfFile?: File }> {
	return await LPDFExporter.importLPDFFile(lpdfFile);
}
