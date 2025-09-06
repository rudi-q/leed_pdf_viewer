<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let position: 'fixed' | 'absolute' | 'relative' | 'static' = 'static';
  export let positionClasses: string = '';
  export let showOnDesktopOnly: boolean = false;
  export let additionalClasses: string = '';
  
  const dispatch = createEventDispatcher();
  
  function handleClick() {
    dispatch('click');
  }
  
  // Build the complete class string
  $: baseClasses = "text-xs text-charcoal dark:text-gray-100 hover:text-sage dark:hover:text-sage transition-colors flex items-center gap-1 bg-white/80 hover:bg-white/90 dark:bg-gray-800/80 dark:hover:bg-gray-700/90 px-2 py-1 rounded-lg backdrop-blur-sm border border-charcoal/10 dark:border-gray-600/20";
  $: positionClass = position !== 'static' ? position : '';
  $: hiddenClasses = showOnDesktopOnly ? 'hidden lg:flex' : '';
  $: allClasses = [baseClasses, positionClass, positionClasses, hiddenClasses, additionalClasses].filter(Boolean).join(' ');
</script>

<button
  class={allClasses}
  on:click={handleClick}
  title="Show keyboard shortcuts (? or F1)"
  aria-label="Show keyboard shortcuts"
>
  <span>?</span>
  <span>Help</span>
</button>
