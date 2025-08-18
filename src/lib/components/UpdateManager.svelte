<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { dev } from '$app/environment';
  import { updateStore } from '$lib/stores/updateStore';
  
  // Check if we're in Tauri environment
  const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
  
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
      updateStore.setError(`Failed to check for updates: ${error}`);
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
      updateStore.setError(`Failed to install update: ${error}`);
    }
  }

  onMount(() => {
    if (browser && enableUpdater) {
      // Check for updates on app start
      checkPromise = checkForUpdates();
    }
    
    return () => {
      // Cleanup if needed
    };
  });

  // Expose manual check function for external use
  export function manualCheckForUpdates() {
    if (!checkPromise) {
      checkPromise = checkForUpdates();
    }
    return checkPromise;
  }
</script>

<!-- This component has no UI - it only handles the update logic -->
<!-- The UI is handled by the UpdateNotification component -->
