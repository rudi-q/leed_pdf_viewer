<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  export let isOpen: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let licenseKey: string = '';
  let isValidating: boolean = false;
  let validationError: string = '';
  
  async function closeModal() {
    // For Tauri desktop app, exit the application when license modal is closed without validation
    const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    
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
  
  async function validateLicense() {
    if (!licenseKey.trim()) {
      validationError = 'Please enter a license key';
      return;
    }
    
    isValidating = true;
    validationError = '';
    
    try {
      const isValid = await invoke('validate_license', { 
        licenseKey: licenseKey.trim() 
      });
      
      if (isValid) {
        dispatch('validated', { licenseKey: licenseKey.trim() });
        closeModalOnSuccess();
      } else {
        validationError = 'Invalid license key';
      }
    } catch (error) {
      console.error('License validation error:', error);
      validationError = typeof error === 'string' ? error : 'Failed to validate license key';
    } finally {
      isValidating = false;
    }
  }
  
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      validateLicense();
    } else if (event.key === 'Escape') {
      closeModal();
    }
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
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
          License Key Required
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
        You need a valid license key to continue using LeedPDF. Please enter your license key below.
      </p>
      
      <div class="mb-4">
        <label for="license-key-input" class="block text-sm font-medium text-gray-700 mb-2">
          License Key
        </label>
        <input
          id="license-key-input"
          type="text"
          bind:value={licenseKey}
          placeholder="Enter your license key"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent"
          disabled={isValidating}
          on:keydown={handleKeyPress}
          autofocus
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
          disabled={isValidating}
        >
          Cancel
        </button>
        <button
          on:click={validateLicense}
          class="px-4 py-2 text-white bg-sage rounded-md hover:bg-sage/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isValidating || !licenseKey.trim()}
        >
          {#if isValidating}
            <div class="flex items-center">
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Validating...
            </div>
          {:else}
            Validate License
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
