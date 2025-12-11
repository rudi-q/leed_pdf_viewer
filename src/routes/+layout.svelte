<script lang="ts">
	import '../app.css';
	import SEOHead from '$lib/components/SEOHead.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import UpdateManager from '$lib/components/UpdateManager.svelte';
	import UpdateNotification from '$lib/components/UpdateNotification.svelte';
	import LicenseModal from '$lib/components/LicenseModal.svelte';
	import CookieConsentBanner from '$lib/components/CookieConsentBanner.svelte';
	import ParityDeals from '$lib/components/ParityDeals.svelte';
	import { fileStorage } from '$lib/utils/fileStorageUtils';
	import { licenseManager } from '$lib/utils/licenseManager';
	import { initializeFonts } from '$lib/stores/drawingStore';
	import { browser, dev } from '$app/environment';
	import { onMount } from 'svelte';
	import { isTauri, detectOS } from '$lib/utils/tauriUtils';
	import { goto } from '$app/navigation';
	import { getCurrent } from '@tauri-apps/plugin-deep-link';
	import { listen } from '@tauri-apps/api/event';

	// Detect if we're on macOS (App Store build - no license required)
	const isMacOS = detectOS() === 'macOS';
	const requiresLicense = isTauri && !isMacOS; // Only Windows/Linux need license

	// License validation state (only used on Windows/Linux)
	let showLicenseModal = false;
	let licenseCheckCompleted = false;
	let hasValidLicense = false;
	let needsActivation = true; // true = first time activation, false = validation

	// Reference to UpdateManager component
	let updateManager: UpdateManager;

	// Initialize file storage auto-cleanup when app loads
	if (browser) {
		onMount(() => {
			// Make licenseManager available in console for debugging (dev only)
			if (dev) {
				(window as any).licenseManager = licenseManager;
			}
			
			// Start auto-cleanup of old files every AUTO_CLEANUP_INTERVAL milliseconds
			const stopCleanup = fileStorage.startAutoCleanup();
      
			// License validation for Tauri desktop app only (Windows/Linux only)
			if (requiresLicense) {
				// Check license immediately after app loads (removed delay)
				performLicenseCheck();
			} else {
				// macOS App Store or web version doesn't need license validation
				licenseCheckCompleted = true;
				hasValidLicense = true;
			}
			
			// Initialize system fonts for all Tauri platforms (Windows, macOS, Linux)
			if (isTauri) {
				initializeFonts();
			}
			
		// Deep link handling for all Tauri platforms
		if (isTauri) {
			// Listen for deep-link events from Rust
			listenForDeepLinks();
			
			// Also register the plugin handler (might work for some cases)
			registerDeepLinkHandler();
			
			// Listen for load-pdf-from-deep-link events (for URLs with file parameters)
			listenForLoadPdfFromDeepLink();
		}
			
			// Cleanup on page unload
			return stopCleanup;
		});
	}

	// Perform license check and trigger update check if valid
	async function performLicenseCheck() {
		try {
			const result = await licenseManager.checkLicenseStatus();

			if (result.valid) {
				hasValidLicense = true;
				// Trigger update check only after license is validated
				if (updateManager && updateManager.manualCheckForUpdates) {
					updateManager.manualCheckForUpdates();
				}
			} else {
				hasValidLicense = false;
				needsActivation = result.needsActivation ?? true;
				showLicenseModal = true;
			}
		} catch (error) {
			// Show modal on error as well (no stored license or validation failed)
			hasValidLicense = false;
			needsActivation = true; // Default to activation on error
			showLicenseModal = true;
		} finally {
			licenseCheckCompleted = true;
		}
	}

	// Handle successful license processing (activation or validation)
	function handleLicenseValidated(
		event: CustomEvent<{ licenseKey: string; wasActivation: boolean }>
	) {
		const { licenseKey, wasActivation } = event.detail;
		// Log success without exposing the raw license key
		const maskedKey =
			licenseKey.length > 4
				? '*'.repeat(licenseKey.length - 4) + licenseKey.slice(-4)
				: '*'.repeat(licenseKey.length);
		console.log(
			`License ${wasActivation ? 'activation' : 'validation'} successful - Key: ${maskedKey}`
		);
		showLicenseModal = false;
		licenseCheckCompleted = true;
		hasValidLicense = true;

		// Now that license is valid, trigger update check
		if (updateManager && updateManager.manualCheckForUpdates) {
			updateManager.manualCheckForUpdates();
		}
	}

	// Handle license modal close
	function handleLicenseModalClose() {
		// If user closes modal without validating, we still mark as completed
		// but they may not be able to use certain features
		licenseCheckCompleted = true;
		// hasValidLicense remains false, so no update check will be triggered
	}

	// Listen for deep-link events emitted from Rust backend
	async function listenForDeepLinks() {
		console.log('🔗 [Deep Link] Setting up event listener for deep-link events...');
		try {
			const unlisten = await listen('deep-link', (event) => {
				console.log('🔗🔗🔗 [Deep Link] EVENT RECEIVED!', event);
				let content = event.payload as string;
				console.log('🔗 [Deep Link] Raw content:', content);

				// Windows strips the colon after https, fix it
				if (content.startsWith('https//') || content.startsWith('http//')) {
					content = content.replace('https//', 'https://').replace('http//', 'http://');
					console.log('🔗 [Deep Link] Fixed URL:', content);
				}

				if (content) {
					// Navigate to /pdf/[url] route - DRY!
					const encodedContent = encodeURIComponent(content);
					console.log('🔗 [Deep Link] Navigating to /pdf/' + encodedContent);
					goto(`/pdf/${encodedContent}`);
				}
			});
			console.log('✅ [Deep Link] Event listener registered successfully!');

			// Tell Rust backend we're ready to receive deep link events
			// This will trigger a re-check of command line args
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('check_file_associations');
			console.log('✅ [Deep Link] Triggered re-check of command line args');
		} catch (error) {
			console.error('❌ [Deep Link] Failed to register event listener:', error);
		}
	}
	
	// Listen for load-pdf-from-deep-link events (for URLs with file parameters)
	async function listenForLoadPdfFromDeepLink() {
		console.log('🔗 [Load PDF Deep Link] Setting up event listener...');
		try {
			const unlisten = await listen<{pdf_path?: string; pdf_url?: string; page: number}>('load-pdf-from-deep-link', (event) => {
				console.log('🔗🔗🔗 [Load PDF Deep Link] EVENT RECEIVED!', event);
				const { pdf_path, pdf_url, page } = event.payload;
				
				if (pdf_url) {
					// Handle URL - navigate to the PDF route
					console.log('🔗 [Load PDF Deep Link] Loading PDF from URL:', pdf_url);
					const encodedUrl = encodeURIComponent(pdf_url);
					goto(`/pdf/${encodedUrl}`);
				} else if (pdf_path) {
					// Handle local file path - navigate to the PDF route
					console.log('🔗 [Load PDF Deep Link] Loading PDF from path:', pdf_path);
					const encodedPath = encodeURIComponent(pdf_path);
					goto(`/pdf/${encodedPath}`);
				}
			});
			console.log('✅ [Load PDF Deep Link] Event listener registered successfully!');
		} catch (error) {
			console.error('❌ [Load PDF Deep Link] Failed to register event listener:', error);
		}
	}

	// Register deep link handler - handles leedpdf:// URLs (plugin-based, may not work on all platforms)
	async function registerDeepLinkHandler() {
		console.log('🔗 [Deep Link] Starting plugin registration...');
		try {
			console.log('🔗 [Deep Link] Getting current instance...');
			const current = await getCurrent();
			console.log('🔗 [Deep Link] Got current:', current);

			if (!current || typeof current !== 'object' || !('onOpenUrl' in current)) {
				console.log('⚠️ [Deep Link] Plugin API not available, relying on custom event handler');
				return;
			}

			console.log('🔗 [Deep Link] Calling onOpenUrl...');
			const unlisten = await (current as any).onOpenUrl((urls: string[]) => {
				console.log('🔗🔗🔗 [Deep Link] PLUGIN CALLBACK TRIGGERED! Received:', urls);
				console.log('🔗 [Deep Link] Type:', typeof urls, 'IsArray:', Array.isArray(urls));

				// Process each URL
				for (const url of urls) {
					console.log('🔗 [Deep Link] Processing URL:', url);
					if (url.startsWith('leedpdf://')) {
						// Extract the content after leedpdf://
						let content = url.replace('leedpdf://', '');
						console.log('🔗 [Deep Link] Extracted content:', content);

						// Fix Windows colon stripping
						if (content.startsWith('https//') || content.startsWith('http//')) {
							content = content.replace('https//', 'https://').replace('http//', 'http://');
							console.log('🔗 [Deep Link] Fixed URL:', content);
						}

						if (content) {
							// Navigate to /pdf/[url] route - same as web app!
							const encodedContent = encodeURIComponent(content);
							console.log('🔗 [Deep Link] Navigating to /pdf/' + encodedContent);
							goto(`/pdf/${encodedContent}`);
						}
					} else {
						console.log('🔗 [Deep Link] URL does not start with leedpdf://', url);
					}
				}
			});
			console.log(
				'✅ [Deep Link] Plugin handler registered successfully! Unlisten function:',
				typeof unlisten
			);
		} catch (error: unknown) {
			console.error('❌ [Deep Link] Failed to register plugin handler:', error);
			if (error instanceof Error) {
				console.error('❌ [Deep Link] Error details:', {
					name: error.name,
					message: error.message,
					stack: error.stack
				});
			}
		}
	}
</script>

<SEOHead />
<UpdateManager bind:this={updateManager} disableAutoCheck={true} />
<ParityDeals />
<slot />
<ToastContainer />
<UpdateNotification />
<CookieConsentBanner />

<!-- License Modal for Windows/Linux only (excluded from macOS for App Store compliance) -->
{#if requiresLicense}
	<LicenseModal 
		bind:isOpen={showLicenseModal}
		bind:needsActivation={needsActivation}
		on:validated={handleLicenseValidated}
		on:close={handleLicenseModalClose}
	/>
{/if}
