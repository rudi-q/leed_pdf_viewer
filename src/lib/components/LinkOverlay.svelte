<script lang="ts">
	import { openExternalUrl } from '../utils/navigationUtils';

	export let links: Array<{
		url: string;
		rect: { left: number; top: number; width: number; height: number };
		isInternal: boolean;
		destPage?: number;
	}> = [];
	export let containerWidth: number = 0;
	export let containerHeight: number = 0;
	export let onGoToPage: ((page: number) => void) | undefined = undefined;

	let hoveredIndex: number = -1;

	function handleClick(link: (typeof links)[0]) {
		if (link.isInternal && link.destPage !== undefined && onGoToPage) {
			onGoToPage(link.destPage);
		} else if (link.url) {
			openExternalUrl(link.url);
		}
	}
</script>

{#if links.length > 0}
	<div
		class="absolute top-0 left-0 pointer-events-none"
		style="width: {containerWidth}px; height: {containerHeight}px; z-index: 3;"
	>
		{#each links as link, i}
			<a
				href={link.url || '#'}
				class="absolute pointer-events-auto block link-highlight"
				class:hovered={hoveredIndex === i}
				style="
					left: {link.rect.left}px;
					top: {link.rect.top}px;
					width: {link.rect.width}px;
					height: {link.rect.height}px;
				"
				target="_blank"
				rel="noopener noreferrer"
				title={link.isInternal ? `Go to page ${link.destPage}` : link.url}
				on:mouseenter={() => (hoveredIndex = i)}
				on:mouseleave={() => (hoveredIndex = -1)}
				on:click|preventDefault={() => handleClick(link)}
			></a>
		{/each}
	</div>
{/if}

<style>
	.link-highlight {
		cursor: pointer;
		border-radius: 2px;
		transition: background-color 0.15s ease;
	}

	.link-highlight:hover,
	.link-highlight.hovered {
		background-color: rgba(59, 130, 246, 0.15);
		outline: 1.5px solid rgba(59, 130, 246, 0.5);
	}
</style>
