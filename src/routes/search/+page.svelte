<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { Search, FileText, ExternalLink, Loader2, AlertCircle } from 'lucide-svelte';

  // Search state
  let searchQuery = '';
  let searchResults: any[] = [];
  let isLoading = false;
  let error = '';
  let hasSearched = false;
  let currentPage = 1;
  let totalResults = 0;
  let searchTime = 0;

  // Get initial search query from URL params
  $: if (browser && $page?.url) {
    const urlQuery = $page.url.searchParams.get('q');
    if (urlQuery && urlQuery !== searchQuery && !hasSearched) {
      searchQuery = urlQuery;
      performSearch();
    }
  }

  async function performSearch(pageNum = 1) {
    if (!searchQuery.trim()) {
      error = 'Please enter a search query';
      return;
    }

    isLoading = true;
    error = '';
    hasSearched = true;
    currentPage = pageNum;

    const startTime = Date.now();

    try {
      // Update URL with search query
      if (browser) {
        const url = new URL(window.location.href);
        url.searchParams.set('q', searchQuery);
        if (pageNum > 1) url.searchParams.set('page', pageNum.toString());
        else url.searchParams.delete('page');
        window.history.replaceState(null, '', url.toString());
      }

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `${searchQuery} filetype:pdf`,
          page: pageNum
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      searchResults = data.results || [];
      totalResults = data.totalResults || 0;
      searchTime = Date.now() - startTime;

    } catch (err) {
      console.error('Search error:', err);
      error = err instanceof Error ? err.message : 'Search failed. Please try again.';
      searchResults = [];
      totalResults = 0;
    } finally {
      isLoading = false;
    }
  }

  function handleSearchSubmit() {
    performSearch(1);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      try {
        event.preventDefault();
      } catch (e) {
        // Ignore passive event listener errors
      }
      handleSearchSubmit();
    }
  }

  function openPDF(url: string) {
    // Navigate to the PDF viewer with the URL
    const encodedUrl = encodeURIComponent(url);
    goto(`/pdf/${encodedUrl}`);
  }

  function handleNextPage() {
    if (currentPage * 10 < totalResults) {
      performSearch(currentPage + 1);
    }
  }

  function handlePreviousPage() {
    if (currentPage > 1) {
      performSearch(currentPage - 1);
    }
  }

  function formatFileSize(url: string): string {
    // Try to extract file size from URL or return unknown
    return 'Unknown size';
  }

  function extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  onMount(() => {
    // Focus search input on mount
    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  });
</script>

<svelte:head>
  <title>{searchQuery ? `"${searchQuery}" - PDF Search` : 'PDF Search'} | LeedPDF</title>
  <meta name="description" content="Search for PDF documents online using LeedPDF's powerful search engine. Find and view PDFs directly in your browser." />
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="flex items-center justify-center mb-4">
        <img src="/logo.png" alt="LeedPDF" class="w-12 h-12 mr-3 dark:hidden" />
        <img src="/logo-dark.png" alt="LeedPDF" class="w-12 h-12 mr-3 hidden dark:block" />
        <h1 class="text-3xl font-bold text-gray-800 dark:text-white">PDF Search</h1>
      </div>
      <p class="text-gray-600 dark:text-gray-300">Search for PDF documents across the web and open them directly in LeedPDF</p>
    </div>

    <!-- Search Box -->
    <div class="mb-8">
      <div class="relative max-w-2xl mx-auto">
        <div class="relative">
          <Search class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            bind:value={searchQuery}
            on:keydown={handleKeydown}
            placeholder="Search for PDF documents..."
            class="w-full pl-12 pr-32 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white shadow-lg"
            disabled={isLoading}
          />
          <button
            on:click={handleSearchSubmit}
            disabled={isLoading || !searchQuery.trim()}
            class="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {#if isLoading}
              <Loader2 class="animate-spin" size={16} />
            {:else}
              Search
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    {#if error}
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
        <div class="flex items-center">
          <AlertCircle class="text-red-600 dark:text-red-400 mr-2" size={20} />
          <span class="text-red-800 dark:text-red-200">{error}</span>
        </div>
      </div>
    {/if}

    {#if hasSearched && !isLoading && !error}
      <!-- Results Summary -->
      <div class="flex items-center justify-between mb-6 text-sm text-gray-600 dark:text-gray-400">
        <div>
          About {totalResults.toLocaleString()} results ({searchTime}ms)
        </div>
        {#if totalResults > 10}
          <div>
            Page {currentPage} of {Math.ceil(totalResults / 10)}
          </div>
        {/if}
      </div>

      <!-- Results List -->
      <div class="space-y-6">
        {#each searchResults as result}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center mb-2">
                  <FileText class="text-red-600 mr-2" size={16} />
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                    {result.title || 'PDF Document'}
                  </h3>
                </div>
                
                <p class="text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">
                  {result.description || result.snippet || 'PDF document available for viewing'}
                </p>
                
                <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3">
                  <span class="mr-4">{extractDomain(result.url)}</span>
                  <span class="mr-4">{formatFileSize(result.url)}</span>
                  {#if result.date}
                    <span>{new Date(result.date).toLocaleDateString()}</span>
                  {/if}
                </div>
                
                <div class="flex items-center space-x-3">
                  <button
                    on:click={() => openPDF(result.url)}
                    class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <FileText size={16} class="mr-2" />
                    Open in LeedPDF
                  </button>
                  
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
                  >
                    <ExternalLink size={16} class="mr-2" />
                    Open Original
                  </a>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Pagination -->
      {#if totalResults > 10}
        <div class="flex items-center justify-center mt-8 space-x-4">
          <button
            on:click={handlePreviousPage}
            disabled={currentPage <= 1 || isLoading}
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800 rounded-lg font-medium transition-colors"
          >
            Previous
          </button>
          
          <span class="text-gray-600 dark:text-gray-400">
            Page {currentPage} of {Math.ceil(totalResults / 10)}
          </span>
          
          <button
            on:click={handleNextPage}
            disabled={currentPage * 10 >= totalResults || isLoading}
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800 rounded-lg font-medium transition-colors"
          >
            Next
          </button>
        </div>
      {/if}

      <!-- No Results -->
      {#if searchResults.length === 0 && !isLoading}
        <div class="text-center py-12">
          <FileText class="mx-auto mb-4 text-gray-400" size={64} />
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">No PDFs found</h3>
          <p class="text-gray-600 dark:text-gray-300">Try different keywords or check your spelling</p>
        </div>
      {/if}
    {/if}

    <!-- Loading State -->
    {#if isLoading}
      <div class="text-center py-12">
        <Loader2 class="mx-auto mb-4 animate-spin text-blue-600" size={48} />
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Searching...</h3>
        <p class="text-gray-600 dark:text-gray-300">Finding PDF documents for "{searchQuery}"</p>
      </div>
    {/if}

    <!-- Back to Home -->
    <div class="text-center mt-12">
      <a
        href="/"
        class="inline-flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
      >
        ← Back to LeedPDF
      </a>
    </div>
  </div>
</main>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
