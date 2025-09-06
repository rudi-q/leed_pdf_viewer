<script lang="ts">
  export let dragOver = false;
</script>

{#if dragOver}
  <div class="absolute inset-0 bg-sage/40 backdrop-blur-sm flex items-center justify-center z-40 transition-all duration-200 ease-out pointer-events-none">
    <div class="text-center transform scale-105 transition-transform duration-200">
      <div class="text-6xl mb-4 animate-bounce">📄</div>
      <h3 class="text-2xl font-bold text-charcoal mb-2">Drop your PDF here</h3>
      <p class="text-slate">Release to start drawing</p>
      <div class="mt-4 text-sm text-sage font-medium">Ready to receive PDF</div>
    </div>
  </div>
{/if}
