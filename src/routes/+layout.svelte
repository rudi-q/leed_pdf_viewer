<script lang="ts">
	import '../app.css';
	import SEOHead from '$lib/components/SEOHead.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import UpdateManager from '$lib/components/UpdateManager.svelte';
	import UpdateNotification from '$lib/components/UpdateNotification.svelte';
	import LicenseModal from '$lib/components/LicenseModal.svelte';
	import { fileStorage } from '$lib/utils/fileStorageUtils';
	import { licenseManager } from '$lib/utils/licenseManager';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { isTauri } from '$lib/utils/tauriUtils';

	// License validation state
	let showLicenseModal = false;
	let licenseCheckCompleted = false;
	let hasValidLicense = false;
	let needsActivation = true; // true = first time activation, false = validation

	// Reference to UpdateManager component
	let updateManager: UpdateManager;

	// Initialize file storage auto-cleanup when app loads
	if (browser) {
		onMount(() => {
			// Start auto-cleanup of old files every AUTO_CLEANUP_INTERVAL milliseconds
			const stopCleanup = fileStorage.startAutoCleanup();
			
			// License validation for Tauri desktop app only
			if (isTauri) {
				// Check license immediately after app loads (removed delay)
				performLicenseCheck();
			} else {
				// Web version doesn't need license validation
				licenseCheckCompleted = true;
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
	function handleLicenseValidated(event: CustomEvent<{ licenseKey: string; wasActivation: boolean }>) {
		const { licenseKey, wasActivation } = event.detail;
		// Log success without exposing the raw license key
		const maskedKey = licenseKey.length > 4 ? 
			'*'.repeat(licenseKey.length - 4) + licenseKey.slice(-4) : 
			'*'.repeat(licenseKey.length);
		console.log(`License ${wasActivation ? 'activation' : 'validation'} successful - Key: ${maskedKey}`);
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
</script>

<SEOHead />
<UpdateManager bind:this={updateManager} disableAutoCheck={true} />
<slot />
<ToastContainer />
<UpdateNotification />

<!-- License Modal for Tauri Desktop App -->
<LicenseModal 
	bind:isOpen={showLicenseModal}
	bind:needsActivation={needsActivation}
	on:validated={handleLicenseValidated}
	on:close={handleLicenseModalClose}
/>
