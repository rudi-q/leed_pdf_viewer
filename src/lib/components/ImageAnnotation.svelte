<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { ImageAnnotation } from '../stores/drawingStore';
	import {
		transformPoint,
		inverseTransformPoint,
		rotateDelta,
		type RotationAngle
	} from '../utils/rotationUtils';

	export let annotation: ImageAnnotation;
	export let scale: number = 1;
	export let rotation: RotationAngle = 0;
	export let basePageWidth: number = 0;
	export let basePageHeight: number = 0;

	const dispatch = createEventDispatcher<{
		update: ImageAnnotation;
		delete: string;
	}>();

	let isDragging = false;
	let isResizing = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	const MIN_SIZE = 20;

	let actualX = 0;
	let actualY = 0;
	let actualWidth = 0;
	let actualHeight = 0;

	$: if (basePageWidth > 0 && basePageHeight > 0 && scale > 0) {
		const baseX =
			annotation.x !== undefined ? annotation.x : annotation.relativeX * basePageWidth;
		const baseY =
			annotation.y !== undefined ? annotation.y : annotation.relativeY * basePageHeight;

		const rotatedPoint = transformPoint(
			baseX,
			baseY,
			rotation as RotationAngle,
			basePageWidth,
			basePageHeight
		);

		actualX = rotatedPoint.x * scale;
		actualY = rotatedPoint.y * scale;

		const baseW =
			annotation.width !== undefined
				? annotation.width
				: annotation.relativeWidth * basePageWidth;
		const baseH =
			annotation.height !== undefined
				? annotation.height
				: annotation.relativeHeight * basePageHeight;

		actualWidth = Math.max(MIN_SIZE, baseW) * scale;
		actualHeight = Math.max(MIN_SIZE, baseH) * scale;
	}

	const handleMouseDown = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		isDragging = true;
		dragStartX = event.clientX - actualX;
		dragStartY = event.clientY - actualY;

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

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

			const baseW =
				annotation.width !== undefined
					? annotation.width
					: annotation.relativeWidth * basePageWidth;
			const baseH =
				annotation.height !== undefined
					? annotation.height
					: annotation.relativeHeight * basePageHeight;

			const constrainedX = Math.max(0, Math.min(basePageWidth - baseW, basePoint.x));
			const constrainedY = Math.max(0, Math.min(basePageHeight - baseH, basePoint.y));

			dispatch('update', {
				...annotation,
				x: constrainedX,
				y: constrainedY,
				relativeX: basePageWidth > 0 ? constrainedX / basePageWidth : 0,
				relativeY: basePageHeight > 0 ? constrainedY / basePageHeight : 0
			});
		} else if (isResizing) {
			const screenDeltaX = event.clientX - resizeStartX;
			const screenDeltaY = event.clientY - resizeStartY;

			const { dx: deltaX, dy: deltaY } = rotateDelta(screenDeltaX, screenDeltaY, rotation);

			// Use larger delta to preserve approximate aspect ratio during resize
			const delta = Math.max(deltaX, deltaY);
			const safeScale = scale > 0 ? scale : 1;
			const baseDelta = delta / safeScale;
			const baseStartW = resizeStartWidth / safeScale;
			const baseStartH = resizeStartHeight / safeScale;
			const aspectRatio = baseStartW > 0 ? baseStartW / baseStartH : 1;

			const newBaseW = Math.max(MIN_SIZE, baseStartW + baseDelta);
			const newBaseH = Math.max(MIN_SIZE, newBaseW / aspectRatio);

			dispatch('update', {
				...annotation,
				width: newBaseW,
				height: newBaseH,
				relativeWidth: basePageWidth > 0 ? newBaseW / basePageWidth : 0,
				relativeHeight: basePageHeight > 0 ? newBaseH / basePageHeight : 0
			});
		}
	};

	const handleMouseUp = () => {
		isDragging = false;
		isResizing = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	};

	const handleResizeMouseDown = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartWidth = actualWidth;
		resizeStartHeight = actualHeight;

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	const handleWheel = (event: WheelEvent) => {
		event.preventDefault();
		event.stopPropagation();

		const rotationDelta = event.deltaY > 0 ? 15 : -15;
		let newRotation = ((annotation.rotation || 0) + rotationDelta) % 360;
		if (newRotation < 0) newRotation += 360;

		dispatch('update', { ...annotation, rotation: newRotation });
	};

	const handleDelete = () => {
		dispatch('delete', annotation.id);
	};

	const handleContextMenu = (event: MouseEvent) => {
		event.preventDefault();
		if (confirm('Delete this image?')) {
			handleDelete();
		}
	};

	onMount(() => {
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	});
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
	class="image-annotation"
	style:left="{actualX}px"
	style:top="{actualY}px"
	style:width="{actualWidth}px"
	style:height="{actualHeight}px"
	style="--page-rotation: {rotation}deg; transform: rotate(var(--page-rotation)); transform-origin: top left;"
	class:dragging={isDragging}
	class:resizing={isResizing}
	on:mousedown={handleMouseDown}
	on:wheel={handleWheel}
	on:contextmenu={handleContextMenu}
	role="button"
	tabindex="0"
	aria-label="Pasted image"
	title="Drag to move, scroll to rotate, right-click to delete"
>
	<button
		class="delete-btn"
		on:click|stopPropagation={handleDelete}
		title="Delete image"
		aria-label="Delete image"
	>
		×
	</button>

	<div
		class="image-content"
		style="transform: rotate({annotation.rotation || 0}deg); transform-origin: center;"
	>
		<img src={annotation.imageData} alt="" draggable="false" />
	</div>

	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="resize-handle"
		on:mousedown|stopPropagation={handleResizeMouseDown}
		title="Drag to resize"
		role="button"
		tabindex="0"
		aria-label="Resize image"
	></div>
</div>

<style>
	.image-annotation {
		position: absolute;
		cursor: move;
		user-select: none;
		border-radius: 4px;
		z-index: 100;
		background: transparent;
		border: 2px solid transparent;
		pointer-events: auto;
		transition: border-color 0.1s ease;
	}

	.image-annotation:hover {
		border-color: rgba(59, 130, 246, 0.5);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.image-annotation.dragging {
		cursor: grabbing;
		z-index: 101;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
	}

	.image-annotation.resizing {
		cursor: nw-resize;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
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

	.image-annotation:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 1);
		transform: scale(1.1);
	}

	.image-content {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: 2px;
	}

	.image-content img {
		width: 100%;
		height: 100%;
		object-fit: fill;
		display: block;
		pointer-events: none;
	}

	.resize-handle {
		position: absolute;
		bottom: -4px;
		right: -4px;
		width: 12px;
		height: 12px;
		background: rgba(59, 130, 246, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.8);
		border-radius: 2px;
		cursor: nw-resize;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.image-annotation:hover .resize-handle {
		opacity: 1;
	}

	.resize-handle:hover {
		background: rgba(59, 130, 246, 1);
		transform: scale(1.2);
	}

	.image-annotation {
		animation: imagePlaced 0.25s ease-out;
	}

	@keyframes imagePlaced {
		0% {
			opacity: 0;
			transform: scale(0.85) rotate(var(--page-rotation, 0deg));
		}
		100% {
			opacity: 1;
			transform: scale(1) rotate(var(--page-rotation, 0deg));
		}
	}

	.image-annotation:focus {
		outline: 2px solid rgba(59, 130, 246, 0.6);
		outline-offset: 2px;
	}

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

	@media (hover: none) {
		.delete-btn,
		.resize-handle {
			opacity: 1;
		}
	}
</style>
