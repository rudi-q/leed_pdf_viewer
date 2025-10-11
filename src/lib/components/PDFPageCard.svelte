<script lang="ts">
	import { GripVertical, Trash2 } from 'lucide-svelte';
	import type { PDFPageInfo } from '$lib/utils/pdfMergeUtils';

	export let page: PDFPageInfo;
	export let index: number;
	export let onDelete: (pageId: string) => void;
	export let onDragStart: (index: number) => void;
	export let onDragEnd: () => void;
	export let onDragOver: (index: number) => void;
	export let isDragging = false;
	export let isOver = false;

	function handleDragStart(e: DragEvent) {
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());
		}
		onDragStart(index);
	}

	function handleDragEnd() {
		onDragEnd();
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		onDragOver(index);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
	}

	function handleDelete() {
		onDelete(page.id);
	}
</script>

<div
	role="button"
	tabindex="0"
	draggable="true"
	on:dragstart={handleDragStart}
	on:dragend={handleDragEnd}
	on:dragover={handleDragOver}
	on:drop={handleDrop}
	class="pdf-page-card group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 transition-all duration-200 cursor-move select-none"
	class:border-slate={!isDragging && !isOver}
	class:border-sage={isOver && !isDragging}
	class:opacity-50={isDragging}
	class:scale-105={isOver && !isDragging}
	class:shadow-lg={isOver && !isDragging}
	class:hover:border-lavender={!isDragging}
	class:hover:shadow-md={!isDragging}
>
	<!-- Drag Handle -->
	<div
		class="absolute top-2 left-2 text-slate dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-gray-800/80 rounded p-1"
	>
		<GripVertical size={16} />
	</div>

	<!-- Delete Button -->
	<button
		on:click={handleDelete}
		class="absolute top-2 right-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-gray-800/80 rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/20"
		title="Delete page"
	>
		<Trash2 size={16} />
	</button>

	<!-- Thumbnail -->
	<div class="p-3">
		{#if page.thumbnailDataUrl}
			<img
				src={page.thumbnailDataUrl}
				alt="Page {page.pageNumber}"
				class="w-full h-auto rounded shadow-sm"
			/>
		{:else}
			<div
				class="w-full aspect-[3/4] bg-cream dark:bg-gray-700 rounded flex items-center justify-center"
			>
				<div class="text-slate dark:text-gray-400 text-sm animate-pulse">Loading...</div>
			</div>
		{/if}
	</div>

	<!-- Page Info -->
	<div
		class="px-3 pb-3 text-center border-t border-slate/20 dark:border-gray-700 pt-2 bg-cream/30 dark:bg-gray-900/30"
	>
		<div class="text-xs font-medium text-charcoal dark:text-gray-300">
			Page {page.pageNumber}
		</div>
		<div class="text-xs text-slate dark:text-gray-500 truncate" title={page.sourceFileName}>
			{page.sourceFileName}
		</div>
	</div>

	<!-- Drag Over Indicator -->
	{#if isOver && !isDragging}
		<div
			class="absolute inset-0 border-2 border-dashed border-sage bg-sage/10 dark:bg-sage/20 rounded-lg pointer-events-none"
		></div>
	{/if}
</div>

<style>
	.pdf-page-card {
		width: 180px;
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
	}

	.pdf-page-card:active {
		cursor: grabbing;
	}
</style>
