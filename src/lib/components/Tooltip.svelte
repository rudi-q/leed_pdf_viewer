<script lang="ts">
  import { createEventDispatcher, tick, onMount, onDestroy } from 'svelte';

  // Props
  export let content = '';
  export let position: 'top' | 'bottom' | 'left' | 'right' | 'auto' = 'auto';
  export let delay = 500; // Delay before showing (ms)
  export let hideDelay = 0; // Delay before hiding (ms)
  export let disabled = false;
  export let showOnMobile = false; // Whether to show tooltips on mobile devices
  export let offset = 8; // Distance from target element
  export let maxWidth = 250; // Maximum tooltip width in pixels
  export let className = ''; // Additional CSS classes
  export let allowHTML = false; // Whether to allow HTML content (use with caution)

  // State
  let isVisible = false;
  let showTimeout: number | undefined;
  let hideTimeout: number | undefined;
  let tooltipElement: HTMLDivElement;
  let targetElement: HTMLElement;
  let computedPosition = position;
  let portalTarget: HTMLElement;

  // Reactive variables for positioning
  let tooltipStyle = '';

  // Dispatch events
  const dispatch = createEventDispatcher<{
    show: void;
    hide: void;
  }>();

  // Check if we're on mobile
  $: isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  $: shouldShow = !disabled && (!isMobile || showOnMobile) && content.trim();

  // Position calculation
  function calculatePosition() {
    if (!tooltipElement || !targetElement) {
      return;
    }

    // Get target element position
    const targetRect = targetElement.getBoundingClientRect();
    
    let finalPosition = position === 'auto' ? 'bottom' : position;
    
    // For auto positioning, prefer bottom for toolbar items
    if (position === 'auto') {
      const spaceBottom = window.innerHeight - targetRect.bottom;
      finalPosition = spaceBottom >= 50 ? 'bottom' : 'top';
    }
    
    computedPosition = finalPosition;
    
    // Calculate position
    let top = 0;
    let left = 0;
    let transform = '';
    
    switch (finalPosition) {
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + targetRect.width / 2;
        transform = 'translateX(-50%)';
        break;
      case 'top':
        top = targetRect.top - offset;
        left = targetRect.left + targetRect.width / 2;
        transform = 'translateX(-50%) translateY(-100%)';
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - offset;
        transform = 'translateY(-50%) translateX(-100%)';
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + offset;
        transform = 'translateY(-50%)';
        break;
    }
    
    const style = `top: ${top}px; left: ${left}px; transform: ${transform}; max-width: ${maxWidth}px; position: fixed; z-index: 9999;`;
    
    tooltipStyle = style;
  }

  function show() {
    if (!shouldShow) return;
    
    if (hideTimeout) clearTimeout(hideTimeout);
    
    showTimeout = window.setTimeout(async () => {
      isVisible = true;
      dispatch('show');
      await tick();
      // Small delay to ensure DOM is updated
      setTimeout(calculatePosition, 0);
    }, delay);
  }

  function hide() {
    if (showTimeout) clearTimeout(showTimeout);
    
    hideTimeout = window.setTimeout(() => {
      isVisible = false;
      dispatch('hide');
    }, hideDelay);
  }

  function handleMouseEnter(event: MouseEvent) {
    targetElement = event.currentTarget as HTMLElement;
    show();
  }

  function handleMouseLeave() {
    hide();
  }

  function handleFocus(event: FocusEvent) {
    targetElement = event.currentTarget as HTMLElement;
    show();
  }

  function handleBlur() {
    hide();
  }

  // Touch handling for mobile
  function handleTouchStart(event: TouchEvent) {
    if (showOnMobile) {
      targetElement = event.currentTarget as HTMLElement;
      show();
      
      // Auto hide after a few seconds on mobile
      setTimeout(hide, 2000);
    }
  }

  // Portal setup
  onMount(() => {
    // Create portal target
    portalTarget = document.createElement('div');
    portalTarget.className = 'tooltip-portal';
    document.body.appendChild(portalTarget);
  });

  // Clean up timeouts and portal
  function cleanup() {
    if (showTimeout) clearTimeout(showTimeout);
    if (hideTimeout) clearTimeout(hideTimeout);
    if (portalTarget && portalTarget.parentNode) {
      portalTarget.parentNode.removeChild(portalTarget);
    }
  }

  // Cleanup on destroy
  onDestroy(cleanup);
