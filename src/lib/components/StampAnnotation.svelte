<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { StampAnnotation } from '../stores/drawingStore';

	export let stamp: StampAnnotation;
	export let scale: number = 1;
	export let containerWidth: number = 0;
	export let containerHeight: number = 0;

	const dispatch = createEventDispatcher<{
		update: StampAnnotation;
		delete: string;
	}>();

	let isDragging = false;
	let isResizing = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartSize = 0;
	let stampElement: HTMLDivElement;

	// Minimum and maximum dimensions
	const MIN_SIZE = 16;
	const MAX_SIZE = 120;

	// Calculate actual position and size based on scale and relative coordinates
	$: actualX = stamp.relativeX * containerWidth;
	$: actualY = stamp.relativeY * containerHeight;
	$: actualSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, stamp.relativeSize * Math.min(containerWidth, containerHeight)));

	// Handle mouse down for dragging
	const handleMouseDown = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		isDragging = true;
		dragStartX = event.clientX - actualX;
		dragStartY = event.clientY - actualY;

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	// Handle mouse move for dragging
	const handleMouseMove = (event: MouseEvent) => {
		if (isDragging) {
			const newX = event.clientX - dragStartX;
			const newY = event.clientY - dragStartY;

			// Constrain to container bounds
			const constrainedX = Math.max(0, Math.min(containerWidth - actualSize, newX));
			const constrainedY = Math.max(0, Math.min(containerHeight - actualSize, newY));

			const updatedStamp: StampAnnotation = {
				...stamp,
				x: constrainedX,
				y: constrainedY,
				relativeX: constrainedX / containerWidth,
				relativeY: constrainedY / containerHeight,
			};
			dispatch('update', updatedStamp);
		} else if (isResizing) {
			const deltaX = event.clientX - resizeStartX;
			const deltaY = event.clientY - resizeStartY;
			const delta = Math.max(deltaX, deltaY); // Use the larger delta for proportional resizing

			const newSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, resizeStartSize + delta));

			const updatedStamp: StampAnnotation = {
				...stamp,
				size: newSize,
				relativeSize: newSize / Math.min(containerWidth, containerHeight),
			};
			dispatch('update', updatedStamp);
		}
	};

	// Handle mouse up
	const handleMouseUp = () => {
		isDragging = false;
		isResizing = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	};

	// Handle resize handle mouse down
	const handleResizeMouseDown = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartSize = actualSize;

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	// Handle rotation (mousewheel when hovering over stamp)
	const handleWheel = (event: WheelEvent) => {
		event.preventDefault();
		event.stopPropagation();

		const rotationDelta = event.deltaY > 0 ? 15 : -15;
		let newRotation = (stamp.rotation + rotationDelta) % 360;
		if (newRotation < 0) newRotation += 360;

		const updatedStamp: StampAnnotation = {
			...stamp,
			rotation: newRotation,
		};
		dispatch('update', updatedStamp);
	};

	// Handle delete
	const handleDelete = () => {
		dispatch('delete', stamp.id);
	};

	// Handle right-click context menu
	const handleContextMenu = (event: MouseEvent) => {
		event.preventDefault();
		handleDelete();
	};

	onMount(() => {
		// Clean up event listeners on component destroy
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	});

	// Update relative position when stamp is moved
	function updateRelativePosition(stamp: StampAnnotation, newX: number, newY: number) {
		const relativeX = containerWidth > 0 ? newX / containerWidth : stamp.relativeX;
		const relativeY = containerHeight > 0 ? newY / containerHeight : stamp.relativeY;
		
		const updatedStamp: StampAnnotation = {
			...stamp,
			x: newX,
			y: newY,
			relativeX,
			relativeY
		};
		dispatch('update', updatedStamp);
	}

	// Calculate absolute position from relative position (for scaling)
	function getAbsolutePosition(stamp: StampAnnotation) {
		return {
			x: stamp.relativeX * containerWidth,
			y: stamp.relativeY * containerHeight,
			size: stamp.relativeSize * Math.min(containerWidth, containerHeight)
		};
	}

	// Scale stamps when canvas size changes
	$: if (containerWidth > 0 && containerHeight > 0) {
		const pos = getAbsolutePosition(stamp);
		if (pos.x !== stamp.x || pos.y !== stamp.y || pos.size !== stamp.size) {
			const updatedStamp: StampAnnotation = {
				...stamp,
				x: pos.x,
				y: pos.y,
				size: pos.size
			};
			dispatch('update', updatedStamp);
		}
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
	bind:this={stampElement}
	class="stamp-annotation"
	style:left="{actualX}px"
	style:top="{actualY}px"
	style:width="{actualSize}px"
	style:height="{actualSize}px"
	style:transform="rotate({stamp.rotation}deg)"
	style:font-size="{actualSize * 0.8}px"
	class:dragging={isDragging}
	class:resizing={isResizing}
	on:mousedown={handleMouseDown}
	on:wheel={handleWheel}
	on:contextmenu={handleContextMenu}
	role="button"
	tabindex="0"
	aria-label="Stamp: {stamp.stamp}"
	title="Drag to move, scroll to rotate, right-click to delete"
>
	<!-- Delete button -->
	<button
		class="delete-btn"
		on:click|stopPropagation={handleDelete}
		title="Delete stamp"
		aria-label="Delete stamp"
	>
		×
	</button>

	<!-- Stamp content -->
	<div class="stamp-content">
		{@html stamp.stamp}
	</div>

	<!-- Resize handle -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="resize-handle"
		on:mousedown|stopPropagation={handleResizeMouseDown}
		title="Drag to resize"
		role="button"
		aria-label="Resize stamp"
	></div>
</div>

<style>
	.stamp-annotation {
		position: absolute;
		cursor: move;
		user-select: none;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		transition: all 0.1s ease;
		z-index: 100;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid transparent;
		pointer-events: auto;
	}

	.stamp-annotation:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(139, 69, 19, 0.3);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transform: scale(1.05) rotate(var(--rotation, 0deg));
	}

	.stamp-annotation.dragging {
		cursor: grabbing;
		transform: scale(1.1) rotate(var(--rotation, 0deg));
		z-index: 101;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
	}

	.stamp-annotation.resizing {
		cursor: nw-resize;
		box-shadow: 0 0 0 2px rgba(139, 69, 19, 0.5);
	}

	.delete-btn {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 20px;
		height: 20px;
		border: none;
		background: rgba(239, 68, 68, 0.9);
		color: white;
		border-radius: 50%;
		cursor: pointer;
		font-size: 12px;
		font-weight: bold;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.2s ease, transform 0.2s ease;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.stamp-annotation:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 1);
		transform: scale(1.1);
	}

	.stamp-content {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: inherit;
		line-height: 1;
		text-align: center;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
	}

	/* Style SVG stamps */
	.stamp-content :global(svg) {
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
	}

	.resize-handle {
		position: absolute;
		bottom: -4px;
		right: -4px;
		width: 12px;
		height: 12px;
		background: rgba(139, 69, 19, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.8);
		border-radius: 2px;
		cursor: nw-resize;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.stamp-annotation:hover .resize-handle {
		opacity: 1;
	}

	.resize-handle:hover {
		background: rgba(139, 69, 19, 1);
		transform: scale(1.2);
	}

	/* Visual feedback for rotation */
	.stamp-annotation {
		--rotation: 0deg;
	}

	.stamp-annotation:hover {
		transition: transform 0.1s ease;
	}

	/* Add subtle animation when first created */
	.stamp-annotation {
		animation: stampPlaced 0.3s ease-out;
	}

	@keyframes stampPlaced {
		0% {
			opacity: 0;
			transform: scale(0.5) rotate(var(--rotation, 0deg));
		}
		50% {
			opacity: 1;
			transform: scale(1.2) rotate(var(--rotation, 0deg));
		}
		100% {
			opacity: 1;
			transform: scale(1) rotate(var(--rotation, 0deg));
		}
	}

	/* Accessibility improvements */
	.stamp-annotation:focus {
		outline: 2px solid rgba(139, 69, 19, 0.6);
		outline-offset: 2px;
	}

	/* Dark mode adjustments */
	:global(.dark) .stamp-annotation {
		background: rgba(0, 0, 0, 0.1);
	}

	:global(.dark) .stamp-annotation:hover {
		background: rgba(0, 0, 0, 0.2);
		border-color: rgba(139, 69, 19, 0.5);
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.delete-btn {
			width: 24px;
			height: 24px;
			font-size: 14px;
			top: -10px;
			right: -10px;
		}

		.resize-handle {
			width: 16px;
			height: 16px;
			bottom: -6px;
			right: -6px;
		}
	}

	/* Touch-friendly interactions */
	@media (hover: none) {
		.delete-btn,
		.resize-handle {
			opacity: 1;
		}

		.stamp-annotation {
			border-color: rgba(139, 69, 19, 0.2);
		}
	}
</style>
