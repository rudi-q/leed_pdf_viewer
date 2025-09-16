<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { PDFSharingService, type SharePDFOptions } from '$lib/services/pdfSharingService';
  import { toastStore } from '$lib/stores/toastStore';
  
  export let isOpen = false;
  export let pdfFile: File | string | null = null;
  export let originalFileName = '';
  
  const dispatch = createEventDispatcher<{
    close: void;
    shared: { shareUrl: string; shareId: string };
  }>();
  
  let isSharing = false;
  let shareResult: { shareUrl?: string; shareId?: string } | null = null;
  
  // Share options
  let isPublic = true;
  let requiresPassword = false;
  let password = '';
  let hasExpiration = true;
  let expirationDays = 30;
  let hasDownloadLimit = false;
  let maxDownloads = 10;
  
  // Copy to clipboard state
  let copied = false;
  
  function close() {
    isOpen = false;
    dispatch('close');
    resetForm();
  }
  
  function resetForm() {
    isSharing = false;
    shareResult = null;
    isPublic = true;
    requiresPassword = false;
    password = '';
    hasExpiration = true;
    expirationDays = 30;
    hasDownloadLimit = false;
    maxDownloads = 10;
    copied = false;
  }
  
  async function handleShare() {
    if (!pdfFile) {
      toastStore.error('No PDF', 'No PDF file to share');
      return;
    }
    
    if (requiresPassword && !password.trim()) {
      toastStore.error('Password Required', 'Please enter a password or disable password protection');
      return;
    }
    
    const options: SharePDFOptions = {
      isPublic,
      password: requiresPassword ? password : undefined,
      expiresInDays: hasExpiration ? expirationDays : undefined,
      maxDownloads: hasDownloadLimit ? maxDownloads : undefined
    };
    
    isSharing = true;
    
    try {
      const result = await PDFSharingService.sharePDF(pdfFile, originalFileName, options);
      
      if (result.success && result.shareUrl && result.shareId) {
        shareResult = {
          shareUrl: result.shareUrl,
          shareId: result.shareId
        };
        if (shareResult.shareUrl && shareResult.shareId) {
          dispatch('shared', { shareUrl: shareResult.shareUrl, shareId: shareResult.shareId });
        }
      }
      
    } catch (error) {
      console.error('Sharing failed:', error);
    } finally {
      isSharing = false;
    }
  }
  
  async function copyToClipboard() {
    if (!shareResult?.shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareResult.shareUrl);
      copied = true;
      toastStore.success('Copied!', 'Share link copied to clipboard');
      
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toastStore.error('Copy Failed', 'Failed to copy link to clipboard');
    }
  }
  
  function shareViaEmail() {
    if (!shareResult?.shareUrl) return;
    
    const subject = encodeURIComponent(`Shared PDF: ${originalFileName}`);
    const body = encodeURIComponent(`I've shared a PDF with you via LeedPDF:\n\n${shareResult.shareUrl}\n\nPowered by LeedPDF - https://leed.my`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }
  
  function shareViaWhatsApp() {
    if (!shareResult?.shareUrl) return;
    
    const text = encodeURIComponent(`Check out this PDF I shared: ${shareResult.shareUrl}\n\nPowered by LeedPDF`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }
  
  function shareViaTwitter() {
    if (!shareResult?.shareUrl) return;
    
    const text = encodeURIComponent(`Check out this PDF: ${shareResult.shareUrl} #PDF #LeedPDF`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  }
</script>

{#if isOpen}
  <!-- Modal backdrop -->
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click={close}
    on:keydown={(e) => e.key === 'Escape' && close()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
  >
    <!-- Modal content -->
    <div 
      class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      role="document"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 id="modal-title" class="text-xl font-bold text-charcoal dark:text-white">
          Share PDF
        </h2>
        <button 
          on:click={close}
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Close modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {#if !shareResult}
        <!-- Share options form -->
        <div class="p-6 space-y-6">
          <div>
            <h3 class="text-sm font-medium text-charcoal dark:text-white mb-2">File to Share</h3>
            <p class="text-sm text-slate dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              📄 {originalFileName}
            </p>
          </div>
          
          <!-- Privacy Settings -->
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-charcoal dark:text-white">Privacy Settings</h3>
            
            <div class="space-y-3">
              <label class="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  bind:checked={isPublic}
                  class="mt-1 h-4 w-4 text-sage border-gray-300 rounded focus:ring-sage"
                />
                <div>
                  <div class="text-sm font-medium text-charcoal dark:text-white">Public Access</div>
                  <div class="text-xs text-slate dark:text-gray-400">Anyone with the link can view this PDF</div>
                </div>
              </label>
              
              <label class="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  bind:checked={requiresPassword}
                  class="mt-1 h-4 w-4 text-sage border-gray-300 rounded focus:ring-sage"
                />
                <div>
                  <div class="text-sm font-medium text-charcoal dark:text-white">Password Protection</div>
                  <div class="text-xs text-slate dark:text-gray-400">Require a password to access the PDF</div>
                </div>
              </label>
              
              {#if requiresPassword}
                <div class="ml-7">
                  <input
                    type="password"
                    bind:value={password}
                    placeholder="Enter password"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sage focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              {/if}
            </div>
          </div>
          
          <!-- Expiration Settings -->
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-charcoal dark:text-white">Expiration</h3>
            
            <label class="flex items-start gap-3">
              <input 
                type="checkbox" 
                bind:checked={hasExpiration}
                class="mt-1 h-4 w-4 text-sage border-gray-300 rounded focus:ring-sage"
              />
              <div class="flex-1">
                <div class="text-sm font-medium text-charcoal dark:text-white">Auto-expire</div>
                <div class="text-xs text-slate dark:text-gray-400 mb-2">Automatically delete the shared PDF after a set time</div>
                
                {#if hasExpiration}
                  <div class="flex items-center gap-2">
                    <input
                      type="number"
                      bind:value={expirationDays}
                      min="1"
                      max="365"
                      class="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-sage focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <span class="text-sm text-slate dark:text-gray-400">days</span>
                  </div>
                {/if}
              </div>
            </label>
          </div>
          
          <!-- Download Limits -->
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-charcoal dark:text-white">Download Limits</h3>
            
            <label class="flex items-start gap-3">
              <input 
                type="checkbox" 
                bind:checked={hasDownloadLimit}
                class="mt-1 h-4 w-4 text-sage border-gray-300 rounded focus:ring-sage"
              />
              <div class="flex-1">
                <div class="text-sm font-medium text-charcoal dark:text-white">Limit downloads</div>
                <div class="text-xs text-slate dark:text-gray-400 mb-2">Restrict how many times the PDF can be accessed</div>
                
                {#if hasDownloadLimit}
                  <div class="flex items-center gap-2">
                    <input
                      type="number"
                      bind:value={maxDownloads}
                      min="1"
                      max="1000"
                      class="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-sage focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <span class="text-sm text-slate dark:text-gray-400">max views</span>
                  </div>
                {/if}
              </div>
            </label>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            on:click={close}
            class="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={handleShare}
            disabled={isSharing}
            class="px-6 py-2 text-sm bg-sage text-white rounded-lg hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {#if isSharing}
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sharing...
            {:else}
              Share PDF
            {/if}
          </button>
        </div>
        
      {:else}
        <!-- Share success result -->
        <div class="p-6 space-y-6">
          <div class="text-center">
            <div class="text-4xl mb-4">🎉</div>
            <h3 class="text-lg font-bold text-charcoal dark:text-white mb-2">PDF Shared Successfully!</h3>
            <p class="text-sm text-slate dark:text-gray-400">Your PDF is now available via the link below</p>
          </div>
          
          <!-- Share URL -->
          <div class="space-y-3">
            <div class="text-sm font-medium text-charcoal dark:text-white">Share Link</div>
            <div class="flex items-center gap-2">
              <input
                type="text"
                value={shareResult.shareUrl}
                readonly
                class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-charcoal dark:text-white"
              />
              <button
                on:click={copyToClipboard}
                class="px-4 py-2 text-sm bg-sage text-white rounded-lg hover:bg-sage/90 transition-colors flex items-center gap-2"
                class:bg-green-600={copied}
                class:hover:bg-green-700={copied}
              >
                {#if copied}
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                {:else}
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                {/if}
              </button>
            </div>
          </div>
          
          <!-- Quick share options -->
          <div class="space-y-3">
            <div class="text-sm font-medium text-charcoal dark:text-white">Quick Share</div>
            <div class="flex flex-wrap gap-2">
              <button
                on:click={shareViaEmail}
                class="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                📧 Email
              </button>
              <button
                on:click={shareViaWhatsApp}
                class="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                💬 WhatsApp
              </button>
              <button
                on:click={shareViaTwitter}
                class="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                🐦 Twitter
              </button>
            </div>
          </div>
          
          <!-- Share info -->
          <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">📋 Share Summary</h4>
            <ul class="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Access: {isPublic ? 'Public' : 'Private'} {requiresPassword ? '(Password Protected)' : ''}</li>
              {#if hasExpiration}
                <li>• Expires: In {expirationDays} days</li>
              {/if}
              {#if hasDownloadLimit}
                <li>• Download Limit: {maxDownloads} views</li>
              {/if}
            </ul>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            on:click={close}
            class="px-6 py-2 text-sm bg-sage text-white rounded-lg hover:bg-sage/90 transition-colors"
          >
            Done
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}