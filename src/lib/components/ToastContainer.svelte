<script lang="ts">
	import { toastStore } from '$lib/stores/toastStore';
	import Toast from './Toast.svelte';
</script>

<!-- Regular toasts - top right -->
<div class="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-end p-6">
  <div class="flex w-full flex-col items-center space-y-4 sm:items-end">
    {#each $toastStore.filter(t => t.type !== 'tip').slice(-1) as toast (toast.id)}
      <Toast {toast} />
    {/each}
  </div>
</div>

<!-- Tip toasts - bottom left, above help button -->
<div class="pointer-events-none fixed inset-0 z-[9999] flex items-end justify-start pb-16 pl-6 pr-6 pt-6">
  <div class="flex w-full flex-col items-center space-y-4 sm:items-start">
    {#each $toastStore.filter(t => t.type === 'tip').slice(-1) as toast (toast.id)}
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
