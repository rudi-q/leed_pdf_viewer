<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { StickyNoteAnnotation } from '$lib/stores/drawingStore';
	import {
		transformPoint,
		inverseTransformPoint,
		type RotationAngle
	} from '$lib/utils/rotationUtils';

	export let note: StickyNoteAnnotation;
	export let scale: number = 1; // Current PDF scale
	export let containerWidth: number = 0; // Actual displayed canvas width
	export let containerHeight: number = 0; // Actual displayed canvas height
	export let viewOnlyMode = false; // If true, disable all editing interactions
	export let rotation: RotationAngle = 0;
	export let basePageWidth: number = 0;
	export let basePageHeight: number = 0;

	const dispatch = createEventDispatcher<{
		update: StickyNoteAnnotation;
		delete: string;
	}>();

	let isEditing = false;
	let isDragging = false;
	let isResizing = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;
	let textareaRef: HTMLTextAreaElement;
	let noteElement: HTMLDivElement;

	// Minimum dimensions
	const MIN_WIDTH = 120;
	const MIN_HEIGHT = 80;
	const MAX_WIDTH = 400;
	const MAX_HEIGHT = 300;

	// Display position and size variables
	let displayX: number = 0;
	let displayY: number = 0;
	let displayWidth: number = 0;
	let displayHeight: number = 0;

	// Calculate display position and size
	// The container dimensions should already be scaled (viewport.width at current scale)
	// Notes are stored at base scale (scale 1.0), need to scale up for display
	$: if (containerWidth > 0 && containerHeight > 0 && scale > 0) {
		const hasValidBaseDimensions = basePageWidth > 0 && basePageHeight > 0;
		// Since containerWidth/Height are the actual displayed dimensions (already at current scale),
		// we need to be careful about how we calculate positions

		// Method 1: If we have absolute coordinates, use them directly
		if (note.x !== undefined && note.y !== undefined) {
			// These are stored at base scale, 0-rotation. Transform to current rotation.
			if (hasValidBaseDimensions) {
				const rotatedPoint = transformPoint(
					note.x,
					note.y,
					rotation as RotationAngle,
					basePageWidth,
					basePageHeight
				);
				displayX = rotatedPoint.x * scale;
				displayY = rotatedPoint.y * scale;
			} else {
				displayX = note.x * scale;
				displayY = note.y * scale;
			}
		} else {
			// Method 2: Use relative coordinates
			// Container dimensions are already scaled, so use them directly
			//displayX = note.relativeX * containerWidth;
			//displayY = note.relativeY * containerHeight;
		}

		// Calculate display size
		if (note.width !== undefined && note.height !== undefined) {
			// Absolute dimensions stored at base scale
			displayWidth = note.width * scale;
			displayHeight = note.height * scale;
		} else {
			// Relative dimensions
			//displayWidth = note.relativeWidth * containerWidth;
			//displayHeight = note.relativeHeight * containerHeight;
		}

		// Debug log - gated for development only
		if (false) {
			console.log('StickyNote display calc:', {
				containerDims: `${containerWidth}x${containerHeight}`,
				scale,
				stored: `pos(${note.x},${note.y}) size(${note.width}x${note.height})`,
				relative: `pos(${note.relativeX},${note.relativeY}) size(${note.relativeWidth}x${note.relativeHeight})`,
				display: `pos(${displayX.toFixed(2)},${displayY.toFixed(2)}) size(${displayWidth.toFixed(2)}x${displayHeight.toFixed(2)})`
			});
		}
	}

	// Auto-resize textarea to fit content
	const autoResizeTextarea = () => {
		if (textareaRef) {
			textareaRef.style.height = 'auto';
			const scrollHeight = textareaRef.scrollHeight;
			const minHeight = 60; // Minimum textarea height
			textareaRef.style.height = `${Math.max(minHeight, scrollHeight)}px`;
		}
	};

	// Handle text changes
	const handleTextChange = (event: Event) => {
		if (viewOnlyMode) return; // Block text changes in view-only mode
		const target = event.target as HTMLTextAreaElement;
		const updatedNote: StickyNoteAnnotation = {
			...note,
			text: target.value
		};
		dispatch('update', updatedNote);
		autoResizeTextarea();
	};

	// Handle double-click to start editing
	const handleDoubleClick = () => {
		if (viewOnlyMode) return; // Disable editing in view-only mode
		isEditing = true;
		setTimeout(() => {
			if (textareaRef) {
				textareaRef.focus();
				textareaRef.select();
			}
		}, 0);
	};

	// Handle blur to stop editing
	const handleBlur = () => {
		isEditing = false;
	};

	// Handle key events
	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			isEditing = false;
			if (textareaRef) {
				textareaRef.blur();
			}
		} else if (event.key === 'Enter' && event.ctrlKey) {
			isEditing = false;
			if (textareaRef) {
				textareaRef.blur();
			}
		}
	};

	// Handle mouse down for dragging
	const handleMouseDown = (event: MouseEvent) => {
		if (isEditing || viewOnlyMode) return; // Disable dragging in view-only mode

		event.preventDefault();
		event.stopPropagation();

		isDragging = true;
		dragStartX = event.clientX - displayX;
		dragStartY = event.clientY - displayY;

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	// Handle mouse move for dragging
	const handleMouseMove = (event: MouseEvent) => {
		if (isDragging) {
			// Calculate new display position
			const newDisplayX = event.clientX - dragStartX;
			const newDisplayY = event.clientY - dragStartY;

			// Convert display coordinates to base scale
			const rotatedBaseX = newDisplayX / scale;
			const rotatedBaseY = newDisplayY / scale;

			// Inverse transform to 0-rotation base scale for storage
			const basePoint = inverseTransformPoint(
				rotatedBaseX,
				rotatedBaseY,
				rotation as RotationAngle,
				basePageWidth,
				basePageHeight
			);

			// Constrain to container bounds (at true base scale)
			const noteWidth = note.width || note.relativeWidth * basePageWidth;
			const noteHeight = note.height || note.relativeHeight * basePageHeight;
			const constrainedX = Math.max(0, Math.min(basePageWidth - noteWidth, basePoint.x));
			const constrainedY = Math.max(0, Math.min(basePageHeight - noteHeight, basePoint.y));

			const updatedNote: StickyNoteAnnotation = {
				...note,
				x: constrainedX, // Store at base scale 0-rotation
				y: constrainedY, // Store at base scale 0-rotation
				relativeX: basePageWidth > 0 ? constrainedX / basePageWidth : 0,
				relativeY: basePageHeight > 0 ? constrainedY / basePageHeight : 0
			};
			dispatch('update', updatedNote);
		} else if (isResizing) {
			const screenDeltaX = event.clientX - resizeStartX;
			const screenDeltaY = event.clientY - resizeStartY;

			// Rotate delta into local coordinate space
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

			// Calculate new dimensions at base scale
			const baseStartWidth = resizeStartWidth / scale;
			const baseStartHeight = resizeStartHeight / scale;
			const baseDeltaX = deltaX / scale;
			const baseDeltaY = deltaY / scale;

			// Ensure minimum and maximum size at base scale
			const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, baseStartWidth + baseDeltaX));
			const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, baseStartHeight + baseDeltaY));

			// Calculate new font size with intelligent constraints
			const widthBasedSize = newWidth * 0.16;
			const heightConstraint = newHeight * 0.4;
			const maxFontSize = 32;
			const newFontSize = Math.max(8, Math.min(widthBasedSize, heightConstraint, maxFontSize));

			const updatedNote: StickyNoteAnnotation = {
				...note,
				width: newWidth,
				height: newHeight,
				fontSize: newFontSize,
				relativeWidth: basePageWidth > 0 ? newWidth / basePageWidth : 0,
				relativeHeight: basePageHeight > 0 ? newHeight / basePageHeight : 0
			};
			dispatch('update', updatedNote);
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
		if (viewOnlyMode) return; // Disable resizing in view-only mode
		event.preventDefault();
		event.stopPropagation();

		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartWidth = displayWidth;
		resizeStartHeight = displayHeight;

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	// Handle delete
	const handleDelete = () => {
		if (viewOnlyMode) return; // Disable delete in view-only mode
		dispatch('delete', note.id);
	};

	// Handle right-click context menu
	const handleContextMenu = (event: MouseEvent) => {
		event.preventDefault();
		if (viewOnlyMode) return;
		// Show confirmation before deleting
		if (confirm('Delete this sticky note?')) {
			handleDelete();
		}
	};

	onMount(() => {
		if (isEditing && textareaRef) {
			textareaRef.focus();
			autoResizeTextarea();
		}
	});

	// Auto-resize when text changes
	$: if (textareaRef && note.text) {
		setTimeout(autoResizeTextarea, 0);
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
	bind:this={noteElement}
	class="sticky-note"
	style:left="{displayX}px"
	style:top="{displayY}px"
	style:width="{displayWidth}px"
	style:height="{displayHeight}px"
	style="--rotation: {rotation}deg; --state-transform: translateY(0px);"
	style:background-color={note.backgroundColor}
	style:font-size="{note.fontSize * scale}px"
	class:editing={isEditing}
	class:dragging={isDragging}
	class:resizing={isResizing}
	on:mousedown={handleMouseDown}
	on:dblclick={handleDoubleClick}
	on:contextmenu={handleContextMenu}
	on:keydown={(e) => {
		if (viewOnlyMode) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleDoubleClick();
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			e.stopPropagation();
			handleDelete();
		}
	}}
	role="button"
	tabindex="0"
	aria-label="Sticky note: {note.text || 'Empty note'}"
