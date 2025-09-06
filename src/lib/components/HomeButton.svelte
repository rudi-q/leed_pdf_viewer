<script lang="ts">
	import { goto } from '$app/navigation';

	export let position: 'fixed' | 'absolute' | 'relative' | 'static' = 'absolute';
  export let positionClasses: string = 'top-16';
  export let showThumbnails: boolean = false;
  export let additionalClasses: string = '';
  
  function goHome() {
    goto('/');
  }
  
  // Build the complete class string - matching HelpButton styling but with appropriate sizing
  $: baseClasses = "text-sm text-charcoal/60 dark:text-gray-300 hover:text-charcoal dark:hover:text-white transition-colors flex items-center gap-2 bg-white/50 hover:bg-white/80 dark:bg-gray-800/80 dark:hover:bg-gray-700/90 px-3 py-2 rounded-lg backdrop-blur-sm border border-charcoal/10 dark:border-gray-600/20";
  $: positionClass = position !== 'static' ? position : '';
  $: dynamicLeftClass = showThumbnails ? 'left-52' : 'left-4';
  $: allClasses = [baseClasses, positionClass, positionClasses, dynamicLeftClass, additionalClasses].filter(Boolean).join(' ');
</script>

<button
  class={allClasses}
  on:click={goHome}
  title="Go back to home"
  aria-label="Go back to home"
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>
  </svg>
  <span>Home</span>
</button>
