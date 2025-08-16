<script>
	import '../app.css';
	import SEOHead from '$lib/components/SEOHead.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { fileStorage } from '$lib/utils/fileStorageUtils';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// Initialize file storage auto-cleanup when app loads
	if (browser) {
		onMount(() => {
			// Start auto-cleanup of old files every 30 minutes
			const stopCleanup = fileStorage.startAutoCleanup();
			
			// Cleanup on page unload
			return stopCleanup;
		});
	}
</script>

<SEOHead />
<slot />
<ToastContainer />
