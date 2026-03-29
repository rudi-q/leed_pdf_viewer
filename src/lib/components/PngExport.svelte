<script lang="ts">
	import ExportProgressCard from './ExportProgressCard.svelte';
	import { exportCurrentPageAsPng, exportAllPagesAsPngZip } from '$lib/utils/exportHandlers';
	import { forceSaveAllAnnotations } from '$lib/stores/drawingStore';

	/**
	 * Callback the parent route provides.
	 * Returns the pdfViewer reference, the current page, total pages, and a base filename.
	 */
	export let getExportContext:
		| (() => {
				pdfViewer: { getMergedCanvasForPage: (page: number) => Promise<HTMLCanvasElement | null> };
				currentPage: number;
				totalPages: number;
				baseName: string;
		  })
		| null = null;

	/** Optional analytics callback fired on successful export */
	export let onExportSuccess: ((filename: string) => void) | undefined = undefined;

	// Progress card state
	let isExporting = false;
	let exportOperation = '';
	let exportStatus: 'processing' | 'success' | 'error' = 'processing';
	let exportMessage = '';
	let exportProgress = 0;

	/** Called by the parent (via bind:this) to start the export */
	export function open() {
		if (!getExportContext) {
			console.warn('PngExport: no getExportContext callback provided');
			return;
		}
		if (isExporting) return; // prevent concurrent exports on double-click
		doExport();
	}

	async function doExport() {
		if (!getExportContext) return;

		const ctx = getExportContext();

		try {
			isExporting = true;
			exportStatus = 'processing';
			exportProgress = 5;

			// Flush any in-memory annotations to persistent storage before rendering
			await forceSaveAllAnnotations();

			const isSinglePage = ctx.totalPages === 1;
			exportOperation = isSinglePage ? 'Exporting PNG' : 'Exporting PNGs';
			exportMessage = isSinglePage ? 'Rendering page...' : `Rendering ${ctx.totalPages} pages...`;

			let success: boolean;

			if (isSinglePage) {
				exportProgress = 30;
				exportMessage = 'Converting to PNG...';
				success = await exportCurrentPageAsPng(ctx.pdfViewer, ctx.currentPage, ctx.baseName);
			} else {
				success = await exportAllPagesAsPngZip(
					ctx.pdfViewer,
					ctx.totalPages,
					ctx.baseName,
					(percent) => {
						exportProgress = percent;
						exportMessage = `Rendering pages... ${percent}%`;
					}
				);
			}

			if (success) {
				exportProgress = 100;
				exportStatus = 'success';
				exportOperation = 'Export Complete';
				const filename = isSinglePage
					? `${ctx.baseName}_page${ctx.currentPage}.png`
					: `${ctx.baseName}_pages.zip`;
				exportMessage = filename;
				console.log(`PNG export successful: ${filename}`);
				onExportSuccess?.(filename);
			} else {
				isExporting = false;
				console.log('PNG export was cancelled by user');
			}
		} catch (error) {
			console.error('PNG export failed:', error);
			exportProgress = 0;
			exportStatus = 'error';
			exportOperation = 'Export Failed';
			exportMessage = 'Failed to export as PNG. Please try again.';
		}
	}
</script>

<!-- Progress card (bottom-right) -->
<ExportProgressCard
	bind:isExporting
	operation={exportOperation}
	status={exportStatus}
	message={exportMessage}
	progress={exportProgress}
/>
