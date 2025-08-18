<script lang="ts">
  import { updateStore } from '$lib/stores/updateStore';
  import { onDestroy } from 'svelte';

  $: updateState = $updateStore;
  $: progressPercentage = updateState.contentLength > 0 
    ? Math.round((updateState.downloaded / updateState.contentLength) * 100) 
    : 0;

  // Auto-hide completed state after 5 seconds
  let hideTimeout: number;
  $: if (updateState.completed) {
    hideTimeout = setTimeout(() => {
      updateStore.reset();
    }, 5000);
  }

  onDestroy(() => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
  });

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
</script>

<!-- Update Notification Panel -->
{#if updateState.checking || updateState.available || updateState.downloading || updateState.completed || updateState.error}
  <div class="fixed top-4 right-4 z-50 w-80 animate-fade-in">
    <div class="floating-panel p-4 shadow-lg">
      {#if updateState.checking}
        <div class="flex items-center gap-3">
          <div class="w-5 h-5 border-2 border-sage/30 border-t-sage rounded-full animate-spin"></div>
          <div class="flex-1">
            <h3 class="font-semibold text-charcoal dark:text-gray-100 text-sm">
              Checking for updates...
            </h3>
            <p class="text-xs text-slate dark:text-gray-400">
              Looking for the latest version
            </p>
          </div>
        </div>
      {/if}

      {#if updateState.available && !updateState.downloading && !updateState.completed}
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M13 5v6h1.17L12 13.17 9.83 11H11V5h2m2-2H9v6H5l7 7 7-7h-4V3zm4 15H5v2h14v-2z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-charcoal dark:text-gray-100 text-sm mb-1">
              Update Available!
            </h3>
            {#if updateState.version}
              <p class="text-xs text-slate dark:text-gray-400 mb-1">
                Version {updateState.version}
              </p>
            {/if}
            {#if updateState.body}
              <p class="text-xs text-slate dark:text-gray-400 mb-2 line-clamp-2">
                {updateState.body}
              </p>
            {/if}
            <div class="text-xs text-sage font-medium">
              Download starting automatically...
            </div>
          </div>
        </div>
      {/if}

      {#if updateState.downloading}
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M13 5v6h1.17L12 13.17 9.83 11H11V5h2m2-2H9v6H5l7 7 7-7h-4V3zm4 15H5v2h14v-2z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-charcoal dark:text-gray-100 text-sm mb-1">
              Downloading Update...
            </h3>
            <div class="mb-2">
              <div class="flex justify-between text-xs text-slate dark:text-gray-400 mb-1">
                <span>{progressPercentage}%</span>
                <span>
                  {formatBytes(updateState.downloaded)} / {formatBytes(updateState.contentLength)}
                </span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  class="bg-gradient-to-r from-sage to-mint h-2 rounded-full transition-all duration-300 ease-out"
                  style="width: {progressPercentage}%"
                ></div>
              </div>
            </div>
            <p class="text-xs text-slate dark:text-gray-400">
              The app will restart automatically when complete
            </p>
          </div>
        </div>
      {/if}

      {#if updateState.completed}
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-charcoal dark:text-gray-100 text-sm mb-1">
              Update Complete!
            </h3>
            <p class="text-xs text-slate dark:text-gray-400">
              Restarting application...
            </p>
          </div>
        </div>
      {/if}

      {#if updateState.error}
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-charcoal dark:text-gray-100 text-sm mb-1">
              Update Failed
            </h3>
            <p class="text-xs text-red-600 dark:text-red-400 mb-2">
              {updateState.error}
            </p>
            <button 
              class="text-xs text-sage hover:text-sage/80 font-medium"
              on:click={() => updateStore.reset()}
            >
              Dismiss
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-clamp: 2; /* Standard property for compatibility */
  }
  
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>
