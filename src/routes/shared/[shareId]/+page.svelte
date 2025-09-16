<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import PDFViewer from '$lib/components/PDFViewer.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import { PDFSharingService } from '$lib/services/pdfSharingService';
  import { toastStore } from '$lib/stores/toastStore';
  import { setCurrentPDF } from '$lib/stores/drawingStore';
  
  let isLoading = true;
  let currentFile: string | null = null;
  let pdfViewer: PDFViewer;
  let requiresPassword = false;
  let password = '';
  let sharedPDFData: any = null;
  let errorMessage = '';
  
  onMount(async () => {
    if (browser && $page.params.shareId) {
      await loadSharedPDF($page.params.shareId);
    }
  });
  
  async function loadSharedPDF(shareId: string, providedPassword?: string) {
    try {
      isLoading = true;
      errorMessage = '';
      
      const result = await PDFSharingService.getSharedPDF(shareId, providedPassword);
      
      if (!result.success) {
        if (result.error === 'Invalid password') {
          requiresPassword = true;
          isLoading = false;
          return;
        }
        
        errorMessage = result.error || 'Failed to load shared PDF';
        isLoading = false;
        return;
      }
      
      // Set the PDF URL for viewing
      currentFile = result.pdfUrl || null;
      sharedPDFData = result.sharedPDF;
      
      // Set current PDF for the store (for auto-save functionality)
      if (result.sharedPDF) {
        setCurrentPDF(
          result.sharedPDF.originalFileName,
          result.sharedPDF.metadata?.fileSize || 0
        );
      }
      
      // Apply annotations if they exist
      if (result.annotations && result.annotations.length > 0) {
        // Wait a bit for the PDF to load before applying annotations
        setTimeout(async () => {
          try {
            await PDFSharingService.applyAnnotations(result.annotations!);
          } catch (error) {
            console.warn('Failed to apply annotations:', error);
          }
        }, 1000);
      }
      
      requiresPassword = false;
      isLoading = false;
      
    } catch (error) {
      console.error('Error loading shared PDF:', error);
      errorMessage = 'Failed to load shared PDF. Please try again.';
      isLoading = false;
    }
  }
  
  async function handlePasswordSubmit() {
    if (!password.trim()) {
      toastStore.error('Password Required', 'Please enter the password');
      return;
    }
    
    await loadSharedPDF($page.params.shareId!, password);
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && requiresPassword) {
      handlePasswordSubmit();
    }
  }
  
  function goHome() {
    goto('/');
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<main class="w-screen h-screen relative overflow-hidden">
  {#if isLoading}
    <div class="h-full flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-sage mx-auto mb-4"></div>
        <p class="text-lg text-charcoal dark:text-gray-300">Loading shared PDF...</p>
      </div>
    </div>
    
  {:else if requiresPassword}
    <div class="h-full flex items-center justify-center bg-gradient-to-br from-cream to-pearl">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div class="text-center mb-6">
          <div class="text-4xl mb-4">🔐</div>
          <h2 class="text-2xl font-bold text-charcoal dark:text-white mb-2">Password Required</h2>
          <p class="text-slate dark:text-gray-400">This shared PDF is password protected</p>
        </div>
        
        <div class="space-y-4">
          <div>
            <label for="password" class="block text-sm font-medium text-charcoal dark:text-gray-300 mb-2">
              Enter Password
            </label>
            <input
              id="password"
              type="password"
              bind:value={password}
              placeholder="Enter password"
              class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sage focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div class="flex gap-3">
            <button
              on:click={goHome}
              class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              on:click={handlePasswordSubmit}
              disabled={!password.trim()}
              class="flex-1 px-4 py-2 bg-sage text-white rounded-lg hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Access PDF
            </button>
          </div>
        </div>
      </div>
    </div>
    
  {:else if errorMessage}
    <div class="h-full flex items-center justify-center bg-gradient-to-br from-cream to-pearl">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4 text-center">
        <div class="text-6xl mb-4">😞</div>
        <h2 class="text-2xl font-bold text-charcoal dark:text-white mb-2">Oops!</h2>
        <p class="text-slate dark:text-gray-400 mb-6">{errorMessage}</p>
        
        <button
          on:click={goHome}
          class="px-6 py-2 bg-sage text-white rounded-lg hover:bg-sage/90 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
    
  {:else if currentFile}
    <Toolbar
      onFileUpload={() => {}}
      onPreviousPage={() => pdfViewer?.previousPage()}
      onNextPage={() => pdfViewer?.nextPage()}
      onZoomIn={() => pdfViewer?.zoomIn()}
      onZoomOut={() => pdfViewer?.zoomOut()}
      onResetZoom={() => pdfViewer?.resetZoom()}
      onFitToWidth={() => pdfViewer?.fitToWidth()}
      onFitToHeight={() => pdfViewer?.fitToHeight()}
      onExportPDF={() => {}}
      onExportLPDF={() => {}}
      showThumbnails={false}
      onToggleThumbnails={() => {}}
      isSharedView={true}
    />

    <div class="w-full h-full pt-12">
      <PDFViewer bind:this={pdfViewer} pdfFile={currentFile} />
    </div>

    <!-- Shared PDF Info -->
    {#if sharedPDFData}
      <div class="absolute top-14 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm shadow-lg border border-gray-200 dark:border-gray-600">
        <div class="flex items-center gap-2">
          <span class="text-sage">🔗</span>
          <div>
            <div class="font-medium text-charcoal dark:text-white">
              {sharedPDFData.originalFileName}
            </div>
            <div class="text-xs text-slate dark:text-gray-400">
              Shared PDF • {sharedPDFData.metadata?.pageCount || 0} pages
              {#if sharedPDFData.metadata?.hasAnnotations}
                • With annotations
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Credit -->
    <div class="absolute bottom-4 right-4 text-xs text-charcoal/60 dark:text-gray-300 flex items-center gap-2 hidden lg:flex">
      <span>Powered by LeedPDF</span>
      <a 
        href="https://leed.my" 
        class="text-sage hover:text-sage/80 transition-colors"
        target="_blank"
        rel="noopener"
      >
        Try it free
      </a>
    </div>
  {/if}
</main>

<style>
  main {
    background: linear-gradient(135deg, #FDF6E3 0%, #F7F3E9 50%, #F0EFEB 100%);
  }
  
  :global(.dark) main {
    background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%);
  }
</style>