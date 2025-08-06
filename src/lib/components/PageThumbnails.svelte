<script lang="ts">
	import { tick } from 'svelte';
	import { pdfState } from '../stores/drawingStore';

	export let onPageSelect: (pageNumber: number) => void;
  export let isVisible = false;

  let thumbnailContainer: HTMLDivElement;
  let thumbnails: Map<number, HTMLCanvasElement> = new Map();
  let isGenerating = false;
  let generatedPages = new Set<number>();

  const THUMBNAIL_WIDTH = 120;
  const THUMBNAIL_HEIGHT = 160;

  // Intersection Observer for lazy loading
  let observer: IntersectionObserver | null = null;
  
  // Set up lazy loading when panel becomes visible and DOM is ready
  $: if (isVisible && thumbnailContainer && $pdfState.document && !observer) {
    // Use tick() to ensure DOM is fully rendered
    tick().then(() => setupLazyLoading());
  }
  
  // Clean up observer when panel is hidden
  $: if (!isVisible && observer) {
    observer.disconnect();
    observer = null;
  }
  
  function setupLazyLoading() {
    if (typeof window === 'undefined') return;
    
    console.log('Setting up lazy loading observer');
    
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNumber = parseInt(entry.target.getAttribute('data-page') || '0');
            console.log('Page', pageNumber, 'came into view, generating thumbnail');
            if (pageNumber && !thumbnails.has(pageNumber)) {
              generateThumbnail(pageNumber);
            }
            // Stop observing this element once loaded
            observer?.unobserve(entry.target);
          }
        });
      },
      {
        root: thumbnailContainer,
        rootMargin: '50px', // Load thumbnails 50px before they come into view
        threshold: 0.1
      }
    );
    
    // Observe all placeholder elements
    const placeholders = thumbnailContainer?.querySelectorAll('.thumbnail-placeholder');
    console.log('Found', placeholders?.length, 'placeholders to observe');
    placeholders?.forEach(placeholder => {
      observer?.observe(placeholder);
    });
  }


  async function generateThumbnail(pageNumber: number): Promise<void> {
    if (!$pdfState.document) return;

    try {
      const page = await $pdfState.document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnails
      
      // Scale to fit within thumbnail dimensions
      const scale = Math.min(THUMBNAIL_WIDTH / viewport.width, THUMBNAIL_HEIGHT / viewport.height);
      const scaledViewport = page.getViewport({ scale: scale * 0.3 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = THUMBNAIL_WIDTH;
      canvas.height = THUMBNAIL_HEIGHT;
      
      // Center the page within the thumbnail
      const offsetX = (THUMBNAIL_WIDTH - scaledViewport.width) / 2;
      const offsetY = (THUMBNAIL_HEIGHT - scaledViewport.height) / 2;
      
      // Fill background
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
      
      // Translate to center the content
      context.translate(offsetX, offsetY);

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      };

      await page.render({
        ...renderContext,
        canvas: canvas
      }).promise;
      thumbnails.set(pageNumber, canvas);
      
      // Force reactivity update
      thumbnails = new Map(thumbnails);
    } catch (error) {
      console.error(`Error generating thumbnail for page ${pageNumber}:`, error);
    }
  }

  function handleThumbnailClick(pageNumber: number) {
    onPageSelect(pageNumber);
  }

  // Clear thumbnails when document changes
  let lastDocument: any = null;
  $: if ($pdfState.document && $pdfState.document !== lastDocument) {
    lastDocument = $pdfState.document;
    thumbnails.clear();
    generatedPages.clear();
    thumbnails = new Map();
    // Reset observer when document changes
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // Svelte action to render thumbnail on canvas
  function renderThumbnail(canvas: HTMLCanvasElement, thumbnail: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (ctx && thumbnail) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(thumbnail, 0, 0);
    }
    
    return {
      update(newThumbnail: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        if (ctx && newThumbnail) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(newThumbnail, 0, 0);
        }
      }
    };
  }
</script>

{#if isVisible}
  <div class="thumbnail-panel">
    <div class="thumbnail-header">
      <h3 class="text-sm font-medium text-charcoal mb-3">Page Navigator</h3>
      <div class="text-xs text-slate mb-4">
        {$pdfState.totalPages} pages • Click to jump
      </div>
    </div>
    
    <div bind:this={thumbnailContainer} class="thumbnail-grid">
      {#each Array($pdfState.totalPages).fill(0) as _, i}
        {@const pageNumber = i + 1}
        {@const thumbnail = thumbnails.get(pageNumber)}
        <div 
          class="thumbnail-item"
          class:active={pageNumber === $pdfState.currentPage}
          on:click={() => handleThumbnailClick(pageNumber)}
          on:keydown={(e) => e.key === 'Enter' && handleThumbnailClick(pageNumber)}
          role="button"
          tabindex="0"
        >
          {#if thumbnail}
            <div class="thumbnail-canvas-container">
              <canvas 
                width={THUMBNAIL_WIDTH} 
                height={THUMBNAIL_HEIGHT}
                use:renderThumbnail={thumbnail}
              ></canvas>
            </div>
          {:else}
            <button 
              class="thumbnail-placeholder"
              data-page={pageNumber}
              on:click={() => {
                // Generate thumbnail when clicked if not already generated
                if (!thumbnail) {
                  generateThumbnail(pageNumber);
                }
                handleThumbnailClick(pageNumber);
              }}
            >
              <div class="text-xs text-slate mb-2">Loading...</div>
              <div class="loading-spinner"></div>
            </button>
          {/if}
          <div class="thumbnail-label">
            {pageNumber}
          </div>
        </div>
      {/each}
    </div>

  </div>
{/if}

<style>
  .thumbnail-panel {
    width: 200px;
    height: 100%;
    background: white;
    border-right: 1px solid #e2e8f0;
    overflow-y: auto;
    padding: 16px;
  }

  .thumbnail-header {
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }

  .thumbnail-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .thumbnail-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #f8fafc;
  }

  .thumbnail-item:hover {
    border-color: #cbd5e1;
    background: #f1f5f9;
  }

  .thumbnail-item.active {
    border-color: #10b981;
    background: #ecfdf5;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  }

  .thumbnail-canvas-container {
    width: 120px;
    height: 160px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .thumbnail-placeholder {
    width: 120px;
    height: 160px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .thumbnail-placeholder:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .thumbnail-label {
    margin-top: 8px;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
  }

  .thumbnail-item.active .thumbnail-label {
    color: #10b981;
    font-weight: 600;
  }


  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>

