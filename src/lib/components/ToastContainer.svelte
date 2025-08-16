<script lang="ts">
  import { toastStore } from '$lib/stores/toastStore';
  import Toast from './Toast.svelte';
</script>

<!-- Toast Container - Fixed position at top right -->
<div class="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-end p-6 sm:p-6">
  <div class="flex w-full flex-col items-center space-y-4 sm:items-end">
    {#each $toastStore as toast (toast.id)}
      <Toast {toast} />
    {/each}
  </div>
</div>

<style>
  /* Ensure toasts appear above everything */
  div {
    z-index: 9999;
  }
</style>
