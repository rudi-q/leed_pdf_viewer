<script lang="ts">
	import { onMount } from 'svelte';
	import ImageAnnotation from './ImageAnnotation.svelte';
	import type { ImageAnnotation as ImageAnnotationType } from '../stores/drawingStore';
	import {
		addImageAnnotation,
		currentPageImageAnnotations,
		deleteImageAnnotation,
		pdfState,
		updateImageAnnotation
	} from '../stores/drawingStore';
	import { trackFirstAnnotation } from '../utils/analytics';
	import { type RotationAngle } from '../utils/rotationUtils';
	import { toastStore } from '../stores/toastStore';
	import { showTipsFor } from '../utils/tipManager';

	export let containerWidth: number = 0;
	export let containerHeight: number = 0;
	export let scale: number = 1;
	export let viewOnlyMode = false;
	export let rotation: RotationAngle = 0;
	export let basePageWidth: number = 0;
	export let basePageHeight: number = 0;

	/**
	 * Downscale an image to a maximum dimension while preserving aspect ratio.
	 * Prevents oversized base64 blobs in localStorage.
	 */
	function resizeImageToMaxDimension(img: HTMLImageElement, maxDimension: number): string {
		let w = img.naturalWidth;
		let h = img.naturalHeight;

		if (Math.max(w, h) > maxDimension) {
			const factor = maxDimension / Math.max(w, h);
			w = Math.round(w * factor);
			h = Math.round(h * factor);
		}

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get 2D canvas context');
		ctx.drawImage(img, 0, 0, w, h);
		return canvas.toDataURL('image/png');
	}

	async function handlePaste(event: ClipboardEvent) {
		if (viewOnlyMode) return;

		// Don't intercept paste in text inputs / contentEditable
		const target = event.target as HTMLElement;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target.isContentEditable
		)
			return;

		const items = event.clipboardData?.items;
		if (!items) return;

		let imageItem: DataTransferItem | null = null;
		for (const item of Array.from(items)) {
			if (item.type.startsWith('image/')) {
				imageItem = item;
				break;
			}
		}

		if (!imageItem) return;

		// We have an image — prevent default and process it
		event.preventDefault();

		const blob = imageItem.getAsFile();
		if (!blob) return;

		const objectUrl = URL.createObjectURL(blob);

		try {
			const img = await new Promise<HTMLImageElement>((resolve, reject) => {
				const el = new Image();
				el.onload = () => resolve(el);
				el.onerror = reject;
				el.src = objectUrl;
			});

			// Downscale to at most 1600px on the longest side for localStorage budget
			const imageData = resizeImageToMaxDimension(img, 1600);

			const naturalW = img.naturalWidth;
			const naturalH = img.naturalHeight;

			if (!basePageWidth || !basePageHeight) return;

			// Fit within 40% of page width and 80% of page height, maintaining aspect ratio
			const scaleW = (basePageWidth * 0.4) / naturalW;
			const scaleH = (basePageHeight * 0.8) / naturalH;
			const fitScale = Math.min(scaleW, scaleH);
			const defaultBaseW = naturalW * fitScale;
			const defaultBaseH = naturalH * fitScale;

			// Place at page center
			const centerX = (basePageWidth - defaultBaseW) / 2;
			const centerY = (basePageHeight - defaultBaseH) / 2;
			const constrainedX = Math.max(0, Math.min(basePageWidth - defaultBaseW, centerX));
			const constrainedY = Math.max(0, Math.min(basePageHeight - defaultBaseH, centerY));

			const newAnnotation: ImageAnnotationType = {
				id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				pageNumber: $pdfState.currentPage,
				x: constrainedX,
				y: constrainedY,
				width: defaultBaseW,
				height: defaultBaseH,
				imageData,
				rotation: 0,
				relativeX: basePageWidth > 0 ? constrainedX / basePageWidth : 0,
				relativeY: basePageHeight > 0 ? constrainedY / basePageHeight : 0,
				relativeWidth: basePageWidth > 0 ? defaultBaseW / basePageWidth : 0,
				relativeHeight: basePageHeight > 0 ? defaultBaseH / basePageHeight : 0
			};

			trackFirstAnnotation('image');
			addImageAnnotation(newAnnotation);
		} catch (error) {
			console.error('Failed to process pasted image:', error);
			toastStore.error('Paste failed', 'Could not paste image. Try copying it again.');
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	}

	const handleAnnotationUpdate = (event: CustomEvent<ImageAnnotationType>) => {
		if (viewOnlyMode) return;
		updateImageAnnotation(event.detail);
	};

	const handleAnnotationDelete = (event: CustomEvent<string>) => {
		if (viewOnlyMode) return;
		deleteImageAnnotation(event.detail, $pdfState.currentPage);
	};

	onMount(() => {
		document.addEventListener('paste', handlePaste);

		const tipTimer = !viewOnlyMode ? showTipsFor('pdf-loaded') : null;

		return () => {
			document.removeEventListener('paste', handlePaste);
			if (tipTimer != null) clearTimeout(tipTimer);
		};
	});
</script>

<div
	class="image-overlay"
	style:width="{containerWidth}px"
	style:height="{containerHeight}px"
>
	{#each $currentPageImageAnnotations as annotation (annotation.id)}
		<ImageAnnotation
			{annotation}
			{scale}
			{rotation}
			{basePageWidth}
			{basePageHeight}
			{viewOnlyMode}
			on:update={handleAnnotationUpdate}
			on:delete={handleAnnotationDelete}
		/>
	{/each}
</div>

<style>
	.image-overlay {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		z-index: 9;
		background: transparent;
	}
</style>
