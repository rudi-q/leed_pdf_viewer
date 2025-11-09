<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { type Toast, toastStore } from '$lib/stores/toastStore';
	import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-svelte';

	export let toast: Toast;

  let toastElement: HTMLDivElement;

  const iconMap = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info
  };

  const colorMap = {
    success: 'border-sage/40 bg-sage/25 text-charcoal dark:bg-sage/30 dark:text-gray-100',
    error: 'border-sage/40 bg-sage/25 text-charcoal dark:bg-sage/30 dark:text-gray-100',
    warning: 'border-sage/40 bg-sage/25 text-charcoal dark:bg-sage/30 dark:text-gray-100',
    info: 'border-sage/40 bg-sage/25 text-charcoal dark:bg-sage/30 dark:text-gray-100'
  };

  const iconColorMap = {
    success: 'text-sage',
    error: 'text-sage',
    warning: 'text-sage',
    info: 'text-sage'
  };

  function dismiss() {
    toastStore.removeToast(toast.id);
  }

  onMount(() => {
    // Focus for accessibility
    if (toastElement) {
      toastElement.focus();
    }
  });
</script>

<div
  bind:this={toastElement}
  class="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg {colorMap[toast.type]}"
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  tabindex="-1"
  in:fly={{ x: 300, duration: 300 }}
  out:fly={{ x: 300, duration: 200 }}
>
  <div class="p-4">
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <svelte:component this={iconMap[toast.type]} class="h-5 w-5 {iconColorMap[toast.type]}" />
      </div>
      <div class="ml-3 w-0 flex-1">
        <p class="text-sm font-medium">
          {toast.title}
        </p>
        <p class="mt-1 text-sm opacity-90">
          {toast.message}
        </p>
        {#if toast.actions && toast.actions.length > 0}
          <div class="mt-3 flex gap-2">
            {#each toast.actions as action}
              <button
                type="button"
                class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                  bg-sage text-white hover:bg-sage/90 dark:bg-sage/80 dark:hover:bg-sage
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sage"
                on:click={() => {
                  action.onClick();
                  dismiss();
                }}
              >
                {action.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      {#if toast.dismissible}
        <div class="ml-4 flex flex-shrink-0">
          <button
            type="button"
            class="inline-flex rounded-md opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
            on:click={dismiss}
          >
            <span class="sr-only">Close</span>
            <X class="h-4 w-4" />
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Ensure proper focus styles */
  div:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
  }
</style>
