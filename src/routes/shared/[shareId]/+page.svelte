<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import PDFViewer from '$lib/components/PDFViewer.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
	import PageThumbnails from '$lib/components/PageThumbnails.svelte';
	import { keyboardShortcuts } from '$lib/utils/keyboardShortcuts';
	import { PDFSharingService, ShareAccessError } from '$lib/services/pdfSharingService';
	import { toastStore } from '$lib/stores/toastStore';
	import { pdfState, redo, setTool, undo } from '$lib/stores/drawingStore';
	import { getFormattedVersion } from '$lib/utils/version';
	import { PDFExporter } from '$lib/utils/pdfExport';
	import { exportCurrentPDFAsDocx } from '$lib/utils/docxExport';
	import { Frown, Link, Lock } from 'lucide-svelte';

	let isLoading = true;
	let currentFile: File | string | null = null;
	let pdfViewer: PDFViewer;
	let requiresPassword = false;
	let password = '';
	let sharedPDFData: any = null;
	let errorMessage = '';
	let showShortcuts = false;
	let showThumbnails = false;
	let focusMode = false;
	let presentationMode = false;
	let isFullscreen = false;

	onMount(() => {
		if (browser && $page.params.shareId) {
			loadSharedPDF($page.params.shareId);
		}

		// Listen for fullscreen changes
		document.addEventListener('fullscreenchange', handleFullscreenChange);
	});

	onDestroy(() => {
		if (browser) {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
		}
	});

	function handleFullscreenChange() {
		isFullscreen = !!document.fullscreenElement;
		// Exit presentation mode when fullscreen is exited
		if (!document.fullscreenElement && presentationMode) {
			presentationMode = false;
		}
	}

	function enterFullscreen() {
		if (document.documentElement.requestFullscreen) {
			document.documentElement.requestFullscreen().catch((err) => {
				console.warn('Failed to enter fullscreen:', err);
			});
		}
	}

	function exitFullscreen() {
		if (document.fullscreenElement && document.exitFullscreen) {
			document.exitFullscreen().catch((err) => {
				console.warn('Failed to exit fullscreen:', err);
			});
		}
	}

	async function loadSharedPDF(shareId: string, providedPassword?: string) {
		isLoading = true;
		errorMessage = '';
		requiresPassword = false; // Reset password requirement

		let result;

		try {
			result = await PDFSharingService.getSharedPDF(shareId, providedPassword);
		} catch (error) {
			console.error('Error calling PDFSharingService.getSharedPDF:', error);
			errorMessage = 'Failed to load shared PDF. Please try again.';
			isLoading = false;
			return;
		}

		if (!result.success) {
			// Check if password is required or invalid
			if (
				result.errorType === ShareAccessError.PASSWORD_REQUIRED ||
				result.errorType === ShareAccessError.INVALID_PASSWORD ||
				(result.error &&
					(result.error.includes('password protected') ||
						result.error.includes('Invalid password')))
			) {
				requiresPassword = true;
				isLoading = false;
				errorMessage = ''; // Ensure error message is cleared

				// Show a toast for invalid password attempts
				if (
					result.errorType === ShareAccessError.INVALID_PASSWORD ||
					(result.error && result.error.includes('Invalid password'))
				) {
					toastStore.error('Invalid Password', 'Please check your password and try again.');
				}

				return;
			}

			errorMessage = result.error || 'Failed to load shared PDF';
			requiresPassword = false;
			isLoading = false;
			return;
		}

		// Success case - process the PDF
		try {
			sharedPDFData = result.sharedPDF;

			// Download and process LPDF file
			if (result.lpdfUrl) {
				try {
					// Fetch the LPDF file
					const lpdfResponse = await fetch(result.lpdfUrl);
					if (!lpdfResponse.ok) {
						throw new Error('Failed to download LPDF file');
					}

					const lpdfBlob = await lpdfResponse.blob();
					const lpdfFile = new File(
						[lpdfBlob],
						result.sharedPDF?.originalFileName || 'shared.lpdf',
						{ type: 'application/x-lpdf' }
					);

					// Import LPDF to extract PDF and annotations
					const { LPDFExporter } = await import('$lib/utils/lpdfExport');
					const importResult = await LPDFExporter.importFromLPDF(lpdfFile);

					if (importResult.pdfFile && importResult.annotations) {
						// Set the extracted PDF for viewing
						currentFile = importResult.pdfFile;

						// Get the original file size from metadata or use current size
						const originalSize =
							importResult.annotations.metadata?.originalSize ?? importResult.pdfFile.size;
						const originalFileName =
							importResult.annotations.metadata?.originalFilename ||
							result.sharedPDF?.originalFileName ||
							importResult.pdfFile.name;

						// Load annotations into stores properly
						console.log(
							'Loading annotations into stores for shared PDF:',
							importResult.annotations
						);
						await LPDFExporter.loadAnnotationsIntoStores(
							importResult.annotations,
							originalFileName,
							originalSize
						);

						console.log('Successfully loaded shared LPDF with annotations');
					} else {
						throw new Error('Failed to extract PDF from LPDF file');
					}
				} catch (error) {
					console.error('Error processing LPDF file:', error);
					throw new Error(
						`Failed to load LPDF file: ${error instanceof Error ? error.message : 'Unknown error'}`
					);
				}
			} else {
				throw new Error('No LPDF file found');
			}

			requiresPassword = false;
			isLoading = false;
		} catch (error) {
			console.error('Error processing LPDF file:', error);
			errorMessage = 'Failed to process shared PDF. Please try again.';
			isLoading = false;
		}
	}

	async function handlePasswordSubmit() {
		if (!password.trim()) {
			toastStore.error('Password Required', 'Please enter the password');
			return;
		}

		await loadSharedPDF($page.params.shareId!, password);
	}

	function goHome() {
		goto('/');
	}

	// Page-specific keyboard shortcuts (password submission, F11)
	function handlePageSpecificKeys(event: KeyboardEvent) {
		const isTyping =
			event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

		// Handle password submission
		if (event.key === 'Enter' && requiresPassword && isTyping) {
			handlePasswordSubmit();
			return;
		}

		switch (event.key) {
			case 'F11':
				event.preventDefault();
				if (!document.fullscreenElement) {
					document.documentElement.requestFullscreen?.();
				} else {
					document.exitFullscreen?.();
				}
				break;
		}
	}

	function handleStampToolClick() {
		// Open the stamp palette
		const stampButton = document.querySelector('.stamp-palette-container button');
		if (stampButton) {
			(stampButton as HTMLButtonElement).click();
		}
	}

	// Dummy function for file upload click (not needed in shared view)
	function handleFileUploadClick() {
		// No-op for shared view
	}

	// Thumbnail and page navigation handlers
	function handleToggleThumbnails(show: boolean) {
		showThumbnails = show;
	}

	function handlePageSelect(pageNumber: number) {
		pdfViewer?.goToPage(pageNumber);
	}

	// Wheel zoom handler
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

	// DOCX export handler for shared PDFs
	async function handleExportDOCX() {
		// Check if downloading is allowed for this shared PDF
		if (sharedPDFData?.allowDownloading === false) {
			toastStore.warning('Export Disabled', 'DOCX export is not allowed for this shared PDF.');
			return;
		}

		if (!currentFile || !pdfViewer) {
			toastStore.warning('No PDF', 'No PDF to export');
			return;
		}

		try {
			console.log('Starting DOCX export for shared PDF...');

			// Get the PDF bytes (currentFile should be a File object from LPDF import)
			if (typeof currentFile === 'string') {
				throw new Error('Shared PDF export expects a File object, not a URL');
			}
			const arrayBuffer = await currentFile.arrayBuffer();
			const pdfBytes = new Uint8Array(arrayBuffer);
			const originalName =
				sharedPDFData?.originalFileName?.replace(/\.pdf$/i, '') || 'shared-document';

			// Create annotated PDF first (same process as other pages)
			const exporter = new PDFExporter();
			exporter.setOriginalPDF(pdfBytes);

			// Export all pages with annotations
			console.log('Creating annotated PDF for DOCX export with', $pdfState.totalPages, 'pages');
			const totalPages = $pdfState.totalPages;
			let pagesWithAnnotations = 0;

			for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
				console.log(`Processing page ${pageNumber} for shared PDF DOCX export...`);

				// Check if this page has any annotations
				const hasAnnotations = await pdfViewer.pageHasAnnotations(pageNumber);

				if (hasAnnotations) {
					console.log(`📝 Page ${pageNumber} has annotations - creating merged canvas`);
					const mergedCanvas = await pdfViewer.getMergedCanvasForPage(pageNumber);
					if (mergedCanvas) {
						exporter.setPageCanvas(pageNumber, mergedCanvas);
						pagesWithAnnotations++;
						console.log(`✅ Added merged canvas for page ${pageNumber} to shared PDF DOCX export`);
					} else {
						console.log(`❌ Failed to create merged canvas for page ${pageNumber}`);
					}
				} else {
					console.log(`📄 Page ${pageNumber} has no annotations - will preserve original page`);
				}
			}

			console.log(
				`📊 Shared PDF DOCX Export summary: ${pagesWithAnnotations} pages with annotations out of ${totalPages} total pages`
			);

			// Get the annotated PDF bytes
			const annotatedPdfBytes = await exporter.exportToPDF();
			console.log(
				'Annotated PDF created for shared DOCX conversion, size:',
				annotatedPdfBytes.length
			);

			// Now convert the annotated PDF to DOCX
			const success = await exportCurrentPDFAsDocx(annotatedPdfBytes, `${originalName}.pdf`);
			if (success) {
				console.log('🎉 Shared PDF DOCX exported successfully with annotations');
			} else {
				console.log('📄 Shared PDF DOCX export was cancelled by user');
			}
		} catch (error) {
			console.error('Shared PDF DOCX export failed:', error);
			toastStore.error('Export Failed', 'DOCX export failed. Please try again.');
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
				document.documentElement.requestFullscreen?.();
			} else {
				document.exitFullscreen?.();
			}
		},
		onFileUploadClick: handleFileUploadClick,
		onStampToolClick: handleStampToolClick
	}}
	on:keydown={handlePageSpecificKeys}
	on:wheel={handleWheel}
