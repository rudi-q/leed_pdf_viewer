<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { listen } from '@tauri-apps/api/event';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { invoke } from '@tauri-apps/api/core';
	import PDFViewer from '$lib/components/PDFViewer.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
	import PageThumbnails from '$lib/components/PageThumbnails.svelte';
	import { isValidLPDFFile, isValidPDFFile } from '$lib/utils/pdfUtils';
	import {
		forceSaveAllAnnotations,
		pdfState,
		redo,
		setCurrentPDF,
		setTool,
		undo
	} from '$lib/stores/drawingStore';
	import { PDFExporter } from '$lib/utils/pdfExport';
	import { exportCurrentPDFAsLPDF, importLPDFFile } from '$lib/utils/lpdfExport';
	import { exportCurrentPDFAsDocx } from '$lib/utils/docxExport';
	import { toastStore } from '$lib/stores/toastStore';
	import { getFormattedVersion } from '$lib/utils/version';
	import { isTauri } from '$lib/utils/tauriUtils';
	import { MAX_FILE_SIZE } from '$lib/constants';
	import HelpButton from '$lib/components/HelpButton.svelte';
	import HomeButton from '$lib/components/HomeButton.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import DragOverlay from '$lib/components/DragOverlay.svelte';
	import SharePDFModal from '$lib/components/SharePDFModal.svelte';
	import GlobalStyles from '$lib/components/GlobalStyles.svelte';
	import { keyboardShortcuts } from '$lib/utils/keyboardShortcuts';
	import { handleFileUploadClick, handleStampToolClick } from '$lib/utils/pageKeyboardHelpers';

	// Get the page data from the load function
	export let data;

	let pdfViewer: PDFViewer;
	let currentFile: File | string | null = null;
	let dragOver = false;
	let showShortcuts = false;
	let isFullscreen = false;
	let showThumbnails = false;
	let focusMode = false;
	let presentationMode = false;
	let isLoading = true;
	let templateError = false;
	let showShareModal = false;

	// Load template PDF if it exists
	$: if (browser && data) {
		if (data.exists && data.templateUrl && !currentFile) {
			console.log('[Template Route] Loading template PDF:', data.templateName);
			handleTemplateLoad(data.templateUrl, data.templateName);
		} else if (!data.exists) {
			console.log('[Template Route] Template not found:', data.templateName);
			templateError = true;
			isLoading = false;
		}
	}

	onMount(() => {
		// Setup all the event listeners and handlers for Tauri functionality
		setupEventListeners();

		return cleanup;
	});

	function setupEventListeners() {
		console.log('[Template Route] Setting up event listeners');
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

			// Store cleanup functions for later
			(window as any).__templateRouteCleanup = {
				unlistenFileOpened,
				unlistenStartupReady,
				unlistenDebug
			};
		}

		console.log('✅ All file loading strategies initialized');
	}

	function cleanup() {
		console.log('[Template Route] Cleaning up');
		document.removeEventListener('fullscreenchange', handleFullscreenChange);

		// Clean up Tauri event listeners
		if ((window as any).__templateRouteCleanup) {
			const { unlistenFileOpened, unlistenStartupReady, unlistenDebug } = (window as any)
				.__templateRouteCleanup;
			unlistenFileOpened.then((fn: () => void) => fn()).catch(console.error);
			unlistenStartupReady.then((fn: () => void) => fn()).catch(console.error);
			unlistenDebug.then((fn: () => void) => fn()).catch(console.error);
			delete (window as any).__templateRouteCleanup;
		}
	}

	async function handleFileUpload(files: FileList) {
		console.log('handleFileUpload called with:', files);
		const file = files[0];
		console.log('Selected file:', file?.name, 'Type:', file?.type, 'Size:', file?.size);

		const isPDF = isValidPDFFile(file);
		const isLPDF = isValidLPDFFile(file);

		if (!isPDF && !isLPDF) {
			console.log('Invalid file type');
			toastStore.error('Invalid File', 'Please choose a valid PDF or LPDF file.');
			return;
		}

		// If it's an LPDF file, import it and navigate to pdf-upload with the extracted PDF
		if (isLPDF) {
			// Check file size for LPDF files too
			if (file.size > MAX_FILE_SIZE) {
				console.log('LPDF file too large');
				toastStore.error(
					'File Too Large',
					`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
				);
				return;
			}

			console.log('LPDF file detected, importing...');
			try {
				const result = await importLPDFFile(file);
				if (result.success && result.pdfFile) {
					console.log('🎉 LPDF imported successfully, navigating to pdf-upload...');

					// Store the extracted PDF file and navigate to pdf-upload route (like main route does)
					const fileReader = new FileReader();
					fileReader.onload = (e) => {
						const arrayBuffer = e.target?.result as ArrayBuffer;
						const fileData = {
							name: result.pdfFile!.name,
							size: result.pdfFile!.size,
							type: result.pdfFile!.type,
							data: Array.from(new Uint8Array(arrayBuffer))
						};
						sessionStorage.setItem('tempPdfFile', JSON.stringify(fileData));
						console.log('Extracted PDF stored in sessionStorage, navigating...');
						goto('/pdf-upload');
					};
					fileReader.readAsArrayBuffer(result.pdfFile);
				} else {
					console.log('❌ LPDF import failed or was cancelled');
				}
			} catch (error) {
				console.error('LPDF import failed:', error);
				toastStore.error('Import Failed', 'LPDF import failed. Please try again.');
			}
			return;
		}

		if (file.size > MAX_FILE_SIZE) {
			// 50MB limit
			console.log('File too large');
			toastStore.error('File Too Large', 'File too large. Please choose a file under 50MB.');
			return;
		}

		console.log('Storing file and navigating to pdf-upload route');
		// Store file in sessionStorage temporarily and navigate to upload route
		const fileReader = new FileReader();
		fileReader.onload = (e) => {
			const arrayBuffer = e.target?.result as ArrayBuffer;
			const fileData = {
				name: file.name,
				size: file.size,
				type: file.type,
				data: Array.from(new Uint8Array(arrayBuffer))
			};
			sessionStorage.setItem('tempPdfFile', JSON.stringify(fileData));
			console.log('File stored in sessionStorage, navigating...');
			goto('/pdf-upload');
		};
		fileReader.readAsArrayBuffer(file);
	}

	async function handleFileFromCommandLine(filePath: string): Promise<boolean> {
		console.log('*** HANDLING FILE FROM COMMAND LINE ***');
		console.log('File path:', filePath);

		try {
			if (!filePath || typeof filePath !== 'string') {
				throw new Error('Invalid file path received');
			}

			let cleanPath = filePath.trim();
			if (cleanPath.startsWith('"') && cleanPath.endsWith('"')) {
				cleanPath = cleanPath.slice(1, -1);
			}

			const fileName = cleanPath.split(/[\\\/]/).pop() || 'document.pdf';

			if (!fileName.toLowerCase().endsWith('.pdf')) {
				return false;
			}

			let fileData: Uint8Array;
			try {
				fileData = await readFile(cleanPath);
			} catch (readError: unknown) {
				const errorMsg = readError instanceof Error ? readError.message : String(readError);
				console.error('File read error:', errorMsg);
				return false;
			}

			const pdfHeader = new Uint8Array(fileData.slice(0, 4));
			const pdfSignature = String.fromCharCode(...pdfHeader);
			if (pdfSignature !== '%PDF') {
				return false;
			}

			const file = new File([new Uint8Array(fileData)], fileName, { type: 'application/pdf' });

			if (file.size > MAX_FILE_SIZE) {
				return false;
			}

			currentFile = file;
			isLoading = false;

			setCurrentPDF(file.name, file.size);

			try {
				await invoke('mark_file_processed');
			} catch (e) {
				console.warn('Could not mark as processed (not critical)');
			}

			return true;
		} catch (error: unknown) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error('Unexpected error:', errorMsg);
			return false;
		}
	}

	async function checkForPendingFiles() {
		try {
			console.log('Checking for pending files...');
			const pendingFile = (await invoke('get_pending_file')) as string | null;

			if (pendingFile) {
				console.log('Found pending file via command:', pendingFile);
				const success = await handleFileFromCommandLine(pendingFile);

				if (success) {
					setTimeout(checkForPendingFiles, 100);
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
			console.log('Checking file associations...');
			const pdfFiles = (await invoke('check_file_associations')) as string[];

			if (pdfFiles && pdfFiles.length > 0) {
				console.log('Found PDF files via direct check:', pdfFiles);
				for (const pdfFile of pdfFiles) {
					const success = await handleFileFromCommandLine(pdfFile);
					if (success) {
						break;
					}
				}
			} else {
				console.log('No PDF files found via direct check');
			}
		} catch (error) {
			console.error('Error checking file associations:', error);
		}
	}

	async function handleTemplateLoad(templateUrl: string, templateName: string) {
		console.log('[handleTemplateLoad] Loading template:', templateName, 'from:', templateUrl);

		try {
			// Set the template URL as currentFile (similar to how URL route works)
			currentFile = templateUrl;
			isLoading = false;

			// Set current PDF for auto-save functionality
			setCurrentPDF(`${templateName}.pdf`, 0);
			console.log('Template PDF setup completed');
		} catch (error) {
			console.error('Template loading failed:', error);
			templateError = true;
			isLoading = false;
		}
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
		const mainElement = event.currentTarget as Element;
		const relatedTarget = event.relatedTarget as Element;

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
			return;
		}

		try {
			console.log('Starting multi-page PDF export with annotations...');

			// Force save all annotations to localStorage before export
			forceSaveAllAnnotations();
			console.log('✅ All annotations force-saved to localStorage before export');

			let pdfBytes: Uint8Array;
			let originalName: string;

			if (typeof currentFile === 'string') {
				// Template URL - fetch the PDF data
				const response = await fetch(currentFile);
				if (!response.ok) {
					throw new Error(`Failed to fetch template: ${response.statusText}`);
				}
				const arrayBuffer = await response.arrayBuffer();
				pdfBytes = new Uint8Array(arrayBuffer);
				originalName = data.templateName || 'template';
			} else {
				const arrayBuffer = await currentFile.arrayBuffer();
				pdfBytes = new Uint8Array(arrayBuffer);
				originalName = currentFile.name.replace(/\.pdf$/i, '');
			}

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
			console.log('\u2705 All annotations force-saved to localStorage before export');

			let pdfBytes: Uint8Array;
			let originalName: string;

			if (typeof currentFile === 'string') {
				// Template URL - fetch the PDF data
				const response = await fetch(currentFile);
				if (!response.ok) {
					throw new Error(`Failed to fetch template: ${response.statusText}`);
				}
				const arrayBuffer = await response.arrayBuffer();
				pdfBytes = new Uint8Array(arrayBuffer);
				originalName = data.templateName || 'template';
			} else {
				const arrayBuffer = await currentFile.arrayBuffer();
				pdfBytes = new Uint8Array(arrayBuffer);
				originalName = currentFile.name.replace(/\\.pdf$/i, '');
			}

			const success = await exportCurrentPDFAsLPDF(pdfBytes, `${originalName}.pdf`);
			if (success) {
				console.log('\ud83c\udf89 LPDF exported successfully');
			} else {
				console.log('\ud83d\udcc4 LPDF export was cancelled by user');
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
			console.log('\u2705 All annotations force-saved to localStorage before DOCX export');

			let pdfBytes: Uint8Array;
			let originalName: string;

			if (typeof currentFile === 'string') {
				// Template URL - fetch the PDF data
				const response = await fetch(currentFile);
				if (!response.ok) {
					throw new Error(`Failed to fetch template: ${response.statusText}`);
				}
				const arrayBuffer = await response.arrayBuffer();
				pdfBytes = new Uint8Array(arrayBuffer);
				originalName = data.templateName || 'template';
			} else {
				const arrayBuffer = await currentFile.arrayBuffer();
				pdfBytes = new Uint8Array(arrayBuffer);
				originalName = currentFile.name.replace(/\\.pdf$/i, '');
			}

			// Create annotated PDF first (same process as handleExportPDF)
			const exporter = new PDFExporter();
			exporter.setOriginalPDF(pdfBytes);

			// Export all pages with annotations
			console.log('Creating annotated PDF for DOCX export with', $pdfState.totalPages, 'pages');
			let pagesWithAnnotations = 0;
			const totalPages = $pdfState.totalPages;

			for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
				console.log(`Processing page ${pageNumber} for DOCX export...`);

				// Check if this page has any annotations
				const hasAnnotations = await pdfViewer.pageHasAnnotations(pageNumber);

				if (hasAnnotations) {
					console.log(`📝 Page ${pageNumber} has annotations - creating merged canvas`);
					const mergedCanvas = await pdfViewer.getMergedCanvasForPage(pageNumber);
					if (mergedCanvas) {
						exporter.setPageCanvas(pageNumber, mergedCanvas);
						pagesWithAnnotations++;
						console.log(`✅ Added merged canvas for page ${pageNumber} to DOCX export`);
					} else {
						console.log(`❌ Failed to create merged canvas for page ${pageNumber}`);
					}
				} else {
					console.log(`📄 Page ${pageNumber} has no annotations - will preserve original page`);
				}
			}

			console.log(
				`📊 DOCX Export summary: ${pagesWithAnnotations} pages with annotations out of ${totalPages} total pages`
			);

			// Get the annotated PDF bytes
			const annotatedPdfBytes = await exporter.exportToPDF();
			console.log('Annotated PDF created for DOCX conversion, size:', annotatedPdfBytes.length);

			// Now convert the annotated PDF to DOCX
			const success = await exportCurrentPDFAsDocx(annotatedPdfBytes, `${originalName}.pdf`);
			if (success) {
				console.log('\ud83c\udf89 DOCX exported successfully with annotations');
			} else {
				console.log('\ud83d\udcc4 DOCX export was cancelled by user');
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

	function handleFullscreenChange() {
		isFullscreen = !!document.fullscreenElement;
		// Exit presentation mode when fullscreen is exited
		if (!document.fullscreenElement && presentationMode) {
			presentationMode = false;
		}
	}

	function handleSharePDF() {
		showShareModal = true;
	}

	function getOriginalFileName(): string {
		if (typeof currentFile === 'string') {
			return data.templateName || 'template.pdf';
		} else if (currentFile) {
			return currentFile.name;
		}
		return 'document.pdf';
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
				document.documentElement.requestFullscreen?.();
			} else {
				document.exitFullscreen?.();
			}
		},
		onFileUploadClick: handleFileUploadClick,
		onStampToolClick: handleStampToolClick,
		onDownloadClick: handleExportPDF
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
			{presentationMode}
			onPresentationModeChange={(value) => {
				presentationMode = value;
				if (value) {
					enterFullscreen();
				} else if (document.fullscreenElement) {
					exitFullscreen();
				}
			}}
		/>
	{/if}

	<div class="w-full h-full" class:pt-12={!focusMode && !presentationMode}>
		{#if templateError}
			<!-- Error state when template is not found -->
			<div class="h-full flex items-center justify-center">
				<div class="text-center max-w-md mx-auto px-6">
					<h1 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
						Template Not Found
					</h1>
					<p class="text-gray-600 dark:text-gray-400 mb-6">
						The template "<strong>{data.templateName}</strong>" could not be found.
					</p>
					<button
						class="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
						on:click={() => goto('/')}
					>
						Go Back Home
					</button>
				</div>
			</div>
		{:else if isLoading}
			<!-- Loading state -->
			<div class="h-full flex items-center justify-center">
				<div class="text-center">
					<div
						class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-4"
					></div>
					<p class="text-gray-600 dark:text-gray-400">Loading template...</p>
				</div>
			</div>
		{:else if currentFile}
			<!-- PDF viewer -->
			<div class="relative w-full h-full">
				{#if showThumbnails}
					<PageThumbnails isVisible={showThumbnails} onPageSelect={handlePageSelect} />
				{/if}

				<PDFViewer bind:this={pdfViewer} pdfFile={currentFile} {presentationMode} />
			</div>
		{/if}
	</div>

	{#if !focusMode && !presentationMode}
		<HelpButton
			position="absolute"
			positionClasses="bottom-4 left-4"
			showOnDesktopOnly={true}
			on:click={() => (showShortcuts = true)}
		/>

		<HomeButton {showThumbnails} />
	{/if}

	<Footer
		{focusMode}
		{presentationMode}
		{getFormattedVersion}
		on:helpClick={() => (showShortcuts = true)}
	/>
</main>

<DragOverlay {dragOver} />

<!-- Keyboard shortcuts modal -->
<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => (showShortcuts = false)} />

<!-- Share PDF Modal -->
<SharePDFModal
	bind:isOpen={showShareModal}
	pdfFile={currentFile}
	originalFileName={getOriginalFileName()}
	on:close={() => (showShareModal = false)}
	on:shared={(event) => {
		console.log('PDF shared successfully:', event.detail);
		// Let the modal handle its own state - don't auto-close to show success feedback
	}}
/>

<GlobalStyles />

<style>
	.drag-over {
		background-color: rgb(239 246 255); /* bg-blue-50 */
	}
	:global(.dark) .drag-over {
		background-color: rgb(30 58 138 / 0.1); /* dark:bg-blue-900/10 */
	}
</style>
