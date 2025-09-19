<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import PDFViewer from '$lib/components/PDFViewer.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
  import PageThumbnails from '$lib/components/PageThumbnails.svelte';
  import { PDFSharingService, ShareAccessError } from '$lib/services/pdfSharingService';
  import { toastStore } from '$lib/stores/toastStore';
  import { setCurrentPDF, setTool, undo, redo } from '$lib/stores/drawingStore';
  import { getFormattedVersion } from '$lib/utils/version';
  import { Lock, Frown, Link } from 'lucide-svelte';
  
  let isLoading = true;
  let currentFile: File | string | null = null;
  let pdfViewer: PDFViewer;
  let requiresPassword = false;
  let password = '';
  let sharedPDFData: any = null;
  let errorMessage = '';
  let showShortcuts = false;
  let showThumbnails = false;
  let focusMode = false;
  
  onMount(async () => {
    if (browser && $page.params.shareId) {
      await loadSharedPDF($page.params.shareId);
    }
  });
  
  async function loadSharedPDF(shareId: string, providedPassword?: string) {
    isLoading = true;
    errorMessage = '';
    requiresPassword = false; // Reset password requirement
    
    let result;
    
    try {
      result = await PDFSharingService.getSharedPDF(shareId, providedPassword);
    } catch (error) {
      console.error('Error calling PDFSharingService.getSharedPDF:', error);
      errorMessage = 'Failed to load shared PDF. Please try again.';
      isLoading = false;
      return;
    }
    
    if (!result.success) {
      // Check if password is required or invalid
      if (result.errorType === ShareAccessError.PASSWORD_REQUIRED || 
          result.errorType === ShareAccessError.INVALID_PASSWORD ||
          (result.error && (result.error.includes('password protected') || result.error.includes('Invalid password')))) {
        
        requiresPassword = true;
        isLoading = false;
        errorMessage = ''; // Ensure error message is cleared
        
        // Show a toast for invalid password attempts
        if (result.errorType === ShareAccessError.INVALID_PASSWORD || 
            (result.error && result.error.includes('Invalid password'))) {
          toastStore.error('Invalid Password', 'Please check your password and try again.');
        }
        
        return;
      }
      
      errorMessage = result.error || 'Failed to load shared PDF';
      requiresPassword = false;
      isLoading = false;
      return;
    }
    
    // Success case - process the PDF
    try {
      
      sharedPDFData = result.sharedPDF;
      
      // Download and process LPDF file
      if (result.lpdfUrl) {
        try {
          // Fetch the LPDF file
          const lpdfResponse = await fetch(result.lpdfUrl);
          if (!lpdfResponse.ok) {
            throw new Error('Failed to download LPDF file');
          }
          
          const lpdfBlob = await lpdfResponse.blob();
          const lpdfFile = new File([lpdfBlob], result.sharedPDF?.originalFileName || 'shared.lpdf', { type: 'application/x-lpdf' });
          
          // Import LPDF to extract PDF and annotations
          const { LPDFExporter } = await import('$lib/utils/lpdfExport');
          const importResult = await LPDFExporter.importFromLPDF(lpdfFile);
          
          if (importResult.pdfFile && importResult.annotations) {
            // Set the extracted PDF for viewing
            currentFile = importResult.pdfFile;
            
            // Get the original file size from metadata or use current size
            const originalSize = importResult.annotations.metadata?.originalSize ?? importResult.pdfFile.size;
            const originalFileName = importResult.annotations.metadata?.originalFilename || result.sharedPDF?.originalFileName || importResult.pdfFile.name;
            
            // Load annotations into stores properly
            console.log('Loading annotations into stores for shared PDF:', importResult.annotations);
            await LPDFExporter.loadAnnotationsIntoStores(importResult.annotations, originalFileName, originalSize);
            
            console.log('Successfully loaded shared LPDF with annotations');
          } else {
            throw new Error('Failed to extract PDF from LPDF file');
          }
        } catch (error) {
          console.error('Error processing LPDF file:', error);
          throw new Error(`Failed to load LPDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        throw new Error('No LPDF file found');
      }
      
      requiresPassword = false;
      isLoading = false;
      
    } catch (error) {
      console.error('Error processing LPDF file:', error);
      errorMessage = 'Failed to process shared PDF. Please try again.';
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
  
  
  function goHome() {
    goto('/');
  }

  // Keyboard shortcuts handler (copied from regular PDF route)
  function handleKeyboard(event: KeyboardEvent) {
    const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    
    // Handle password submission
    if (event.key === 'Enter' && requiresPassword && isTyping) {
      handlePasswordSubmit();
      return;
    }
    
    if (isTyping && event.key !== 'Escape') {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'z':
          if (event.shiftKey) {
            event.preventDefault();
            redo();
          } else {
            event.preventDefault();
            undo();
          }
          break;
        case 'y':
          event.preventDefault();
          redo();
          break;
        case '=':
        case '+':
          event.preventDefault();
          pdfViewer?.zoomIn();
          break;
        case '-':
          event.preventDefault();
          pdfViewer?.zoomOut();
          break;
        case '0':
          event.preventDefault();
          pdfViewer?.resetZoom();
          break;
      }
    } else {
      switch (event.key) {
        case 'ArrowLeft':
          pdfViewer?.previousPage();
          break;
        case 'ArrowRight':
          pdfViewer?.nextPage();
          break;
        case '1':
          event.preventDefault();
          setTool('pencil');
          break;
        case '2':
          event.preventDefault();
          setTool('eraser');
          break;
        case '3':
          event.preventDefault();
          setTool('text');
          break;
        case '4':
          event.preventDefault();
          setTool('arrow');
          break;
        case '5':
          event.preventDefault();
          setTool('highlight');
          break;
        case '6':
          event.preventDefault();
          setTool('note');
          break;
        case 'h':
        case 'H':
          event.preventDefault();
          pdfViewer?.fitToHeight();
          break;
        case 'w':
        case 'W':
          event.preventDefault();
          pdfViewer?.fitToWidth();
          break;
        case '?':
          event.preventDefault();
          showShortcuts = true;
          break;
        case 'F1':
          event.preventDefault();
          showShortcuts = true;
          break;
        case 't':
        case 'T':
          event.preventDefault();
          showThumbnails = !showThumbnails;
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          focusMode = !focusMode;
          break;
        case 's':
        case 'S':
          event.preventDefault();
          setTool('stamp');
          // Also open the stamp palette
          const stampButton = document.querySelector('.stamp-palette-container button');
          if (stampButton) {
            (stampButton as HTMLButtonElement).click();
          }
          break;
        case 'Escape':
          if (showShortcuts) {
            showShortcuts = false;
          }
          break;
      }
    }
  }

  // Thumbnail and page navigation handlers
  function handleToggleThumbnails(show: boolean) {
    showThumbnails = show;
  }

  function handlePageSelect(pageNumber: number) {
    pdfViewer?.goToPage(pageNumber);
  }

  // Wheel zoom handler
  function handleWheel(event: WheelEvent) {
    if (event.ctrlKey) {
      event.preventDefault();
      const zoomIn = event.deltaY < 0;
      if (zoomIn) {
        pdfViewer?.zoomIn();
      } else {
        pdfViewer?.zoomOut();
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeyboard} on:wheel={handleWheel} />

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
          <div class="flex justify-center mb-4">
            <Lock class="w-12 h-12 text-sage" />
          </div>
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
              class="flex-1 px-4 py-2 bg-sage text-charcoal rounded-lg hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div class="flex justify-center mb-4">
          <Frown class="w-16 h-16 text-slate dark:text-gray-400" />
        </div>
        <h2 class="text-2xl font-bold text-charcoal dark:text-white mb-2">Oops!</h2>
        <p class="text-slate dark:text-gray-400 mb-6">{errorMessage}</p>
        
        <button
          on:click={goHome}
          class="px-6 py-2 bg-sage text-charcoal rounded-lg hover:bg-sage/90 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
    
  {:else if currentFile}
    {#if !focusMode}
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
        {showThumbnails}
        onToggleThumbnails={handleToggleThumbnails}
        isSharedView={true}
      />
    {/if}

    <div class="w-full h-full" class:pt-12={!focusMode}>
      <div class="flex h-full">
        {#if showThumbnails}
          <PageThumbnails
            isVisible={showThumbnails}
            onPageSelect={handlePageSelect}
          />
        {/if}

        <div class="flex-1">
          <PDFViewer bind:this={pdfViewer} pdfFile={currentFile} />
        </div>
      </div>
    </div>

    <!-- Shared PDF Info (positioned properly based on focus mode) -->
    {#if sharedPDFData && !focusMode}
      <div class="absolute top-14 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm shadow-lg border border-gray-200 dark:border-gray-600">
        <div class="flex items-center gap-2">
          <Link class="w-4 h-4 text-sage" />
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

    <!-- Footer with all cards -->
    <Footer
      focusMode={false}
      getFormattedVersion={getFormattedVersion}
      on:helpClick={() => showShortcuts = true}
    />
  {/if}
</main>

<!-- Help/Shortcuts Modal -->
<KeyboardShortcuts bind:isOpen={showShortcuts} on:close={() => showShortcuts = false} />

<style>
  main {
    background: linear-gradient(135deg, #FDF6E3 0%, #F7F3E9 50%, #F0EFEB 100%);
  }
  
  :global(.dark) main {
    background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%);
  }
</style>