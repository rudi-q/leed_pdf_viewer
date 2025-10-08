<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { licenseManager } from '$lib/utils/licenseManager';
  
  export let isOpen = false;
  export let needsActivation = true;
  
  const dispatch = createEventDispatcher<{
    validated: { licenseKey: string; wasActivation: boolean };
    close: void;
  }>();
  
  let licenseKey = '';
  let isProcessing = false;
  let validationError = '';
  
  function close() {
    isOpen = false;
    dispatch('close');
  }
  
  function closeModalOnSuccess() {
    isOpen = false;
    licenseKey = '';
    validationError = '';
  }
  
  function getErrorMessageWithLinks(baseError: string): string {
    return `${baseError}. Need help? Visit <a href="https://polar.sh/leedpdf" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">polar.sh/leedpdf</a> or contact us at <a href="mailto:support@leed.my" class="text-primary hover:underline">support@leed.my</a>`;
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
        result = await licenseManager.activateLicense(licenseKey.trim());
      } else {
        result = await licenseManager.validateLicense(licenseKey.trim());
      }
      
      if (result.valid) {
        dispatch('validated', { licenseKey: licenseKey.trim(), wasActivation: needsActivation });
        closeModalOnSuccess();
      } else {
        validationError = result.error || (needsActivation ? 'License activation failed' : 'Invalid license key');
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
    if (event.key === 'Enter' && !isProcessing) {
      processLicense();
    } else if (event.key === 'Escape') {
      close();
    }
  }
  
  function handlePurchase() {
    window.open('https://polar.sh/leedpdf', '_blank');
  }
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click|self={close}
    on:keydown={handleKeyPress}
    role="dialog"
    aria-modal="true"
    aria-labelledby="license-modal-title"
    tabindex="-1"
  >
    <div class="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/30 max-w-md w-full">
      <div class="border-b border-charcoal/10 px-6 py-4">
        <div class="flex items-center justify-between">
          <h2 id="license-modal-title" class="text-xl font-semibold text-charcoal">
            {needsActivation ? 'Activate License' : 'Validate License'}
          </h2>
          <button 
            on:click={close}
            class="p-2 hover:bg-charcoal/10 rounded-lg transition-colors"
            title="Close (Esc)"
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="p-6">
        <p class="text-sm text-slate mb-4">
          {needsActivation 
            ? 'Enter your license key to activate LeedPDF. Don\'t have one yet?' 
            : 'Your license needs to be validated. Please enter your license key.'}
        </p>
        
        {#if needsActivation}
          <button
            on:click={handlePurchase}
            class="w-full mb-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Purchase License
          </button>
        {/if}
        
        <div class="space-y-4">
          <div>
            <label for="license-key" class="block text-sm font-medium text-charcoal mb-2">
              License Key
            </label>
            <input
              id="license-key"
              type="text"
              bind:value={licenseKey}
              on:keypress={handleKeyPress}
              placeholder="LEEDWIN-XXXX-XXXX-XXXX-XXXX"
              class="w-full px-4 py-2 border border-charcoal/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              disabled={isProcessing}
            />
          </div>
          
          {#if validationError}
            <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {@html validationError}
            </div>
          {/if}
          
          <button
            on:click={processLicense}
            disabled={isProcessing || !licenseKey.trim()}
            class="w-full px-4 py-2 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            {isProcessing ? 'Processing...' : (needsActivation ? 'Activate' : 'Validate')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}


