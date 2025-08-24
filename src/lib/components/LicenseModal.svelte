<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { licenseManager } from '$lib/utils/licenseManager';
  import { invoke } from '@tauri-apps/api/core';
  import { isTauri } from '$lib/utils/tauriUtils';

  export let isOpen: boolean = false;
  export let needsActivation: boolean = true; // true = activation, false = validation
  
  const dispatch = createEventDispatcher();
  
  let licenseKey: string = '';
  let isProcessing: boolean = false;
  let validationError: string = '';
  let licenseInput: HTMLInputElement;
  
  async function closeModal() {
    // For Tauri desktop app, exit the application when license modal is closed without validation
    
    if (isTauri) {
      try {
        await invoke('exit_app');
      } catch (error) {
        console.error('Failed to exit app:', error);
      }
    }
    
    // This won't be reached in Tauri, but kept for web compatibility
    isOpen = false;
    licenseKey = '';
    validationError = '';
    dispatch('close');
  }
  
  function closeModalOnSuccess() {
    // This is called when license is successfully validated
    isOpen = false;
    licenseKey = '';
    validationError = '';
    dispatch('close');
  }
  
  async function processLicense() {
    if (!licenseKey.trim()) {
      validationError = 'Please enter a license key';
      return;
    }
    
    isProcessing = true;
    validationError = '';
    
    try {
      let result;
      
      if (needsActivation) {
        // First time - activate license
        result = await licenseManager.activateLicense(licenseKey.trim());
      } else {
        // Subsequent times - validate existing license
        result = await licenseManager.validateLicense(licenseKey.trim());
      }
      
      if (result.valid) {
        dispatch('validated', { licenseKey: licenseKey.trim(), wasActivation: needsActivation });
        closeModalOnSuccess();
      } else {
        // Use the error message from the backend directly, with fallback
        validationError = result.error || (needsActivation ? 'License activation failed' : 'Invalid license key');
        // Only add links for generic errors, not platform-specific ones
        const isPlatformSpecificError = validationError.includes('not valid for Windows') || 
                                       validationError.includes('not valid for macOS') ||
                                       validationError.includes('starts with \'LEEDWIN\'') ||
                                       validationError.includes('starts with \'LEEDMAC\'');
        
        if (!isPlatformSpecificError && !validationError.includes('polar.sh') && !validationError.includes('leed.my')) {
          validationError = getErrorMessageWithLinks(validationError);
        }
      }
    } catch (error) {
      console.error('License processing error:', error);
      const baseError = typeof error === 'string' ? error : (needsActivation ? 'Failed to activate license key' : 'Failed to validate license key');
      validationError = getErrorMessageWithLinks(baseError);
    } finally {
      isProcessing = false;
    }
  }
  
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      processLicense();
    } else if (event.key === 'Escape') {
      closeModal();
    }
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
  
  async function openPolarPortal() {
    const polarUrl = 'https://polar.sh/doublone-studios/portal/';
    
    if (isTauri) {
      try {
        // Use Tauri's custom command to open external URL
        await invoke('open_external_url', { url: polarUrl });
      } catch (error) {
        console.error('Failed to open Polar portal with Tauri command:', error);
        
        // Fallback: try shell plugin
        try {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(polarUrl);
        } catch (shellError) {
          console.error('Failed to open Polar portal with shell plugin:', shellError);
        }
      }
    } else {
      // In web environment, open in new tab
      window.open(polarUrl, '_blank', 'noopener,noreferrer');
    }
  }
  
  function getPurchaseUrl(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac') || userAgent.includes('darwin')) {
      return 'https://leed.my/download-for-mac';
    } else {
      return 'https://leed.my/download-for-windows';
    }
  }
  
  async function openPurchaseLink() {
    const purchaseUrl = getPurchaseUrl();
    
    if (isTauri) {
      try {
        // Use Tauri's custom command to open external URL
        await invoke('open_external_url', { url: purchaseUrl });
      } catch (error) {
        console.error('Failed to open purchase link with Tauri command:', error);
        
        // Fallback: try shell plugin
        try {
          const { open } = await import('@tauri-apps/plugin-shell');
          await open(purchaseUrl);
        } catch (shellError) {
          console.error('Failed to open purchase link with shell plugin:', shellError);
        }
      }
    } else {
      // In web environment, open in new tab
      window.open(purchaseUrl, '_blank', 'noopener,noreferrer');
    }
  }
  
  function getErrorMessageWithLinks(baseError: string): string {
    const purchaseUrl = getPurchaseUrl();
    return `${baseError}. You can find your license key on your Polar portal: https://polar.sh/doublone-studios/portal/ or purchase one from ${purchaseUrl}`;
  }

  // Focus input when modal opens
  onMount(() => {
    if (isOpen && licenseInput) {
      licenseInput.focus();
    }
  });

  // Watch for modal open state changes
  $: if (isOpen && licenseInput) {
    setTimeout(() => licenseInput.focus(), 100);
  }
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    on:click={handleBackdropClick}
    on:keydown={handleKeyPress}
    role="dialog"
    aria-modal="true"
    aria-labelledby="license-modal-title"
    tabindex="-1"
  >
    <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
      <div class="flex items-center justify-between mb-4">
        <h2 id="license-modal-title" class="text-xl font-semibold text-gray-900">
          {needsActivation ? 'Activate License Key' : 'License Key Required'}
        </h2>
        <button 
          on:click={closeModal}
          class="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <p class="text-gray-600 mb-4">
        {#if needsActivation}
          Welcome to LeedPDF! Please enter your license key to activate this device.
        {:else}
          You need a valid license key to continue using LeedPDF. Please enter your license key below.
        {/if}
      </p>
      
      <p class="text-sm text-gray-500 mb-4">
        Don't know your license key? You can find it on 
        <button 
          type="button"
          on:click={openPolarPortal}
          class="text-sage hover:text-sage/80 underline transition-colors cursor-pointer bg-transparent border-none p-0 font-inherit"
        >
          your Polar portal
        </button>. If you don't have a license key, you can purchase one from 
        <button 
          type="button"
          on:click={() => openPurchaseLink()}
          class="text-sage hover:text-sage/80 underline transition-colors cursor-pointer bg-transparent border-none p-0 font-inherit"
        >
          here
        </button>.
      </p>
      
      <div class="mb-4">
        <label for="license-key-input" class="block text-sm font-medium text-gray-700 mb-2">
          License Key
        </label>
        <input
          id="license-key-input"
          type="text"
          bind:value={licenseKey}
          bind:this={licenseInput}
          placeholder="Enter your license key"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent"
          disabled={isProcessing}
          on:keydown={handleKeyPress}
        />
      </div>
      
      {#if validationError}
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {validationError}
        </div>
      {/if}
      
      <div class="flex justify-end space-x-3">
        <button
          on:click={closeModal}
          class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          on:click={processLicense}
          class="px-4 py-2 text-white bg-sage rounded-md hover:bg-sage/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isProcessing || !licenseKey.trim()}
        >
          {#if isProcessing}
            <div class="flex items-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {needsActivation ? 'Activating...' : 'Validating...'}
            </div>
          {:else}
            {needsActivation ? 'Activate License' : 'Validate License'}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Ensure modal is above other elements */
  :global(.fixed) {
    z-index: 9999;
  }
</style>
