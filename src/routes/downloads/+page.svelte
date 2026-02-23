<script lang="ts">
	import { DOWNLOAD_URL } from './constants';
</script>

<svelte:head>
	<title>Redirecting to LeedPDF Downloads...</title>
	<meta http-equiv="refresh" content="0;url={DOWNLOAD_URL}" />
	<link rel="canonical" href={DOWNLOAD_URL} />
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-sand">
	<p class="text-charcoal text-lg">Redirecting to downloads...</p>
</div>
