<script lang="ts">
	import { FileText } from 'lucide-svelte';

	export let dragOver = false;
</script>

{#if dragOver}
  <div class="absolute inset-0 bg-sage/40 backdrop-blur-sm flex items-center justify-center z-40 transition-all duration-200 ease-out pointer-events-none">
    <div class="text-center transform scale-105 transition-transform duration-200">
      <div class="text-sage mb-4 animate-bounce">
        <FileText class="w-16 h-16 mx-auto" />
      </div>
      <h3 class="text-2xl font-bold text-charcoal mb-2">Drop your file here</h3>
      <p class="text-slate">Release to start (PDF, Markdown, or LPDF)</p>
      <div class="mt-4 text-sm text-sage font-medium">Ready to receive file</div>
    </div>
  </div>
{/if}
