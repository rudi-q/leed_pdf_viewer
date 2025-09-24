<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { ArrowAnnotation } from '../stores/drawingStore';
	import {
		addArrowAnnotation,
		currentPageArrowAnnotations,
		deleteArrowAnnotation,
		drawingState,
		pdfState,
		updateArrowAnnotation
	} from '$lib/stores/drawingStore';
	import { trackFirstAnnotation } from '$lib/utils/analytics';
	import ArrowAnnotationComponent from './ArrowAnnotation.svelte';

	export let containerWidth: number = 0; // Base viewport width at scale 1.0
	export let containerHeight: number = 0; // Base viewport height at scale 1.0
	export let scale: number = 1; // Current zoom scale
	export let viewOnlyMode = false; // If true, disable all editing interactions

	let overlayElement: HTMLDivElement;

	let isCreatingArrow = false;

	// Flags whether the arrow tool is active
	$: isArrowTool = $drawingState.tool === 'arrow';

	// Coordinates for new arrow
	let startX = 0;
	let startY = 0;

	const handleContainerMouseDown = (event: MouseEvent) => {
		if (!isArrowTool || viewOnlyMode) return;

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
		// Get click position in current scale
		const scaledX = event.clientX - rect.left;
		const scaledY = event.clientY - rect.top;
		
		// Convert to base viewport coordinates
		startX = scaledX / scale;
		startY = scaledY / scale;

		isCreatingArrow = true;

		// Create new arrow immediately (storing at base scale)
		const newArrow: ArrowAnnotation = {
			id: `arrow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			pageNumber: $pdfState.currentPage,
			x1: startX, // Store at base scale
			y1: startY, // Store at base scale
			x2: startX + 50, // Default length at base scale
			y2: startY + 50,
			relativeX1: startX / containerWidth,
			relativeY1: startY / containerHeight,
			relativeX2: (startX + 50) / containerWidth,
			relativeY2: (startY + 50) / containerHeight,
			stroke: $drawingState.color || '#2D3748',
			strokeWidth: $drawingState.lineWidth || 3,
			arrowHead: true
		};

		// Track first annotation creation
		trackFirstAnnotation('arrow');

		addArrowAnnotation(newArrow);
	};

	const handleContainerMouseMove = (event: MouseEvent) => {
		if (!isCreatingArrow) return;

		const rect = overlayElement.getBoundingClientRect();
		// Get mouse position in current scale
		const scaledX = event.clientX - rect.left;
		const scaledY = event.clientY - rect.top;
		
		// Convert to base viewport coordinates
		const currentX = scaledX / scale;
		const currentY = scaledY / scale;

		// Update last created arrow with new end coordinates
		const arrows = $currentPageArrowAnnotations;
		const arrow = arrows[arrows.length - 1];
		if (!arrow) return;

		const updatedArrow = {
			...arrow,
			x2: Math.min(containerWidth, Math.max(0, currentX)), // Store at base scale
			y2: Math.min(containerHeight, Math.max(0, currentY)), // Store at base scale
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
		// Get mouse position in current scale
		const scaledX = event.clientX - rect.left;
		const scaledY = event.clientY - rect.top;
		
		// Convert to base viewport coordinates
		const currentX = scaledX / scale;
		const currentY = scaledY / scale;

		// Update last created arrow with new end coordinates
		const arrows = $currentPageArrowAnnotations;
		const arrow = arrows[arrows.length - 1];
		if (!arrow) return;

		const updatedArrow = {
			...arrow,
			x2: Math.min(containerWidth, Math.max(0, currentX)), // Store at base scale
			y2: Math.min(containerHeight, Math.max(0, currentY)), // Store at base scale
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
		// No need to update positions on mount - arrows are stored at base scale
		// and will be displayed at current scale automatically
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

	// No need for reactive updates - arrows are stored at base scale
	// and displayed at current scale
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div 
	bind:this={overlayElement}
	class="arrow-overlay absolute top-0 left-0 {pointerEventsClass}"
	style="width: {containerWidth * scale}px; height: {containerHeight * scale}px; z-index: 3;"
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
			{scale}
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
