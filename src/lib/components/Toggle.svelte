<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let checked = false;
  export let disabled = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let ariaLabel = 'Toggle switch';
  
  const dispatch = createEventDispatcher<{ change: boolean }>();
  
  function handleClick() {
    if (disabled) return;
    checked = !checked;
    dispatch('change', checked);
  }

  // Size configurations
  const sizeClasses = {
    sm: {
      track: 'w-9 h-5',
      thumb: 'w-4 h-4',
      translate: 'translate-x-4',
      translateValue: 'translateX(16px)' // 36px - 16px - 4px padding = 16px
    },
    md: {
      track: 'w-11 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-5',
      translateValue: 'translateX(20px)' // 44px - 20px - 4px padding = 20px
    },
    lg: {
      track: 'w-14 h-7',
      thumb: 'w-6 h-6',
      translate: 'translate-x-7',
      translateValue: 'translateX(28px)' // 56px - 24px - 4px padding = 28px
    }
  };

  $: config = sizeClasses[size];
</script>

<button
  type="button"
  class="relative inline-flex items-center rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 {config.track} {checked ? 'bg-sage' : 'bg-gray-200 dark:bg-gray-700'}"
  class:opacity-50={disabled}
  class:cursor-not-allowed={disabled}
  {disabled}
  on:click={handleClick}
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel}
>
  <span
    class="inline-block rounded-full bg-white shadow-lg ring-0 transition-all duration-200 ease-in-out {config.thumb}"
    style="transform: {checked ? config.translateValue : 'translateX(0)'}"
  ></span>
</button>

<style>
  /* Ensure smooth transitions */
  button {
    transition: background-color 0.2s ease-in-out;
  }
  
  span {
    transition: transform 0.2s ease-in-out;
  }
</style>