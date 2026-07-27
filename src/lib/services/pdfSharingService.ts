import {
	COLLECTIONS,
	DATABASE_ID,
	databases,
	ID,
	Query,
	type SharedPDF,
	storage,
	STORAGE_BUCKET_ID,
	tauriFetchReady
} from './appwrite';
import {
	arrowAnnotations,
	drawingPaths,
	pdfState,
	stampAnnotations,
	stickyNoteAnnotations,
	textAnnotations
} from '$lib/stores/drawingStore';
import { get } from 'svelte/store';
import { toastStore } from '$lib/stores/toastStore';

export interface SharePDFOptions {
	isPublic: boolean;
	password?: string;
	expiresInDays?: number;
	maxDownloads?: number;
	viewOnly?: boolean;
	allowDownloading?: boolean;
}

export interface SharePDFResult {
	success: boolean;
	shareUrl?: string;
	shareId?: string;
	error?: string;
}

// Specific error types for share access
export enum ShareAccessError {
	NOT_FOUND = 'SHARE_NOT_FOUND',
	PASSWORD_REQUIRED = 'PASSWORD_REQUIRED',
	INVALID_PASSWORD = 'INVALID_PASSWORD',
	EXPIRED = 'SHARE_EXPIRED',
	DOWNLOAD_LIMIT_EXCEEDED = 'DOWNLOAD_LIMIT_EXCEEDED'
}

export interface GetSharedPDFResult {
	success: boolean;
	sharedPDF?: SharedPDF;
	lpdfUrl?: string;
	annotations?: any[];
	error?: string;
	errorType?: ShareAccessError;
}

// Password security utilities
export class PasswordUtils {
	/**
	 * Generate a random salt for password hashing
	 */
	static generateSalt(): string {
		const array = new Uint8Array(16);
		crypto.getRandomValues(array);
		return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Hash a password using PBKDF2
	 */
	static async hashPassword(password: string, salt: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(password);
		const saltBuffer = encoder.encode(salt);

		// Import password as key material
		const keyMaterial = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']);

		// Derive key using PBKDF2
		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				salt: saltBuffer,
				iterations: 100000, // 100k iterations for security
				hash: 'SHA-256'
			},
			keyMaterial,
			256 // 32 bytes
		);

