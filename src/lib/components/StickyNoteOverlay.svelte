<script lang="ts">
	import { onMount } from 'svelte';
	import StickyNote from './StickyNote.svelte';
	import type { StickyNoteAnnotation } from '$lib/stores/drawingStore';
	import {
		addStickyNoteAnnotation,
		currentPageStickyNotes,
		deleteStickyNoteAnnotation,
		drawingState,
		pdfState,
		updateStickyNoteAnnotation
	} from '$lib/stores/drawingStore';

	export let containerWidth: number = 0; // Actual displayed canvas width
	export let containerHeight: number = 0; // Actual displayed canvas height
	export let scale: number = 1; // Current PDF scale
	export let viewOnlyMode = false; // If true, disable all editing interactions

	let overlayElement: HTMLDivElement;
	let isCreatingNote = false;

	// Listen for note tool activation and click events
	$: isNoteTool = $drawingState.tool === 'note';

	// Handle click to create new sticky note
	const handleContainerClick = (event: MouseEvent) => {
		if (!isNoteTool || isCreatingNote || viewOnlyMode) return;

		// Don't create note if clicking on an existing note
		const target = event.target as HTMLElement;
		if (target.closest('.sticky-note')) return;

		// Calculate click position relative to the container
		const rect = overlayElement.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		
		// Convert to base scale for storage
		const baseX = x / scale;
		const baseY = y / scale;

		// Default dimensions at base scale
		const defaultWidth = 150;
		const defaultHeight = 100;

		// Ensure the note fits within the container (at base scale)
		const baseContainerWidth = containerWidth / scale;
		const baseContainerHeight = containerHeight / scale;
		const constrainedX = Math.max(0, Math.min(baseContainerWidth - defaultWidth, baseX));
		const constrainedY = Math.max(0, Math.min(baseContainerHeight - defaultHeight, baseY));

		// Calculate font size with intelligent constraints (base scale)
		// Use width-based scaling but cap it to ensure it fits within height
		const widthBasedSize = defaultWidth * 0.16;
		const heightConstraint = defaultHeight * 0.4; // Max 40% of height
		const maxFontSize = 32; // Absolute maximum font size
		const relativeFontSize = Math.max(10, Math.min(widthBasedSize, heightConstraint, maxFontSize));

	// Create new sticky note
	const newNote: StickyNoteAnnotation = {
		id: `sticky-note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		pageNumber: $pdfState.currentPage,
		x: constrainedX,
		y: constrainedY,
		text: '',
		fontSize: relativeFontSize,
		fontFamily: 'ReenieBeanie, cursive',
		backgroundColor: $drawingState.noteColor,
		width: defaultWidth,
		height: defaultHeight,
		relativeX: constrainedX / baseContainerWidth,
		relativeY: constrainedY / baseContainerHeight,
		relativeWidth: defaultWidth / baseContainerWidth,
		relativeHeight: defaultHeight / baseContainerHeight,
	};

		isCreatingNote = true;
		addStickyNoteAnnotation(newNote);
		
		// Reset creating state after a short delay
		setTimeout(() => {
			isCreatingNote = false;
		}, 100);
	};

	// Handle sticky note updates
	const handleNoteUpdate = (event: CustomEvent<StickyNoteAnnotation>) => {
		if (viewOnlyMode) return; // Block updates in view-only mode
		updateStickyNoteAnnotation(event.detail);
	};

	// Handle sticky note deletion
	const handleNoteDelete = (event: CustomEvent<string>) => {
		if (viewOnlyMode) return; // Block deletions in view-only mode
		deleteStickyNoteAnnotation(event.detail, $pdfState.currentPage);
	};

	onMount(() => {
		// Add cursor style for note tool
		const updateCursor = () => {
			if (overlayElement) {
				if (isNoteTool) {
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
		class="sticky-note-overlay"
		class:note-tool-active={isNoteTool}
	style:width="{containerWidth}px"
	style:height="{containerHeight}px"
		on:click={handleContainerClick}
		role="application"
		aria-label="Sticky notes area - click to create new note when note tool is active"
	>
	{#each $currentPageStickyNotes as note (note.id)}
		<StickyNote
			{note}
			{scale}
			{containerWidth}
			{containerHeight}
			{viewOnlyMode}
			on:update={handleNoteUpdate}
			on:delete={handleNoteDelete}
		/>
	{/each}

	<!-- Visual indicator when note tool is active -->
	{#if isNoteTool && $currentPageStickyNotes.length === 0}
		<div class="note-tool-hint">
			<div class="hint-content">
				<div class="hint-icon">📝</div>
				<div class="hint-text">Click anywhere to create a sticky note</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.sticky-note-overlay {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		z-index: 10;
		background: transparent;
	}

	.sticky-note-overlay.note-tool-active {
		cursor: crosshair;
		pointer-events: auto;
	}

	/* Allow interaction with individual sticky notes regardless of current tool */
	.sticky-note-overlay :global(.sticky-note) {
		pointer-events: auto;
	}

	.note-tool-hint {
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
		background: rgba(59, 130, 246, 0.9);
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


	/* Prevent text selection when in note tool mode */
	.sticky-note-overlay.note-tool-active * {
		user-select: none;
	}

	/* Add subtle grid pattern when note tool is active (optional visual enhancement) */
	.sticky-note-overlay.note-tool-active::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image: 
			radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.1) 1px, transparent 0);
		background-size: 20px 20px;
		pointer-events: none;
		opacity: 0;
		animation: fadeInGrid 0.3s ease-in-out 0.5s both;
	}

	@keyframes fadeInGrid {
		0% { opacity: 0; }
		100% { opacity: 1; }
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
