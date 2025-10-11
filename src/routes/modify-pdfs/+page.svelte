<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Home, Download, RotateCcw, Loader2 } from 'lucide-svelte';
	import PDFUploadZone from '$lib/components/PDFUploadZone.svelte';
	import PDFMergeViewer from '$lib/components/PDFMergeViewer.svelte';
	import { toastStore } from '$lib/stores/toastStore';
	import {
		loadPDFInfo,
		generateThumbnail,
		mergePDFsWithFiles,
		downloadPDF,
		isValidPDF,
		type PDFPageInfo,
		type PDFFileInfo
	} from '$lib/utils/pdfMergeUtils';

	let uploadedFiles: PDFFileInfo[] = [];
	let pages: PDFPageInfo[] = [];
	let isProcessing = false;
	let processingMessage = '';

	// For display in upload zone
	$: uploadedFilesDisplay = uploadedFiles.map((f) => ({
		id: f.id,
		name: f.file.name,
		size: f.file.size,
		pageCount: f.pageCount
	}));

	async function handleFilesSelected(files: File[]) {
		isProcessing = true;
		processingMessage = 'Loading PDFs...';

		try {
			const validFiles = files.filter((file) => {
				if (!isValidPDF(file)) {
					toastStore.error('Invalid File', `${file.name} is not a valid PDF`);
					return false;
				}
				return true;
			});

			if (validFiles.length === 0) {
				isProcessing = false;
				return;
			}

			// Load PDF info for each file
			for (const file of validFiles) {
				try {
					const pdfInfo = await loadPDFInfo(file);
					uploadedFiles = [...uploadedFiles, pdfInfo];

					// Generate pages for this PDF
					const newPages: PDFPageInfo[] = [];
					for (let i = 1; i <= pdfInfo.pageCount; i++) {
						newPages.push({
							id: `${pdfInfo.id}-page-${i}`,
							sourceFileId: pdfInfo.id,
							sourceFileName: file.name,
							pageNumber: i
						});
					}

					pages = [...pages, ...newPages];

					// Generate thumbnails in background
					generateThumbnailsForPages(newPages, file);
				} catch (error) {
					console.error('Error loading PDF:', error);
					toastStore.error('Load Error', `Failed to load ${file.name}`);
				}
			}

			toastStore.success(
				'PDFs Loaded',
				`Successfully loaded ${validFiles.length} PDF${validFiles.length > 1 ? 's' : ''}`
			);
		} catch (error) {
			console.error('Error processing files:', error);
			toastStore.error('Processing Error', 'Failed to process PDF files');
		} finally {
			isProcessing = false;
			processingMessage = '';
		}
	}

	async function generateThumbnailsForPages(pagesToProcess: PDFPageInfo[], file: File) {
		// Generate thumbnails without blocking UI
		for (const page of pagesToProcess) {
			try {
				const thumbnail = await generateThumbnail(file, page.pageNumber, 150);

				// Update the page with thumbnail
				pages = pages.map((p) => {
					if (p.id === page.id) {
						return { ...p, thumbnailDataUrl: thumbnail };
					}
					return p;
				});
			} catch (error) {
				console.error(`Error generating thumbnail for page ${page.pageNumber}:`, error);
			}
		}
	}

	function handleRemoveFile(fileId: string) {
		// Remove file and all its pages
		uploadedFiles = uploadedFiles.filter((f) => f.id !== fileId);
		pages = pages.filter((p) => p.sourceFileId !== fileId);

		toastStore.info('File Removed', 'File and its pages have been removed');
	}

	function handleDeletePage(pageId: string) {
		pages = pages.filter((p) => p.id !== pageId);
		toastStore.info('Page Deleted', 'Page removed successfully');
	}

	function handleReorder(fromIndex: number, toIndex: number) {
		const newPages = [...pages];
		const [movedPage] = newPages.splice(fromIndex, 1);
		newPages.splice(toIndex, 0, movedPage);
		pages = newPages;

		console.log(`Reordered: page ${fromIndex + 1} → ${toIndex + 1}`);
	}

	async function handleMergeAndDownload() {
		if (pages.length === 0) {
			toastStore.warning('No Pages', 'Please upload at least one PDF file');
			return;
		}

		isProcessing = true;
		processingMessage = 'Merging PDFs...';

		try {
			// Create a map of file IDs to File objects
			const filesMap = new Map<string, File>();
			for (const fileInfo of uploadedFiles) {
				filesMap.set(fileInfo.id, fileInfo.file);
			}

			// Merge PDFs
			const mergedPdfBytes = await mergePDFsWithFiles(pages, filesMap);

			// Generate filename
			const timestamp = new Date().toISOString().split('T')[0];
			const filename = `merged_${timestamp}.pdf`;

			// Download
			downloadPDF(mergedPdfBytes, filename);

			toastStore.success('Success', `PDF merged successfully: ${filename}`);
		} catch (error) {
			console.error('Error merging PDFs:', error);
			toastStore.error('Merge Failed', 'Failed to merge PDFs. Please try again.');
		} finally {
			isProcessing = false;
			processingMessage = '';
		}
	}

	function handleReset() {
		if (
			pages.length === 0 ||
			confirm('Are you sure you want to reset? All uploaded files and changes will be lost.')
		) {
			uploadedFiles = [];
			pages = [];
			toastStore.info('Reset', 'All files and pages have been cleared');
		}
	}

	function handleGoHome() {
		goto('/');
	}
