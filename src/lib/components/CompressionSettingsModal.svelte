<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { X, Zap, Scale, ImageDown } from 'lucide-svelte';

	export let isOpen = false;

	const dispatch = createEventDispatcher<{
		close: void;
		confirm: { quality: number };
	}>();

	let quality = 70;

	const presets = [
		{ label: 'Light', quality: 85, description: 'Minimal quality loss, smaller reduction' },
		{ label: 'Medium', quality: 70, description: 'Good balance of size and quality' },
		{ label: 'Heavy', quality: 50, description: 'Noticeably smaller, some quality loss' },
		{ label: 'Maximum', quality: 30, description: 'Smallest file, visible quality loss' }
	];

	$: activePreset = presets.find((p) => p.quality === quality)?.label ?? 'Custom';

	$: qualityLabel =
		quality >= 80
			? 'High quality'
			: quality >= 60
				? 'Good quality'
				: quality >= 40
					? 'Reduced quality'
					: 'Low quality';

	$: estimatedReduction =
		quality >= 80
			? '10–25%'
			: quality >= 60
				? '25–50%'
				: quality >= 40
					? '40–65%'
					: '55–80%';

	function close() {
		isOpen = false;
		dispatch('close');
	}

	function confirm() {
		isOpen = false;
		dispatch('confirm', { quality });
	}

	function selectPreset(presetQuality: number) {
		quality = presetQuality;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
		if (e.key === 'Enter') confirm();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
		on:click={(e) => {
			if (e.target === e.currentTarget) close();
		}}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden"
			transition:fly={{ y: 20, duration: 250 }}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 pt-5 pb-3">
				<div>
					<h2 class="text-lg font-semibold text-charcoal dark:text-white">
						Compression Settings
					</h2>
					<p class="text-xs text-slate dark:text-gray-400 mt-0.5">
						Choose how much to compress your PDF
					</p>
				</div>
				<button
					on:click={close}
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
					aria-label="Close"
				>
					<X size={18} />
				</button>
			</div>

			<div class="px-6 pb-6 space-y-5">
				<!-- Preset buttons -->
				<div class="grid grid-cols-4 gap-2">
					{#each presets as preset}
						<button
							on:click={() => selectPreset(preset.quality)}
							class="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all
								{activePreset === preset.label
								? 'border-sage bg-sage/10 text-sage dark:bg-sage/20'
								: 'border-gray-200 dark:border-gray-600 text-slate dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'}"
						>
							{#if preset.label === 'Light'}
								<ImageDown size={16} />
							{:else if preset.label === 'Medium'}
								<Scale size={16} />
							{:else if preset.label === 'Heavy'}
								<Zap size={16} />
							{:else}
								<Zap size={16} />
							{/if}
							{preset.label}
						</button>
					{/each}
				</div>

				<!-- Quality slider -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label
							for="quality-slider"
							class="text-sm font-medium text-charcoal dark:text-white"
						>
							Image Quality
						</label>
						<span class="text-sm font-semibold text-sage tabular-nums">{quality}%</span>
					</div>

					<input
						id="quality-slider"
						type="range"
						min="20"
						max="95"
						step="5"
						bind:value={quality}
						class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-sage slider"
					/>

					<div class="flex justify-between text-[10px] text-slate dark:text-gray-500">
						<span>Smallest file</span>
						<span>Best quality</span>
					</div>
				</div>

				<!-- Info card -->
				<div
					class="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 space-y-1.5 border border-gray-100 dark:border-gray-600/50"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs text-slate dark:text-gray-400">Quality</span>
						<span class="text-xs font-medium text-charcoal dark:text-white"
							>{qualityLabel}</span
						>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs text-slate dark:text-gray-400">Est. size reduction</span>
						<span class="text-xs font-medium text-sage">{estimatedReduction}</span>
					</div>
					{#if quality < 40}
						<p class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
							Very low quality may cause visible artifacts in images.
						</p>
					{/if}
				</div>

				<!-- Action buttons -->
				<div class="flex gap-3 pt-1">
					<button
						on:click={close}
						class="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-slate dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						Cancel
					</button>
					<button
						on:click={confirm}
						class="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-sage text-white hover:bg-sage/90 transition-colors shadow-sm"
					>
						Compress & Export
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-sage, #6b8f71);
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-sage, #6b8f71);
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}
</style>