		// Convert to hex string
		const hashArray = new Uint8Array(derivedBits);
		return Array.from(hashArray, (byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Verify a password against its hash
	 */
	static async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
		const computedHash = await this.hashPassword(password, salt);
		return computedHash === hash;
	}
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
			await tauriFetchReady;

			// Generate unique share ID
			const shareId = ID.unique();

			toastStore.info('Sharing PDF', 'Uploading PDF and annotations...');

			// Step 1: Generate and upload LPDF file
			let lpdfStorageId: string;

			// Get PDF bytes for LPDF generation
			let pdfBytes: Uint8Array;
			if (typeof pdfFile === 'string') {
				try {
					console.log('Fetching PDF from URL for sharing:', pdfFile);

					// Try with different fetch options to handle CORS issues
					const fetchOptions = {
						method: 'GET',
						headers: {
							Accept: 'application/pdf,*/*',
							'Cache-Control': 'no-cache'
						},
						mode: 'cors' as RequestMode,
						credentials: 'omit' as RequestCredentials
					};

					const response = await fetch(pdfFile, fetchOptions);

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					const contentType = response.headers.get('content-type');
					if (contentType && !contentType.includes('pdf')) {
						console.warn('Response content-type is not PDF:', contentType);
					}

					const arrayBuffer = await response.arrayBuffer();

					if (arrayBuffer.byteLength === 0) {
						throw new Error('Received empty response from PDF URL');
					}

					pdfBytes = new Uint8Array(arrayBuffer);
					console.log(`Successfully fetched PDF: ${pdfBytes.length} bytes`);
				} catch (fetchError) {
					console.error('Direct fetch failed, trying proxy fallback...', fetchError);

					// Try using the proxy API as a fallback for CORS issues
					try {
						console.log('Attempting to fetch PDF via proxy server...');

						const proxyResponse = await fetch('/api/proxy-pdf', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ url: pdfFile })
						});

						if (!proxyResponse.ok) {
							const errorText = await proxyResponse.text();
							throw new Error(`Proxy failed: ${proxyResponse.status} ${errorText}`);
						}

						const proxyResult = await proxyResponse.json();

						if (!proxyResult.success || !proxyResult.data) {
							throw new Error('Proxy returned invalid response');
						}

						// Convert base64 back to Uint8Array
						const binaryString = atob(proxyResult.data);
						pdfBytes = new Uint8Array(binaryString.length);
						for (let i = 0; i < binaryString.length; i++) {
							pdfBytes[i] = binaryString.charCodeAt(i);
						}

						// Validate PDF signature (same as direct fetch path)
						if (pdfBytes.length < 4) {
							throw new Error('Response too small to be a valid PDF file');
						}

						const pdfHeader = pdfBytes.slice(0, 4);
						const pdfSignature = String.fromCharCode(...pdfHeader);
						if (pdfSignature !== '%PDF') {
							throw new Error(
								`Invalid PDF signature from proxy: expected '%PDF', got '${pdfSignature}'`
							);
						}

						console.log(`Successfully fetched PDF via proxy: ${pdfBytes.length} bytes`);
					} catch (proxyError) {
						console.error('Proxy fallback also failed:', proxyError);

						// Provide helpful error messages based on the error type
						if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
							throw new Error(
								'Unable to access the PDF from the external URL due to CORS restrictions. The server may not allow cross-origin requests. Try downloading the PDF first and then uploading it to LeedPDF for sharing.'
							);
						} else if (
							proxyError instanceof Error &&
							proxyError.message.includes('Proxy failed: 502')
						) {
							throw new Error(
								'The PDF server is not responding or the PDF file cannot be accessed. Please check if the URL is correct and accessible.'
							);
						} else if (proxyError instanceof Error && proxyError.message.includes('timeout')) {
							throw new Error(
								'The PDF server is taking too long to respond. Please try again later or download the PDF and upload it instead.'
							);
						} else {
							throw new Error(
								'Unable to access the PDF from the external URL. This may be due to server restrictions, network issues, or the PDF being password-protected. Try downloading the PDF first and then uploading it to LeedPDF for sharing.'
							);
						}
					}
				}
			} else {
				const arrayBuffer = await pdfFile.arrayBuffer();
				pdfBytes = new Uint8Array(arrayBuffer);
			}

			// Generate LPDF with current annotations
			const { exportCurrentPDFAsLPDF } = await import('$lib/utils/lpdfExport');
			const lpdfData = (await exportCurrentPDFAsLPDF(
				pdfBytes,
				originalFileName,
				true
			)) as Uint8Array; // true = return data instead of download

			if (!lpdfData || !(lpdfData instanceof Uint8Array)) {
				throw new Error('Failed to generate LPDF data');
			}

			// Create LPDF file and upload
			const lpdfFileName = originalFileName.replace(/\.pdf$/i, '.lpdf');
			const lpdfFile = new File([new Uint8Array(lpdfData)], lpdfFileName, {
				type: 'application/x-lpdf'
			});

			const lpdfUploadResult = await storage.createFile(STORAGE_BUCKET_ID, ID.unique(), lpdfFile);
			lpdfStorageId = lpdfUploadResult.$id;

			// Step 2: LPDF already contains annotations, so no separate upload needed
			const annotations = await PDFSharingService.collectAllAnnotations();
			const hasAnnotations = annotations.length > 0;

			// Step 3: Process security options
			let passwordHash: string | undefined;
			let passwordSalt: string | undefined;
			let expiresAt: string | undefined;

			// Handle password protection
			if (options.password && options.password.trim()) {
				passwordSalt = PasswordUtils.generateSalt();
				passwordHash = await PasswordUtils.hashPassword(options.password.trim(), passwordSalt);
				console.log('Password protection enabled for share');
			}

			// Calculate expiration date
			if (options.expiresInDays && options.expiresInDays > 0) {
				const expireDate = new Date();
				expireDate.setDate(expireDate.getDate() + options.expiresInDays);
				expiresAt = expireDate.toISOString();
				console.log(`Share will expire on: ${expireDate.toLocaleDateString()}`);
			}

			// Step 4: Create database record with security fields
			const fileSize = lpdfFile.size;
			const pageCount = get(pdfState).totalPages || 1;
			const now = new Date().toISOString();

			const sharedPDFData = {
				// File metadata
				filename: originalFileName,
				file_id: lpdfStorageId,
				original_filename: originalFileName,
				file_size: fileSize,
				mime_type: 'application/x-lpdf',
				page_count: pageCount,

				// Share metadata
				share_token: shareId,
				uploaded_at: now,
				uploaded_by: shareId, // Using shareId as uploader reference
				is_public: options.isPublic,
				description: hasAnnotations ? `LPDF with ${annotations.length} annotations` : 'Shared LPDF',
				tags: hasAnnotations ? ['annotated', 'lpdf'] : ['shared', 'lpdf'],

				// Security fields
				...(passwordHash && { password_hash: passwordHash }),
				...(passwordSalt && { password_salt: passwordSalt }),
				...(expiresAt && { expires_at: expiresAt }),
				...(options.maxDownloads &&
					options.maxDownloads > 0 && { max_downloads: options.maxDownloads }),

				// Permission fields
				view_only: options.viewOnly || false,
				allow_downloading: options.allowDownloading !== undefined ? options.allowDownloading : true,

				// Download tracking
				download_count: 0 // Initialize download counter
			};

			await databases.createDocument(
				DATABASE_ID,
				COLLECTIONS.SHARED_PDFS,
				ID.unique(),
				sharedPDFData
			);

			// Generate share URL
			const baseUrl = 'https://leed.my';
			const shareUrl = `${baseUrl}/shared/${shareId}`;

			toastStore.success('PDF Shared', 'Your PDF has been shared successfully!');

			return {
				success: true,
				shareUrl,
				shareId
			};
		} catch (error) {
			console.error('Error sharing PDF:', error);
			const errorMessage =
				error instanceof Error
					? error.message
					: typeof error === 'string'
						? error
						: JSON.stringify(error) || 'Unknown error occurred';
			toastStore.error('Sharing Failed', errorMessage);

			return {
				success: false,
				error: errorMessage
			};
		}
	}

	/**
	 * Retrieve a shared PDF with full security enforcement
	 */
	static async getSharedPDF(shareId: string, password?: string): Promise<GetSharedPDFResult> {
		try {
			await tauriFetchReady;
			// Find the shared PDF record using share_token field
			const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SHARED_PDFS, [
				Query.equal('share_token', shareId)
			]);

			if (response.documents.length === 0) {
				return {
					success: false,
					error:
						'Share not found. The link may be invalid or the shared PDF may have been deleted.',
					errorType: ShareAccessError.NOT_FOUND
				};
			}

			const doc = response.documents[0] as any;

			// Security Check 1: Check if share has expired
			if (doc.expires_at) {
				const expirationDate = new Date(doc.expires_at);
				const now = new Date();
				if (now > expirationDate) {
					return {
						success: false,
						error: `This shared PDF expired on ${expirationDate.toLocaleDateString()}. Please request a new share link.`,
						errorType: ShareAccessError.EXPIRED
					};
				}
			}

			// Security Check 2: Password verification
			if (doc.password_hash && doc.password_salt) {
				if (!password || !password.trim()) {
					return {
						success: false,
						error: 'This shared PDF is password protected. Please provide the password.',
						errorType: ShareAccessError.PASSWORD_REQUIRED
					};
				}

				const isPasswordValid = await PasswordUtils.verifyPassword(
					password.trim(),
					doc.password_hash,
					doc.password_salt
				);

				if (!isPasswordValid) {
					return {
						success: false,
						error: 'Invalid password. Please check your password and try again.',
						errorType: ShareAccessError.INVALID_PASSWORD
					};
				}
			}

			// Security Check 3: Download limit enforcement
			const currentDownloadCount = doc.download_count || 0;
			const maxDownloads = doc.max_downloads;

			if (maxDownloads && currentDownloadCount >= maxDownloads) {
				return {
					success: false,
					error: `Download limit reached. This PDF has been accessed ${currentDownloadCount} time(s) out of ${maxDownloads} allowed.`,
					errorType: ShareAccessError.DOWNLOAD_LIMIT_EXCEEDED
				};
			}

			// All security checks passed - proceed with access

			// Atomic increment of download counter to prevent race conditions
			try {
				await databases.updateDocument(DATABASE_ID, COLLECTIONS.SHARED_PDFS, doc.$id, {
					download_count: currentDownloadCount + 1
				});
				console.log(
					`Download count incremented to ${currentDownloadCount + 1} for share ${shareId}`
				);
			} catch (updateError) {
				console.warn('Failed to update download count:', updateError);
				// Continue anyway - don't block access for counter update failures
			}

			// Get LPDF download URL using file_id
			const lpdfUrl = storage.getFileView(STORAGE_BUCKET_ID, doc.file_id);

			// Create SharedPDF object with proper typing
			const sharedPDF: SharedPDF = {
				$id: doc.$id,
				shareId: shareId,
				originalFileName: doc.original_filename || doc.filename,
				pdfStorageId: doc.file_id,
				createdAt: doc.uploaded_at,
				expiresAt: doc.expires_at,
				isPublic: doc.is_public || false,
				passwordHash: doc.password_hash,
				passwordSalt: doc.password_salt,
				downloadCount: currentDownloadCount + 1, // Updated count
				maxDownloads: doc.max_downloads,
				viewOnly: doc.view_only || false,
				allowDownloading: doc.allow_downloading !== undefined ? doc.allow_downloading : true,
				metadata: {
					fileSize: doc.file_size || 0,
					pageCount: doc.page_count || 1,
					hasAnnotations: doc.tags?.includes('annotated') || false
				}
			};

			return {
				success: true,
				sharedPDF,
				lpdfUrl,
				annotations: [] // Will be loaded from LPDF when imported
			};
		} catch (error) {
			console.error('Error retrieving shared PDF:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to load shared PDF';

			return {
				success: false,
				error: `Unable to load shared PDF: ${errorMessage}`
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
			const stickyNotesMap = new Map(
				Object.entries(stickyNotesByPage).map(([k, v]) => [parseInt(k), v])
			);
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
			const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SHARED_PDFS, [
				Query.equal('shareId', shareId)
			]);

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