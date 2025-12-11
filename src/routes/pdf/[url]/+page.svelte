<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { listen } from '@tauri-apps/api/event';
	import { readFile as readFilePlugin } from '@tauri-apps/plugin-fs';
	import { invoke } from '@tauri-apps/api/core';
	import PDFViewer from '$lib/components/PDFViewer.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
	import PageThumbnails from '$lib/components/PageThumbnails.svelte';
	import HelpButton from '$lib/components/HelpButton.svelte';
	import HomeButton from '$lib/components/HomeButton.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { isValidLPDFFile, isValidPDFFile } from '$lib/utils/pdfUtils';
	import {
		forceSaveAllAnnotations,
		pdfState,
		redo,
		setCurrentPDF,
		setTool,
		undo
	} from '$lib/stores/drawingStore';
	import { toastStore } from '$lib/stores/toastStore';
	import { PDFExporter } from '$lib/utils/pdfExport';
	import { exportCurrentPDFAsLPDF, importLPDFFile } from '$lib/utils/lpdfExport';
	import { exportCurrentPDFAsDocx } from '$lib/utils/docxExport';
	import { MAX_FILE_SIZE } from '$lib/constants';
	import { isTauri } from '$lib/utils/tauriUtils';
	import { storeUploadedFile } from '$lib/utils/fileStorageUtils';
	import SharePDFModal from '$lib/components/SharePDFModal.svelte';
	import { getFormattedVersion } from '$lib/utils/version';
	import { keyboardShortcuts } from '$lib/utils/keyboardShortcuts';
	import { handleFileUploadClick, handleStampToolClick } from '$lib/utils/pageKeyboardHelpers';

	// Module-scoped cleanup handlers for Tauri event listeners
	let tauriCleanupHandlers: {
		unlistenFileOpened: Promise<() => void>;
		unlistenStartupReady: Promise<() => void>;
		unlistenDebug: Promise<() => void>;
	} | null = null;

	// Track pending files timeout for cleanup
	let pendingFilesTimeout: ReturnType<typeof setTimeout> | null = null;

	let pdfViewer: PDFViewer;
	let currentFile: File | string | null = null;
	let dragOver = false;
	let showShortcuts = false;
	let isFullscreen = false;
	let showThumbnails = false;
	let focusMode = false;
	let presentationMode = false;
	let isLoading = true;
	let showShareModal = false;

	// Debug variables
	let debugVisible = false;
	let debugResults = 'Click button to test...';

	// File loading variables
	// (hasLoadedFromCommandLine removed - was unused dead code)

	// Extract and decode URL parameter
	$: if (browser && $page && $page.params.url) {
		const encodedUrl = $page.params.url;
		try {
			const decodedUrl = decodeURIComponent(encodedUrl);
			console.log('[PDF Route] Loading PDF from URL:', decodedUrl);

			if (decodedUrl && !currentFile) {
				handlePdfUrlLoad(decodedUrl);
			}
		} catch (error) {
			console.error('Error decoding URL parameter:', error);
			// Redirect to home if URL is invalid
			goto('/');
		}
	}

	// Redirect to home if no URL parameter
	$: if (browser && $page && !$page.params.url) {
		console.log('No URL parameter found, redirecting to home');
		goto('/');
	}

	onMount(() => {
		// Setup all the event listeners and handlers for Tauri functionality
		setupEventListeners();

		return cleanup;
	});

	function setupEventListeners() {
		console.log('[PDF Route] Setting up event listeners');
		document.addEventListener('fullscreenchange', handleFullscreenChange);

		// Strategy 1: Immediate checks for Tauri file associations
		if (isTauri) {
			console.log('Starting immediate file checks...');
			checkForPendingFiles();
			checkFileAssociations();
		}

		// Strategy 2: Event listeners for Tauri
		if (isTauri) {
			console.log('Setting up Tauri event listeners...');

			const unlistenFileOpened = listen('file-opened', (event) => {
				console.log('*** FILE-OPENED EVENT RECEIVED ***');
				console.log('Event payload:', event.payload);
				handleFileFromCommandLine(event.payload as string);
			});

			const unlistenStartupReady = listen('startup-file-ready', (event) => {
				console.log('*** STARTUP-FILE-READY EVENT RECEIVED ***');
				console.log('Event payload:', event.payload);
				handleFileFromCommandLine(event.payload as string);
			});

			const unlistenDebug = listen('debug-info', (event) => {
				console.log('TAURI DEBUG:', event.payload);
			});

			// Store cleanup functions in module-scoped variable
			tauriCleanupHandlers = {
				unlistenFileOpened,
				unlistenStartupReady,
				unlistenDebug
			};
		}

		console.log('✅ All file loading strategies initialized');
	}

	function cleanup() {
		console.log('[PDF Route] Cleaning up');
		document.removeEventListener('fullscreenchange', handleFullscreenChange);

		// Clear any pending file check timeout
		if (pendingFilesTimeout !== null) {
			clearTimeout(pendingFilesTimeout);
			pendingFilesTimeout = null;
		}

		// Clean up Tauri event listeners
		if (tauriCleanupHandlers) {
			const { unlistenFileOpened, unlistenStartupReady, unlistenDebug } = tauriCleanupHandlers;
			unlistenFileOpened.then((fn) => fn()).catch(console.error);
			unlistenStartupReady.then((fn) => fn()).catch(console.error);
			unlistenDebug.then((fn) => fn()).catch(console.error);
			tauriCleanupHandlers = null;
		}
	}

	async function handleFileUpload(files: FileList) {
		console.log('handleFileUpload called with:', files);

		// Defensive guard for files array
		if (!files || files.length === 0) {
			toastStore.error('No File Selected', 'Please choose a file.');
			return;
		}

		const file = files[0];
		console.log('Selected file:', file?.name, 'Type:', file?.type, 'Size:', file?.size);

		const isPDF = isValidPDFFile(file);
		const isLPDF = isValidLPDFFile(file);

		if (!isPDF && !isLPDF) {
			console.log('Invalid file type');
			toastStore.error('Invalid File', 'Please choose a valid PDF or LPDF file.');
			return;
		}

		// Check file size for all file types before processing
		if (file.size > MAX_FILE_SIZE) {
			console.log('File too large');
			toastStore.error(
				'File Too Large',
				`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
			);
			return;
		}

		// If it's an LPDF file, import it and navigate to pdf-upload with the extracted PDF
		if (isLPDF) {
			console.log('LPDF file detected, importing...');
			try {
				const result = await importLPDFFile(file);
				if (result.success && result.pdfFile) {
					console.log('🎉 LPDF imported successfully, loading PDF...');

					// Validate extracted PDF size to prevent bypass of upload size limits
					if (result.pdfFile.size > MAX_FILE_SIZE) {
						console.log('Extracted PDF too large:', result.pdfFile.size);
						toastStore.error(
							'Extracted PDF Too Large',
							`The PDF inside the LPDF file (${(result.pdfFile.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
						);
						return;
					}

					// Store the extracted PDF file using IndexedDB (same as main route)
					const storeResult = await storeUploadedFile(result.pdfFile);

					if (storeResult.success && storeResult.id) {
						console.log(
							'Extracted PDF stored successfully, navigating to pdf-upload with ID:',
							storeResult.id
						);
						goto(`/pdf-upload?fileId=${storeResult.id}`);
					} else {
						console.error('Failed to store extracted PDF:', storeResult.error);
						toastStore.error('Storage Error', 'Failed to load the PDF from LPDF file.');
					}
				} else {
					console.log('❌ LPDF import failed or was cancelled');
				}
			} catch (error) {
				console.error('LPDF import failed:', error);
				toastStore.error('Import Failed', 'LPDF import failed. Please try again.');
			}
			return;
		}

		console.log('Storing file and navigating to pdf-upload route');

		try {
			// Store file using IndexedDB (same as main route)
			const storeResult = await storeUploadedFile(file);

			if (storeResult.success && storeResult.id) {
				console.log('File stored successfully, navigating to pdf-upload with ID:', storeResult.id);
				goto(`/pdf-upload?fileId=${storeResult.id}`);
			} else {
				console.error('Failed to store file:', storeResult.error);
				toastStore.error('Storage Error', 'Failed to store the PDF file.');
			}
		} catch (error) {
			console.error('Error during file storage:', error);
			toastStore.error('Storage Error', 'Failed to process the PDF file. Please try again.');
		}
	}

	function isValidPdfUrl(url: string): boolean {
		try {
			const validUrl = new URL(url);
			return validUrl.protocol === 'https:' || validUrl.protocol === 'http:';
		} catch {
			return false;
		}
	}

	async function handleFileFromCommandLine(filePath: string): Promise<boolean> {
		console.log('*** HANDLING FILE FROM COMMAND LINE ***');
		console.log('File path:', filePath);

		// File loading from command line initiated

		try {
			// Step 1: Validate path
			if (!filePath || typeof filePath !== 'string') {
				debugResults += '\n❌ FAILED: Invalid file path received';
				throw new Error('Invalid file path received');
			}
			debugResults += '\n✅ Step 1: Path validation passed';

			// Step 2: Sanitize path
			let cleanPath = filePath.trim();
			if (cleanPath.startsWith('"') && cleanPath.endsWith('"')) {
				cleanPath = cleanPath.slice(1, -1);
			}
			debugResults += `\n✅ Step 2: Cleaned path: ${cleanPath}`;

			// Step 3: Extract filename
			const fileName = cleanPath.split(/[\\\/]/).pop() || 'document.pdf';
			debugResults += `\n✅ Step 3: Extracted filename: ${fileName}`;

			// Step 4: Check if it's a PDF
			if (!fileName.toLowerCase().endsWith('.pdf')) {
				debugResults += '\n❌ FAILED: Not a PDF file';
				return false;
			}
			debugResults += '\n✅ Step 4: PDF file check passed';

			// Step 5: Try to read the file using Rust command first, then plugin fallback
			debugResults += '\n🔄 Step 5: Reading file...';
			let fileData: Uint8Array;
			try {
				// First try the Rust command for better security and permissions
				debugResults += '\n🔄 Trying Rust read_file_content command...';
				const fileContent = (await invoke('read_file_content', {
					filePath: cleanPath
				})) as number[];
				fileData = new Uint8Array(fileContent);
				debugResults += `\n✅ Step 5: File read successfully via Rust! Size: ${fileData.length} bytes`;
			} catch (rustError: unknown) {
				const rustErrorMsg = rustError instanceof Error ? rustError.message : String(rustError);
				debugResults += `\n⚠️ Rust command failed: ${rustErrorMsg}`;
				debugResults += '\n🔄 Falling back to plugin-fs readFile...';

				try {
					// Fallback to plugin-fs when Rust command fails (e.g., permissions)
					fileData = await readFilePlugin(cleanPath);
					debugResults += `\n✅ Step 5: File read successfully via plugin fallback! Size: ${fileData.length} bytes`;
				} catch (pluginError: unknown) {
					const pluginErrorMsg =
						pluginError instanceof Error ? pluginError.message : String(pluginError);
					debugResults += `\n❌ Plugin fallback also failed: ${pluginErrorMsg}`;

					// Try alternative path formats with plugin fallback
					debugResults += '\n🔄 Trying alternative path formats with plugin...';
					const altPaths = [
						cleanPath.replace(/\\/g, '/'),
						cleanPath.replace(/\//g, '\\'),
						`"${cleanPath}"` // Try with quotes
					];

					let success = false;
					for (const altPath of altPaths) {
						try {
							debugResults += `\n🔄 Trying: ${altPath}`;
							fileData = await readFilePlugin(altPath);
							debugResults += `\n✅ Success with alternative path!`;
							cleanPath = altPath;
							success = true;
							break;
						} catch (altError: unknown) {
							const altErrorMsg = altError instanceof Error ? altError.message : String(altError);
							debugResults += `\n❌ Failed: ${altErrorMsg}`;
						}
					}

					if (!success) {
						debugResults += '\n❌ FINAL FAILURE: All path formats failed';
						return false;
					}
				}
			}

			// Step 6: Validate PDF header
			debugResults += '\n🔄 Step 6: Validating PDF header...';
			const pdfHeader = new Uint8Array(fileData!.slice(0, 4));
			const pdfSignature = String.fromCharCode(...pdfHeader);
			if (pdfSignature !== '%PDF') {
				debugResults += `\n❌ FAILED: Invalid PDF signature: ${pdfSignature}`;
				return false;
			}
			debugResults += '\n✅ Step 6: PDF signature valid';

			// Step 7: Create File object
			debugResults += '\n🔄 Step 7: Creating File object...';
			const file = new File([new Uint8Array(fileData!)], fileName, { type: 'application/pdf' });
			debugResults += `\n✅ Step 7: File object created - ${file.name}, ${file.size} bytes`;

			// Step 8: Size check
			if (file.size > MAX_FILE_SIZE) {
				debugResults += '\n❌ FAILED: File too large';
				return false;
			}
			debugResults += '\n✅ Step 8: Size check passed';

			// Step 9: Set state
			debugResults += '\n🔄 Step 9: Setting application state...';
			currentFile = file;
			isLoading = false;
			debugResults += '\n✅ Step 9: State updated';

			// Step 10: Set PDF for auto-save
			debugResults += '\n🔄 Step 10: Setting up auto-save...';
			setCurrentPDF(file.name, file.size);
			debugResults += '\n✅ Step 10: Auto-save configured';

			// Step 11: Mark as processed
			try {
				await invoke('mark_file_processed');
				debugResults += '\n✅ Step 11: Marked as processed in Rust';
			} catch (e) {
				debugResults += '\n⚠️ Step 11: Could not mark as processed (not critical)';
			}

			debugResults += '\n🎉 SUCCESS: PDF should now be loading!';
			return true;
		} catch (error: unknown) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			debugResults += `\n💥 UNEXPECTED ERROR: ${errorMsg}`;
			return false;
		}
	}

	// Multiple strategies for checking files
	async function checkForPendingFiles() {
		try {
			console.log('Checking for pending files (strategy 1: command)...');
			const pendingFile = (await invoke('get_pending_file')) as string | null;

			if (pendingFile) {
				console.log('Found pending file via command:', pendingFile);
				const success = await handleFileFromCommandLine(pendingFile);

				if (success) {
					// Check for more files - track timeout for cleanup
					pendingFilesTimeout = setTimeout(checkForPendingFiles, 100);
				}
			} else {
				console.log('No pending files found via command');
			}
		} catch (error) {
			console.error('Error checking for pending files:', error);
		}
	}

	async function checkFileAssociations() {
		try {
			console.log('Checking file associations (strategy 2: direct check)...');
			const pdfFiles = (await invoke('check_file_associations')) as string[];

			if (pdfFiles && pdfFiles.length > 0) {
				console.log('Found PDF files via direct check:', pdfFiles);
				for (const pdfFile of pdfFiles) {
					const success = await handleFileFromCommandLine(pdfFile);
					if (success) {
						break; // Only load the first one
					}
				}
			} else {
				console.log('No PDF files found via direct check');
			}
		} catch (error) {
			console.error('Error checking file associations:', error);
		}
	}

	function fixDropboxUrl(url: string): string {
		try {
			const urlObj = new URL(url);

			if (!urlObj.hostname.includes('dropbox.com')) {
				return url;
			}

			// Remove problematic st parameter and ensure dl=1
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
						console.log('Converting to dropboxusercontent.com domain');
						return `https://dl.dropboxusercontent.com/scl/fi/${fileId}/${fileName}?rlkey=${rlkey}&dl=1`;
					}
				}
			}

			return urlObj.toString();
		} catch (error) {
			console.warn('Error fixing Dropbox URL:', error);
			return url;
		}
	}

	async function handlePdfUrlLoad(url: string) {
		console.log('[handlePdfUrlLoad] Starting with URL:', url);

		if (!isValidPdfUrl(url)) {
			console.log('Invalid PDF URL');
			toastStore.error('Invalid URL', 'Invalid PDF URL. Please provide a valid web address.');
			goto('/');
			return;
		}

		// Fix Dropbox URLs
		const fixedUrl = fixDropboxUrl(url);
		console.log('Fixed URL:', fixedUrl);

		console.log('Setting currentFile');
		currentFile = fixedUrl;
		isLoading = false;

		// Set current PDF for auto-save functionality
		const filename = extractFilenameFromUrl(fixedUrl);
		setCurrentPDF(filename, 0);
		console.log('PDF URL setup completed');
	}

	function extractFilenameFromUrl(url: string): string {
		try {
			const urlObj = new URL(url);

			// For Dropbox URLs, extract from path
			if (urlObj.hostname.includes('dropbox.com')) {
				const pathMatch = urlObj.pathname.match(/\/scl\/fi\/[^\/]+\/(.+)/);
				if (pathMatch) {
					return pathMatch[1];
				}
			}

			const pathname = urlObj.pathname;
			const filename = pathname.split('/').pop() || 'document.pdf';

			// Ensure .pdf extension
			return filename.toLowerCase().endsWith('.pdf') ? filename : filename + '.pdf';
		} catch {
			return 'document.pdf';
		}
	}

	/**
	 * Shared helper to get PDF bytes and base name from currentFile.
	 * Call forceSaveAllAnnotations() before calling this.
	 */
	async function getPdfBytesAndBaseName(): Promise<{ pdfBytes: Uint8Array; originalName: string }> {
		if (!currentFile) {
			throw new Error('No PDF file available');
		}

		let pdfBytes: Uint8Array;
		let originalName: string;

		if (typeof currentFile === 'string') {
			console.log('Fetching PDF data from URL:', currentFile);
			const response = await fetch(currentFile);
			if (!response.ok) {
				throw new Error(`Failed to fetch PDF: ${response.statusText}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			pdfBytes = new Uint8Array(arrayBuffer);
			originalName = extractFilenameFromUrl(currentFile).replace(/\.pdf$/i, '');
		} else {
			const arrayBuffer = await currentFile.arrayBuffer();
			pdfBytes = new Uint8Array(arrayBuffer);
			originalName = currentFile.name.replace(/\.pdf$/i, '');
		}

		return { pdfBytes, originalName };
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		if (event.dataTransfer?.files) {
			handleFileUpload(event.dataTransfer.files);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		// Only set dragOver to false if we're actually leaving the main container
		// Check if the related target is outside the main element
		const mainElement = event.currentTarget as Element;
		const relatedTarget = event.relatedTarget as Element;

		// If relatedTarget is null (leaving the window) or not a child of main, we're truly leaving
		if (!relatedTarget || !mainElement.contains(relatedTarget)) {
			dragOver = false;
		}
	}

	// Page-specific keyboard shortcuts (F11, Escape)
	function handlePageSpecificKeys(event: KeyboardEvent) {
		switch (event.key) {
			case 'F11':
				event.preventDefault();
				toggleFullscreen();
				break;
			case 'Escape':
				if (isFullscreen) {
					exitFullscreen();
				} else if (showShortcuts) {
					showShortcuts = false;
				}
				break;
		}
	}

	function handleWheel(event: WheelEvent) {
		if (event.ctrlKey) {
			event.preventDefault();
			const zoomIn = event.deltaY < 0;
			if (zoomIn) {
				pdfViewer?.zoomIn();
			} else {
				pdfViewer?.zoomOut();
			}
		}
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			enterFullscreen();
		} else {
			exitFullscreen();
		}
	}

	function enterFullscreen() {
		if (document.documentElement.requestFullscreen) {
			document.documentElement.requestFullscreen();
			isFullscreen = true;
		}
	}

	function exitFullscreen() {
		if (document.fullscreenElement && document.exitFullscreen) {
			document.exitFullscreen();
			isFullscreen = false;
		}
	}

	async function handleExportPDF() {
		if (!currentFile || !pdfViewer) {
			toastStore.warning('No PDF', 'No PDF to export');
			return;
		}

		try {
			console.log('Starting multi-page PDF export with annotations...');

			// Force save all annotations to localStorage before export
			forceSaveAllAnnotations();
			console.log('✅ All annotations force-saved to localStorage before export');

			const { pdfBytes, originalName } = await getPdfBytesAndBaseName();

			const exporter = new PDFExporter();
			exporter.setOriginalPDF(pdfBytes);

			// Export ALL pages that have annotations
			console.log('Checking all pages for annotations...');
			const totalPages = $pdfState.totalPages;
			let pagesWithAnnotations = 0;

			for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
				const hasAnnotations = await pdfViewer.pageHasAnnotations(pageNumber);

				if (hasAnnotations) {
					console.log(`📄 Page ${pageNumber} has annotations - creating merged canvas`);
					const mergedCanvas = await pdfViewer.getMergedCanvasForPage(pageNumber);
					if (mergedCanvas) {
						exporter.setPageCanvas(pageNumber, mergedCanvas);
						pagesWithAnnotations++;
						console.log(`✅ Added merged canvas for page ${pageNumber}`);
					} else {
						console.warn(`❌ Failed to create merged canvas for page ${pageNumber}`);
					}
				} else {
					console.log(`📄 Page ${pageNumber} has no annotations - will preserve original page`);
				}
			}

			console.log(
				`📊 Export summary: ${pagesWithAnnotations} pages with annotations out of ${totalPages} total pages`
			);

			const annotatedPdfBytes = await exporter.exportToPDF();
			const filename = `${originalName}_annotated.pdf`;

			const success = await PDFExporter.exportFile(annotatedPdfBytes, filename, 'application/pdf');
			if (success) {
				console.log('🎉 Multi-page PDF exported successfully:', filename);
			} else {
				console.log('📄 Export was cancelled by user');
			}
		} catch (error) {
			console.error('Export failed:', error);
			toastStore.error('Export Failed', 'Export failed. Please try again.');
		}
	}

	async function handleExportLPDF() {
		if (!currentFile || !pdfViewer) {
			toastStore.warning('No PDF', 'No PDF to export');
			return;
		}

		try {
			// Force save all annotations to localStorage before export
			forceSaveAllAnnotations();
			console.log('✅ All annotations force-saved to localStorage before export');

			const { pdfBytes, originalName } = await getPdfBytesAndBaseName();

			const success = await exportCurrentPDFAsLPDF(pdfBytes, `${originalName}.pdf`);
			if (success) {
				console.log('🎉 LPDF exported successfully');
			} else {
				console.log('📄 LPDF export was cancelled by user');
			}
		} catch (error) {
			console.error('LPDF export failed:', error);
			toastStore.error('Export Failed', 'LPDF export failed. Please try again.');
		}
	}

	async function handleExportDOCX() {
		if (!currentFile || !pdfViewer) {
			toastStore.warning('No PDF', 'No PDF to export');
			return;
		}

		try {
			// Force save all annotations to localStorage before export
			forceSaveAllAnnotations();
			console.log('✅ All annotations force-saved to localStorage before DOCX export');

			const { pdfBytes, originalName } = await getPdfBytesAndBaseName();

			// First export to annotated PDF, then convert to DOCX
			const exporter = new PDFExporter();
			exporter.setOriginalPDF(pdfBytes);

			// Export ALL pages that have annotations
			console.log('Checking all pages for annotations...');
			const totalPages = $pdfState.totalPages;
			let pagesWithAnnotations = 0;

			for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
				const hasAnnotations = await pdfViewer.pageHasAnnotations(pageNumber);

				if (hasAnnotations) {
					console.log(`📄 Page ${pageNumber} has annotations - creating merged canvas`);
					const mergedCanvas = await pdfViewer.getMergedCanvasForPage(pageNumber);
					if (mergedCanvas) {
						exporter.setPageCanvas(pageNumber, mergedCanvas);
						pagesWithAnnotations++;
						console.log(`✅ Added merged canvas for page ${pageNumber}`);
					} else {
						console.warn(`❌ Failed to create merged canvas for page ${pageNumber}`);
					}
				} else {
					console.log(`📄 Page ${pageNumber} has no annotations - will preserve original page`);
				}
			}

			console.log(
				`📊 Export summary: ${pagesWithAnnotations} pages with annotations out of ${totalPages} total pages`
			);

			// Generate annotated PDF bytes
			const annotatedPdfBytes = await exporter.exportToPDF();

			// Convert annotated PDF to DOCX
			const success = await exportCurrentPDFAsDocx(annotatedPdfBytes, `${originalName}.pdf`);
			if (success) {
				console.log('🎉 DOCX exported successfully');
			} else {
				console.log('📄 DOCX export was cancelled by user');
			}
		} catch (error) {
			console.error('DOCX export failed:', error);
			toastStore.error('Export Failed', 'DOCX export failed. Please try again.');
		}
	}

	function handleToggleThumbnails(show: boolean) {
		showThumbnails = show;
	}

	function handlePageSelect(pageNumber: number) {
		pdfViewer?.goToPage(pageNumber);
	}

	function handleSharePDF() {
		showShareModal = true;
	}

	function getOriginalFileName(): string {
		if (typeof currentFile === 'string') {
			return extractFilenameFromUrl(currentFile);
		} else if (currentFile) {
			return currentFile.name;
		}
		return 'document.pdf';
	}

	function handleFullscreenChange() {
		isFullscreen = !!document.fullscreenElement;
		// Exit presentation mode when fullscreen is exited
		if (!document.fullscreenElement && presentationMode) {
			presentationMode = false;
		}
	}
</script>

<svelte:window
	use:keyboardShortcuts={{
		pdfViewer,
		showShortcuts,
		showThumbnails,
		focusMode,
		presentationMode,
		onShowShortcutsChange: (value) => (showShortcuts = value),
		onShowThumbnailsChange: (value) => (showThumbnails = value),
		onFocusModeChange: (value) => (focusMode = value),
		onPresentationModeChange: (value) => {
			presentationMode = value;
			if (value) {
				enterFullscreen();
			} else if (document.fullscreenElement) {
				// Only exit fullscreen if actually in fullscreen
				exitFullscreen();
			}
		},
		onFileUploadClick: handleFileUploadClick,
		onStampToolClick: handleStampToolClick
	}}
	on:keydown={handlePageSpecificKeys}
	on:wheel={handleWheel}
/>

<main
	class="w-screen h-screen relative overflow-hidden"
	class:drag-over={dragOver}
	on:drop={handleDrop}
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
>
	{#if isLoading}
		<div class="h-full flex items-center justify-center">
			<div class="text-center">
				<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sage mx-auto mb-4"></div>
				<p class="text-lg text-charcoal dark:text-gray-300">Loading PDF...</p>
			</div>
		</div>
	{:else if currentFile}
		{#if !focusMode && !presentationMode}
			<Toolbar
				onFileUpload={handleFileUpload}
				onPreviousPage={() => pdfViewer?.previousPage()}
				onNextPage={() => pdfViewer?.nextPage()}
				onZoomIn={() => pdfViewer?.zoomIn()}
				onZoomOut={() => pdfViewer?.zoomOut()}
				onResetZoom={() => pdfViewer?.resetZoom()}
				onFitToWidth={() => pdfViewer?.fitToWidth()}
				onFitToHeight={() => pdfViewer?.fitToHeight()}
				onExportPDF={handleExportPDF}
				onExportLPDF={handleExportLPDF}
				onExportDOCX={handleExportDOCX}
				onSharePDF={handleSharePDF}
				{showThumbnails}
				onToggleThumbnails={handleToggleThumbnails}
			/>
		{/if}

		<div class="w-full h-full" class:pt-12={!focusMode && !presentationMode}>
			<div class="flex h-full">
				{#if showThumbnails}
					<PageThumbnails isVisible={showThumbnails} onPageSelect={handlePageSelect} />
				{/if}

				<div class="flex-1">
					<PDFViewer bind:this={pdfViewer} pdfFile={currentFile} {presentationMode} />
				</div>
			</div>
		</div>

		{#if dragOver}
			<div
				class="absolute inset-0 bg-sage/20 backdrop-blur-sm flex items-center justify-center z-40"
			>
				<div class="text-center">
					<div class="text-6xl mb-4">📄</div>
					<h3 class="text-2xl font-bold text-charcoal mb-2">Drop your new PDF here</h3>
					<p class="text-slate">Release to replace current PDF</p>
				</div>
			</div>
		{/if}

		{#if !focusMode && !presentationMode}
			<HelpButton
				position="absolute"
				positionClasses="bottom-4 left-4"
				showOnDesktopOnly={true}
				on:click={() => (showShortcuts = true)}
			/>

			<HomeButton {showThumbnails} />
		{/if}
	{/if}

	<Footer
		{focusMode}
		{presentationMode}
		{getFormattedVersion}
		on:helpClick={() => (showShortcuts = true)}
	/>
</main>

<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => (showShortcuts = false)} />

<!-- Share PDF Modal -->
<SharePDFModal
	bind:isOpen={showShareModal}
	pdfFile={currentFile}
	originalFileName={getOriginalFileName()}
	on:close={() => (showShareModal = false)}
	on:shared={(event) => {
		console.log('PDF shared successfully:', event.detail);
		showShareModal = false;
	}}
/>

<!-- Hidden file input -->
<input
	type="file"
	accept=".pdf,.lpdf"
	multiple={false}
	class="hidden"
	on:change={(event) => {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			handleFileUpload(input.files);
		}
	}}
/>

<style>
	main {
		background: linear-gradient(135deg, #fdf6e3 0%, #f7f3e9 50%, #f0efeb 100%);
	}

	:global(.dark) main {
		background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%);
	}

	.drag-over {
		background: linear-gradient(135deg, #fdf6e3 0%, #e8f5e8 50%, #f0efeb 100%);
	}

	:global(.dark) .drag-over {
		background: linear-gradient(135deg, #111827 0%, #065f46 50%, #374151 100%);
	}

	:global(body) {
		font-family: 'Inter', system-ui, sans-serif;
	}
</style>
