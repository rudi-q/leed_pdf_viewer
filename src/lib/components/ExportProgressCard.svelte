<script lang="ts">
	import { fly } from 'svelte/transition';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { onDestroy } from 'svelte';
	import { CheckCircle, Loader2, AlertCircle, X } from 'lucide-svelte';

	export let isExporting = false;
	export let operation = 'Exporting PDF';
	export let status: 'processing' | 'success' | 'error' = 'processing';
	export let message = '';
	export let progress = 0;

	const smoothProgress = tweened(0, { duration: 400, easing: cubicOut });

	$: smoothProgress.set(progress);

	$: percentText = Math.round($smoothProgress);

	let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

	// Auto-dismiss after success
	$: if (status === 'success') {
		clearTimeout(dismissTimeout!);
		dismissTimeout = setTimeout(() => {
			isExporting = false;
		}, 3000);
	}

	// Auto-dismiss after error
	$: if (status === 'error') {
		clearTimeout(dismissTimeout!);
		dismissTimeout = setTimeout(() => {
			isExporting = false;
		}, 5000);
	}

	function dismiss() {
		clearTimeout(dismissTimeout!);
		isExporting = false;
	}

	onDestroy(() => {
		clearTimeout(dismissTimeout!);
	});
</script>

{#if isExporting}
	<div
		class="fixed bottom-24 right-6 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[320px] max-w-[400px]"
		transition:fly={{ y: 20, duration: 300 }}
	>
		<div class="flex items-start gap-3">
			<!-- Icon -->
			<div class="flex-shrink-0 mt-0.5">
				{#if status === 'processing'}
					<Loader2 class="w-5 h-5 text-sage animate-spin" />
				{:else if status === 'success'}
					<CheckCircle class="w-5 h-5 text-green-600" />
				{:else}
					<AlertCircle class="w-5 h-5 text-red-600" />
				{/if}
			</div>

			<!-- Content -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center justify-between mb-1">
					<div class="font-medium text-sm text-charcoal dark:text-white">
						{operation}
					</div>
					<div class="flex items-center gap-2">
						{#if status === 'processing'}
							<span class="text-xs font-semibold text-sage tabular-nums">
								{percentText}%
							</span>
						{/if}
						<button
							on:click={dismiss}
							class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
							aria-label="Dismiss"
						>
							<X class="w-3.5 h-3.5" />
						</button>
					</div>
				</div>

				{#if message}
					<div class="text-xs text-slate dark:text-gray-400 mb-1.5">
						{message}
					</div>
				{/if}

				<!-- Progress bar -->
				{#if status === 'processing'}
					<div class="mt-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
						<div
							class="h-full bg-sage rounded-full transition-all duration-300 ease-out"
							style="width: {$smoothProgress}%"
						></div>
					</div>
				{:else if status === 'success'}
					<div class="mt-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
						<div class="h-full bg-green-500 rounded-full" style="width: 100%"></div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
