import {
  databases,
  storage,
  DATABASE_ID,
  STORAGE_BUCKET_ID,
  COLLECTIONS,
  ID,
  Query,
  type SharedPDF,
  type PDFAnnotationData
} from './appwrite';
import {
  drawingPaths,
  textAnnotations,
  stickyNoteAnnotations,
  stampAnnotations,
  arrowAnnotations,
  pdfState
} from '$lib/stores/drawingStore';
import { get } from 'svelte/store';
import { toastStore } from '$lib/stores/toastStore';

export interface SharePDFOptions {
  isPublic: boolean;
  password?: string;
  expiresInDays?: number;
  maxDownloads?: number;
}

export interface SharePDFResult {
  success: boolean;
  shareUrl?: string;
  shareId?: string;
  error?: string;
}

export class PDFSharingService {
  /**
   * Share a PDF with annotations
   */
  static async sharePDF(
    pdfFile: File | string,
    originalFileName: string,
    options: SharePDFOptions
  ): Promise<SharePDFResult> {
    try {
      // Generate unique share ID
      const shareId = ID.unique();
      
      toastStore.info('Sharing PDF', 'Uploading PDF and annotations...');

      // Step 1: Generate and upload LPDF file
      let lpdfStorageId: string;
      
      // Get PDF bytes for LPDF generation
      let pdfBytes: Uint8Array;
      if (typeof pdfFile === 'string') {
        const response = await fetch(pdfFile);
        if (!response.ok) {
          throw new Error('Failed to fetch PDF from URL');
        }
        const arrayBuffer = await response.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
      } else {
        const arrayBuffer = await pdfFile.arrayBuffer();
        pdfBytes = new Uint8Array(arrayBuffer);
      }
      
      // Generate LPDF with current annotations
      const { exportCurrentPDFAsLPDF } = await import('$lib/utils/lpdfExport');
      const lpdfData = await exportCurrentPDFAsLPDF(pdfBytes, originalFileName, true) as Uint8Array; // true = return data instead of download
      
      if (!lpdfData || !(lpdfData instanceof Uint8Array)) {
        throw new Error('Failed to generate LPDF data');
      }
      
      // Create LPDF file and upload
      const lpdfFileName = originalFileName.replace(/\.pdf$/i, '.lpdf');
      const lpdfFile = new File([new Uint8Array(lpdfData)], lpdfFileName, { type: 'application/x-lpdf' });
      
      const lpdfUploadResult = await storage.createFile(
        STORAGE_BUCKET_ID,
        ID.unique(),
        lpdfFile
      );
      lpdfStorageId = lpdfUploadResult.$id;

      // Step 2: LPDF already contains annotations, so no separate upload needed
      const annotations = await PDFSharingService.collectAllAnnotations();
      const hasAnnotations = annotations.length > 0;

      // Step 3: Create database record
      const fileSize = lpdfFile.size;
      const pageCount = get(pdfState).totalPages || 1;
      
      const sharedPDFData = {
        filename: originalFileName,
        file_id: lpdfStorageId,
        original_filename: originalFileName,
        file_size: fileSize,
        mime_type: 'application/x-lpdf',
        uploaded_at: new Date().toISOString(),
        uploaded_by: shareId, // Using shareId as uploader reference
        share_token: shareId, // Using shareId as the share token
        is_public: options.isPublic,
        description: hasAnnotations ? `LPDF with ${annotations.length} annotations` : 'Shared LPDF',
        tags: hasAnnotations ? ['annotated', 'lpdf'] : ['shared', 'lpdf'],
        page_count: pageCount
      };

      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.SHARED_PDFS,
        ID.unique(),
        sharedPDFData
      );

      // Generate share URL
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://leed.my';
      const shareUrl = `${baseUrl}/shared/${shareId}`;

      toastStore.success('PDF Shared', 'Your PDF has been shared successfully!');

      return {
        success: true,
        shareUrl,
        shareId
      };

    } catch (error) {
      console.error('Error sharing PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toastStore.error('Sharing Failed', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Retrieve a shared PDF
   */
  static async getSharedPDF(shareId: string, password?: string): Promise<{
    success: boolean;
    sharedPDF?: SharedPDF;
    lpdfUrl?: string;
    annotations?: any[];
    error?: string;
  }> {
    try {
      // Find the shared PDF record using share_token field
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.SHARED_PDFS,
        [Query.equal('share_token', shareId)]
      );

      if (response.documents.length === 0) {
        return {
          success: false,
          error: 'Shared PDF not found'
        };
      }

      const sharedPDF = response.documents[0] as any; // Using any since schema changed

      // Note: Expiration and password features not implemented in current schema
      // These would need additional fields if required in the future

      // Get LPDF download URL using file_id
      const lpdfUrl = storage.getFileView(STORAGE_BUCKET_ID, sharedPDF.file_id);

      return {
        success: true,
        sharedPDF,
        lpdfUrl,
        // LPDF files contain both PDF and annotations, so no separate annotations array needed
        annotations: [] // Will be loaded from LPDF when imported
      };

    } catch (error) {
      console.error('Error retrieving shared PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load shared PDF';
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Collect all current annotations from the stores
   */
  private static async collectAllAnnotations(): Promise<any[]> {
    const annotations: any[] = [];
    
    // Get all annotation data from stores
    const paths = get(drawingPaths);
    const texts = get(textAnnotations);
    const stickyNotes = get(stickyNoteAnnotations);
    const stamps = get(stampAnnotations);
    const arrows = get(arrowAnnotations);

    // Add drawing paths
    if (paths instanceof Map) {
      paths.forEach((pagePaths, pageNum) => {
        pagePaths.forEach((path: any, index: number) => {
          annotations.push({
            type: 'drawing',
            pageNumber: pageNum,
            id: `path_${pageNum}_${index}`,
            data: path
          });
        });
      });
    } else {
      Object.entries(paths).forEach(([pageNum, pagePaths]) => {
        (pagePaths as any[]).forEach((path: any, index: number) => {
          annotations.push({
            type: 'drawing',
            pageNumber: parseInt(pageNum),
            id: `path_${pageNum}_${index}`,
            data: path
          });
        });
      });
    }

    // Add text annotations
    if (texts instanceof Map) {
      texts.forEach((pageTexts, pageNum) => {
        pageTexts.forEach((text: any) => {
          annotations.push({
            type: 'text',
            pageNumber: pageNum,
            id: text.id,
            data: text
          });
        });
      });
    } else {
      Object.entries(texts).forEach(([pageNum, pageTexts]) => {
        (pageTexts as any[]).forEach((text: any) => {
          annotations.push({
            type: 'text',
            pageNumber: parseInt(pageNum),
            id: text.id,
            data: text
          });
        });
      });
    }

    // Add sticky notes
    if (stickyNotes instanceof Map) {
      stickyNotes.forEach((pageNotes, pageNum) => {
        pageNotes.forEach((note: any) => {
          annotations.push({
            type: 'sticky',
            pageNumber: pageNum,
            id: note.id,
            data: note
          });
        });
      });
    } else {
      Object.entries(stickyNotes).forEach(([pageNum, pageNotes]) => {
        (pageNotes as any[]).forEach((note: any) => {
          annotations.push({
            type: 'sticky',
            pageNumber: parseInt(pageNum),
            id: note.id,
            data: note
          });
        });
      });
    }

    // Add stamps
    if (stamps instanceof Map) {
      stamps.forEach((pageStamps, pageNum) => {
        pageStamps.forEach((stamp: any) => {
          annotations.push({
            type: 'stamp',
            pageNumber: pageNum,
            id: stamp.id,
            data: stamp
          });
        });
      });
    } else {
      Object.entries(stamps).forEach(([pageNum, pageStamps]) => {
        (pageStamps as any[]).forEach((stamp: any) => {
          annotations.push({
            type: 'stamp',
            pageNumber: parseInt(pageNum),
            id: stamp.id,
            data: stamp
          });
        });
      });
    }

    // Add arrows
    if (arrows instanceof Map) {
      arrows.forEach((pageArrows, pageNum) => {
        pageArrows.forEach((arrow: any) => {
          annotations.push({
            type: 'arrow',
            pageNumber: pageNum,
            id: arrow.id,
            data: arrow
          });
        });
      });
    } else {
      Object.entries(arrows).forEach(([pageNum, pageArrows]) => {
        (pageArrows as any[]).forEach((arrow: any) => {
          annotations.push({
            type: 'arrow',
            pageNumber: parseInt(pageNum),
            id: arrow.id,
            data: arrow
          });
        });
      });
    }

    return annotations;
  }

  /**
   * Apply annotations to the current PDF
   */
  static async applyAnnotations(annotations: any[]): Promise<void> {
    try {
      // Group annotations by type and page
      const pathsByPage: { [page: number]: any[] } = {};
      const textsByPage: { [page: number]: any[] } = {};
      const stickyNotesByPage: { [page: number]: any[] } = {};
      const stampsByPage: { [page: number]: any[] } = {};
      const arrowsByPage: { [page: number]: any[] } = {};

      annotations.forEach((annotation) => {
        const page = annotation.pageNumber;
        
        switch (annotation.type) {
          case 'drawing':
            if (!pathsByPage[page]) pathsByPage[page] = [];
            pathsByPage[page].push(annotation.data);
            break;
          case 'text':
            if (!textsByPage[page]) textsByPage[page] = [];
            textsByPage[page].push(annotation.data);
            break;
          case 'sticky':
            if (!stickyNotesByPage[page]) stickyNotesByPage[page] = [];
            stickyNotesByPage[page].push(annotation.data);
            break;
          case 'stamp':
            if (!stampsByPage[page]) stampsByPage[page] = [];
            stampsByPage[page].push(annotation.data);
            break;
          case 'arrow':
            if (!arrowsByPage[page]) arrowsByPage[page] = [];
            arrowsByPage[page].push(annotation.data);
            break;
        }
      });

      // Update the stores with the loaded annotations
      // Convert to Maps as expected by the stores
      const pathsMap = new Map(Object.entries(pathsByPage).map(([k, v]) => [parseInt(k), v]));
      const textsMap = new Map(Object.entries(textsByPage).map(([k, v]) => [parseInt(k), v]));
      const stickyNotesMap = new Map(Object.entries(stickyNotesByPage).map(([k, v]) => [parseInt(k), v]));
      const stampsMap = new Map(Object.entries(stampsByPage).map(([k, v]) => [parseInt(k), v]));
      const arrowsMap = new Map(Object.entries(arrowsByPage).map(([k, v]) => [parseInt(k), v]));
      
      drawingPaths.set(pathsMap);
      textAnnotations.set(textsMap);
      stickyNoteAnnotations.set(stickyNotesMap);
      stampAnnotations.set(stampsMap);
      arrowAnnotations.set(arrowsMap);

      toastStore.success('Annotations Loaded', 'PDF annotations have been loaded successfully');
      
    } catch (error) {
      console.error('Error applying annotations:', error);
      toastStore.error('Loading Failed', 'Failed to load PDF annotations');
      throw error;
    }
  }

  /**
   * Delete a shared PDF and its associated files
   */
  static async deleteSharedPDF(shareId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the shared PDF record
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.SHARED_PDFS,
        [Query.equal('shareId', shareId)]
      );

      if (response.documents.length === 0) {
        return { success: false, error: 'Shared PDF not found' };
      }

      const sharedPDF = response.documents[0] as unknown as SharedPDF;

      // Delete files from storage
      await storage.deleteFile(STORAGE_BUCKET_ID, sharedPDF.pdfStorageId);
      
      if (sharedPDF.annotationsStorageId) {
        await storage.deleteFile(STORAGE_BUCKET_ID, sharedPDF.annotationsStorageId);
      }

      // Delete database record
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SHARED_PDFS, sharedPDF.$id!);

      return { success: true };
      
    } catch (error) {
      console.error('Error deleting shared PDF:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete shared PDF' 
      };
    }
  }
}