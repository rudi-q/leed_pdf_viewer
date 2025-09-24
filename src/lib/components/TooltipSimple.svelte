<script lang="ts">
  // Props
  export let content = '';
  export let position: 'top' | 'bottom' = 'top'; // 'top' means tooltip appears below the button
  export let delay = 500;
  export let disabled = false;
  export let allowHTML = false; // Whether to allow HTML content (use with caution)

  // State
  let isVisible = false;
  let showTimeout: number | undefined;
  let hideTimeout: number | undefined;

  function show() {
    if (disabled || !content.trim()) return;
    if (hideTimeout) clearTimeout(hideTimeout);
    showTimeout = window.setTimeout(() => {
      isVisible = true;
    }, delay);
  }

  function hide() {
    if (showTimeout) clearTimeout(showTimeout);
    hideTimeout = window.setTimeout(() => {
      isVisible = false;
    }, 0);
  }

  function handleMouseEnter() {
    show();
  }

  function handleMouseLeave() {
    hide();
  }

  // Cleanup
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (showTimeout) clearTimeout(showTimeout);
    if (hideTimeout) clearTimeout(hideTimeout);
  });
</script>

<!-- Target wrapper -->
<div 
  class="tooltip-container"
  role="presentation"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <slot />
  
  <!-- Tooltip -->
  {#if isVisible}
    <div class="tooltip" class:tooltip-top={position === 'top'}>
      {#if allowHTML}
        {@html content}
      {:else}
        {content}
      {/if}
    </div>
  {/if}
</div>

<style>
  .tooltip-container {
    position: relative;
    display: inline-block;
  }

  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    z-index: 9999;
    background: rgba(37, 37, 37, 0.95);
    color: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    line-height: 1.4;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24), 0 2px 8px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(12px);
    animation: tooltipFadeIn 0.15s ease-out forwards;
  }

  .tooltip.tooltip-top {
    top: 100%;
    bottom: auto;
    margin-top: 8px;
    margin-bottom: 0;
  }

  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
  }

  .tooltip-top {
    animation: tooltipFadeInTop 0.15s ease-out forwards;
  }

  @keyframes tooltipFadeInTop {
    from {
      opacity: 0;
      transform: translateX(-50%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
  }

  /* Dark mode */
  :global(.dark) .tooltip {
    background: rgba(17, 24, 39, 0.95);
    border-color: rgba(255, 255, 255, 0.15);
  }
</style>
