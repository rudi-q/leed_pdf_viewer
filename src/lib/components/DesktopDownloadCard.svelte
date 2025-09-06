<script lang="ts">
  import { browser } from '$app/environment';
  import { isTauri, detectOS } from '$lib/utils/tauriUtils';
  
  export let focusMode = false;
  export let showDownloadCard = true;
  
  // Function to handle card dismissal
  function handleDismiss() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('leedpdf-download-card-dismissed', 'true');
    }
    showDownloadCard = false;
  }
</script>

{#if !focusMode && browser && !isTauri && showDownloadCard && detectOS() === 'Windows'}
<!-- Optimized Desktop App Download Card -->
<div class="absolute bottom-16 right-4 w-72 animate-fade-in download-card">
  <div class="floating-panel p-4 group hover:scale-[1.01] transition-all duration-300 hover:shadow-xl">
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 mt-0.5">
        <div class="w-9 h-9 bg-gradient-to-br from-sage to-mint rounded-xl flex items-center justify-center shadow-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white" class="drop-shadow-sm">
            <path d="M13 5v6h1.17L12 13.17 9.83 11H11V5h2m2-2H9v6H5l7 7 7-7h-4V3zm4 15H5v2h14v-2z"/>
          </svg>
        </div>
      </div>
      <div class="flex-1 min-w-0 pr-2">
        <h3 class="font-semibold text-charcoal dark:text-gray-100 text-sm mb-1.5 group-hover:text-sage transition-colors leading-tight">
          Download LeedPDF Desktop
        </h3>
        <p class="text-xs text-slate dark:text-gray-400 mb-3 leading-relaxed">
          Better performance and offline access
        </p>
        <a 
          href="/download-for-windows"
          target="_blank" 
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-xs font-medium text-sage hover:text-sage/80 transition-colors group/link"
        >
          <span>Download Now</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" class="group-hover/link:translate-x-0.5 transition-transform">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </a>
      </div>
      <button 
        class="flex-shrink-0 text-slate/40 hover:text-slate/70 transition-colors p-1.5 -mt-1 -mr-1 rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50"
        on:click={handleDismiss}
        title="Dismiss"
        aria-label="Dismiss download card"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    <!-- Subtle decorative gradient border -->
    <div class="absolute inset-0 rounded-2xl bg-gradient-to-r from-sage/8 via-mint/8 to-lavender/8 -z-10 blur-sm group-hover:blur-md transition-all duration-300"></div>
  </div>
</div>
{/if}
