<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { ExternalLink, FileText, Loader2, Search } from 'lucide-svelte';
	import type { SearchResponse, SearchResult } from '$lib/types/search';

	// Search state
  let searchQuery = '';
  let searchResults: SearchResult[] = [];
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

      const data: SearchResponse = await response.json();
      
      if ('error' in data) {
        throw new Error((data as any).error);
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
    // Validate URL
    try {
      const parsedUrl = new URL(url);
      // Only allow HTTP(S) protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      console.error('Invalid PDF URL:', error);
      return;
    }
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

<main class="w-full">
  <!-- Header -->
  <div class="header">
    <div class="container">
      <div class="header-content">
        <enhanced:img src="/static/./favicon.png" alt="LeedPDF" class="logo dark:hidden" />
        <enhanced:img src="/static/./logo-dark.png" alt="LeedPDF" class="logo hidden dark:block" />
        <h1 class="title">PDF Search</h1>
        <p class="subtitle">Search for PDF documents across the web and open them directly in LeedPDF</p>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="container content">
    <!-- Search Box -->
    <div class="search-section">
      <div class="search-container">
        <Search class="search-icon" size={20} />
        <input
          type="text"
          bind:value={searchQuery}
          on:keydown={handleKeydown}
          placeholder="Search for PDF documents..."
          class="search-input"
          disabled={isLoading}
        />
        <button
          on:click={handleSearchSubmit}
          disabled={isLoading || !searchQuery.trim()}
          class="search-button"
        >
          {#if isLoading}
            <Loader2 class="animate-spin" size={16} />
          {:else}
            Search
          {/if}
        </button>
      </div>
    </div>


    <!-- Search Results -->
    {#if error}
      <div class="error-card">
        <div class="error-icon">⚠️</div>
        <h2>Search Error</h2>
        <p>{error}</p>
      </div>
    {/if}

    {#if hasSearched && !isLoading && !error}
      <!-- Results Summary -->
      <div class="results-summary">
        <div class="results-count">
          About {totalResults.toLocaleString()} results ({searchTime}ms)
        </div>
        {#if totalResults > 10}
          <div class="results-pagination-info">
            Page {currentPage} of {Math.ceil(totalResults / 10)}
          </div>
        {/if}
      </div>

      <!-- Results Grid -->
      <div class="results-grid">
        {#each searchResults as result}
          <div class="result-card">
            <div class="result-header">
              <FileText class="result-icon" size={16} />
              <h3 class="result-title line-clamp-2">
                {result.title || 'PDF Document'}
              </h3>
            </div>
            
            <p class="result-description line-clamp-3">
              {result.description || result.snippet || 'PDF document available for viewing'}
            </p>
            
            <div class="result-meta">
              <span class="result-domain">{extractDomain(result.url)}</span>
              <span class="result-size">{formatFileSize(result.url)}</span>
              {#if result.date}
                <span class="result-date">{new Date(result.date).toLocaleDateString()}</span>
              {/if}
            </div>
            
            <div class="result-actions">
              <button
                on:click={() => openPDF(result.url)}
                class="primary-button button-with-icon"
              >
                <FileText size={16} />
                Open in LeedPDF
              </button>
              
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                class="secondary-button button-with-icon"
              >
                <ExternalLink size={16} />
                Open Original
              </a>
            </div>
          </div>
        {/each}
      </div>

      <!-- Pagination -->
      {#if totalResults > 10}
        <div class="pagination">
          <button
            on:click={handlePreviousPage}
            disabled={currentPage <= 1 || isLoading}
            class="pagination-button"
            class:disabled={currentPage <= 1 || isLoading}
          >
            Previous
          </button>
          
          <span class="pagination-info">
            Page {currentPage} of {Math.ceil(totalResults / 10)}
          </span>
          
          <button
            on:click={handleNextPage}
            disabled={currentPage * 10 >= totalResults || isLoading}
            class="pagination-button"
            class:disabled={currentPage * 10 >= totalResults || isLoading}
          >
            Next
          </button>
        </div>
      {/if}

      <!-- No Results -->
      {#if searchResults.length === 0 && !isLoading}
        <div class="no-results">
          <div class="no-results-icon">📄</div>
          <h3 class="no-results-title">No PDFs found</h3>
          <p class="no-results-description">Try different keywords or check your spelling</p>
        </div>
      {/if}
    {/if}

    <!-- Loading State -->
    {#if isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <h3 class="loading-title">Searching...</h3>
        <p class="loading-description">Finding PDF documents for "{searchQuery}"</p>
      </div>
    {/if}

    <!-- Back to Home -->
    <div class="back-section">
      <a href="/" class="back-button">
        ← Back to LeedPDF
      </a>
    </div>
  </div>
</main>

<style>
  :global(html) {
    height: auto;
    min-height: 100%;
    overflow-y: auto !important;
  }

  :global(body) {
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
    height: auto;
    min-height: 100%;
    overflow: visible !important;
  }

  main {
    background: linear-gradient(135deg, #FDF6E3 0%, #F7F3E9 50%, #F0EFEB 100%);
    min-height: 100vh;
    width: 100%;
  }

  :global(.dark) main {
    background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #374151 100%);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .header {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(52, 73, 94, 0.1);
    padding: 2rem 0;
  }

  :global(.dark) .header {
    background: rgba(31, 41, 55, 0.8);
    border-bottom: 1px solid rgba(107, 114, 128, 0.1);
  }

  .header-content {
    text-align: center;
  }

  .logo {
    width: 64px;
    height: 64px;
    margin-bottom: 1rem;
  }

  .title {
    font-size: 2.5rem;
    font-weight: 700;
    color: #34495e;
    margin: 0 0 0.5rem 0;
  }

  :global(.dark) .title {
    color: #f9fafb;
  }

  .subtitle {
    font-size: 1.2rem;
    color: #7f8c8d;
    margin: 0;
  }

  :global(.dark) .subtitle {
    color: #d1d5db;
  }

  .content {
    padding: 3rem 0;
  }

  .search-section {
    margin-bottom: 3rem;
  }

  .search-container {
    position: relative;
    max-width: 800px;
    margin: 0 auto;
  }

  :global(.search-icon) {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #7f8c8d;
    z-index: 10;
  }

  .search-input {
    width: 100%;
    padding: 1rem 6rem 1rem 3rem;
    font-size: 1.1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    color: #34495e;
    transition: all 0.3s ease;
    box-sizing: border-box;
  }

  .search-input:focus {
    outline: none;
    border-color: #87A96B;
    box-shadow: 0 0 0 4px rgba(135, 169, 107, 0.1);
  }

  :global(.dark) .search-input {
    background: rgba(31, 41, 55, 0.8);
    border-color: rgba(107, 114, 128, 0.3);
    color: #f9fafb;
  }

  .search-button {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    padding: 0.75rem 1.5rem;
    background: #87A96B;
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search-button:hover:not(:disabled) {
    background: #759157;
    transform: translateY(-50%) translateY(-1px);
  }

  .search-button:disabled {
    background: #95a5a6;
    cursor: not-allowed;
  }

  .results-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    font-size: 0.9rem;
    color: #7f8c8d;
  }

  :global(.dark) .results-summary {
    color: #d1d5db;
  }

  .results-grid {
    display: grid;
    gap: 1.5rem;
    margin-bottom: 3rem;
  }

  .result-card {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    border: 2px solid transparent;
  }

  .result-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    border-color: #87A96B;
  }

  :global(.dark) .result-card {
    background: #374151;
    border-color: transparent;
  }

  :global(.dark) .result-card:hover {
    border-color: #87A96B;
  }

  .result-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  :global(.result-icon) {
    color: #e74c3c;
    margin-top: 0.25rem;
    flex-shrink: 0;
  }

  .result-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #34495e;
    margin: 0;
    line-height: 1.4;
  }

  :global(.dark) .result-title {
    color: #f9fafb;
  }

  .result-description {
    color: #5a6c7d;
    line-height: 1.6;
    margin-bottom: 1rem;
  }

  :global(.dark) .result-description {
    color: #d1d5db;
  }

  .result-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.875rem;
    color: #95a5a6;
    margin-bottom: 1.5rem;
  }

  :global(.dark) .result-meta {
    color: #9ca3af;
  }

  .result-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .button-with-icon {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-bottom: 3rem;
  }

  .pagination-button {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #34495e;
    border: 2px solid rgba(52, 73, 94, 0.1);
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pagination-button:hover:not(.disabled) {
    background: #87A96B;
    color: white;
    border-color: #87A96B;
    transform: translateY(-1px);
  }

  .pagination-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.dark) .pagination-button {
    background: #374151;
    color: #f9fafb;
    border-color: rgba(107, 114, 128, 0.3);
  }

  .pagination-info {
    color: #7f8c8d;
    font-weight: 500;
  }

  :global(.dark) .pagination-info {
    color: #d1d5db;
  }

  .no-results {
    text-align: center;
    padding: 4rem 0;
  }

  .no-results-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .no-results-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #34495e;
    margin: 0 0 0.5rem 0;
  }

  :global(.dark) .no-results-title {
    color: #f9fafb;
  }

  .no-results-description {
    color: #7f8c8d;
    margin: 0;
  }

  :global(.dark) .no-results-description {
    color: #d1d5db;
  }

  .loading {
    text-align: center;
    padding: 4rem 0;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(135, 169, 107, 0.3);
    border-left: 4px solid #87A96B;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #34495e;
    margin: 0 0 0.5rem 0;
  }

  :global(.dark) .loading-title {
    color: #f9fafb;
  }

  .loading-description {
    color: #7f8c8d;
    margin: 0;
  }

  :global(.dark) .loading-description {
    color: #d1d5db;
  }

  .error-card {
    background: white;
    border-radius: 16px;
    padding: 3rem;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    max-width: 500px;
    margin: 0 auto 3rem;
    border: 2px solid #e74c3c;
  }

  :global(.dark) .error-card {
    background: #374151;
    border-color: #ef4444;
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .error-card h2 {
    color: #34495e;
    margin-bottom: 1rem;
  }

  :global(.dark) .error-card h2 {
    color: #f9fafb;
  }

  .error-card p {
    color: #7f8c8d;
    margin-bottom: 0;
  }

  :global(.dark) .error-card p {
    color: #d1d5db;
  }

  .back-section {
    text-align: center;
    margin-top: 3rem;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #34495e;
    color: white;
    padding: 1rem 2rem;
    border-radius: 16px;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: #2c3e50;
    transform: translateY(-1px);
  }

  :global(.dark) .back-button {
    background: #4b5563;
  }

  :global(.dark) .back-button:hover {
    background: #374151;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
    }

    .title {
      font-size: 2rem;
    }

    .result-actions {
      flex-direction: column;
    }

    .pagination {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