</script>

<!-- Target element wrapper -->
<span
  class="tooltip-target"
  role="presentation"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  on:focus={handleFocus}
  on:blur={handleBlur}
  on:touchstart={handleTouchStart}
>
  <slot />
</span>

<!-- Tooltip element (rendered in portal) -->
{#if isVisible && shouldShow}
  <div
    bind:this={tooltipElement}
    class="tooltip-popup fixed z-[9999] {className}"
    class:tooltip-top={computedPosition === 'top'}
    class:tooltip-bottom={computedPosition === 'bottom'}
    class:tooltip-left={computedPosition === 'left'}
    class:tooltip-right={computedPosition === 'right'}
    style={tooltipStyle}
    role="tooltip"
    aria-hidden="false"
  >
    <div class="tooltip-content">
      {#if allowHTML && typeof content === 'string'}
        {@html content}
      {:else}
        {content}
      {/if}
    </div>
    
    <!-- Tooltip arrow -->
    <div class="tooltip-arrow" class:arrow-top={computedPosition === 'top'} class:arrow-bottom={computedPosition === 'bottom'} class:arrow-left={computedPosition === 'left'} class:arrow-right={computedPosition === 'right'}></div>
  </div>
{/if}

<style>
  .tooltip-target {
    display: inline-block;
  }

  .tooltip-popup {
    --tooltip-bg: rgba(37, 37, 37, 0.95);
    --tooltip-text: rgba(255, 255, 255, 0.95);
    --tooltip-border: rgba(255, 255, 255, 0.1);
    
    background: var(--tooltip-bg);
    color: var(--tooltip-text);
    border: 1px solid var(--tooltip-border);
    backdrop-filter: blur(12px);
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.4;
    font-weight: 500;
    letter-spacing: 0.01em;
    pointer-events: none;
    user-select: none;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24), 0 2px 8px rgba(0, 0, 0, 0.12);
    
    /* Animation */
    animation: tooltipFadeIn 0.15s ease-out forwards;
    transform-origin: center;
  }

  .tooltip-content {
    padding: 8px 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Multi-line support for longer tooltips */
  .tooltip-popup[style*="max-width"] .tooltip-content {
    white-space: normal;
    word-wrap: break-word;
  }

  /* Dark mode adjustments */
  :global(.dark) .tooltip-popup {
    --tooltip-bg: rgba(17, 24, 39, 0.95);
    --tooltip-text: rgba(255, 255, 255, 0.95);
    --tooltip-border: rgba(255, 255, 255, 0.15);
  }

  /* Arrow styling */
  .tooltip-arrow {
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--tooltip-bg);
    border: 1px solid var(--tooltip-border);
    border-radius: 1px;
    transform: rotate(45deg);
    pointer-events: none;
  }

  .tooltip-popup.tooltip-top .tooltip-arrow,
  .tooltip-arrow.arrow-top {
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    border-top: none;
    border-left: none;
  }

  .tooltip-popup.tooltip-bottom .tooltip-arrow,
  .tooltip-arrow.arrow-bottom {
    top: -4px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    border-bottom: none;
    border-right: none;
  }

  .tooltip-popup.tooltip-left .tooltip-arrow,
  .tooltip-arrow.arrow-left {
    right: -4px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
    border-left: none;
    border-bottom: none;
  }

  .tooltip-popup.tooltip-right .tooltip-arrow,
  .tooltip-arrow.arrow-right {
    left: -4px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
    border-right: none;
    border-top: none;
  }

  /* Animations */
  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Responsive behavior */
  @media (max-width: 1024px) {
    .tooltip-popup {
      font-size: 12px;
      max-width: 200px !important;
    }
    
    .tooltip-content {
      padding: 6px 10px;
    }
  }

  /* High contrast support */
  @media (prefers-contrast: high) {
    .tooltip-popup {
      --tooltip-bg: rgb(0, 0, 0);
      --tooltip-text: rgb(255, 255, 255);
      --tooltip-border: rgb(255, 255, 255);
      border-width: 2px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .tooltip-popup {
      animation: none;
    }
  }
</style>