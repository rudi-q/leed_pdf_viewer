<script lang="ts">
	import PDFPageCard from './PDFPageCard.svelte';
	import type { PDFPageInfo } from '$lib/utils/pdfMergeUtils';

	export let pages: PDFPageInfo[] = [];
	export let onReorder: (fromIndex: number, toIndex: number) => void;
	export let onDeletePage: (pageId: string) => void;

	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;

	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDragEnd() {
		if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
			onReorder(draggedIndex, dragOverIndex);
		}
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragOver(index: number) {
		if (draggedIndex !== null && index !== draggedIndex) {
			dragOverIndex = index;
		}
	}
</script>

{#if pages.length === 0}
	<div
		class="flex items-center justify-center p-12 border-2 border-dashed border-slate/30 dark:border-gray-700 rounded-lg bg-cream/20 dark:bg-gray-800/20"
	>
		<div class="text-center">
			<p class="text-slate dark:text-gray-400 text-lg mb-2">No pages to display</p>
			<p class="text-slate/70 dark:text-gray-500 text-sm">
				Upload PDF files above to get started
			</p>
		</div>
	</div>
{:else}
	<div>
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-lg font-semibold text-charcoal dark:text-gray-200">
				Pages ({pages.length})
			</h3>
			<p class="text-sm text-slate dark:text-gray-400">
				Drag and drop to reorder • Click trash icon to delete
			</p>
		</div>

		<div
			class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4 bg-cream/20 dark:bg-gray-900/20 rounded-lg border border-slate/20 dark:border-gray-700"
		>
			{#each pages as page, index (page.id)}
				<PDFPageCard
					{page}
					{index}
					onDelete={onDeletePage}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDragOver={handleDragOver}
					isDragging={draggedIndex === index}
					isOver={dragOverIndex === index}
				/>
			{/each}
		</div>
	</div>
{/if}
