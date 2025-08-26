<script lang="ts">
	import { onMount } from 'svelte';
	import StampAnnotation from './StampAnnotation.svelte';
	import type { StampAnnotation as StampAnnotationType } from '../stores/drawingStore';
	import {
		addStampAnnotation,
		availableStamps,
		currentPageStampAnnotations,
		deleteStampAnnotation,
		drawingState,
		getStampById,
		pdfState,
		updateStampAnnotation
	} from '../stores/drawingStore';

	export let containerWidth: number = 0; // Base viewport width at scale 1.0
	export let containerHeight: number = 0; // Base viewport height at scale 1.0
	export let scale: number = 1; // Current zoom scale

	let overlayElement: HTMLDivElement;
	let isCreatingStamp = false;

	// Listen for stamp tool activation and click events
	$: isStampTool = $drawingState.tool === 'stamp';

	// Use our custom SVG stamps instead of emojis
	$: stampOptions = availableStamps;

	// Handle click to create new stamp
	const handleContainerClick = (event: MouseEvent) => {
		if (!isStampTool || isCreatingStamp) return;

		// Don't create stamp if clicking on an existing stamp
		const target = event.target as HTMLElement;
		if (target.closest('.stamp-annotation')) return;

		// Calculate click position relative to the container
		const rect = overlayElement.getBoundingClientRect();
		// Get click position in current scale
		const scaledX = event.clientX - rect.left;
		const scaledY = event.clientY - rect.top;
		
		// Convert to base viewport coordinates
		const x = scaledX / scale;
		const y = scaledY / scale;

		// Default dimensions for new stamps (at base scale)
		const defaultSize = 32;

		// Ensure the stamp fits within the container (at base scale)
		const constrainedX = Math.max(0, Math.min(containerWidth - defaultSize, x - defaultSize / 2));
		const constrainedY = Math.max(0, Math.min(containerHeight - defaultSize, y - defaultSize / 2));

		// Create new stamp using the currently selected stamp ID from the store
		const selectedStampId = $drawingState.stampId || 'star';
		const selectedStamp = getStampById(selectedStampId);
		
		if (!selectedStamp) {
			console.warn('No stamp found for ID:', selectedStampId);
			return;
		}
		
		const newStamp: StampAnnotationType = {
			id: `stamp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			pageNumber: $pdfState.currentPage,
			x: constrainedX, // Store at base scale
			y: constrainedY, // Store at base scale
			stampId: selectedStampId, // Store the stamp ID instead of SVG
			width: defaultSize, // Store at base scale
			height: defaultSize, // Store at base scale
			size: defaultSize, // Store at base scale
			rotation: 0,
			relativeX: constrainedX / containerWidth,
			relativeY: constrainedY / containerHeight,
			relativeSize: defaultSize / Math.min(containerWidth, containerHeight)
		};

		isCreatingStamp = true;
		addStampAnnotation(newStamp);
		
		// Reset creating state after a short delay
		setTimeout(() => {
			isCreatingStamp = false;
		}, 100);
	};

	// Handle stamp updates
	const handleStampUpdate = (event: CustomEvent<StampAnnotationType>) => {
		updateStampAnnotation(event.detail);
	};

	// Handle stamp deletion
	const handleStampDelete = (event: CustomEvent<string>) => {
		deleteStampAnnotation(event.detail, $pdfState.currentPage);
	};

	onMount(() => {
		// Add cursor style for stamp tool
		const updateCursor = () => {
			if (overlayElement) {
				if (isStampTool) {
					overlayElement.style.cursor = 'crosshair';
				} else {
					overlayElement.style.cursor = 'default';
				}
			}
		};

		updateCursor();
		
		// Watch for tool changes
		const unsubscribe = drawingState.subscribe(() => {
			updateCursor();
		});

		return () => {
			unsubscribe();
		};
	});
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
	bind:this={overlayElement}
	class="stamp-overlay"
	class:stamp-tool-active={isStampTool}
	style:width="{containerWidth * scale}px"
	style:height="{containerHeight * scale}px"
	on:click={handleContainerClick}
	role="application"
	aria-label="Stamps area - click to create new stamp when stamp tool is active"
>
	{#each $currentPageStampAnnotations as stamp (stamp.id)}
		<StampAnnotation
			{stamp}
			{scale}
			{containerWidth}
			{containerHeight}
			on:update={handleStampUpdate}
			on:delete={handleStampDelete}
		/>
	{/each}

	<!-- Visual indicator when stamp tool is active -->
	{#if isStampTool && $currentPageStampAnnotations.length === 0}
		<div class="stamp-tool-hint">
			<div class="hint-content">
				<div class="hint-icon">🏷️</div>
				<div class="hint-text">Click anywhere to place a stamp</div>
			</div>
		</div>
	{/if}

</div>

<style>
	.stamp-overlay {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		z-index: 8;
		background: transparent;
	}

	.stamp-overlay.stamp-tool-active {
		cursor: crosshair;
		pointer-events: auto;
	}

	.stamp-tool-hint {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		opacity: 0;
		animation: fadeInHint 0.5s ease-in-out 1s both;
		z-index: 1;
	}

	.hint-content {
		background: rgba(139, 69, 19, 0.9);
		color: white;
		padding: 12px 20px;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		text-align: center;
		font-size: 14px;
		font-weight: 500;
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.hint-icon {
		font-size: 24px;
		margin-bottom: 4px;
	}

	.hint-text {
		white-space: nowrap;
	}



	@keyframes fadeInHint {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.8);
		}
		100% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}







	/* Prevent text selection when in stamp tool mode */
	.stamp-overlay.stamp-tool-active * {
		user-select: none;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.hint-content {
			font-size: 12px;
			padding: 8px 16px;
		}
		
		.hint-icon {
			font-size: 20px;
		}
	}
</style>
