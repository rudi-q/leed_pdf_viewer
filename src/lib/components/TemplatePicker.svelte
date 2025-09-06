<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import templatesData from '$lib/data/templates.json';

	export let isOpen = false;
  
  const dispatch = createEventDispatcher();
  
  // Import templates from JSON file
  const templates = templatesData;
  
  function close() {
    isOpen = false;
    dispatch('close');
  }
  
  function selectTemplate(templateName: string) {
    close();
    goto(`/templates/${templateName}`);
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }
  
  onMount(() => {
    if (browser) {
      document.addEventListener('keydown', handleKeydown);
    }
  });
  
  onDestroy(() => {
    if (browser) {
      document.removeEventListener('keydown', handleKeydown);
    }
  });
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click|self={close}
    on:keydown={(e) => e.key === 'Escape' && close()}
    role="button"
    tabindex="-1"
    aria-label="Close modal overlay"
  >
    <!-- Modal -->
    <div class="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/30 max-w-2xl w-full max-h-[80vh] overflow-hidden">
      <!-- Header -->
      <div class="border-b border-charcoal/10 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold text-charcoal">Choose a Template</h2>
            <p class="text-sm text-slate mt-1">Start with a pre-designed PDF template</p>
          </div>
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
      
      <!-- Content -->
      <div class="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {#each templates as template}
            <button
              class="template-card group text-left p-4 rounded-xl border-2 border-transparent bg-white/50 hover:bg-white/80 hover:border-sage/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage"
              on:click={() => selectTemplate(template.name)}
            >
              <div class="flex items-center gap-3 mb-3">
                <div class="text-2xl">{template.icon}</div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-charcoal group-hover:text-sage transition-colors truncate">
                    {template.title}
                  </h3>
                </div>
              </div>
              <p class="text-sm text-slate leading-relaxed">
                {template.description}
              </p>
              <div class="mt-3 text-xs text-sage opacity-70 group-hover:opacity-100 transition-opacity">
                Click to open →
              </div>
            </button>
          {/each}
        </div>
        
        <!-- Empty state if no templates -->
        {#if templates.length === 0}
          <div class="text-center py-8">
            <div class="text-4xl mb-4">📄</div>
            <h3 class="text-lg font-medium text-charcoal mb-2">No Templates Available</h3>
            <p class="text-sm text-slate">Templates will appear here when they're added to the templates folder.</p>
          </div>
        {/if}
        
        <!-- Footer tip -->
        <div class="mt-6 pt-4 border-t border-charcoal/10">
          <p class="text-xs text-slate text-center">
            💡 Tip: Templates are pre-designed PDFs you can annotate and customize
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .template-card {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .template-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }
  
  .template-card:active {
    transform: translateY(0);
  }
</style>
