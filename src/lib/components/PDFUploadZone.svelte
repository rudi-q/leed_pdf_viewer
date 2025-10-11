<script lang="ts">
	import { Upload, FileText, X } from 'lucide-svelte';
	import { formatFileSize } from '$lib/utils/pdfMergeUtils';

	export let onFilesSelected: (files: File[]) => void;
	export let uploadedFiles: Array<{ id: string; name: string; size: number; pageCount: number }> =
		[];
	export let onRemoveFile: (fileId: string) => void;

	let isDragging = false;
	let fileInput: HTMLInputElement;

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const files = Array.from(e.dataTransfer?.files || []).filter(
			(file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
		);

		if (files.length > 0) {
			onFilesSelected(files);
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files || []);

		if (files.length > 0) {
			onFilesSelected(files);
		}

		// Reset input so same file can be selected again
		input.value = '';
	}

	function handleClick() {
		fileInput.click();
	}
</script>

<div class="space-y-4">
	<!-- Upload Zone -->
	<div
		role="button"
		tabindex="0"
		on:click={handleClick}
		on:keydown={(e) => e.key === 'Enter' && handleClick()}
		on:dragover={handleDragOver}
		on:dragleave={handleDragLeave}
		on:drop={handleDrop}
		class="upload-zone relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 {isDragging ? 'border-sage shadow-lg upload-zone-dragging' : 'border-slate hover:border-lavender bg-cream dark:bg-gray-800'}"
	>
		<div class="flex flex-col items-center gap-4">
			<div
				class="p-4 rounded-full transition-colors {isDragging ? 'upload-icon-dragging' : 'bg-cream dark:bg-gray-700'}"
			>
				<Upload
					size={32}
					class="transition-colors {isDragging ? 'text-sage' : 'text-slate dark:text-gray-400'}"
				/>
			</div>

			<div>
				<h3 class="text-lg font-semibold text-charcoal dark:text-gray-200 mb-2">
					{isDragging ? 'Drop PDFs here' : 'Upload PDFs'}
				</h3>
				<p class="text-sm text-slate dark:text-gray-400">
					Drag & drop PDF files here or click to browse
				</p>
				<p class="text-xs text-slate dark:text-gray-500 mt-2" style="opacity: 0.7;">
					You can upload multiple PDFs to merge or reorder
				</p>
			</div>
		</div>

		<input
			bind:this={fileInput}
			type="file"
			accept=".pdf,application/pdf"
			multiple
			class="hidden"
			on:change={handleFileInput}
		/>
	</div>

	<!-- Uploaded Files List -->
	{#if uploadedFiles.length > 0}
		<div class="space-y-2">
			<h4 class="text-sm font-semibold text-charcoal dark:text-gray-200">
				Uploaded Files ({uploadedFiles.length})
			</h4>
			<div class="space-y-2">
				{#each uploadedFiles as file (file.id)}
					<div
						class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-slate dark:border-gray-700 hover:border-sage dark:hover:border-sage transition-colors group"
						style="border-opacity: 0.2;"
					>
						<div class="flex-shrink-0 text-sage">
							<FileText size={20} />
						</div>

						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium text-charcoal dark:text-gray-200 truncate">
								{file.name}
							</div>
							<div class="text-xs text-slate dark:text-gray-400">
								{formatFileSize(file.size)} • {file.pageCount}
								{file.pageCount === 1 ? 'page' : 'pages'}
							</div>
						</div>

						<button
							on:click={() => onRemoveFile(file.id)}
							class="flex-shrink-0 p-1 text-slate hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
							title="Remove file"
						>
							<X size={16} />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.upload-zone {
		min-height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.upload-zone-dragging {
		transform: scale(1.02);
		background-color: rgba(135, 169, 107, 0.1);
	}

	.upload-icon-dragging {
		background-color: rgba(135, 169, 107, 0.2);
	}
</style>
