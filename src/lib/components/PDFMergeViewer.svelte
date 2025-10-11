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
		overflow-x: scroll; /* Always show horizontal scrollbar */
		overflow-y: visible;
		padding: 1rem 1rem 2rem 1rem; /* Extra bottom padding for scrollbar */
		background-color: rgba(253, 246, 227, 0.2);
		border-radius: 0.5rem;
		border: 1px solid rgba(100, 116, 139, 0.2);
		/* Force scrollbar to always be visible */
		scrollbar-width: auto; /* Firefox */
		scrollbar-color: #87A96B #f1f5f9; /* sage thumb, light track */
	}

	:global(.dark) .pages-grid-wrapper {
		background-color: rgba(17, 24, 39, 0.2);
		border-color: rgba(55, 65, 81, 1);
		scrollbar-color: #87A96B #374151; /* sage thumb, dark track */
	}

	/* Webkit scrollbar - always visible */
	.pages-grid-wrapper::-webkit-scrollbar {
		height: 14px; /* Bigger for better visibility */
		background-color: #f1f5f9;
		border-radius: 7px;
	}

	:global(.dark) .pages-grid-wrapper::-webkit-scrollbar {
		background-color: #374151;
	}

	.pages-grid-wrapper::-webkit-scrollbar-track {
		background: #e2e8f0;
		border-radius: 7px;
		border: 1px solid #cbd5e1;
	}

	:global(.dark) .pages-grid-wrapper::-webkit-scrollbar-track {
		background: #4b5563;
		border-color: #6b7280;
	}

	.pages-grid-wrapper::-webkit-scrollbar-thumb {
		background: #87A96B; /* sage color */
		border-radius: 7px;
		border: 2px solid #e2e8f0;
		min-width: 30px; /* Minimum thumb width */
	}

	:global(.dark) .pages-grid-wrapper::-webkit-scrollbar-thumb {
		border-color: #4b5563;
	}

	.pages-grid-wrapper::-webkit-scrollbar-thumb:hover {
		background: #6f8a55; /* darker sage on hover */
	}

	.pages-grid-wrapper::-webkit-scrollbar-thumb:active {
		background: #5a6e44; /* even darker sage when clicking */
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
