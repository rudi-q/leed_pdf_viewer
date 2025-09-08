<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { toastStore } from '../stores/toastStore';

  // Event dispatcher for parent components
  const dispatch = createEventDispatcher<{
    fileSelected: { url: string; fileName: string; fileSize: number };
    cancel: void;
    error: { message: string };
  }>();

  // Props
  export let multiselect = false;
  export let linkType: 'preview' | 'direct' = 'direct'; // Use direct links for better CORS support
  export let extensions = ['.pdf']; // Only allow PDFs by default
  export let sizeLimit: number | undefined = undefined; // Optional size limit in bytes

  // State
  let isDropboxSupported = false;
  let isLoading = false;

  // Check if Dropbox API is available and browser is supported
  onMount(() => {
    if (browser && typeof window !== 'undefined') {
      // Wait for Dropbox API to load
      const checkDropbox = () => {
        if (window.Dropbox && window.Dropbox.isBrowserSupported) {
          isDropboxSupported = window.Dropbox.isBrowserSupported();
          if (!isDropboxSupported) {
            console.warn('Dropbox Chooser is not supported in this browser');
          }
        } else {
          // Retry after a short delay if Dropbox API hasn't loaded yet
          setTimeout(checkDropbox, 100);
        }
      };
      checkDropbox();
    }
  });

  // Main function to trigger Dropbox Chooser
  export function openDropboxChooser() {
    if (!browser || !window.Dropbox) {
      const errorMsg = 'Dropbox API is not available';
      console.error(errorMsg);
      dispatch('error', { message: errorMsg });
      toastStore.error('Dropbox Error', 'Dropbox integration is not available. Please try uploading from your device instead.');
      return;
    }

    if (!isDropboxSupported) {
      const errorMsg = 'Your browser does not support Dropbox Chooser';
      console.error(errorMsg);
      dispatch('error', { message: errorMsg });
      toastStore.error('Browser Not Supported', 'Your browser doesn\'t support Dropbox Chooser. Please try uploading from your device instead.');
      return;
    }

    isLoading = true;
    
    const options = {
      // Required success callback
      success: function(files: any[]) {
        console.log('Dropbox files selected:', files);
        isLoading = false;

        if (files && files.length > 0) {
          const file = files[0]; // Take first file (since multiselect is false for PDFs)
          
          // Validate that it's a PDF
          if (!file.name.toLowerCase().endsWith('.pdf')) {
            const errorMsg = 'Please select a PDF file';
            console.error(errorMsg);
            dispatch('error', { message: errorMsg });
            toastStore.error('Invalid File Type', 'Please select a PDF file from your Dropbox.');
            return;
          }

          console.log('Selected PDF from Dropbox:', {
            name: file.name,
            size: file.bytes,
            link: file.link
          });

          // Dispatch the file selection event with the direct link
          dispatch('fileSelected', {
            url: file.link,
            fileName: file.name,
            fileSize: file.bytes
          });

          toastStore.success('File Selected', `Loading "${file.name}" from Dropbox...`);
        }
      },

      // Optional cancel callback
      cancel: function() {
        console.log('Dropbox Chooser cancelled by user');
        isLoading = false;
        dispatch('cancel');
      },

      // Configuration options
      linkType: linkType,
      multiselect: multiselect,
      extensions: extensions,
      folderselect: false, // We only want files, not folders
      sizeLimit: sizeLimit
    };

    try {
      // Trigger the Dropbox Chooser
      window.Dropbox.choose(options);
    } catch (error) {
      console.error('Error opening Dropbox Chooser:', error);
      isLoading = false;
      const errorMsg = error instanceof Error ? error.message : 'Failed to open Dropbox Chooser';
      dispatch('error', { message: errorMsg });
      toastStore.error('Dropbox Error', 'Failed to open Dropbox file picker. Please try again.');
    }
  }

</script>

<!-- 
  This component doesn't render any UI - it's a utility component
  that provides the openDropboxChooser() function to parent components
-->

{#if isLoading}
  <!-- Optional: You can add a loading indicator here if needed -->
  <div class="dropbox-chooser-loading" style="display: none;">
    <p>Opening Dropbox Chooser...</p>
  </div>
{/if}

<style>
  .dropbox-chooser-loading {
    /* Styles for loading indicator if needed */
  }
</style>
