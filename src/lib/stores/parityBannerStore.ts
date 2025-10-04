import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Store to track the presence of the Parity Deals banner
 * This runs once globally instead of per-component for better performance
 */
function createParityBannerStore() {
  const { subscribe, set } = writable(false);

  if (browser) {
    // Defensive check: ensure document.body exists before proceeding
    if (!document.body) {
      console.warn('[ParityBanner] document.body not available yet');
      return { subscribe };
    }

    // Function to check if banner class is present
    const checkParityBanner = () => {
      // Guard against body becoming unavailable (edge case)
      if (!document.body) return;
      
      const hasBanner = document.body.classList.contains('pd-has-parity-banner');
      set(hasBanner);
    };

    // Initial check
    checkParityBanner();

    // Watch for class changes on body element
    const observer = new MutationObserver(checkParityBanner);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Also check periodically for the first few seconds (in case banner loads slowly)
    let checkCount = 0;
    const intervalId = setInterval(() => {
      checkParityBanner();
      checkCount++;
      if (checkCount >= 10) { // Check for 5 seconds (10 * 500ms)
        clearInterval(intervalId);
      }
    }, 500);

    // Note: We don't disconnect the observer since this is a global singleton
    // It will be cleaned up when the page unloads
  }

  return { subscribe };
}

export const hasParityBanner = createParityBannerStore();
