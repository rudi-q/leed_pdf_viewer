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
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[320px] max-w-[400px]">
      <div class="mb-3">
        <h3 class="text-sm font-medium text-charcoal dark:text-gray-200 mb-2">Choose a Stamp</h3>
        <div class="space-y-3">
          {#each Object.entries(stampCategories) as [category, stamps]}
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">{categoryEmojis[category]}</span>
                <span class="text-xs font-medium text-charcoal/70 dark:text-gray-400 uppercase tracking-wide">
                  {categoryNames[category]}
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                {#each stamps as stamp}
                  <button
                    class="stamp-preview p-2 rounded-lg border-2 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 {stamp.id === $drawingState.stampId ? 'border-sage bg-sage/10 scale-105' : 'border-gray-200'}"
                    on:click={() => handleStampSelect(stamp)}
                    title={stamp.name}
                  >
                    <div class="w-10 h-10">
                      {@html stamp.svg}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
        <div class="flex items-center justify-between">
          <span class="text-xs text-charcoal/70 dark:text-gray-400">
            Click to select • Perfect for feedback & grading
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .stamp-preview :global(svg) {
    width: 100%;
    height: 100%;
  }
  
  /* Ensure stamp SVGs render properly */
  .stamp-preview :global(svg rect),
  .stamp-preview :global(svg circle),
  .stamp-preview :global(svg ellipse) {
    filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.15));
  }
</style>
