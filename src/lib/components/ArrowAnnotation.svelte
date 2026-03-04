<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { ArrowAnnotation } from '../stores/drawingStore';
	import { drawingState } from '../stores/drawingStore';
	import {
		transformPoint,
		inverseTransformPoint,
		type RotationAngle
	} from '../utils/rotationUtils';

	export let arrow: ArrowAnnotation;
	export let scale: number = 1; // Current PDF zoom scale
	export let containerWidth: number = 0;
	export let containerHeight: number = 0;
	export let rotation: RotationAngle = 0;
	export let basePageWidth: number = 0;
	export let basePageHeight: number = 0;

	const dispatch = createEventDispatcher<{ update: ArrowAnnotation; delete: string }>();

	let isDraggingStart = false;
	let isDraggingEnd = false;
	let isDraggingArrow = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let initialDisplayX1 = 0;
	let initialDisplayY1 = 0;
	let initialDisplayX2 = 0;
	let initialDisplayY2 = 0;
	let isHovering = false;

	let displayX1 = 0;
	let displayY1 = 0;
	let displayX2 = 0;
	let displayY2 = 0;

	$: if (basePageWidth > 0 && basePageHeight > 0) {
		let baseX1 = arrow.x1 !== undefined ? arrow.x1 : arrow.relativeX1 * basePageWidth;
		let baseY1 = arrow.y1 !== undefined ? arrow.y1 : arrow.relativeY1 * basePageHeight;
		let baseX2 = arrow.x2 !== undefined ? arrow.x2 : arrow.relativeX2 * basePageWidth;
		let baseY2 = arrow.y2 !== undefined ? arrow.y2 : arrow.relativeY2 * basePageHeight;

		const pt1 = transformPoint(
			baseX1,
			baseY1,
			rotation as RotationAngle,
			basePageWidth,
			basePageHeight
		);
		const pt2 = transformPoint(
			baseX2,
			baseY2,
			rotation as RotationAngle,
			basePageWidth,
			basePageHeight
		);

		displayX1 = pt1.x * scale;
		displayY1 = pt1.y * scale;
		displayX2 = pt2.x * scale;
		displayY2 = pt2.y * scale;
	}

	// Calculate arrow midpoint for delete button positioning
	$: arrowMidX = (displayX1 + displayX2) / 2;
	$: arrowMidY = (displayY1 + displayY2) / 2;

	// Determine if handles should be visible (arrow tool selected or hovering)
	$: handlesVisible = $drawingState.tool === 'arrow' || isHovering;

	// Determine if arrow should respond to pointer events (only when arrow tool is active or hovering)
	$: pointerEventsEnabled = $drawingState.tool === 'arrow' || isHovering;

	const handleStartMouseDown = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		isDraggingStart = true;
		const rect = (event.target as Element).closest('.arrow-overlay')?.getBoundingClientRect();
		if (rect) {
			dragStartX = event.clientX - rect.left - displayX1;
			dragStartY = event.clientY - rect.top - displayY1;
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	const handleEndMouseDown = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		isDraggingEnd = true;
		const rect = (event.target as Element).closest('.arrow-overlay')?.getBoundingClientRect();
		if (rect) {
			dragStartX = event.clientX - rect.left - displayX2;
			dragStartY = event.clientY - rect.top - displayY2;
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	const handleArrowMouseDown = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		isDraggingArrow = true;
		const rect = (event.target as Element).closest('.arrow-overlay')?.getBoundingClientRect();
		if (rect) {
			dragStartX = event.clientX - rect.left;
			dragStartY = event.clientY - rect.top;
			initialDisplayX1 = displayX1;
			initialDisplayY1 = displayY1;
			initialDisplayX2 = displayX2;
			initialDisplayY2 = displayY2;
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	const handleMouseMove = (event: MouseEvent) => {
		if (isDraggingStart) {
			const rect = document.querySelector('.arrow-overlay')?.getBoundingClientRect();
			if (rect) {
				const newDisplayX = event.clientX - rect.left - dragStartX;
				const newDisplayY = event.clientY - rect.top - dragStartY;

				const rotatedBaseX = newDisplayX / scale;
				const rotatedBaseY = newDisplayY / scale;

				const pt = inverseTransformPoint(
					rotatedBaseX,
					rotatedBaseY,
					rotation as RotationAngle,
					basePageWidth,
					basePageHeight
				);

				const constrainedX = Math.max(0, Math.min(basePageWidth, pt.x));
				const constrainedY = Math.max(0, Math.min(basePageHeight, pt.y));

				const updatedArrow: ArrowAnnotation = {
					...arrow,
					x1: constrainedX,
					y1: constrainedY,
					relativeX1: basePageWidth > 0 ? constrainedX / basePageWidth : 0,
					relativeY1: basePageHeight > 0 ? constrainedY / basePageHeight : 0
				};

				dispatch('update', updatedArrow);
			}
		} else if (isDraggingEnd) {
			const rect = document.querySelector('.arrow-overlay')?.getBoundingClientRect();
			if (rect) {
				const newDisplayX = event.clientX - rect.left - dragStartX;
				const newDisplayY = event.clientY - rect.top - dragStartY;

				const rotatedBaseX = newDisplayX / scale;
				const rotatedBaseY = newDisplayY / scale;

				const pt = inverseTransformPoint(
					rotatedBaseX,
					rotatedBaseY,
					rotation as RotationAngle,
					basePageWidth,
					basePageHeight
				);

				const constrainedX = Math.max(0, Math.min(basePageWidth, pt.x));
				const constrainedY = Math.max(0, Math.min(basePageHeight, pt.y));

				const updatedArrow: ArrowAnnotation = {
					...arrow,
					x2: constrainedX,
					y2: constrainedY,
					relativeX2: basePageWidth > 0 ? constrainedX / basePageWidth : 0,
					relativeY2: basePageHeight > 0 ? constrainedY / basePageHeight : 0
				};

				dispatch('update', updatedArrow);
			}
		} else if (isDraggingArrow) {
			const rect = document.querySelector('.arrow-overlay')?.getBoundingClientRect();
			if (rect) {
				const currentX = event.clientX - rect.left;
				const currentY = event.clientY - rect.top;
				const deltaX = currentX - dragStartX;
				const deltaY = currentY - dragStartY;

				const newDisplayX1 = initialDisplayX1 + deltaX;
				const newDisplayY1 = initialDisplayY1 + deltaY;
				const newDisplayX2 = initialDisplayX2 + deltaX;
				const newDisplayY2 = initialDisplayY2 + deltaY;

				const pt1 = inverseTransformPoint(
					newDisplayX1 / scale,
					newDisplayY1 / scale,
					rotation as RotationAngle,
					basePageWidth,
					basePageHeight
				);
				const pt2 = inverseTransformPoint(
					newDisplayX2 / scale,
					newDisplayY2 / scale,
					rotation as RotationAngle,
					basePageWidth,
					basePageHeight
				);

				const constrainedX1 = Math.max(0, Math.min(basePageWidth, pt1.x));
				const constrainedY1 = Math.max(0, Math.min(basePageHeight, pt1.y));
				const constrainedX2 = Math.max(0, Math.min(basePageWidth, pt2.x));
				const constrainedY2 = Math.max(0, Math.min(basePageHeight, pt2.y));

				// Only update if both points are within bounds
				if (
					constrainedX1 === pt1.x &&
					constrainedY1 === pt1.y &&
					constrainedX2 === pt2.x &&
					constrainedY2 === pt2.y
				) {
					const updatedArrow: ArrowAnnotation = {
						...arrow,
						x1: constrainedX1,
						y1: constrainedY1,
						x2: constrainedX2,
						y2: constrainedY2,
						relativeX1: basePageWidth > 0 ? constrainedX1 / basePageWidth : 0,
						relativeY1: basePageHeight > 0 ? constrainedY1 / basePageHeight : 0,
						relativeX2: basePageWidth > 0 ? constrainedX2 / basePageWidth : 0,
						relativeY2: basePageHeight > 0 ? constrainedY2 / basePageHeight : 0
					};

					dispatch('update', updatedArrow);
				}
			}
		}
	};

	const handleMouseUp = () => {
		isDraggingStart = false;
		isDraggingEnd = false;
		isDraggingArrow = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	};

	// Handle delete
	const handleDelete = () => {
		dispatch('delete', arrow.id);
	};

	onMount(() => {
		// Nothing for now
	});
</script>

<div
	class="arrow-annotation absolute"
	style="left: 0; top: 0; width: {containerWidth}px; height: {containerHeight}px; pointer-events: none;"
	aria-label="Arrow annotation"
>
	<svg
		width={containerWidth}
		height={containerHeight}
		class="arrow-svg"
		style="pointer-events: {pointerEventsEnabled ? 'auto' : 'none'};"
	>
		<!-- Arrow line with marker -->
		<defs>
			<marker
				id="arrowhead-{arrow.id}"
				markerWidth="10"
				markerHeight="7"
				refX="9"
				refY="3.5"
				orient="auto"
				fill={arrow.stroke}
			>
				<polygon points="0 0, 10 3.5, 0 7" />
			</marker>
		</defs>

		<!-- Main arrow line -->
		<line
			x1={displayX1}
			y1={displayY1}
			x2={displayX2}
			y2={displayY2}
			stroke={arrow.stroke}
			stroke-width={arrow.strokeWidth}
			marker-end={arrow.arrowHead ? `url(#arrowhead-${arrow.id})` : undefined}
			class="arrow-line"
			class:dragging={isDraggingArrow}
			on:mousedown={handleArrowMouseDown}
			on:mouseenter={() => (isHovering = true)}
			on:mouseleave={() => (isHovering = false)}
			role="button"
			tabindex="0"
			aria-label="Arrow line - click and drag to move"
		/>

		<!-- Start handle (drag point) -->
		<circle
			cx={displayX1}
			cy={displayY1}
			r="8"
			fill="rgba(70, 144, 226, 0.8)"
			stroke="#4A90E2"
			stroke-width="2"
			class="handle start-handle"
			class:dragging={isDraggingStart}
			class:visible={handlesVisible}
			on:mousedown={handleStartMouseDown}
			on:mouseenter={() => (isHovering = true)}
			on:mouseleave={() => (isHovering = false)}
			role="button"
			tabindex="0"
			aria-label="Arrow start point - drag to resize"
		/>

		<!-- End handle (drag point) -->
		<circle
			cx={displayX2}
			cy={displayY2}
			r="8"
			fill="rgba(70, 144, 226, 0.8)"
			stroke="#4A90E2"
			stroke-width="2"
			class="handle end-handle"
			class:dragging={isDraggingEnd}
			class:visible={handlesVisible}
			on:mousedown={handleEndMouseDown}
			on:mouseenter={() => (isHovering = true)}
			on:mouseleave={() => (isHovering = false)}
			role="button"
			tabindex="0"
			aria-label="Arrow end point - drag to resize"
		/>
	</svg>

	<!-- Delete button positioned at arrow midpoint -->
	<button
		class="delete-btn"
		class:visible={isHovering}
		style="left: {arrowMidX - 12}px; top: {arrowMidY - 12}px; pointer-events: {pointerEventsEnabled
			? 'auto'
			: 'none'};"
		on:click|stopPropagation={handleDelete}
		on:mouseenter={() => (isHovering = true)}
		on:mouseleave={() => (isHovering = false)}
		title="Delete arrow"
		aria-label="Delete arrow"
	>
		×
	</button>
</div>

<style>
	.arrow-annotation {
		z-index: 10;
	}

	.arrow-svg {
		position: absolute;
		top: 0;
		left: 0;
	}

	.arrow-line {
		cursor: move;
		stroke-linecap: round;
		transition: stroke-width 0.2s ease;
	}

	.arrow-line:hover,
	.arrow-line.dragging {
		stroke-width: calc(var(--stroke-width, 3) + 2);
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
	}

	.handle {
		cursor: grab;
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: auto;
	}

	.handle.visible {
		opacity: 0.6;
	}

	.handle:hover {
		opacity: 1;
		filter: drop-shadow(0 2px 4px rgba(70, 144, 226, 0.4));
	}

	.handle.dragging {
		opacity: 1;
		cursor: grabbing;
		transition: none; /* Disable transitions while dragging */
		filter: drop-shadow(0 2px 6px rgba(70, 144, 226, 0.6));
	}

	.delete-btn {
		position: absolute;
		width: 24px;
		height: 24px;
		border: none;
		background: rgba(239, 68, 68, 0.9);
		color: white;
		border-radius: 50%;
		font-size: 14px;
		font-weight: bold;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		z-index: 12;
		opacity: 0;
	}

	.delete-btn.visible {
		opacity: 1;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 1);
		transform: scale(1.1);
	}

	.delete-btn:active {
		transform: scale(0.95);
	}
</style>
