<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { dev } from '$app/environment';
  import { updateStore } from '$lib/stores/updateStore';
  import { isTauri } from '$lib/utils/tauriUtils';
  
  // Props
  export let disableAutoCheck = false;
  
  // Disable updater in development mode
  const enableUpdater = !dev && isTauri;

  let checkPromise: Promise<void> | null = null;
  
  async function checkForUpdates() {
    if (!enableUpdater) {
      console.log('Updater disabled (development mode or not in Tauri environment)');
      return;
    }

    try {
      updateStore.setChecking(true);
      
      // Dynamic imports for Tauri plugins (only available in Tauri environment)
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');

      console.log('Checking for updates...');
      const update = await check();
      
      if (update) {
        console.log(`Found update ${update.version} from ${update.date} with notes ${update.body}`);
        
        updateStore.setAvailable(true, update.version, update.date, update.body);
        updateStore.setChecking(false);
        
        // Auto-start download and installation
        await downloadAndInstallUpdate(update, relaunch);
      } else {
        console.log('No updates available');
        updateStore.setChecking(false);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      updateStore.setDownloading(false);
      
      // Check if this is a network connectivity issue
      const errorString = error?.toString() || '';
      const isNetworkError = errorString.includes('error sending request') || 
                           errorString.includes('network') || 
                           errorString.includes('timeout') ||
                           errorString.includes('connection') ||
                           errorString.includes('dns') ||
                           errorString.includes('offline');
      
      if (isNetworkError) {
        console.log('Update check skipped - no internet connection');
        updateStore.setChecking(false);
        // Don't show error notification for network issues - just log and continue
      } else {
        // Only show error for non-network related issues
        updateStore.setError(`Failed to check for updates: ${error}`);
      }
    }
  }

  async function downloadAndInstallUpdate(update: any, relaunch: any) {
    try {
      updateStore.setDownloading(true);
      
      let downloaded = 0;
      let contentLength = 0;
      
      // Download and install the update with progress tracking
      await update.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength;
            updateStore.setProgress(0, contentLength);
            console.log(`Started downloading ${event.data.contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            updateStore.setProgress(downloaded, contentLength);
            console.log(`Downloaded ${downloaded} from ${contentLength}`);
            break;
          case 'Finished':
            updateStore.setDownloading(false);
            updateStore.setCompleted(true);
            console.log('Download finished');
            break;
        }
      });

      console.log('Update installed');
      
      // Give user a moment to see completion before restarting
      setTimeout(async () => {
        await relaunch();
      }, 2000);
      
    } catch (error) {
      console.error('Error downloading/installing update:', error);
      updateStore.setDownloading(false);
      updateStore.setError(`Failed to install update: ${error}`);
    }
  }

  onMount(() => {
    if (browser && enableUpdater && !disableAutoCheck) {
      // Check for updates on app start using the manual function to maintain single source of truth
      console.log('Auto-checking for updates on app start');
      manualCheckForUpdates();
    } else if (disableAutoCheck) {
      console.log('Auto-check disabled - updates will only be checked after license validation');
    }
    
    return () => {
      // Cleanup if needed
    };
  });

  // Expose manual check function for external use
  export function manualCheckForUpdates() {
    if (!checkPromise) {
      // Create new promise and attach finalizer to clear it when settled
      checkPromise = checkForUpdates().finally(() => {
        checkPromise = null;
      });
    }
    return checkPromise;
  }
</script>

<!-- This component has no UI - it only handles the update logic -->
<!-- The UI is handled by the UpdateNotification component -->
