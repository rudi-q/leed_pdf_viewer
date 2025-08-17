<script lang="ts">
	import { onMount } from 'svelte';
import StampAnnotation from './StampAnnotation.svelte';
import {
	currentPageStampAnnotations,
	addStampAnnotation,
	updateStampAnnotation,
	deleteStampAnnotation,
	drawingState,
	pdfState,
	availableStamps,
	getStampById
} from '../stores/drawingStore';
	import type { StampAnnotation as StampAnnotationType } from '../stores/drawingStore';

	export let containerWidth: number = 0;
	export let containerHeight: number = 0;
	export let scale: number = 1;

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
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		// Default dimensions for new stamps
		const defaultSize = 32;

		// Ensure the stamp fits within the container
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
			x: constrainedX,
			y: constrainedY,
			stampId: selectedStampId, // Store the stamp ID instead of SVG
			width: defaultSize,
			height: defaultSize,
			size: defaultSize,
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
	style:width="{containerWidth}px"
	style:height="{containerHeight}px"
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

	.stamp-picker {
		position: absolute;
		top: 16px;
		left: 16px;
		pointer-events: auto;
		z-index: 20;
		animation: slideInPicker 0.3s ease-out;
	}

	.stamp-picker-content {
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 12px;
		padding: 16px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(8px);
		min-width: 280px;
	}

	.stamp-picker-title {
		font-size: 14px;
		font-weight: 600;
		color: #374151;
		margin-bottom: 12px;
		text-align: center;
	}

	.stamp-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 8px;
		max-width: 280px;
	}

	.stamp-option {
		width: 40px;
		height: 40px;
		border: 2px solid transparent;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		font-size: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		user-select: none;
	}

	.stamp-option:hover {
		background: rgba(255, 255, 255, 1);
		border-color: rgba(139, 69, 19, 0.3);
		transform: scale(1.1);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.stamp-option.selected {
		background: rgba(139, 69, 19, 0.1);
		border-color: rgba(139, 69, 19, 0.6);
		box-shadow: 0 0 0 2px rgba(139, 69, 19, 0.2);
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

	@keyframes slideInPicker {
		0% {
			opacity: 0;
			transform: translateY(-10px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Dark mode support */
	:global(.dark) .stamp-picker-content {
		background: rgba(31, 41, 55, 0.95);
		border-color: rgba(255, 255, 255, 0.1);
	}

	:global(.dark) .stamp-picker-title {
		color: #e5e7eb;
	}

	:global(.dark) .stamp-option {
		background: rgba(55, 65, 81, 0.8);
		border-color: rgba(255, 255, 255, 0.1);
	}

	:global(.dark) .stamp-option:hover {
		background: rgba(55, 65, 81, 1);
		border-color: rgba(139, 69, 19, 0.5);
	}

	/* SVG stamp preview styling */
	.stamp-svg-preview {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.stamp-svg-preview :global(svg) {
		width: 100%;
		height: 100%;
		max-width: 24px;
		max-height: 24px;
	}

	/* Prevent text selection when in stamp tool mode */
	.stamp-overlay.stamp-tool-active * {
		user-select: none;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.stamp-picker {
			top: 8px;
			left: 8px;
		}
		
		.stamp-picker-content {
			min-width: 240px;
			padding: 12px;
		}
		
		.stamp-grid {
			grid-template-columns: repeat(5, 1fr);
			max-width: 240px;
		}
		
		.stamp-option {
			width: 36px;
			height: 36px;
			font-size: 18px;
		}
		
		.hint-content {
			font-size: 12px;
			padding: 8px 16px;
		}
		
		.hint-icon {
			font-size: 20px;
		}
	}
</style>