>
	<!-- Delete button -->
	{#if !viewOnlyMode}
		<button
			class="delete-btn"
			on:click|stopPropagation={handleDelete}
			title="Delete sticky note"
			aria-label="Delete sticky note"
		>
			×
		</button>
	{/if}

	<!-- Content area -->
	{#if isEditing}
		<textarea
			bind:this={textareaRef}
			class="note-textarea"
			value={note.text}
			on:input={handleTextChange}
			on:blur={handleBlur}
			on:keydown={handleKeydown}
			placeholder="Type your note..."
			style:font-size="{note.fontSize * scale}px"
		></textarea>
	{:else}
		<div class="note-content" style:font-size="{note.fontSize * scale}px">
			{#if note.text.trim()}
				{note.text}
			{:else}
				<span class="placeholder">Double-click to edit</span>
			{/if}
		</div>
	{/if}

	<!-- Resize handle -->
	{#if !viewOnlyMode}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="resize-handle"
			on:mousedown|stopPropagation={handleResizeMouseDown}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleResizeMouseDown(e as any);
				}
			}}
			title="Drag to resize"
			role="button"
			tabindex="0"
			aria-label="Resize sticky note"
		></div>
	{/if}
</div>

<style>
	.sticky-note {
		position: absolute;
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.1),
			0 4px 8px rgba(0, 0, 0, 0.05);
		cursor: move;
		user-select: none;
		overflow: hidden;
		transition: all 0.1s ease;
		padding: 8px 8px 4px 8px;
		box-sizing: border-box;
		font-family: 'ReenieBeanie', cursive;
		line-height: 1.4;
		z-index: 100;
		background: linear-gradient(135deg, var(--bg-color) 0%, var(--bg-color) 100%);
		transform-origin: top left;
		transform: rotate(var(--rotation, 0deg)) var(--state-transform, translateY(0px));
	}

	.sticky-note:hover {
		box-shadow:
			0 4px 8px rgba(0, 0, 0, 0.15),
			0 8px 16px rgba(0, 0, 0, 0.1);
		--state-transform: translateY(-1px);
	}

	.sticky-note.editing {
		cursor: default;
		border-color: #3b82f6;
		box-shadow:
			0 0 0 2px rgba(59, 130, 246, 0.2),
			0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.sticky-note.dragging {
		cursor: grabbing;
		--state-transform: rotate(2deg) scale(1.02);
		z-index: 101;
	}

	.sticky-note.resizing {
		cursor: nw-resize;
	}

	.delete-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 20px;
		height: 20px;
		border: none;
		background: rgba(239, 68, 68, 0.8);
		color: white;
		border-radius: 50%;
		cursor: pointer;
		font-size: 12px;
		font-weight: bold;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.2s ease;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sticky-note:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 1);
		transform: scale(1.1);
	}

	.note-textarea {
		width: 100%;
		height: calc(100% - 8px);
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		resize: none;
		outline: none;
		padding: 0;
		margin: 0;
		color: #2d3748;
		overflow-y: auto;
		min-height: 60px;
	}

	.note-textarea::placeholder {
		color: #9ca3af;
		font-style: italic;
	}

	.note-content {
		width: 100%;
		height: calc(100% - 4px);
		color: #2d3748;
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-y: auto;
		padding-right: 24px; /* Space for delete button */
		padding-bottom: 0;
	}

	.placeholder {
		color: #9ca3af;
		font-style: italic;
		font-size: 0.9em;
	}

	.resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 16px;
		height: 16px;
		cursor: nw-resize;
		background: linear-gradient(
			-45deg,
			transparent 0%,
			transparent 40%,
			#9ca3af 40%,
			#9ca3af 60%,
			transparent 60%
		);
		opacity: 0.5;
	}

	.sticky-note:hover .resize-handle {
		opacity: 1;
	}

	/* Add some visual texture to mimic real sticky notes */
	.sticky-note::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background:
			radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.3) 0%, transparent 15%),
			radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.2) 0%, transparent 15%),
			radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.1) 0%, transparent 15%);
		pointer-events: none;
		border-radius: inherit;
	}

	/* Scrollbar styling for webkit browsers */
	.note-textarea::-webkit-scrollbar,
	.note-content::-webkit-scrollbar {
		width: 4px;
	}

	.note-textarea::-webkit-scrollbar-track,
	.note-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.note-textarea::-webkit-scrollbar-thumb,
	.note-content::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}

	.note-textarea::-webkit-scrollbar-thumb:hover,
	.note-content::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.3);
	}
</style>
