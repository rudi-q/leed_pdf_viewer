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
    success: 'border-green-200 bg-green-50 text-green-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800'
  };

  const iconColorMap = {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400'
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
