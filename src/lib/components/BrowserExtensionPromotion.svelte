<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { isTauri } from '$lib/utils/tauriUtils';
	import { Blocks } from 'lucide-svelte';

	export let focusMode = false;

	let detectedBrowser = '';

	// Detect user's browser (only Chromium-based browsers support extensions)
	function detectBrowser(): string {
		if (!browser) return '';
		
		const userAgent = navigator.userAgent.toLowerCase();
		
		// Check for specific Chromium-based browsers (order matters for accurate detection)
		if (userAgent.includes('arc/')) {
			return 'Arc';
		} else if (userAgent.includes('brave/') || (navigator as any)?.brave) {
			return 'Brave';
		} else if (userAgent.includes('comet/') || userAgent.includes('cometbrowser')) {
			return 'Comet';
		} else if (userAgent.includes('dia/') || userAgent.includes('diabrowser')) {
			return 'Dia';
		} else if (userAgent.includes('edg/') || userAgent.includes('edge/')) {
			return 'Edge';
		} else if (userAgent.includes('opr/') || userAgent.includes('opera/')) {
			return 'Opera';
		} else if (userAgent.includes('chrome/') && !userAgent.includes('edg/')) {
			return 'Chrome';
		}
		
		return ''; // Unknown or unsupported browser - will use fallback text
	}

	// Get the appropriate extension installation text based on detected browser
	$: extensionInstallationText = detectedBrowser 
		? `Install LeedPDF Extension for ${detectedBrowser}` 
		: 'Install LeedPDF Browser Extension';

	onMount(() => {
		detectedBrowser = detectBrowser();
	});
</script>

{#if !focusMode && browser && !isTauri}
<!-- Browser Extension Promotion -->
<div class="mb-6 max-w-sm mx-auto">
  <a 
    href="/download-browser-extension"
    target="_blank" 
    rel="noopener noreferrer"
    class="block"
  >
    <div class="floating-panel p-4 group hover:scale-[1.01] transition-all duration-300 hover:shadow-xl cursor-pointer">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 mt-0.5">
          <div class="w-9 h-9 bg-gradient-to-br from-sage to-mint rounded-xl flex items-center justify-center shadow-sm">
            <Blocks size={18} class="text-white drop-shadow-sm" />
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-semibold text-charcoal dark:text-gray-100 group-hover:text-sage transition-colors leading-tight mb-1.5">
            {extensionInstallationText}
          </h3>
          <p class="text-xs text-slate dark:text-gray-400 leading-relaxed">
            Auto-open any PDF you find online in LeedPDF
          </p>
        </div>
      </div>
      <!-- Subtle decorative gradient border -->
      <div class="absolute inset-0 rounded-2xl bg-gradient-to-r from-sage/8 via-mint/8 to-lavender/8 -z-10 blur-sm group-hover:blur-md transition-all duration-300"></div>
    </div>
  </a>
</div>
{/if}
