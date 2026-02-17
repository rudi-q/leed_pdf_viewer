<script lang="ts">
	import { openExternalUrl } from '../utils/navigationUtils';

	type Link = {
		url: string;
		rect: { left: number; top: number; width: number; height: number };
		isInternal: boolean;
		destPage?: number;
	};

	let {
		links = [],
		containerWidth = 0,
		containerHeight = 0,
		onGoToPage = undefined
	}: {
		links?: Link[];
		containerWidth?: number;
		containerHeight?: number;
		onGoToPage?: (page: number) => void;
	} = $props();

	let hoveredIndex: number = $state(-1);

	const linkCursor = "url('/cursors/link-click.svg') 12 12, pointer";

	function handleClick(link: Link) {
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
					cursor: {linkCursor};
				"
				target="_blank"
				rel="noopener noreferrer"
				title={link.isInternal ? `Go to page ${link.destPage}` : link.url}
				aria-label={link.isInternal ? `Go to page ${link.destPage}` : `Open ${link.url}`}
				onmouseenter={() => (hoveredIndex = i)}
				onmouseleave={() => (hoveredIndex = -1)}
				onclick={(e) => {
					e.preventDefault();
					handleClick(link);
				}}
			></a>
		{/each}
	</div>
{/if}

<style>
	.link-highlight {
		border-radius: 2px;
		transition: background-color 0.15s ease;
	}

	.link-highlight:hover,
	.link-highlight.hovered {
		background-color: rgba(59, 130, 246, 0.15);
		outline: 1.5px solid rgba(59, 130, 246, 0.5);
	}
</style>
