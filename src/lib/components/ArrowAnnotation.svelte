<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { ArrowAnnotation } from '../stores/drawingStore';
	import { drawingState } from '../stores/drawingStore';

	export let arrow: ArrowAnnotation;
	export const scale: number = 1; // For future scaling features
	export let containerWidth: number = 0;
	export let containerHeight: number = 0;

	const dispatch = createEventDispatcher<{ update: ArrowAnnotation; delete: string }>();

	let isDraggingStart = false;
	let isDraggingEnd = false;
	let isDraggingArrow = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let initialArrowX1 = 0;
	let initialArrowY1 = 0;
	let initialArrowX2 = 0;
	let initialArrowY2 = 0;
	let isHovering = false;

	// Helper function to calculate constrained coordinates
	function constrainPoint(x: number, y: number) {
		return {
			x: Math.max(0, Math.min(containerWidth, x)),
			y: Math.max(0, Math.min(containerHeight, y))
		};
	}

	// Calculate arrow length
	$: arrowLength = Math.sqrt(Math.pow(arrow.x2 - arrow.x1, 2) + Math.pow(arrow.y2 - arrow.y1, 2));

	// Calculate arrow angle
	$: arrowAngle = Math.atan2(arrow.y2 - arrow.y1, arrow.x2 - arrow.x1) * (180 / Math.PI);

	// Calculate arrow midpoint for delete button positioning
	$: arrowMidX = (arrow.x1 + arrow.x2) / 2;
	$: arrowMidY = (arrow.y1 + arrow.y2) / 2;

	// Determine if handles should be visible (arrow tool selected or hovering)
	$: handlesVisible = $drawingState.tool === 'arrow' || isHovering;

	const handleStartMouseDown = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		isDraggingStart = true;
		const rect = (event.target as Element).closest('.arrow-overlay')?.getBoundingClientRect();
		if (rect) {
			dragStartX = event.clientX - rect.left - arrow.x1;
			dragStartY = event.clientY - rect.top - arrow.y1;
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
			dragStartX = event.clientX - rect.left - arrow.x2;
			dragStartY = event.clientY - rect.top - arrow.y2;
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
			initialArrowX1 = arrow.x1;
			initialArrowY1 = arrow.y1;
			initialArrowX2 = arrow.x2;
			initialArrowY2 = arrow.y2;
		}

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	const handleMouseMove = (event: MouseEvent) => {
		if (isDraggingStart) {
			const rect = document.querySelector('.arrow-overlay')?.getBoundingClientRect();
			if (rect) {
				const newX = event.clientX - rect.left - dragStartX;
				const newY = event.clientY - rect.top - dragStartY;
				const constrained = constrainPoint(newX, newY);

				const updatedArrow: ArrowAnnotation = {
					...arrow,
					x1: constrained.x,
					y1: constrained.y,
					relativeX1: constrained.x / containerWidth,
					relativeY1: constrained.y / containerHeight
				};

				dispatch('update', updatedArrow);
			}
		} else if (isDraggingEnd) {
			const rect = document.querySelector('.arrow-overlay')?.getBoundingClientRect();
			if (rect) {
				const newX = event.clientX - rect.left - dragStartX;
				const newY = event.clientY - rect.top - dragStartY;
				const constrained = constrainPoint(newX, newY);

				const updatedArrow: ArrowAnnotation = {
					...arrow,
					x2: constrained.x,
					y2: constrained.y,
					relativeX2: constrained.x / containerWidth,
					relativeY2: constrained.y / containerHeight
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

				const newX1 = initialArrowX1 + deltaX;
				const newY1 = initialArrowY1 + deltaY;
				const newX2 = initialArrowX2 + deltaX;
				const newY2 = initialArrowY2 + deltaY;

				const constrainedStart = constrainPoint(newX1, newY1);
				const constrainedEnd = constrainPoint(newX2, newY2);

				// Only update if both points are within bounds
				if (
					constrainedStart.x === newX1 && constrainedStart.y === newY1 &&
					constrainedEnd.x === newX2 && constrainedEnd.y === newY2
				) {
					const updatedArrow: ArrowAnnotation = {
						...arrow,
						x1: constrainedStart.x,
						y1: constrainedStart.y,
						x2: constrainedEnd.x,
						y2: constrainedEnd.y,
						relativeX1: constrainedStart.x / containerWidth,
						relativeY1: constrainedStart.y / containerHeight,
						relativeX2: constrainedEnd.x / containerWidth,
						relativeY2: constrainedEnd.y / containerHeight
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
		style="pointer-events: auto;"
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
			x1={arrow.x1}
			y1={arrow.y1}
			x2={arrow.x2}
			y2={arrow.y2}
			stroke={arrow.stroke}
			stroke-width={arrow.strokeWidth}
			marker-end={arrow.arrowHead ? `url(#arrowhead-${arrow.id})` : undefined}
			class="arrow-line"
			class:dragging={isDraggingArrow}
			on:mousedown={handleArrowMouseDown}
			on:mouseenter={() => isHovering = true}
			on:mouseleave={() => isHovering = false}
			role="button"
			tabindex="0"
			aria-label="Arrow line - click and drag to move"
		/>
		
		<!-- Start handle (drag point) -->
		<circle
			cx={arrow.x1}
			cy={arrow.y1}
			r="8"
			fill="rgba(70, 144, 226, 0.8)"
			stroke="#4A90E2"
			stroke-width="2"
			class="handle start-handle"
			class:dragging={isDraggingStart}
			class:visible={handlesVisible}
			on:mousedown={handleStartMouseDown}
			on:mouseenter={() => isHovering = true}
			on:mouseleave={() => isHovering = false}
			role="button"
			tabindex="0"
			aria-label="Arrow start point - drag to resize"
		/>
		
		<!-- End handle (drag point) -->
		<circle
			cx={arrow.x2}
			cy={arrow.y2}
			r="8"
			fill="rgba(70, 144, 226, 0.8)"
			stroke="#4A90E2"
			stroke-width="2"
			class="handle end-handle"
			class:dragging={isDraggingEnd}
			class:visible={handlesVisible}
			on:mousedown={handleEndMouseDown}
			on:mouseenter={() => isHovering = true}
			on:mouseleave={() => isHovering = false}
			role="button"
			tabindex="0"
			aria-label="Arrow end point - drag to resize"
		/>
	</svg>
	
	<!-- Delete button positioned at arrow midpoint -->
	<button
		class="delete-btn"
		class:visible={isHovering}
		style="left: {arrowMidX - 12}px; top: {arrowMidY - 12}px;"
		on:click|stopPropagation={handleDelete}
		on:mouseenter={() => isHovering = true}
		on:mouseleave={() => isHovering = false}
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
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
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
		pointer-events: auto;
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
