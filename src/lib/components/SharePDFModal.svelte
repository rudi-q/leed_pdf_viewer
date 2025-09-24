<script lang="ts">
import { createEventDispatcher } from 'svelte';
import { PDFSharingService, type SharePDFOptions } from '$lib/services/pdfSharingService';
import { toastStore } from '$lib/stores/toastStore';
import { trackPdfShare } from '$lib/utils/analytics';
	import { Check, Copy, FileText, Mail, MessageCircle, PartyPopper, Twitter } from 'lucide-svelte';
	import Toggle from './Toggle.svelte';

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
  let viewOnly = false;
  let allowDownloading = true;
  
  // Copy to clipboard state
  let copied = false;
  
  // Editable filename
  let editableFileName = '';
  
  // Initialize editable filename when originalFileName changes
  $: if (originalFileName && !editableFileName) {
    // Remove .pdf extension for editing, we'll add .lpdf back programmatically
    editableFileName = originalFileName.replace(/\.pdf$/i, '');
  }
  
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
    viewOnly = false;
    allowDownloading = true;
    copied = false;
    editableFileName = originalFileName.replace(/\.pdf$/i, ''); // Reset to original filename without .pdf
  }
  
  function validateFileName(filename: string): boolean {
    // Remove invalid filename characters and check length
    const invalidChars = /[<>:"/\\|?*]/g;
    return filename.length > 0 && filename.length <= 255 && !invalidChars.test(filename);
  }
  
  function sanitizeFileName(filename: string): string {
    // Remove invalid characters and trim whitespace
    return filename.replace(/[<>:"/\\|?*]/g, '').trim();
  }
  
  async function handleShare() {
    if (!pdfFile) {
      toastStore.error('No PDF', 'No PDF file to share');
      return;
    }
    
    // Check if we're dealing with an external URL (string) that might have CORS issues
    const isExternalUrl = typeof pdfFile === 'string';
    if (isExternalUrl) {
      console.log('Sharing external PDF URL:', pdfFile);
    }
    
    // Validate filename
    const trimmedFileName = editableFileName.trim();
    if (!trimmedFileName) {
      toastStore.error('Filename Required', 'Please enter a filename for the PDF');
      return;
    }
    
    if (!validateFileName(trimmedFileName)) {
      toastStore.error('Invalid Filename', 'Filename contains invalid characters or is too long (max 255 characters)');
      return;
    }
    
    // Always add .pdf extension for the original filename (we share as LPDF but maintain PDF name)
    const finalFileName = `${trimmedFileName}.pdf`;
    
    if (requiresPassword && !password.trim()) {
      toastStore.error('Password Required', 'Please enter a password or disable password protection');
      return;
    }
    
    const options: SharePDFOptions = {
      isPublic,
      password: requiresPassword ? password : undefined,
      expiresInDays: hasExpiration ? expirationDays : undefined,
      maxDownloads: hasDownloadLimit ? maxDownloads : undefined,
      viewOnly,
      allowDownloading
    };
    
    isSharing = true;
    
    try {
      const result = await PDFSharingService.sharePDF(pdfFile, finalFileName, options);
      
      if (result.success && result.shareUrl && result.shareId) {
        shareResult = {
          shareUrl: result.shareUrl,
          shareId: result.shareId
        };
        
        // Track successful PDF sharing
        trackPdfShare('link');
        
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
    
    // Track email sharing
    trackPdfShare('email');
    
    const subject = encodeURIComponent(`Shared PDF: ${editableFileName}.lpdf`);
    const body = encodeURIComponent(`I've shared a PDF with you via LeedPDF:\n\n${shareResult.shareUrl}\n\nPowered by LeedPDF - https://leed.my`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }
  
  function shareViaWhatsApp() {
    if (!shareResult?.shareUrl) return;
    
    // Track WhatsApp sharing
    trackPdfShare('whatsapp');
    
    const text = encodeURIComponent(`I'm sharing the ${editableFileName} doc with you so you can take a look.\n\nHere: ${shareResult.shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }
  
  function shareViaTwitter() {
    if (!shareResult?.shareUrl) return;
    
    // Track Twitter sharing
    trackPdfShare('twitter');
    
    const text = encodeURIComponent(`Check out this PDF: ${shareResult.shareUrl} #PDF #LeedPDF`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  }
</script>

{#if isOpen}
  <!-- Modal backdrop -->
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click={(e) => {
      // Only close if clicked on backdrop, not modal content
      if (e.target === e.currentTarget) {
        close();
      }
    }}
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
            <div class="space-y-2">
              <div class="flex items-center gap-3 text-sm">
                <FileText size={18} class="text-sage flex-shrink-0" />
                <div class="flex-1">
                  <label for="filename-input" class="block text-xs text-slate dark:text-gray-400 mb-1">Filename:</label>
                  <div class="relative">
                    <input
                      id="filename-input"
                      type="text"
                      bind:value={editableFileName}
                      placeholder="Enter filename"
                      class="w-full px-3 py-2 pr-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sage focus:border-transparent dark:bg-gray-700 dark:text-white"
                      class:border-red-500={!validateFileName(editableFileName)}
                      class:dark:border-red-500={!validateFileName(editableFileName)}
                    />
                    <span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate dark:text-gray-400 pointer-events-none">
                      .lpdf
                    </span>
                  </div>
                </div>
              </div>
              {#if editableFileName && !validateFileName(editableFileName)}
                <p class="text-xs text-red-600 dark:text-red-400">
                  Invalid filename: contains invalid characters or is too long (max 255 characters)
                </p>
              {/if}
            </div>
          </div>
          
          <!-- Server Upload Notice -->
          <div class="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-xs text-gray-600 dark:text-gray-300">
                <strong>Note:</strong> LeedPDF normally processes files locally. Sharing requires temporarily uploading your PDF to our secure servers to generate shareable links.
              </p>
            </div>
          </div>
          
          {#if typeof pdfFile === 'string'}
          <!-- External URL Warning -->
          <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div class="text-xs text-amber-700 dark:text-amber-300">
                <strong>External PDF Detected:</strong> This PDF is loaded from an external URL. Some servers may block direct sharing due to CORS restrictions. If sharing fails, try downloading the PDF first and then uploading it to LeedPDF for sharing.
              </div>
            </div>
          </div>
          {/if}
          
          <!-- Privacy Settings -->
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-charcoal dark:text-white">Privacy Settings</h3>
            
            <div class="space-y-3">
              <label class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-charcoal dark:text-white">Public Access</div>
                  <div class="text-xs text-slate dark:text-gray-400">Anyone with the link can view this PDF</div>
                </div>
                <Toggle bind:checked={isPublic} size="sm" ariaLabel="Toggle public access" />
              </label>
              
              <label class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-charcoal dark:text-white">Password Protection</div>
                  <div class="text-xs text-slate dark:text-gray-400">Require a password to access the PDF</div>
                </div>
                <Toggle bind:checked={requiresPassword} size="sm" ariaLabel="Toggle password protection" />
              </label>
              
              {#if requiresPassword}
                <div class="ml-7">
                  <input
                    type="text"
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
            
            <div class="space-y-3">
              <label class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-charcoal dark:text-white">Auto-expire</div>
                  <div class="text-xs text-slate dark:text-gray-400">Automatically delete the shared PDF after a set time</div>
                </div>
                <Toggle bind:checked={hasExpiration} size="sm" ariaLabel="Toggle auto-expire" />
              </label>
              
              {#if hasExpiration}
                <div class="ml-6">
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
                </div>
              {/if}
            </div>
          </div>
          
          <!-- Download Limits -->
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-charcoal dark:text-white">Download Limits</h3>
            
            <div class="space-y-3">
              <label class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-charcoal dark:text-white">Limit downloads</div>
                  <div class="text-xs text-slate dark:text-gray-400">Restrict how many times the PDF can be accessed</div>
                </div>
                <Toggle bind:checked={hasDownloadLimit} size="sm" ariaLabel="Toggle download limits" />
              </label>
              
              {#if hasDownloadLimit}
                <div class="ml-6">
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
                </div>
              {/if}
            </div>
          </div>
          
          <!-- View Permissions -->
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-charcoal dark:text-white">View Permissions</h3>
            
            <label class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-charcoal dark:text-white">View Only Mode</div>
                <div class="text-xs text-slate dark:text-gray-400">Recipients can only view the PDF, no editing or annotations allowed</div>
              </div>
              <Toggle bind:checked={viewOnly} size="sm" ariaLabel="Toggle view-only mode" />
            </label>
          </div>
          
          <!-- Download Permissions -->
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-charcoal dark:text-white">Download Permissions</h3>
            
            <label class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-charcoal dark:text-white">Allow Downloading</div>
                <div class="text-xs text-slate dark:text-gray-400">Recipients can download the PDF file</div>
              </div>
              <Toggle bind:checked={allowDownloading} size="sm" ariaLabel="Toggle allow downloading" />
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
            class="primary-button px-6 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
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
            <div class="mb-4 flex justify-center">
              <PartyPopper size={48} class="text-sage" />
            </div>
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
                class="px-4 py-2 text-sm bg-sage text-charcoal rounded-lg hover:bg-sage/90 transition-colors flex items-center gap-2"
                class:bg-green-600={copied}
                class:hover:bg-green-700={copied}
                class:text-white={copied}
              >
                {#if copied}
                  <Check size={16} />
                  Copied!
                {:else}
                  <Copy size={16} />
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
                class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <Mail size={16} />
                Email
              </button>
              <button
                on:click={shareViaWhatsApp}
                class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <MessageCircle size={16} />
                WhatsApp
              </button>
              <button
                on:click={shareViaTwitter}
                class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <Twitter size={16} />
                Twitter
              </button>
            </div>
          </div>
          
          <!-- Share info -->
          <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <FileText size={16} class="text-blue-900 dark:text-blue-100" />
              <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100">Share Summary</h4>
            </div>
            <ul class="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Access: {isPublic ? 'Public' : 'Private'} {requiresPassword ? '(Password Protected)' : ''}</li>
              <li>• View Mode: {viewOnly ? 'View Only' : 'Full Access'}</li>
              <li>• Download: {allowDownloading ? 'Allowed' : 'Disabled'}</li>
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
            class="primary-button px-6 py-2 text-sm rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}