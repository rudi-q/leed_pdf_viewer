<script lang="ts">
	import { onMount } from 'svelte';
	import { consentStore } from '$lib/stores/consentStore';
	import { isEUUser } from '$lib/utils/geoDetection';
	import { isTauri } from '$lib/utils/tauriUtils';
	import { X, Shield, Eye } from 'lucide-svelte';

	let showBanner = false;
	let isInitialized = false;

	// Subscribe to consent store
	$: if ($consentStore && consentStore.shouldShowBanner($consentStore)) {
		showBanner = true;
	} else {
		showBanner = false;
	}

	onMount(async () => {
		// Skip cookie banner entirely for desktop (Tauri) app
		if (isTauri) {
			console.log('Cookie banner disabled for desktop app');
			isInitialized = true;
			return;
		}
		
		try {
			// Prefer cached EU status to avoid redundant API calls
			let isEU;
			if (typeof window.__isEUUser !== 'undefined') {
				isEU = window.__isEUUser;
				console.log('Cookie banner using cached EU status:', isEU);
			} else {
				// Fallback to geo detection if not cached
				isEU = await isEUUser();
				window.__isEUUser = isEU;
				console.log('Cookie banner detected EU status:', isEU);
			}
			
			consentStore.initialize(isEU);
			isInitialized = true;
			
			console.log(`Cookie banner initialized for ${isEU ? 'EU' : 'non-EU'} user`);
		} catch (error) {
			console.error('Error initializing cookie banner:', error);
			// Default to EU for safety
			consentStore.initialize(true);
			window.__isEUUser = true;
			isInitialized = true;
		}
	});

	function handleAccept() {
		consentStore.accept();
	}

	function handleDecline() {
		consentStore.decline();
	}

	function handleClose() {
		// Treat close as decline for privacy
		consentStore.decline();
	}
</script>

