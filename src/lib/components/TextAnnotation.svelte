<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { TextAnnotation } from '$lib/stores/drawingStore';

	export let annotation: TextAnnotation;
	export let scale: number = 1; // Current PDF scale
	export let containerWidth: number = 0; // Actual displayed canvas width
	export let containerHeight: number = 0; // Actual displayed canvas height

	const dispatch = createEventDispatcher<{
		update: TextAnnotation;
		delete: string;
		startEdit: TextAnnotation;
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
	let annotationElement: HTMLDivElement;

	// Minimum and maximum dimensions
	const MIN_WIDTH = 100;
	const MIN_HEIGHT = 30;
	const MAX_WIDTH = 500;
	const MAX_HEIGHT = 200;

	// Display position and size variables
	let displayX: number = 0;
	let displayY: number = 0;
	let displayWidth: number = 0;
	let displayHeight: number = 0;

	// Calculate display position and size
	$: if (containerWidth > 0 && containerHeight > 0 && scale > 0) {
		// Since containerWidth/Height are the actual displayed dimensions (already at current scale),
		// we need to be careful about how we calculate positions
		
		// Method 1: If we have absolute coordinates, use them directly
		if (annotation.x !== undefined && annotation.y !== undefined) {
			// These are stored at base scale, multiply by current scale
			displayX = annotation.x * scale;
			displayY = annotation.y * scale;
		} else {
			// Method 2: Use relative coordinates
			// Container dimensions are already scaled, so use them directly
			displayX = annotation.relativeX * containerWidth;
			displayY = annotation.relativeY * containerHeight;
		}
		
		// Calculate display size
		if (annotation.width !== undefined && annotation.height !== undefined) {
			// Absolute dimensions stored at base scale
			displayWidth = annotation.width * scale;
			displayHeight = annotation.height * scale;
		} else {
			// Default size if not set
			displayWidth = MIN_WIDTH * scale;
			displayHeight = MIN_HEIGHT * scale;
		}
	}

	// Auto-resize textarea to fit content
	const autoResizeTextarea = () => {
		if (textareaRef) {
			textareaRef.style.height = 'auto';
			const scrollHeight = textareaRef.scrollHeight;
			const minHeight = 30; // Minimum textarea height
			textareaRef.style.height = `${Math.max(minHeight, scrollHeight)}px`;
		}
	};

	// Handle text changes
	const handleTextChange = (event: Event) => {
		const target = event.target as HTMLTextAreaElement;
		const updatedAnnotation: TextAnnotation = {
			...annotation,
			text: target.value,
		};
		dispatch('update', updatedAnnotation);
		autoResizeTextarea();
	};

	// Handle double-click to start editing
	const handleDoubleClick = () => {
		if (!isEditing) {
			isEditing = true;
			dispatch('startEdit', annotation);
			setTimeout(() => {
				if (textareaRef) {
					textareaRef.focus();
					textareaRef.select();
				}
			}, 0);
		}
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
		if (isEditing) return;

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

			// Convert display coordinates to base scale for storage
			const newX = newDisplayX / scale;
			const newY = newDisplayY / scale;

			// Constrain to container bounds (at base scale)
			const baseWidth = containerWidth / scale;
			const baseHeight = containerHeight / scale;
			const annotationWidth = annotation.width || MIN_WIDTH;
			const annotationHeight = annotation.height || MIN_HEIGHT;
			const constrainedX = Math.max(0, Math.min(baseWidth - annotationWidth, newX));
			const constrainedY = Math.max(0, Math.min(baseHeight - annotationHeight, newY));

			const updatedAnnotation: TextAnnotation = {
				...annotation,
				x: constrainedX, // Store at base scale
				y: constrainedY, // Store at base scale
				relativeX: constrainedX / baseWidth,
				relativeY: constrainedY / baseHeight,
			};
			dispatch('update', updatedAnnotation);
		} else if (isResizing) {
			const deltaX = event.clientX - resizeStartX;
			const deltaY = event.clientY - resizeStartY;

			// Calculate new dimensions at base scale
			const baseStartWidth = resizeStartWidth / scale;
			const baseStartHeight = resizeStartHeight / scale;
			const baseDeltaX = deltaX / scale;
			const baseDeltaY = deltaY / scale;
			
			// Ensure minimum size at base scale
			const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, baseStartWidth + baseDeltaX));
			const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, baseStartHeight + baseDeltaY));

			const baseWidth = containerWidth / scale;
			const baseHeight = containerHeight / scale;
			
			// Calculate new font size with intelligent constraints
			// Use width-based scaling but cap it to ensure it fits within height
			const widthBasedSize = newWidth * 0.12; // Slightly smaller multiplier for text
			const heightConstraint = newHeight * 0.6; // Max 60% of height for text
			const maxFontSize = 48; // Absolute maximum font size
			const newFontSize = Math.max(12, Math.min(widthBasedSize, heightConstraint, maxFontSize));
			
			const updatedAnnotation: TextAnnotation = {
				...annotation,
				width: newWidth, // Store at base scale
				height: newHeight, // Store at base scale
				fontSize: newFontSize, // Update font size proportionally
				relativeWidth: newWidth / baseWidth,
				relativeHeight: newHeight / baseHeight,
			};
			dispatch('update', updatedAnnotation);
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
		resizeStartWidth = displayWidth;
		resizeStartHeight = displayHeight;

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	// Handle delete
	const handleDelete = () => {
		dispatch('delete', annotation.id);
	};

	// Handle right-click context menu
	const handleContextMenu = (event: MouseEvent) => {
		event.preventDefault();
		// Could add a context menu here in the future
		handleDelete();
	};

	onMount(() => {
		if (isEditing && textareaRef) {
			textareaRef.focus();
			autoResizeTextarea();
		}
	});

	// Auto-resize when text changes
	$: if (textareaRef && annotation.text) {
		setTimeout(autoResizeTextarea, 0);
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
	bind:this={annotationElement}
	class="text-annotation"
	style:left="{displayX}px"
	style:top="{displayY}px"
	style:width="{displayWidth}px"
	style:height="{displayHeight}px"
	style:font-size="{annotation.fontSize * scale}px"
	style:color={annotation.color}
	style:font-family={annotation.fontFamily}
	class:editing={isEditing}
	class:dragging={isDragging}
	class:resizing={isResizing}
	on:mousedown={handleMouseDown}
	on:dblclick={handleDoubleClick}
	on:contextmenu={handleContextMenu}
	role="button"
	tabindex="0"
	aria-label="Text annotation: {annotation.text || 'Empty text'}"
>
	<!-- Delete button -->
	<button
		class="delete-btn"
		on:click|stopPropagation={handleDelete}
		title="Delete text annotation"
		aria-label="Delete text annotation"
	>
		×
	</button>

	<!-- Content area -->
	{#if isEditing}
		<textarea
			bind:this={textareaRef}
			class="annotation-textarea"
			value={annotation.text}
			on:input={handleTextChange}
			on:blur={handleBlur}
			on:keydown={handleKeydown}
			placeholder="Type your text..."
			style:font-size="{annotation.fontSize * scale}px"
			style:color={annotation.color}
			style:font-family={annotation.fontFamily}
		></textarea>
	{:else}
		<div
			class="annotation-content"
			style:font-size="{annotation.fontSize * scale}px"
			style:color={annotation.color}
			style:font-family={annotation.fontFamily}
		>
			{#if annotation.text.trim()}
				{annotation.text}
			{:else}
				<span class="placeholder">Double-click to edit</span>
			{/if}
		</div>
	{/if}

	<!-- Resize handle -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="resize-handle"
		on:mousedown|stopPropagation={handleResizeMouseDown}
		title="Drag to resize"
		role="button"
		tabindex="0"
		aria-label="Resize text annotation"
	></div>
</div>

<style>
	.text-annotation {
		position: absolute;
		border: 1px solid transparent; /* Transparent by default */
		border-radius: 4px;
		background: transparent; /* Transparent background for export compatibility */
		cursor: move;
		user-select: none;
		overflow: visible; /* Allow text to be visible even when it exceeds bounds */
		transition: all 0.1s ease;
		padding: 4px;
		box-sizing: border-box;
		line-height: 1.4;
		z-index: 100;
	}

	.text-annotation:hover {
		background: rgba(255, 255, 255, 0.1); /* Very subtle background on hover */
		border-color: rgba(59, 130, 246, 0.3); /* Subtle blue border on hover */
	}

	.text-annotation.editing {
		cursor: default;
		border-color: #3B82F6;
		background: rgba(255, 255, 255, 1);
		box-shadow: 
			0 0 0 2px rgba(59, 130, 246, 0.2),
			0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.text-annotation.dragging {
		cursor: grabbing;
		transform: rotate(1deg) scale(1.02);
		z-index: 101;
	}

	.text-annotation.resizing {
		cursor: nw-resize;
	}

	.delete-btn {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 18px;
		height: 18px;
		border: none;
		background: rgba(239, 68, 68, 0.9);
		color: white;
		border-radius: 50%;
		cursor: pointer;
		font-size: 12px;
		font-weight: bold;
		line-height: 1;
		opacity: 0;
		transition: opacity 0.2s ease;
		z-index: 102;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.text-annotation:hover .delete-btn,
	.text-annotation.editing .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 1);
		transform: scale(1.1);
	}

	.annotation-textarea {
		width: 100%;
		height: calc(100% - 8px);
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: inherit;
		color: inherit;
		line-height: inherit;
		resize: none;
		outline: none;
		padding: 0;
		margin: 0;
		overflow-y: auto;
		min-height: 20px;
	}

	.annotation-textarea::placeholder {
		color: #9CA3AF;
		font-style: italic;
	}

	.annotation-content {
		width: 100%;
		height: calc(100% - 4px);
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-y: auto;
		padding-right: 20px; /* Space for delete button */
		padding-bottom: 0;
	}

	.placeholder {
		color: #9CA3AF;
		font-style: italic;
		font-size: 0.9em;
	}

	.resize-handle {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 16px;
		height: 16px;
		cursor: nw-resize;
		background: linear-gradient(-45deg, transparent 0%, transparent 40%, #3B82F6 40%, #3B82F6 60%, transparent 60%);
		opacity: 0; /* Hidden by default */
		transition: opacity 0.2s ease;
		pointer-events: none; /* Don't interfere when hidden */
	}

	.text-annotation:hover .resize-handle,
	.text-annotation.editing .resize-handle,
	.text-annotation.resizing .resize-handle {
		opacity: 0.7;
		pointer-events: auto;
	}

	.resize-handle:hover {
		opacity: 1 !important;
	}

	/* Scrollbar styling for webkit browsers */
	.annotation-textarea::-webkit-scrollbar,
	.annotation-content::-webkit-scrollbar {
		width: 4px;
	}

	.annotation-textarea::-webkit-scrollbar-track,
	.annotation-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.annotation-textarea::-webkit-scrollbar-thumb,
	.annotation-content::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}

	.annotation-textarea::-webkit-scrollbar-thumb:hover,
	.annotation-content::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.3);
	}
</style>
