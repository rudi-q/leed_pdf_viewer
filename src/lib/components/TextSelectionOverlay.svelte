<script lang="ts">
  import { Copy, X } from 'lucide-svelte';
  import { setTool } from '../stores/drawingStore';
  import { toastStore } from '../stores/toastStore';

  export let extractedText: string = '';
  export let currentPage: number = 1;
  export let isLoading: boolean = false;
  export let containerHeight: number = 0;

  let isHovering = false;
  let selectedText = '';

  // Split text into paragraphs
  $: paragraphs = extractedText
    .split('\n\n')
    .filter(p => p.trim().length > 0);

  function handleClose() {
    // Switch back to pencil tool when closing
    setTool('pencil');
  }

  async function copyToClipboard(text: string, label: string = 'Text') {
    try {
      await navigator.clipboard.writeText(text);
      toastStore.success('Copied', `${label} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy:', error);
      toastStore.error('Copy Failed', 'Could not copy text to clipboard');
    }
  }

  function handleCopyParagraph(paragraph: string) {
    copyToClipboard(paragraph, 'Paragraph');
  }

  function handleCopySelection() {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (text) {
      copyToClipboard(text, 'Selection');
    }
  }

  // Track text selection
  function handleSelectionChange() {
    const selection = window.getSelection();
    selectedText = selection?.toString() || '';
  }
</script>

<svelte:window on:selectionchange={handleSelectionChange} />

<div 
  class="fixed right-4 w-80 lg:w-96 z-40 pointer-events-auto"
  style="top: 50%; transform: translateY(-50%); height: {containerHeight}px;"
  on:mouseenter={() => isHovering = true}
  on:mouseleave={() => isHovering = false}
  role="region"
  aria-label="Text selection panel"
>
  <div class="h-full flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-sage/5 dark:bg-sage/10">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-charcoal dark:text-gray-200">
          Page {currentPage} Text
        </h3>
        {#if isLoading}
          <div class="animate-spin h-4 w-4 border-2 border-sage border-t-transparent rounded-full"></div>
        {/if}
      </div>
      
      <!-- Copy Selection Button -->
      {#if selectedText}
        <button
          on:click={handleCopySelection}
          class="p-1.5 hover:bg-sage/20 dark:hover:bg-sage/30 rounded-lg transition-colors text-sage"
          aria-label="Copy selected text"
          title="Copy Selection"
        >
          <Copy size={14} />
        </button>
      {/if}
      
      <button
        on:click={handleClose}
        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="Close text selection"
      >
        <X size={16} class="text-charcoal/70 dark:text-gray-400" />
      </button>
    </div>

    <!-- Text Content -->
    <div class="flex-1 overflow-y-auto p-4 text-content-area">
      {#if isLoading}
        <div class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="animate-spin h-8 w-8 border-3 border-sage border-t-transparent rounded-full mx-auto mb-2"></div>
            <p class="text-sm text-charcoal/60 dark:text-gray-400">Extracting text...</p>
          </div>
        </div>
      {:else if extractedText}
        <div class="prose prose-sm dark:prose-invert max-w-none space-y-4">
          {#each paragraphs as paragraph, index}
            <div class="paragraph-container relative group">
              <p class="text-sm text-charcoal dark:text-gray-200 leading-relaxed whitespace-pre-wrap select-text">
                {paragraph}
              </p>
              {#if isHovering}
                <button
                  on:click={() => handleCopyParagraph(paragraph)}
                  class="absolute top-0 right-0 p-1 bg-white dark:bg-gray-700 hover:bg-sage/10 dark:hover:bg-sage/20 rounded border border-gray-200 dark:border-gray-600 shadow-sm transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Copy paragraph"
                  title="Copy this paragraph"
                >
                  <Copy size={12} class="text-sage" />
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex items-center justify-center h-full">
          <p class="text-sm text-charcoal/60 dark:text-gray-400 text-center">
            No text found on this page
          </p>
        </div>
      {/if}
    </div>

    <!-- Footer with info -->
    <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
      <p class="text-xs text-charcoal/60 dark:text-gray-400 text-center">
        Select and copy text as needed
      </p>
    </div>
  </div>
</div>

<style>
  /* Ensure text is selectable */
  .select-text {
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
  }
  
  /* Text cursor for content area */
  .text-content-area {
    cursor: text;
  }

  /* Custom scrollbar */
  .overflow-y-auto::-webkit-scrollbar {
    width: 8px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
  }

  :global(.dark) .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #4b5563;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  :global(.dark) .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
</style>