{#if showBanner && isInitialized}
	<div class="cookie-banner-overlay" role="dialog" aria-labelledby="cookie-banner-title" aria-describedby="cookie-banner-description">
		<div class="cookie-banner">
			<!-- Header -->
			<div class="cookie-banner-header">
				<div class="cookie-banner-icon">
					<Shield size={24} />
				</div>
				<h3 id="cookie-banner-title" class="cookie-banner-title">
					Your Privacy Matters
				</h3>
				<button 
					class="cookie-banner-close" 
					on:click={handleClose}
					aria-label="Close cookie banner"
				>
					<X size={18} />
				</button>
			</div>

			<!-- Content -->
			<div class="cookie-banner-content">
				<p id="cookie-banner-description" class="cookie-banner-text">
					We use analytics cookies to improve your experience and understand how our PDF tool is used. 
					You can choose to accept or decline cookies - either way, LeedPDF works perfectly!
				</p>

				<!-- Benefits -->
				<div class="cookie-banner-benefits">
					<div class="benefit-item">
						<Shield size={16} class="text-sage" />
						<span>Your PDFs stay private & local</span>
					</div>
					<div class="benefit-item">
						<Eye size={16} class="text-sage" />
						<span>Help us improve the app</span>
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="cookie-banner-actions">
				<button 
					class="btn-secondary" 
					on:click={handleDecline}
					type="button"
				>
					Decline Cookies
				</button>
				<button 
					class="btn-primary" 
					on:click={handleAccept}
					type="button"
				>
					Accept Cookies
				</button>
			</div>

			<!-- Fine print -->
			<div class="cookie-banner-footer">
				<p class="text-xs text-gray-500">
					Declining cookies enables privacy-first analytics. 
					<a href="/privacy" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline">Learn more</a>
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.cookie-banner-overlay {
		position: fixed;
		bottom: 5rem; /* Position above help/version cards (bottom-4 = 1rem, so 5rem gives clearance) */
		left: 1rem; /* Align with help cards (left-4 = 1rem) */
		z-index: 9999;
		animation: slideUp 0.3s ease-out;
	}

	.cookie-banner {
		max-width: 400px; /* Slightly smaller to fit in corner */
		width: 100%;
		/* LeedPDF's floating-panel style */
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(16px);
		border-radius: 1.5rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		overflow: hidden;
	}

	:global(.dark) .cookie-banner {
		background: rgba(31, 41, 55, 0.9);
		border-color: rgba(107, 114, 128, 0.2);
	}

	.cookie-banner-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1.5rem 1.5rem 0;
		position: relative;
	}

	.cookie-banner-icon {
		flex-shrink: 0;
		color: #87A96B; /* LeedPDF sage color */
	}

	.cookie-banner-title {
		flex: 1;
		font-size: 1.125rem;
		font-weight: 600;
		color: #374151; /* LeedPDF charcoal */
		margin: 0;
	}

	:global(.dark) .cookie-banner-title {
		color: #f9fafb;
	}

	.cookie-banner-close {
		position: absolute;
		top: 1.25rem;
		right: 1.25rem;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(55, 65, 81, 0.1);
		color: #6b7280;
		cursor: pointer;
		padding: 0.375rem;
		border-radius: 0.5rem;
		transition: all 0.2s;
		backdrop-filter: blur(4px);
	}

	.cookie-banner-close:hover {
		background: rgba(255, 255, 255, 0.8);
		color: #374151;
		transform: scale(1.05);
	}

	:global(.dark) .cookie-banner-close {
		background: rgba(31, 41, 55, 0.7);
		border-color: rgba(107, 114, 128, 0.2);
		color: #9ca3af;
	}

	:global(.dark) .cookie-banner-close:hover {
		background: rgba(31, 41, 55, 0.9);
		color: #e5e7eb;
	}

	.cookie-banner-content {
		padding: 1rem 1.5rem;
	}

	.cookie-banner-text {
		color: #6b7280;
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0 0 1.25rem 0;
	}

	:global(.dark) .cookie-banner-text {
		color: #d1d5db;
	}

	.cookie-banner-benefits {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.benefit-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: #6b7280;
		padding: 0.5rem 0.75rem;
		background: rgba(135, 169, 107, 0.05); /* Sage tint */
		border-radius: 0.75rem;
	}

	:global(.dark) .benefit-item {
		color: #d1d5db;
		background: rgba(135, 169, 107, 0.1);
	}

	.cookie-banner-actions {
		display: flex;
		gap: 0.75rem;
		padding: 0 1.5rem;
		margin-top: 0.5rem;
	}

	/* LeedPDF button styles */
	.btn-primary {
		flex: 1;
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
		/* LeedPDF primary-button style */
		background: #87A96B; /* sage */
		color: #121212;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	.btn-primary:hover {
		background: rgba(135, 169, 107, 0.9);
		transform: scale(1.02);
		box-shadow: 0 8px 25px -8px rgba(135, 169, 107, 0.4);
	}

	.btn-secondary {
		flex: 1;
		padding: 0.75rem 1.25rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		/* LeedPDF secondary-button style */
		background: rgba(255, 255, 255, 0.7);
		color: #374151; /* charcoal */
		border: 1px solid rgba(55, 65, 81, 0.1);
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.9);
		transform: scale(1.02);
		border-color: rgba(55, 65, 81, 0.2);
	}

	:global(.dark) .btn-secondary {
		background: rgba(31, 41, 55, 0.7);
		color: #e5e7eb;
		border-color: rgba(107, 114, 128, 0.2);
	}

	:global(.dark) .btn-secondary:hover {
		background: rgba(55, 65, 81, 0.9);
		border-color: rgba(107, 114, 128, 0.3);
	}

	.cookie-banner-footer {
		padding: 1rem 1.5rem 1.5rem;
		text-align: center;
	}

	.cookie-banner-footer p {
		color: #9ca3af;
		font-size: 0.75rem;
		margin: 0;
	}

	.cookie-banner-footer a {
		color: #87A96B; /* sage */
		transition: color 0.2s;
	}

	.cookie-banner-footer a:hover {
		color: rgba(135, 169, 107, 0.8);
	}

	:global(.dark) .cookie-banner-footer p {
		color: #6b7280;
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.cookie-banner-overlay {
			/* On mobile, use bottom positioning to avoid covering main content */
			bottom: 1rem;
			left: 0.75rem;
			right: 0.75rem;
		}

		.cookie-banner {
			max-width: none;
			width: 100%;
		}

		.cookie-banner-header {
			padding: 1.25rem 1.25rem 0;
		}

		.cookie-banner-content {
			padding: 1rem 1.25rem;
		}

		.cookie-banner-actions {
			flex-direction: column;
			padding: 0 1.25rem;
			gap: 0.5rem;
		}

		.cookie-banner-footer {
			padding: 1rem 1.25rem 1.25rem;
		}
	}

	/* Tablet breakpoint - adjust positioning */
	@media (min-width: 641px) and (max-width: 1024px) {
		.cookie-banner {
			max-width: 350px;
		}
	}
</style>

<script context="module" lang="ts">
	// Type augmentation for global window properties
	declare global {
		interface Window {
			__isEUUser?: boolean;
			__posthogInitialized?: boolean;
		}
	}
</script>