</script>

<svelte:head>
	<title>Modify PDFs - Merge & Reorder | LeedPDF</title>
	<meta
		name="description"
		content="Merge multiple PDFs and reorder pages with an intuitive drag-and-drop interface"
	/>
</svelte:head>

<div class="min-h-screen bg-cream dark:bg-gray-900">
	<!-- Header -->
	<header class="bg-white dark:bg-gray-800 border-b border-slate/20 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold text-charcoal dark:text-gray-100">Modify PDFs</h1>
					<p class="text-sm text-slate dark:text-gray-400 mt-1">
						Merge multiple PDFs and reorder pages
					</p>
				</div>

				<button
					on:click={handleGoHome}
					class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate dark:text-gray-300 hover:text-sage dark:hover:text-sage transition-colors"
					title="Go to home"
				>
					<Home size={20} />
					<span class="hidden sm:inline">Home</span>
				</button>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<div class="space-y-8">
			<!-- Upload Section -->
			<section>
				<PDFUploadZone
					onFilesSelected={handleFilesSelected}
					uploadedFiles={uploadedFilesDisplay}
					onRemoveFile={handleRemoveFile}
				/>
			</section>

			<!-- Pages Viewer Section -->
			<section>
				<PDFMergeViewer {pages} onReorder={handleReorder} onDeletePage={handleDeletePage} />
			</section>

			<!-- Action Buttons -->
			{#if pages.length > 0}
				<section class="flex flex-wrap gap-4 justify-center pb-8">
					<button
						on:click={handleMergeAndDownload}
						disabled={isProcessing}
						class="flex items-center gap-2 px-6 py-3 bg-sage hover:bg-sage/90 disabled:bg-slate/50 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed"
					>
						{#if isProcessing}
							<Loader2 size={20} class="animate-spin" />
							<span>{processingMessage}</span>
						{:else}
							<Download size={20} />
							<span>Merge & Download PDF</span>
						{/if}
					</button>

					<button
						on:click={handleReset}
						disabled={isProcessing}
						class="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-slate/30 text-charcoal dark:text-gray-200 font-semibold rounded-lg shadow-md hover:shadow-lg border-2 border-slate/20 dark:border-gray-600 transition-all duration-200 disabled:cursor-not-allowed"
					>
						<RotateCcw size={20} />
						<span>Reset</span>
					</button>
				</section>
			{/if}

			<!-- Instructions -->
			<section
				class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-slate/20 dark:border-gray-700 shadow-sm"
			>
				<h2 class="text-lg font-semibold text-charcoal dark:text-gray-200 mb-4">
					How to Use
				</h2>
				<ol class="space-y-2 text-sm text-slate dark:text-gray-400">
					<li class="flex items-start gap-3">
						<span
							class="flex-shrink-0 w-6 h-6 bg-sage/20 text-sage rounded-full flex items-center justify-center text-xs font-bold"
							>1</span
						>
						<span>Upload one or more PDF files using the upload zone above</span>
					</li>
					<li class="flex items-start gap-3">
						<span
							class="flex-shrink-0 w-6 h-6 bg-sage/20 text-sage rounded-full flex items-center justify-center text-xs font-bold"
							>2</span
						>
						<span>
							Drag and drop pages to reorder them - pages from different files can be mixed
						</span>
					</li>
					<li class="flex items-start gap-3">
						<span
							class="flex-shrink-0 w-6 h-6 bg-sage/20 text-sage rounded-full flex items-center justify-center text-xs font-bold"
							>3</span
						>
						<span>Click the trash icon on any page to remove it from the final PDF</span>
					</li>
					<li class="flex items-start gap-3">
						<span
							class="flex-shrink-0 w-6 h-6 bg-sage/20 text-sage rounded-full flex items-center justify-center text-xs font-bold"
							>4</span
						>
						<span>Click "Merge & Download PDF" to download your customized PDF</span>
					</li>
				</ol>
			</section>
		</div>
	</main>

	<!-- Processing Overlay -->
	{#if isProcessing}
		<div
			class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
			style="backdrop-filter: blur(4px);"
		>
			<div class="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl text-center">
				<Loader2 size={48} class="animate-spin text-sage mx-auto mb-4" />
				<p class="text-lg font-semibold text-charcoal dark:text-gray-200">
					{processingMessage}
				</p>
				<p class="text-sm text-slate dark:text-gray-400 mt-2">Please wait...</p>
			</div>
		</div>
	{/if}
</div>
