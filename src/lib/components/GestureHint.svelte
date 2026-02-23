<script lang="ts">
	import { onMount } from 'svelte';
	import { drawingState } from '$lib/stores/drawingStore';

	const STORAGE_KEY = 'leedpdf_gesture_hint_seen';
	const DISMISS_MS = 2000;

	let visible = false;

	$: isFreehandTool = ['pencil', 'eraser', 'highlight'].includes($drawingState.tool);

	// Show the hint once when a freehand tool is first activated on a touch device
	$: if (isFreehandTool && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) {
		tryShow();
	}

	function tryShow() {
		if (visible) return; // already shown — don't stack another timer
		try {
			if (localStorage.getItem(STORAGE_KEY) === 'true') return;
		} catch {
			return; // localStorage unavailable (e.g. private browsing)
		}
		visible = true;
		setTimeout(() => {
			visible = false;
			try {
				localStorage.setItem(STORAGE_KEY, 'true');
			} catch {
				// ignore
			}
		}, DISMISS_MS);
	}
</script>

{#if visible}
	<div
		class="absolute bottom-14 left-1/2 -translate-x-1/2 z-50
			floating-panel !py-2 !px-4 text-sm text-charcoal dark:text-gray-200
			animate-fade-in whitespace-nowrap pointer-events-none select-none"
	>
		Use two fingers to pan or zoom
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translate(-50%, 4px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
	.animate-fade-in {
		animation: fadeIn 0.2s ease-out;
	}
</style>
