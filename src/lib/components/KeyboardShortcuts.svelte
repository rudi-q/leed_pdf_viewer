<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let isOpen = false;

	const dispatch = createEventDispatcher();

	function close() {
		isOpen = false;
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}

	onMount(() => {
		if (browser) {
			document.addEventListener('keydown', handleKeydown);
		}
	});

	onDestroy(() => {
		if (browser) {
			document.removeEventListener('keydown', handleKeydown);
		}
	});

	const shortcuts = [
		{
			category: 'Navigation',
			items: [
				{ keys: ['←', '→'], description: 'Navigate pages' },
				{ keys: ['↑', '↓'], description: 'Scroll/Navigate (pan when zoomed)' },
				{ keys: ['Ctrl', '+'], description: 'Zoom in' },
				{ keys: ['Ctrl', '-'], description: 'Zoom out' },
				{ keys: ['Ctrl', '0'], description: 'Reset zoom' },
				{ keys: ['W'], description: 'Fit to width' },
				{ keys: ['H'], description: 'Fit to height' },
				{ keys: ['T'], description: 'Toggle page thumbnails' }
			]
		},
		{
			category: 'Drawing Tools',
			items: [
				{ keys: ['1'], description: 'Switch to pencil' },
				{ keys: ['2'], description: 'Switch to eraser' },
				{ keys: ['Alt'], description: 'Hold Alt while erasing for granular erase' },
				{ keys: ['3'], description: 'Switch to text' },
				{ keys: ['4'], description: 'Switch to arrow' },
				{ keys: ['5'], description: 'Switch to highlighter' },
				{ keys: ['6'], description: 'Switch to sticky note' },
				{ keys: ['7'], description: 'Switch to select/copy text' },
				{ keys: ['S'], description: 'Switch to stamps' }
			]
		},
		{
			category: 'Actions',
			items: [
				{ keys: ['U'], description: 'Choose PDF file' },
				{ keys: ['Ctrl', 'S'], description: 'Download/Export PDF' },
				{ keys: ['Ctrl', 'Z'], description: 'Undo last action' },
				{ keys: ['Ctrl', 'Y'], description: 'Redo action' },
				{ keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo action (alt)' }
			]
		},
		{
			category: 'View',
			items: [
				{ keys: ['F11'], description: 'Toggle fullscreen' },
				{ keys: ['F'], description: 'Focus mode (hide toolbar & credits)' },
				{ keys: ['P'], description: 'Presentation mode (fullscreen + hide UI)' },
				{ keys: ['Scroll'], description: 'Scroll/Navigate (pan when zoomed)' },
				{ keys: ['Ctrl', 'Scroll'], description: 'Zoom in/out' },
				{ keys: ['Ctrl', 'Drag'], description: 'Pan around document' }
			]
		},
		{
			category: 'Help',
			items: [
				{ keys: ['?'], description: 'Show this help' },
				/*{ keys: ['F1'], description: 'Show this help' },*/
				{ keys: ['Esc'], description: 'Close dialogs' }
			]
		}
	];
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
		on:click|self={close}
		on:keydown={(e) => e.key === 'Escape' && close()}
		role="button"
		tabindex="-1"
		aria-label="Close modal overlay"
	>
		<!-- Modal -->
		<div
			class="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/30 max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
		>
			<!-- Header -->
			<div class="border-b border-charcoal/10 px-6 py-4">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-semibold text-charcoal">Keyboard Shortcuts</h2>
					<button
						on:click={close}
						class="p-2 hover:bg-charcoal/10 rounded-lg transition-colors"
						title="Close (Esc)"
						aria-label="Close modal"
					>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					{#each shortcuts as category}
						<div>
							<h3 class="text-lg font-medium text-charcoal mb-3">{category.category}</h3>
							<div class="space-y-2">
								{#each category.items as shortcut}
									<div class="flex items-center justify-between py-2">
										<span class="text-sm text-slate">{shortcut.description}</span>
										<div class="flex items-center space-x-1">
											{#each shortcut.keys as key, index}
												{#if index > 0}
													<span class="text-xs text-charcoal/50">+</span>
												{/if}
												<kbd
													class="px-2 py-1 text-xs font-medium bg-charcoal/10 text-charcoal rounded border border-charcoal/20 shadow-sm"
												>
													{key}
												</kbd>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<!-- Footer tip -->
				<div class="mt-6 pt-4 border-t border-charcoal/10">
					<p class="text-xs text-slate text-center">
						💡 Tip: You can also access most features through the toolbar buttons
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	kbd {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
	}
</style>
