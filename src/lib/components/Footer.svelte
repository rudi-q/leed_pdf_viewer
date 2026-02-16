<script lang="ts">
	import HelpButton from './HelpButton.svelte';
	import { createEventDispatcher } from 'svelte';
	import { openExternalUrl } from '$lib/utils/navigationUtils';

	export let focusMode = false;
	export let presentationMode = false;
	export let getFormattedVersion: () => string = () => '';
	export let showGithubLink = false;
	export let showVersion = false;

	const dispatch = createEventDispatcher<{
		helpClick: void;
	}>();

	let showSocialOverlay = false;

	function toggleOverlay() {
		showSocialOverlay = !showSocialOverlay;
	}

	function openOverlay() {
		showSocialOverlay = true;
	}

	function closeOverlay() {
		showSocialOverlay = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleOverlay();
		} else if (event.key === 'Escape' && showSocialOverlay) {
			event.preventDefault();
			closeOverlay();
		}
	}

	function handleFocusOut(event: FocusEvent) {
		const target = event.relatedTarget as Node | null;
		const currentTarget = event.currentTarget as HTMLElement;

		// Only close if focus is moving outside the container
		if (!target || !currentTarget.contains(target)) {
			closeOverlay();
		}
	}

	function handleHelpClick() {
		dispatch('helpClick');
	}
</script>

{#if !focusMode && !presentationMode}
	<div class="absolute bottom-4 right-4 text-xs flex items-center gap-2">
		<div
			class="relative hover-trigger"
			role="group"
			on:mouseenter={openOverlay}
			on:mouseleave={closeOverlay}
			on:focusin={openOverlay}
			on:focusout={handleFocusOut}
		>
			<button
				type="button"
				class="text-charcoal/60 dark:text-gray-300 cursor-pointer hover:text-sage dark:hover:text-sage transition-colors bg-transparent border-none p-0 font-inherit text-xs"
				aria-expanded={showSocialOverlay}
				aria-label="Show social media links"
				on:click={toggleOverlay}
				on:keydown={handleKeyDown}
			>
				Made by Rudi K
			</button>

			{#if showSocialOverlay}
				<div class="social-overlay">
					<div class="flex flex-col gap-3">
						<div
							class="text-xs font-semibold text-charcoal/80 dark:text-gray-300 text-center tracking-wide"
						>
							CONNECT WITH ME
						</div>

						<div class="flex items-center justify-center gap-3">
							<!-- GitHub Icon -->
							<button
								type="button"
								on:click={() => openExternalUrl('https://github.com/rudi-q')}
								aria-label="Visit GitHub profile"
								class="social-icon-button"
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="icon">
									<path
										d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.30.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.30 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
									/>
								</svg>
								<span class="sr-only">GitHub</span>
							</button>

							<!-- X (Twitter) Icon -->
							<button
								type="button"
								on:click={() => openExternalUrl('https://x.com/lofifounder')}
								aria-label="Visit X (Twitter) profile"
								class="social-icon-button"
							>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="icon">
									<path
										d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
									/>
								</svg>
								<span class="sr-only">X (Twitter)</span>
							</button>
						</div>
					</div>

					<!-- Decorative arrow -->
					<div class="arrow"></div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Help button and version display -->
	<div class="absolute bottom-4 left-4 flex items-center gap-2">
		<HelpButton on:click={handleHelpClick} />

		<!-- Version display -->
		{#if showVersion}
			<div
				class="text-xs text-charcoal/50 dark:text-gray-400 px-2 py-1 bg-white/60 dark:bg-gray-800/60 rounded-lg backdrop-blur-sm border border-charcoal/5 dark:border-gray-600/10"
			>
				{getFormattedVersion()}
			</div>
		{/if}

		{#if showGithubLink}
			<!-- GitHub repo link -->
			<button
				type="button"
				on:click={() => openExternalUrl('https://github.com/rudi-q/leed_pdf_viewer')}
				aria-label="View source code on GitHub"
				class="github-link"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.30.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.30 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
					/>
				</svg>
			</button>
		{/if}
	</div>
{/if}

<style>
	.hover-trigger {
		/* Add padding to create a larger hover area */
		padding: 8px 8px 20px 8px;
		margin: -8px -8px -20px -8px;
	}

	.social-overlay {
		position: absolute;
		bottom: calc(100% + 4px);
		right: -8px;
		z-index: 9999;

		/* Glass morphism effect matching the app style */
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 12px;
		padding: 16px;
		min-width: 200px;

		/* Beautiful shadow matching Tooltip component */
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.15),
			0 2px 8px rgba(0, 0, 0, 0.08);
		backdrop-filter: blur(12px);

		/* Smooth animation */
		animation: overlayFadeIn 0.2s ease-out forwards;
	}

	/* Dark mode */
	:global(.dark) .social-overlay {
		background: rgba(17, 24, 39, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			0 2px 8px rgba(0, 0, 0, 0.2);
	}

	/* Decorative arrow pointing down */
	.arrow {
		position: absolute;
		bottom: -5px;
		right: 16px;
		width: 10px;
		height: 10px;
		background: rgba(255, 255, 255, 0.95);
		border-right: 1px solid rgba(0, 0, 0, 0.1);
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		transform: rotate(45deg);
	}

	:global(.dark) .arrow {
		background: rgba(17, 24, 39, 0.95);
		border-right: 1px solid rgba(255, 255, 255, 0.15);
		border-bottom: 1px solid rgba(255, 255, 255, 0.15);
	}

	.social-icon-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(37, 37, 37, 0.05);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.social-icon-button:hover {
		background: rgba(142, 165, 145, 0.2);
		transform: translateY(-2px) scale(1.05);
		box-shadow: 0 4px 12px rgba(142, 165, 145, 0.3);
	}

	.social-icon-button:active {
		transform: translateY(0) scale(1);
	}

	:global(.dark) .social-icon-button {
		background: rgba(55, 65, 81, 0.8);
	}

	:global(.dark) .social-icon-button:hover {
		background: rgba(142, 165, 145, 0.3);
	}

	.social-icon-button .icon {
		color: rgba(37, 37, 37, 0.7);
		transition: color 0.3s ease;
	}

	.social-icon-button:hover .icon {
		color: rgb(142, 165, 145);
	}

	:global(.dark) .social-icon-button .icon {
		color: rgba(229, 231, 235, 0.9);
	}

	:global(.dark) .social-icon-button:hover .icon {
		color: rgb(142, 165, 145);
	}

	/* GitHub link styling - matches version card */
	.github-link {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem 0.5rem; /* Same as py-1 px-2 to match Help and Version */
		height: 100%; /* Match height with adjacent cards */
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.6);
		color: rgba(37, 37, 37, 0.5);
		border: 1px solid rgba(37, 37, 37, 0.05);
		backdrop-filter: blur(4px);
		transition: all 0.2s ease;
	}

	.github-link:hover {
		background: rgba(255, 255, 255, 0.7);
		color: rgba(142, 165, 145, 0.9);
		border-color: rgba(37, 37, 37, 0.08);
	}

	.github-link:active {
		transform: scale(0.98);
	}

	:global(.dark) .github-link {
		background: rgba(31, 41, 55, 0.6);
		color: rgba(156, 163, 175, 1);
		border: 1px solid rgba(75, 85, 99, 0.1);
	}

	:global(.dark) .github-link:hover {
		background: rgba(31, 41, 55, 0.7);
		color: rgba(142, 165, 145, 0.9);
		border-color: rgba(75, 85, 99, 0.15);
	}

	/* Screen reader only content */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	@keyframes overlayFadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