/>

<main class="w-screen h-screen relative overflow-hidden">
	{#if isLoading}
		<div class="h-full flex items-center justify-center">
			<div class="text-center">
				<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sage mx-auto mb-4"></div>
				<p class="text-lg text-charcoal dark:text-gray-300">Loading shared PDF...</p>
			</div>
		</div>
	{:else if requiresPassword}
		<div class="h-full flex items-center justify-center bg-gradient-to-br from-cream to-pearl">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
				<div class="text-center mb-6">
					<div class="flex justify-center mb-4">
						<Lock class="w-12 h-12 text-sage" />
					</div>
					<h2 class="text-2xl font-bold text-charcoal dark:text-white mb-2">Password Required</h2>
					<p class="text-slate dark:text-gray-400">This shared PDF is password protected</p>
				</div>

				<div class="space-y-4">
					<div>
						<label
							for="password"
							class="block text-sm font-medium text-charcoal dark:text-gray-300 mb-2"
						>
							Enter Password
						</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							placeholder="Enter password"
							class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sage focus:border-transparent dark:bg-gray-700 dark:text-white"
						/>
					</div>

					<div class="flex gap-3">
						<button
							on:click={goHome}
							class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
						>
							Cancel
						</button>
						<button
							on:click={handlePasswordSubmit}
							disabled={!password.trim()}
							class="flex-1 px-4 py-2 bg-sage text-charcoal rounded-lg hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							Access PDF
						</button>
					</div>
				</div>
			</div>
		</div>
	{:else if errorMessage}
		<div class="h-full flex items-center justify-center bg-gradient-to-br from-cream to-pearl">
			<div
				class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4 text-center"
			>
				<div class="flex justify-center mb-4">
					<Frown class="w-16 h-16 text-slate dark:text-gray-400" />
				</div>
				<h2 class="text-2xl font-bold text-charcoal dark:text-white mb-2">Oops!</h2>
				<p class="text-slate dark:text-gray-400 mb-6">{errorMessage}</p>

				<button
					on:click={goHome}
					class="px-6 py-2 bg-sage text-charcoal rounded-lg hover:bg-sage/90 transition-colors"
				>
					Go Home
				</button>
			</div>
		</div>
	{:else if currentFile}
		{#if !focusMode && !presentationMode}
			<Toolbar
				onFileUpload={() => {}}
				onPreviousPage={() => pdfViewer?.previousPage()}
				onNextPage={() => pdfViewer?.nextPage()}
				onZoomIn={() => pdfViewer?.zoomIn()}
				onZoomOut={() => pdfViewer?.zoomOut()}
				onResetZoom={() => pdfViewer?.resetZoom()}
				onFitToWidth={() => pdfViewer?.fitToWidth()}
				onFitToHeight={() => pdfViewer?.fitToHeight()}
				onExportPDF={() => {}}
				onExportLPDF={() => {}}
				onExportDOCX={handleExportDOCX}
				{showThumbnails}
				onToggleThumbnails={handleToggleThumbnails}
				isSharedView={true}
				viewOnlyMode={sharedPDFData?.viewOnly || false}
				allowDownloading={sharedPDFData?.allowDownloading !== false}
				{presentationMode}
				onPresentationModeChange={(value) => {
					presentationMode = value;
					if (value) {
						enterFullscreen();
					} else {
						exitFullscreen();
					}
				}}
			/>
		{/if}

		<div class="w-full h-full" class:pt-12={!focusMode && !presentationMode}>
			<div class="flex h-full">
				{#if showThumbnails}
					<PageThumbnails isVisible={showThumbnails} onPageSelect={handlePageSelect} />
				{/if}

				<div class="flex-1">
					<PDFViewer
						bind:this={pdfViewer}
						pdfFile={currentFile}
						viewOnlyMode={sharedPDFData?.viewOnly || false}
						{presentationMode}
					/>
				</div>
			</div>
		</div>

		<!-- Shared PDF Info (positioned properly based on focus mode) -->
		{#if sharedPDFData && !focusMode && !presentationMode}
			<div
				class="absolute top-14 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm shadow-lg border border-gray-200 dark:border-gray-600"
			>
				<div class="flex items-center gap-2">
					<Link class="w-4 h-4 text-sage" />
					<div>
						<div class="font-medium text-charcoal dark:text-white">
							{sharedPDFData.originalFileName}
						</div>
						<div class="text-xs text-slate dark:text-gray-400">
							Shared PDF • {sharedPDFData.metadata?.pageCount || 0} pages
							{#if sharedPDFData.metadata?.hasAnnotations}
								• With annotations
							{/if}
							{#if sharedPDFData.viewOnly}
								• View Only
							{/if}
							{#if !sharedPDFData.allowDownloading}
								• No Downloads
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Footer with all cards -->
		<Footer
			{focusMode}
			{presentationMode}
			{getFormattedVersion}
			on:helpClick={() => (showShortcuts = true)}
		/>
	{/if}
</main>

<!-- Help/Shortcuts Modal -->
<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => (showShortcuts = false)} />

<style>
	main {
		background: linear-gradient(135deg, #fdf6e3 0%, #f7f3e9 50%, #f0efeb 100%);
	}

	:global(.dark) main {
		background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%);
	}
</style>
