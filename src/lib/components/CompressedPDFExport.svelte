<script lang="ts">
	import CompressionSettingsModal from './CompressionSettingsModal.svelte';
	import ExportProgressCard from './ExportProgressCard.svelte';
	import { compressPdfBytes } from '$lib/utils/exportHandlers';
	import { PDFExporter } from '$lib/utils/pdfExport';
	import { isTauri, detectOS } from '$lib/utils/tauriUtils';
	import { Download, X } from 'lucide-svelte';

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
	let showDesktopOnlyModal = false;

	// Determine download URL based on OS
	$: downloadUrl = (() => {
		const os = detectOS();
		switch (os) {
			case 'Windows':
				return '/download-for-windows';
			case 'macOS':
				return '/download-for-mac';
			default:
				return '/downloads';
		}
	})();

	// Progress card state
	let isExporting = false;
	let exportOperation = '';
	let exportStatus: 'processing' | 'success' | 'error' = 'processing';
	let exportMessage = '';
	let exportProgress = 0;

	/** Called by the parent (via bind:this or Toolbar callback) to open the settings modal */
	export function open() {
		if (!getAnnotatedPdf) {
			console.warn('CompressedPDFExport: no getAnnotatedPdf callback provided');
			return;
		}

		// If web (not Tauri), show desktop-only modal instead
		if (!isTauri) {
			showDesktopOnlyModal = true;
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
			const filename = `${originalName}_compressed_leedpdf.pdf`;

			exportProgress = 85;
			exportMessage = 'Saving file...';
			const success = await PDFExporter.exportFile(
				compressedBytes,
				filename,
				'application/pdf'
			);

			if (success) {
				const deltaPct = ((originalSize - compressedSize) / originalSize * 100);
				const absPct = Math.abs(deltaPct).toFixed(1);
				const sizeLabel = compressedSize < originalSize
					? `${absPct}% smaller`
					: compressedSize > originalSize
						? `${absPct}% larger`
						: 'no change';
				exportProgress = 100;
				exportStatus = 'success';
				exportOperation = 'Export Complete';
				exportMessage = `${filename} (${sizeLabel})`;
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

<!-- Compression quality settings modal (Desktop only) -->
<CompressionSettingsModal
	bind:isOpen={showSettingsModal}
	on:close
	on:confirm={handleConfirm}
/>

<!-- Desktop-only feature modal (Web only) -->
{#if showDesktopOnlyModal}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		on:click={() => (showDesktopOnlyModal = false)}
		role="dialog"
		aria-labelledby="modal-title"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="relative w-full max-w-md rounded-lg bg-white p-8 shadow-xl dark:bg-charcoal"
			on:click={(e) => e.stopPropagation()}
		>
			<!-- Close button -->
			<button
				class="absolute right-4 top-4 rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
				on:click={() => (showDesktopOnlyModal = false)}
				aria-label="Close modal"
			>
				<X class="h-5 w-5" />
			</button>

			<!-- Header -->
			<div class="mb-6 flex items-center gap-3">
				<div class="rounded-full bg-sage/20 p-3">
					<Download class="h-6 w-6 text-sage" />
				</div>
				<h2 id="modal-title" class="text-2xl font-bold dark:text-white">
					Compress PDF
				</h2>
			</div>

			<!-- Content -->
			<div class="mb-6 space-y-4">
				<p class="text-gray-700 dark:text-gray-300">
					PDF compression with advanced image optimization is a <strong>premium feature</strong> available exclusively on the <strong>LeedPDF Desktop App</strong>.
				</p>

				<div class="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
					<p class="text-sm text-amber-900 dark:text-amber-100">
						<strong>Why desktop only?</strong> Advanced compression happens locally on your device for maximum privacy and performance—no uploads needed!
					</p>
				</div>

				<div class="space-y-2">
					<h3 class="font-semibold dark:text-white">With LeedPDF Desktop, you get:</h3>
					<ul class="space-y-1 text-sm text-gray-700 dark:text-gray-300">
						<li>✓ Compress PDFs by 40-95% with adjustable quality</li>
						<li>✓ Process files locally - no internet required</li>
						<li>✓ Batch compression for multiple files</li>
						<li>✓ Full offline support</li>
					</ul>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-3">
				<button
					class="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
					on:click={() => (showDesktopOnlyModal = false)}
				>
					Not Now
				</button>
				<a
					href={downloadUrl}
					class="flex-1 rounded-lg bg-sage px-4 py-2.5 text-center font-medium text-white transition hover:bg-sage/90 dark:bg-sage dark:hover:bg-sage/80"
					on:click={() => (showDesktopOnlyModal = false)}
				>
					Download App
				</a>
			</div>

			<!-- Footer note -->
			<p class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
				Upgrade to LeedPDF Desktop to unlock compression.
			</p>
		</div>
	</div>
{/if}

<!-- Progress card (bottom-right) -->
<ExportProgressCard
	bind:isExporting
	operation={exportOperation}
	status={exportStatus}
	message={exportMessage}
	progress={exportProgress}
/>
