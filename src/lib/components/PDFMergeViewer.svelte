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
	<div class="pages-viewer-container">
		<div class="mb-4 flex items-center justify-between flex-wrap gap-2">
			<h3 class="text-lg font-semibold text-charcoal dark:text-gray-200">
				Pages ({pages.length})
			</h3>
			<p class="text-sm text-slate dark:text-gray-400">
				Drag and drop to reorder • Click trash icon to delete
			</p>
		</div>

		<div class="pages-grid-wrapper">
			<div class="pages-grid">
				{#each pages as page, index (page.id)}
					<div class="page-card-wrapper">
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
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.pages-viewer-container {
		width: 100%;
	}

	.pages-grid-wrapper {
		overflow-x: auto;
		overflow-y: visible;
		padding: 1rem;
		background-color: rgba(253, 246, 227, 0.2);
		border-radius: 0.5rem;
		border: 1px solid rgba(100, 116, 139, 0.2);
	}

	:global(.dark) .pages-grid-wrapper {
		background-color: rgba(17, 24, 39, 0.2);
		border-color: rgba(55, 65, 81, 1);
	}

	.pages-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		min-width: fit-content;
	}

	.page-card-wrapper {
		flex-shrink: 0;
		width: 180px;
	}

	/* Ensure cards don't overlap */
	.page-card-wrapper :global(.pdf-page-card) {
		position: relative;
		z-index: 1;
	}

	.page-card-wrapper :global(.pdf-page-card:hover) {
		z-index: 10;
	}
</style>
