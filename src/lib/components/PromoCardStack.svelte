<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { isTauri, detectOS } from '$lib/utils/tauriUtils';
	import cards from '$lib/data/promoCards.json';
	import PromoCard from './PromoCard.svelte';

	export let focusMode = false;
	export let presentationMode = false;

	let visibleCard: typeof cards[number] | null = null;
	let visible = false;

	function checkCondition(condition: string | undefined): boolean {
		if (!condition || condition === 'any') return true;
		const os = detectOS();
		if (condition === 'windows') return os === 'Windows';
		if (condition === 'macos') return os === 'macOS';
		return true;
	}

	function dismiss(id: string) {
		localStorage.setItem(`leedpdf-promo-dismissed-${id}`, 'true');
		visible = false;
	}

	onMount(() => {
		// Pick once at mount — never swap mid-session
		visibleCard = cards.find((card) => {
			const dismissed = localStorage.getItem(`leedpdf-promo-dismissed-${card.id}`) === 'true';
			return !dismissed && checkCondition(card.condition);
		}) ?? null;

		if (visibleCard) {
			const timer = setTimeout(() => { visible = true; }, 5000);
			return () => clearTimeout(timer);
		}
	});
</script>

{#if !focusMode && !presentationMode && browser && !isTauri && visibleCard && visible}
	<div class="absolute bottom-16 right-4 w-72 animate-fade-in">
		<PromoCard
			name={visibleCard.name}
			tagline={visibleCard.tagline}
			description={visibleCard.description}
			href={visibleCard.href}
			icon={visibleCard.icon}
			onDismiss={() => dismiss(visibleCard!.id)}
		/>
	</div>
{/if}
