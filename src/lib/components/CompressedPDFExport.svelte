<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import CompressionSettingsModal from './CompressionSettingsModal.svelte';
	import ExportProgressCard from './ExportProgressCard.svelte';
	import { compressPdfBytes } from '$lib/utils/exportHandlers';
	import { PDFExporter } from '$lib/utils/pdfExport';

	/**
	 * Callback that the parent route provides.
	 * It should return the annotated PDF bytes and a base filename (without extension).
	 * This is the ONLY thing each route needs to implement differently.
	 */
	export let getAnnotatedPdf: (() => Promise<{
		bytes: Uint8Array;
		filename: string;
	}>) | null = null;

	/** Optional analytics callback fired on successful export */
	export let onExportSuccess: ((filename: string, size: number) => void) | undefined = undefined;

	// Modal state
	let showSettingsModal = false;

	// Progress card state
	let isExporting = false;
	let exportOperation = '';
	let exportStatus: 'processing' | 'success' | 'error' = 'processing';
	let exportMessage = '';
	let exportProgress = 0;

	const dispatch = createEventDispatcher<{ triggerExport: void }>();

	/** Called by the parent (via bind:this or Toolbar callback) to open the settings modal */
	export function open() {
		if (!getAnnotatedPdf) {
			console.warn('CompressedPDFExport: no getAnnotatedPdf callback provided');
			return;
		}
		showSettingsModal = true;
	}

	async function handleConfirm(event: CustomEvent<{ quality: number }>) {
		const { quality } = event.detail;
		showSettingsModal = false;

		if (!getAnnotatedPdf) return;

		try {
			isExporting = true;
			exportOperation = 'Compressing PDF';
			exportStatus = 'processing';
			exportProgress = 5;
			exportMessage = 'Preparing PDF...';

			exportProgress = 15;
			exportMessage = 'Merging annotations...';

			const { bytes: annotatedPdfBytes, filename: originalName } = await getAnnotatedPdf();
			const originalSize = annotatedPdfBytes.length;

			exportProgress = 45;
			exportMessage = `Compressing images (${quality}% quality)...`;
			const compressedBytes = await compressPdfBytes(annotatedPdfBytes, quality);
			const compressedSize = compressedBytes.length;
			const filename = `${originalName}_compressed.pdf`;

			exportProgress = 85;
			exportMessage = 'Saving file...';
			const success = await PDFExporter.exportFile(
				compressedBytes,
				filename,
				'application/pdf'
			);

			if (success) {
				const ratio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
				exportProgress = 100;
				exportStatus = 'success';
				exportOperation = 'Export Complete';
				exportMessage = `${filename} (${ratio}% smaller)`;
				console.log('Compressed PDF exported successfully:', filename);
				onExportSuccess?.(filename, compressedSize);
			} else {
				isExporting = false;
				console.log('Compressed PDF export was cancelled by user');
			}
		} catch (error) {
			console.error('Compressed PDF export failed:', error);
			exportProgress = 0;
			exportStatus = 'error';
			exportOperation = 'Export Failed';
			exportMessage = 'Failed to compress PDF. Please try again.';
		}
	}
</script>

<!-- Compression quality settings modal -->
<CompressionSettingsModal
	bind:isOpen={showSettingsModal}
	on:close
	on:confirm={handleConfirm}
/>

<!-- Progress card (bottom-right) -->
<ExportProgressCard
	bind:isExporting
	operation={exportOperation}
	status={exportStatus}
	message={exportMessage}
	progress={exportProgress}
/>
