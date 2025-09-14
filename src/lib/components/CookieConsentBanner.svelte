<script lang="ts">
	import { onMount } from 'svelte';
	import { consentStore } from '$lib/stores/consentStore';
	import { isEUUser } from '$lib/utils/geoDetection';
	import { X, Cookie, Shield, Eye } from 'lucide-svelte';

	let showBanner = false;
	let isInitialized = false;

	// Subscribe to consent store
	$: if ($consentStore && consentStore.shouldShowBanner($consentStore)) {
		showBanner = true;
	} else {
		showBanner = false;
	}

	onMount(async () => {
		try {
			// Initialize consent store with EU detection
			const isEU = await isEUUser();
			consentStore.initialize(isEU);
			isInitialized = true;
			
			console.log(`Cookie banner initialized for ${isEU ? 'EU' : 'non-EU'} user`);
		} catch (error) {
			console.error('Error initializing cookie banner:', error);
			// Default to EU for safety
			consentStore.initialize(true);
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
					<Cookie size={24} class="text-blue-600" />
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
						<Shield size={16} class="text-green-600" />
						<span>Your PDFs stay private & local</span>
					</div>
					<div class="benefit-item">
						<Eye size={16} class="text-blue-600" />
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
					<a href="/privacy" class="underline hover:no-underline">Learn more</a>
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.cookie-banner-overlay {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 9999;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.1));
		padding: 1rem;
		animation: slideUp 0.3s ease-out;
	}

	.cookie-banner {
		max-width: 500px;
		margin: 0 auto;
		background: white;
		border-radius: 12px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		border: 1px solid #e5e7eb;
		overflow: hidden;
	}

	.cookie-banner-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1.25rem 1.25rem 0;
		position: relative;
	}

	.cookie-banner-icon {
		flex-shrink: 0;
	}

	.cookie-banner-title {
		flex: 1;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
		margin: 0;
	}

	.cookie-banner-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.cookie-banner-close:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.cookie-banner-content {
		padding: 1rem 1.25rem;
	}

	.cookie-banner-text {
		color: #4b5563;
		font-size: 0.875rem;
		line-height: 1.5;
		margin: 0 0 1rem 0;
	}

	.cookie-banner-benefits {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.benefit-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.cookie-banner-actions {
		display: flex;
		gap: 0.75rem;
		padding: 0 1.25rem;
	}

	.btn-primary, .btn-secondary {
		flex: 1;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
		border-color: #3b82f6;
	}

	.btn-primary:hover {
		background: #2563eb;
		border-color: #2563eb;
	}

	.btn-secondary {
		background: white;
		color: #374151;
		border-color: #d1d5db;
	}

	.btn-secondary:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.cookie-banner-footer {
		padding: 0.75rem 1.25rem 1.25rem;
		text-align: center;
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
			padding: 0.75rem;
		}

		.cookie-banner {
			max-width: none;
		}

		.cookie-banner-header {
			padding: 1rem 1rem 0;
		}

		.cookie-banner-content {
			padding: 0.75rem 1rem;
		}

		.cookie-banner-actions {
			flex-direction: column;
			padding: 0 1rem;
		}

		.cookie-banner-footer {
			padding: 0.75rem 1rem 1rem;
		}
	}
</style>