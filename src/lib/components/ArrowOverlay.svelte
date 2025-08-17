<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ArrowAnnotation } from '../stores/drawingStore';
	import { currentPageArrowAnnotations, addArrowAnnotation, updateArrowAnnotation, deleteArrowAnnotation, drawingState, pdfState } from '$lib/stores/drawingStore';
	import ArrowAnnotationComponent from './ArrowAnnotation.svelte';

	export let containerWidth: number = 0;
	export let containerHeight: number = 0;
	export const scale: number = 1; // For future scaling features

	let overlayElement: HTMLDivElement;

	let isCreatingArrow = false;

	// Flags whether the arrow tool is active
	$: isArrowTool = $drawingState.tool === 'arrow';

	// Coordinates for new arrow
	let startX = 0;
	let startY = 0;

	const handleContainerMouseDown = (event: MouseEvent) => {
		if (!isArrowTool) return;

		// Don't create new arrows if clicking on existing arrow elements
		const target = event.target as Element;
		if (target.closest('.arrow-annotation, .delete-btn, .handle, .arrow-line')) {
			return;
		}

		// Reset flag to ensure we can create multiple arrows
		isCreatingArrow = false;

		event.preventDefault();
		event.stopPropagation();

		const rect = overlayElement.getBoundingClientRect();
		startX = event.clientX - rect.left;
		startY = event.clientY - rect.top;

		isCreatingArrow = true;

		// Create new arrow immediately
		const newArrow: ArrowAnnotation = {
			id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			pageNumber: $pdfState.currentPage,
			x1: startX,
			y1: startY,
			x2: startX + 50, // Default length
			y2: startY + 50,
			relativeX1: startX / containerWidth,
			relativeY1: startY / containerHeight,
			relativeX2: (startX + 50) / containerWidth,
			relativeY2: (startY + 50) / containerHeight,
			stroke: $drawingState.color || '#2D3748',
			strokeWidth: $drawingState.lineWidth || 3,
			arrowHead: true
		};

		addArrowAnnotation(newArrow);
	};

	const handleContainerMouseMove = (event: MouseEvent) => {
		if (!isCreatingArrow) return;

		const rect = overlayElement.getBoundingClientRect();
		const currentX = event.clientX - rect.left;
		const currentY = event.clientY - rect.top;

		// Update last created arrow with new end coordinates
		const arrows = $currentPageArrowAnnotations;
		const arrow = arrows[arrows.length - 1];
		if (!arrow) return;

		const updatedArrow = {
			...arrow,
			x2: Math.min(containerWidth, Math.max(0, currentX)),
			y2: Math.min(containerHeight, Math.max(0, currentY)),
			relativeX2: Math.min(containerWidth, Math.max(0, currentX)) / containerWidth,
			relativeY2: Math.min(containerHeight, Math.max(0, currentY)) / containerHeight
		};

		updateArrowAnnotation(updatedArrow);
	};

	const handleContainerMouseUp = (event: MouseEvent) => {
		if (isCreatingArrow) {
			isCreatingArrow = false;
			// Clean up document event listeners
			document.removeEventListener('mousemove', handleDocumentMouseMove);
			document.removeEventListener('mouseup', handleDocumentMouseUp);
		}
	};

	// Document-level mouse handlers for better tracking during arrow creation
	const handleDocumentMouseMove = (event: MouseEvent) => {
		if (!isCreatingArrow || !overlayElement) return;

		const rect = overlayElement.getBoundingClientRect();
		const currentX = event.clientX - rect.left;
		const currentY = event.clientY - rect.top;

		// Update last created arrow with new end coordinates
		const arrows = $currentPageArrowAnnotations;
		const arrow = arrows[arrows.length - 1];
		if (!arrow) return;

		const updatedArrow = {
			...arrow,
			x2: Math.min(containerWidth, Math.max(0, currentX)),
			y2: Math.min(containerHeight, Math.max(0, currentY)),
			relativeX2: Math.min(containerWidth, Math.max(0, currentX)) / containerWidth,
			relativeY2: Math.min(containerHeight, Math.max(0, currentY)) / containerHeight
		};

		updateArrowAnnotation(updatedArrow);
	};

	const handleDocumentMouseUp = (event: MouseEvent) => {
		if (isCreatingArrow) {
			isCreatingArrow = false;
			// Clean up document event listeners
			document.removeEventListener('mousemove', handleDocumentMouseMove);
			document.removeEventListener('mouseup', handleDocumentMouseUp);
		}
	};

	// Handle arrow update event from child components
	const handleArrowUpdate = (event: CustomEvent<ArrowAnnotation>) => {
		updateArrowAnnotation(event.detail);
	};

	// Handle arrow delete event from child components
	const handleArrowDelete = (event: CustomEvent<string>) => {
		deleteArrowAnnotation(event.detail, $pdfState.currentPage);
	};

	onMount(() => {
		// Scale existing arrows to new container dimensions if needed
		const updateArrowPositions = () => {
			const arrows = $currentPageArrowAnnotations;
			arrows.forEach(arrow => {
				const updatedArrow = {
					...arrow,
					x1: arrow.relativeX1 * containerWidth,
					y1: arrow.relativeY1 * containerHeight,
					x2: arrow.relativeX2 * containerWidth,
					y2: arrow.relativeY2 * containerHeight
				};
				if (updatedArrow.x1 !== arrow.x1 || updatedArrow.y1 !== arrow.y1 || 
				    updatedArrow.x2 !== arrow.x2 || updatedArrow.y2 !== arrow.y2) {
					updateArrowAnnotation(updatedArrow);
				}
			});
		};

		// Update arrow positions when container size changes
		if (containerWidth > 0 && containerHeight > 0) {
			updateArrowPositions();
		}
	});

	// Clean up event listeners on destroy
	onDestroy(() => {
		if (isCreatingArrow) {
			document.removeEventListener('mousemove', handleDocumentMouseMove);
			document.removeEventListener('mouseup', handleDocumentMouseUp);
		}
	});

	// Update cursor style based on tool
	$: {
		if (overlayElement) {
			overlayElement.style.cursor = isArrowTool ? 'crosshair' : 'default';
		}
	}

	// Update pointer events based on tool
	$: pointerEventsClass = isArrowTool ? 'pointer-events-auto' : 'pointer-events-none';

	// Reactive update when container size changes
	$: if (containerWidth > 0 && containerHeight > 0) {
		// Update arrow positions when container dimensions change
		const arrows = $currentPageArrowAnnotations;
		arrows.forEach(arrow => {
			const updatedArrow = {
				...arrow,
				x1: arrow.relativeX1 * containerWidth,
				y1: arrow.relativeY1 * containerHeight,
				x2: arrow.relativeX2 * containerWidth,
				y2: arrow.relativeY2 * containerHeight
			};
			if (updatedArrow.x1 !== arrow.x1 || updatedArrow.y1 !== arrow.y1 || 
			    updatedArrow.x2 !== arrow.x2 || updatedArrow.y2 !== arrow.y2) {
				updateArrowAnnotation(updatedArrow);
			}
		});
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div 
	bind:this={overlayElement}
	class="arrow-overlay absolute top-0 left-0 {pointerEventsClass}"
	style="width: {containerWidth}px; height: {containerHeight}px; z-index: 3;"
	on:mousedown={handleContainerMouseDown}
	on:mousemove={handleContainerMouseMove}
	on:mouseup={handleContainerMouseUp}
	role="application"
	aria-label="Arrow annotations area"
	data-arrow-overlay="true"
>
	{#each $currentPageArrowAnnotations as arrow (arrow.id)}
		<ArrowAnnotationComponent
			{arrow}
			scale={1}
			{containerWidth}
			{containerHeight}
			on:update={handleArrowUpdate}
			on:delete={handleArrowDelete}
		/>
	{/each}
</div>

<style>
	.arrow-overlay {
		background: transparent;
	}

	.pointer-events-auto {
		pointer-events: auto;
		cursor: crosshair;
	}

	.pointer-events-none {
		pointer-events: none;
		cursor: default;
	}

	/* Allow interaction with individual arrows regardless of current tool */
	.arrow-overlay :global(.arrow-annotation) {
		pointer-events: auto;
	}
</style>
