<script lang="ts">
	import { availableStamps, drawingState, setStampId, type StampDefinition } from '../stores/drawingStore';

	// Svelte component - no need for explicit default export
  
  export let isOpen = false;
  export let onClose: () => void = () => {};

  function handleStampSelect(stamp: StampDefinition) {
    setStampId(stamp.id);
    onClose();
  }

  // Group stamps by category for better organization
  const stampCategories = availableStamps.reduce((acc, stamp) => {
    if (!acc[stamp.category]) {
      acc[stamp.category] = [];
    }
    acc[stamp.category].push(stamp);
    return acc;
  }, {} as Record<string, StampDefinition[]>);

  const categoryEmojis: Record<string, string> = {
    'stars': '⭐',
    'checkmarks': '✅',
    'x-marks': '❌',
    'smileys': '😊',
    'hearts': '❤️',
    'thumbs': '👍'
  };

  const categoryNames: Record<string, string> = {
    'stars': 'Stars',
    'checkmarks': 'Checkmarks',
    'x-marks': 'X Marks',
    'smileys': 'Smileys',
    'hearts': 'Hearts',
    'thumbs': 'Thumbs Up'
  };
</script>

{#if isOpen}
  <div class="absolute top-full mt-2 left-0 z-50">
    <div class="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-600/50 p-3 min-w-[280px]">
      <div class="mb-2">
        <h3 class="text-sm font-medium text-charcoal/80 dark:text-gray-200 mb-3 text-center">Choose a Stamp</h3>
        <div class="flex flex-wrap gap-3 justify-center">
          {#each availableStamps as stamp}
            <button
              class="sticker-preview group relative transition-all duration-300 hover:scale-110 hover:rotate-2 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:ring-offset-2 {stamp.id === $drawingState.stampId ? 'scale-110' : ''}"
              on:click={() => handleStampSelect(stamp)}
              title={stamp.name}
            >
              <!-- SVG sticker with built-in realistic border -->
              <div class="w-12 h-12 transition-transform duration-300 group-hover:scale-110">
                {@html stamp.svg}
              </div>
              
              <!-- Selection indicator -->
              {#if stamp.id === $drawingState.stampId}
                <div class="absolute -inset-1 border-2 border-sage rounded-xl animate-pulse"></div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
      
      <div class="border-t border-gray-200/50 dark:border-gray-600/50 pt-2 mt-2">
        <div class="text-center">
          <span class="text-xs text-charcoal/60 dark:text-gray-400">
            Perfect for feedback & grading ✨
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .sticker-preview :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
