<script lang="ts">
	import { goto } from '$app/navigation';
	import { toastStore } from '$lib/stores/toastStore';
	import { MAX_FILE_SIZE } from '$lib/constants';
	import { storeUploadedFile } from '$lib/utils/fileStorageUtils';
	import { isValidMarkdownFile, isValidImageFile, isValidPDFFile } from '$lib/utils/pdfUtils';
	import { readMarkdownFile, convertMarkdownToPDF } from '$lib/utils/markdownUtils';
	import { convertImageToPDF } from '$lib/utils/imageImport';
	import { UploadCloud } from 'lucide-svelte';

	export let heading: string;
	export let subheading: string;
	export let accept: string;
	export let ctaText: string = 'Choose File';
	export let seoTitle: string;
	export let seoDescription: string;

	let dragOver = false;
	let isProcessing = false;
	let fileInput: HTMLInputElement;

	async function handleFileUpload(files: FileList) {
		if (files.length === 0) return;

		const file = files[0];
		dragOver = false;

		// Validate against the accept prop instead of running all validators unconditionally.
		// This prevents, e.g., /png-to-pdf accepting Markdown files just because the shared
		// handler also knows how to convert Markdown.
		const acceptsImages = accept.includes('image') || /\.(png|jpe?g|webp)/i.test(accept);
		const acceptsMarkdown = accept.includes('.md') || accept.includes('markdown');
		const acceptsPDF = accept.includes('.pdf');

		const isImage = acceptsImages && isValidImageFile(file);
		const isMarkdown = acceptsMarkdown && isValidMarkdownFile(file);
		const isPDF = acceptsPDF && isValidPDFFile(file);

		if (!isPDF && !isMarkdown && !isImage) {
			toastStore.error('Invalid File', `Please choose a valid file matching: ${accept}`);
			return;
		}

		if (file.size > MAX_FILE_SIZE) {
			toastStore.error(
				'File Too Large',
				`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
			);
			return;
		}

		try {
			isProcessing = true;
			let fileToStore = file;

			if (isMarkdown) {
				toastStore.info('Converting...', 'Converting markdown to PDF, please wait...');
				const markdownContent = await readMarkdownFile(file);
				let pdfFilename = file.name.replace(/\.(md|markdown|mdown|mkd|mkdn)$/i, '.pdf');
				if (!/\.pdf$/i.test(pdfFilename)) pdfFilename += '.pdf'; // guard for extensionless filenames
				fileToStore = await convertMarkdownToPDF(markdownContent, pdfFilename);
			} else if (isImage) {
				toastStore.info('Converting...', 'Converting image to PDF, please wait...');
				fileToStore = await convertImageToPDF(file);
			}

			if (fileToStore.size > MAX_FILE_SIZE) {
				toastStore.error(
					'File Too Large',
					`Converted PDF size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
				);
				isProcessing = false;
				return;
			}

			const result = await storeUploadedFile(fileToStore);

			try {
				if (result.success && result.id) {
					await goto(`/pdf-upload?fileId=${result.id}`);
				} else {
					toastStore.error(
						'Storage Error',
						result.error ? String(result.error) : 'Failed to store the file. Please try again.'
					);
				}
			} finally {
				isProcessing = false;
			}
		} catch (error) {
			console.error('Error during file upload process:', error);
			toastStore.error('Upload Error', 'Failed to process the requested file. Please try again.');
			isProcessing = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!isProcessing) dragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (isProcessing) return;
		dragOver = false;
		if (e.dataTransfer?.files) {
			handleFileUpload(e.dataTransfer.files);
		}
	}
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={seoDescription} />
</svelte:head>

<div class="min-h-screen bg-sand flex flex-col items-center justify-center p-4">
	<div class="max-w-2xl w-full text-center space-y-8">
		<div class="space-y-4">
			<h1 class="text-4xl sm:text-5xl font-bold text-charcoal">{heading}</h1>
			<p class="text-lg sm:text-xl text-charcoal/80">{subheading}</p>
		</div>

		<!-- Standalone dropzone strictly isolated from homepage -->
		<button
			type="button"
			class="w-full h-80 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all bg-white/50 backdrop-blur-sm group"
			class:border-sage={dragOver}
			class:bg-sage={dragOver}
			class:bg-opacity-10={dragOver}
			class:border-white={!dragOver}
			class:border-opacity-30={!dragOver}
			class:hover:border-sage={!isProcessing}
			class:hover:bg-white={!isProcessing}
			class:opacity-50={isProcessing}
			class:cursor-not-allowed={isProcessing}
			aria-busy={isProcessing}
			aria-disabled={isProcessing}
			tabindex={isProcessing ? -1 : 0}
			on:dragover={handleDragOver}
			on:dragleave={handleDragLeave}
			on:drop={handleDrop}
			on:click={() => {
				if (!isProcessing) fileInput.click();
			}}
		>
			<div class="flex flex-col items-center space-y-4 pointer-events-none">
				{#if isProcessing}
					<div
						class="w-16 h-16 border-4 border-sage border-t-transparent rounded-full animate-spin"
					></div>
					<h3 class="text-2xl font-semibold text-charcoal">Converting...</h3>
					<p class="text-charcoal/60">This runs entirely in your browser.</p>
				{:else}
					<div
						class="w-20 h-20 rounded-full bg-sage/20 flex items-center justify-center text-sage group-hover:scale-110 transition-transform"
					>
						<UploadCloud size={40} />
					</div>
					<div class="space-y-2">
						<h3 class="text-2xl font-semibold text-charcoal">{ctaText}</h3>
						<p class="text-charcoal/60">or drag and drop it here</p>
					</div>
				{/if}
			</div>
		</button>

		<input
			bind:this={fileInput}
			type="file"
			{accept}
			multiple={false}
			class="hidden"
			disabled={isProcessing}
			on:change={(e) => {
				const files = (e.target as HTMLInputElement).files;
				if (files && files.length > 0) handleFileUpload(files);
				// Reset input so same file can be selected again if it failed
				(e.target as HTMLInputElement).value = '';
			}}
		/>

		<!-- SEO copy block below dropzone -->
		<div class="pt-12 text-left space-y-6 max-w-xl mx-auto text-charcoal/80">
			<div class="flex items-start gap-4">
				<div
					class="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center text-sage shrink-0 font-bold"
				>
					1
				</div>
				<div>
					<h4 class="font-semibold text-charcoal text-lg">Instant & Private</h4>
					<p>
						We do not upload your files to any servers. The conversion code runs entirely inside
						your browser, keeping your data completely private.
					</p>
				</div>
			</div>
			<div class="flex items-start gap-4">
				<div
					class="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center text-sage shrink-0 font-bold"
				>
					2
				</div>
				<div>
					<h4 class="font-semibold text-charcoal text-lg">No Account Needed</h4>
					<p>
						Just drag, drop, and convert. You can immediately annotate, edit, and save the resulting
						PDF instantly.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
