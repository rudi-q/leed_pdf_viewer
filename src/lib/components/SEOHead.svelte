<script lang="ts">
  import { page } from '$app/stores';
  import { pageSEOData, defaultSEOData, generateLDJSON, softwareApplicationData } from '$lib/utils/seo';
  import type { SEOData } from '$lib/utils/seo';
  
  export let customSEO: Partial<SEOData> = {};
  
  // Get page-specific SEO data based on current route
  $: currentPageSEO = pageSEOData[$page.route?.id || '/'] || {};
  
  // Merge default -> page-specific -> custom SEO data
  $: seoData = { ...defaultSEOData, ...currentPageSEO, ...customSEO };
  
  // Generate structured data with dynamic updates
  $: structuredData = {
    ...softwareApplicationData,
    url: seoData.url || defaultSEOData.url
  };
</script>

<svelte:head>
  <!-- Dynamic Meta Tags -->
  <title>{seoData.title}</title>
  <meta name="title" content={seoData.title}>
  <meta name="description" content={seoData.description}>
  <meta name="keywords" content={seoData.keywords}>
  <meta name="author" content={seoData.author}>
  <meta name="robots" content={seoData.robots}>
  <link rel="canonical" href={seoData.url}>
  
  <!-- Open Graph -->
  <meta property="og:type" content={seoData.type}>
  <meta property="og:url" content={seoData.url}>
  <meta property="og:title" content={seoData.title}>
  <meta property="og:description" content={seoData.description}>
  <meta property="og:image" content={seoData.image}>
  
  <!-- Twitter -->
  <meta property="twitter:card" content={seoData.twitterCard}>
  <meta property="twitter:url" content={seoData.url}>
  <meta property="twitter:title" content={seoData.title}>
  <meta property="twitter:description" content={seoData.description}>
  <meta property="twitter:image" content={seoData.image}>
  
  <!-- Dynamic Structured Data -->
  {@html `<script type="application/ld+json">${generateLDJSON(structuredData)}</script>`}
</svelte:head>
