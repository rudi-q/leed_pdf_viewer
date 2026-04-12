<script lang="ts">
	import { Video, Sun, Camera } from 'lucide-svelte';

	export let name: string;
	export let tagline: string;
	export let description: string;
	export let href: string;
	export let icon: string;
	export let onDismiss: () => void;

	const iconMap: Record<string, typeof Video> = {
		video: Video,
		sun: Sun,
		camera: Camera
	};

	$: IconComponent = iconMap[icon] ?? Sun;
</script>

<div class="floating-panel !p-0 overflow-hidden group transition-all duration-300 hover:shadow-2xl">

	<!-- "From the maker of LeedPDF" header -->
	<div class="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-gradient-to-r from-sage/10 via-mint/6 to-transparent">
		<div class="flex items-center gap-2 min-w-0">
			<img src="/logo.png" alt="LeedPDF" class="h-[18px] w-auto flex-shrink-0 dark:hidden" />
			<img src="/logo-dark.png" alt="LeedPDF" class="h-[18px] w-auto flex-shrink-0 hidden dark:block" />
			<span class="text-[11px] text-slate dark:text-gray-300 truncate">
				From the maker of LeedPDF
			</span>
		</div>
		<button
			class="flex-shrink-0 text-slate/30 hover:text-slate/60 dark:text-gray-600 dark:hover:text-gray-400 transition-colors rounded-md p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
			on:click={onDismiss}
			title="Dismiss"
			aria-label="Dismiss {name} promotion"
		>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
				<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
			</svg>
		</button>
	</div>

	<!-- Divider -->
	<div class="h-px bg-gradient-to-r from-sage/20 via-mint/15 to-transparent"></div>

	<!-- Product body -->
	<div class="px-3.5 py-3 flex items-start gap-3">
		<div class="flex-shrink-0 mt-0.5">
			<div class="w-9 h-9 bg-gradient-to-br from-sage to-mint rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
				<svelte:component this={IconComponent} size={17} class="text-white drop-shadow-sm" />
			</div>
		</div>
		<div class="flex-1 min-w-0">
			<h3 class="font-bold text-charcoal dark:text-gray-100 text-sm leading-tight group-hover:text-sage transition-colors duration-200">
				{name}
			</h3>
			<p class="text-[11px] font-medium text-slate dark:text-gray-300 mt-0.5 mb-1 leading-tight">
				{tagline}
			</p>
			<p class="text-[11px] text-slate/80 dark:text-gray-400 leading-relaxed mb-2.5">
				{description}
			</p>
			<a
				{href}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1 text-[11px] font-semibold text-sage hover:text-sage/75 transition-colors group/link"
			>
				<span>Try it free</span>
				<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" class="group-hover/link:translate-x-0.5 transition-transform">
					<path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
				</svg>
			</a>
		</div>
	</div>

	<!-- Bottom accent -->
	<div class="h-0.5 bg-gradient-to-r from-sage/40 via-mint/25 to-lavender/20"></div>
</div>
