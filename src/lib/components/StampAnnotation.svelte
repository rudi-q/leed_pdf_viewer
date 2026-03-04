<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { StampAnnotation } from '../stores/drawingStore';
	import { getStampById } from '../stores/drawingStore';
	import {
		transformPoint,
		inverseTransformPoint,
		type RotationAngle
	} from '../utils/rotationUtils';

	export let stamp: StampAnnotation;
	export let scale: number = 1; // Current PDF zoom scale

	// Get the stamp definition to display SVG
	// Handle backward compatibility: stamps might have either stampId OR stamp (SVG string)
	$: stampDefinition = stamp.stampId ? getStampById(stamp.stampId) : null;
	$: stampSvg = stampDefinition?.svg || (stamp as any).stamp || '';

	export let rotation: RotationAngle = 0;
	export let basePageWidth: number = 0;
	export let basePageHeight: number = 0;

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

	let actualX = 0;
	let actualY = 0;
	let actualSize = 0;

	// Calculate actual position and size based on scale and relative coordinates
	// The stamp is stored in unrotated (base) coordinates, but we need to display it
	// in the rotated canvas space. We use transformPoint to convert from base to rotated space.
	$: if (basePageWidth > 0 && basePageHeight > 0 && scale > 0) {
		let baseX = stamp.x !== undefined ? stamp.x : stamp.relativeX * basePageWidth;
		let baseY = stamp.y !== undefined ? stamp.y : stamp.relativeY * basePageHeight;

		// Transform from base (unrotated) coordinates to rotated coordinates
		const rotatedPoint = transformPoint(
			baseX,
			baseY,
			rotation as RotationAngle,
			basePageWidth,
			basePageHeight
		);

		// Apply scale to get final display position
		actualX = rotatedPoint.x * scale;
		actualY = rotatedPoint.y * scale;

		let baseSize =
			stamp.size !== undefined
				? stamp.size
				: stamp.relativeSize * Math.min(basePageWidth, basePageHeight);
		actualSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, baseSize)) * scale;
	}

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

			const safeScale = scale > 0 ? scale : 1;
			const rotatedBaseX = newX / safeScale;
			const rotatedBaseY = newY / safeScale;

			const basePoint = inverseTransformPoint(
				rotatedBaseX,
				rotatedBaseY,
				rotation as RotationAngle,
				basePageWidth,
				basePageHeight
			);

			const baseSize = stamp.size || stamp.relativeSize * Math.min(basePageWidth, basePageHeight);

			// Constrain to container bounds
			const constrainedX = Math.max(0, Math.min(basePageWidth - baseSize, basePoint.x));
			const constrainedY = Math.max(0, Math.min(basePageHeight - baseSize, basePoint.y));

			const updatedStamp: StampAnnotation = {
				...stamp,
				x: constrainedX,
				y: constrainedY,
				relativeX: basePageWidth > 0 ? constrainedX / basePageWidth : 0,
				relativeY: basePageHeight > 0 ? constrainedY / basePageHeight : 0
			};
			dispatch('update', updatedStamp);
		} else if (isResizing) {
			const screenDeltaX = event.clientX - resizeStartX;
			const screenDeltaY = event.clientY - resizeStartY;

			// Rotate delta
			let deltaX = screenDeltaX;
			let deltaY = screenDeltaY;
			if (rotation === 90) {
				deltaX = screenDeltaY;
				deltaY = -screenDeltaX;
			} else if (rotation === 180) {
				deltaX = -screenDeltaX;
				deltaY = -screenDeltaY;
			} else if (rotation === 270) {
				deltaX = -screenDeltaY;
				deltaY = screenDeltaX;
			}

			const delta = Math.max(deltaX, deltaY); // Use the larger delta
			const safeScale = scale > 0 ? scale : 1;
			const baseDelta = delta / safeScale;
			const baseStartSize = resizeStartSize / safeScale;

			const newSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, baseStartSize + baseDelta));

			const updatedStamp: StampAnnotation = {
				...stamp,
				size: newSize,
				relativeSize:
					basePageWidth > 0 && basePageHeight > 0
						? newSize / Math.min(basePageWidth, basePageHeight)
						: 0
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
			rotation: newRotation
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
		const relativeX = basePageWidth > 0 ? newX / basePageWidth : stamp.relativeX;
		const relativeY = basePageHeight > 0 ? newY / basePageHeight : stamp.relativeY;

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
			x: stamp.x !== undefined ? stamp.x : stamp.relativeX * basePageWidth,
			y: stamp.y !== undefined ? stamp.y : stamp.relativeY * basePageHeight,
			size:
				stamp.size !== undefined
					? stamp.size
					: stamp.relativeSize * Math.min(basePageWidth, basePageHeight)
		};
	}

	// Scale stamps when canvas size changes
	$: if (basePageWidth > 0 && basePageHeight > 0) {
		const pos = getAbsolutePosition(stamp);
		const epsilon = 0.01;
		const stampX = typeof stamp.x === 'number' && isFinite(stamp.x) ? stamp.x : pos.x;
		const stampY = typeof stamp.y === 'number' && isFinite(stamp.y) ? stamp.y : pos.y;
		const stampSize =
			typeof stamp.size === 'number' && isFinite(stamp.size) ? stamp.size : pos.size;

		if (
			Math.abs(pos.x - stampX) > epsilon ||
			Math.abs(pos.y - stampY) > epsilon ||
			Math.abs(pos.size - stampSize) > epsilon
		) {
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
	style="--rotation: {rotation}deg; transform: rotate(var(--rotation)); transform-origin: top left;"
	style:font-size="{actualSize * 0.8}px"
	class:dragging={isDragging}
	class:resizing={isResizing}
	on:mousedown={handleMouseDown}
	on:wheel={handleWheel}
	on:contextmenu={handleContextMenu}
	role="button"
	tabindex="0"
	aria-label="Stamp: {stampDefinition?.name || 'Unknown stamp'}"
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
	<div
		class="stamp-content"
		style="transform: rotate({stamp.rotation}deg); transform-origin: center;"
	>
		{@html stampSvg}
	</div>

	<!-- Resize handle -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="resize-handle"
		on:mousedown|stopPropagation={handleResizeMouseDown}
		title="Drag to resize"
		role="button"
		tabindex="0"
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
		background: transparent;
		border: 2px solid transparent;
		pointer-events: auto;
	}

	.stamp-annotation:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(139, 69, 19, 0.2);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transform: scale(1.05) rotate(var(--rotation, 0deg)) !important;
	}

	.stamp-annotation.dragging {
		cursor: grabbing;
		transform: scale(1.1) rotate(var(--rotation, 0deg)) !important;
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
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
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
		background: transparent;
	}

	:global(.dark) .stamp-annotation:hover {
		background: rgba(0, 0, 0, 0.05);
		border-color: rgba(139, 69, 19, 0.3);
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
			background: transparent;
			border-color: rgba(139, 69, 19, 0.1);
		}
	}
</style>
