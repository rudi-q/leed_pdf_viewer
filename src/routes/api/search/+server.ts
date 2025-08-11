import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// You'll need to set this environment variable
const BRAVE_API_KEY = env.BRAVE_SEARCH_API_KEY || '';

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
      date?: string;
      snippet?: string;
    }>;
    total_results?: number;
  };
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
  date?: string;
  snippet?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { query, page = 1 } = await request.json();

    console.log('Search API called with query:', query, 'page:', page);
    console.log('API Key configured:', !!BRAVE_API_KEY);
    console.log('API Key length:', BRAVE_API_KEY ? BRAVE_API_KEY.length : 0);

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log('Invalid query provided');
      return json({ error: 'Search query is required' }, { status: 400 });
    }

    if (!BRAVE_API_KEY) {
      console.log('No API key found');
      return json({ 
        error: 'Brave Search API key not configured. Please add BRAVE_SEARCH_API_KEY to your environment variables.' 
      }, { status: 500 });
    }

    // Calculate offset for pagination
    const offset = (page - 1) * 10;

    // Brave Search API endpoint
    const braveApiUrl = new URL('https://api.search.brave.com/res/v1/web/search');
    braveApiUrl.searchParams.set('q', query);
    braveApiUrl.searchParams.set('count', '10');
    braveApiUrl.searchParams.set('offset', offset.toString());
    braveApiUrl.searchParams.set('safesearch', 'moderate');
    braveApiUrl.searchParams.set('freshness', 'all');
    braveApiUrl.searchParams.set('text_decorations', 'false');
    braveApiUrl.searchParams.set('spellcheck', 'true');

    const response = await fetch(braveApiUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    });

    if (!response.ok) {
      console.error('Brave API error:', response.status, response.statusText);
      
      if (response.status === 401) {
        return json({ 
          error: 'Invalid Brave Search API key. Please check your API key configuration.' 
        }, { status: 401 });
      }
      
      if (response.status === 429) {
        return json({ 
          error: 'API rate limit exceeded. Please try again later.' 
        }, { status: 429 });
      }
      
      return json({ 
        error: `Search service error: ${response.status} ${response.statusText}` 
      }, { status: response.status });
    }

    const data: BraveSearchResponse = await response.json();

    if (!data.web || !data.web.results) {
      return json({
        results: [],
        totalResults: 0,
        query: query.trim()
      });
    }

    // Filter results to only include PDFs and clean up the data
    const pdfResults: SearchResult[] = data.web.results
      .filter(result => {
        // Check if URL ends with .pdf or contains PDF-related indicators
        const url = result.url.toLowerCase();
        return url.includes('.pdf') || 
               url.includes('filetype:pdf') || 
               result.title?.toLowerCase().includes('pdf') ||
               result.description?.toLowerCase().includes('pdf');
      })
      .map(result => ({
        title: result.title || 'PDF Document',
        url: result.url,
        description: result.description || result.snippet || '',
        date: result.date,
        snippet: result.snippet
      }))
      .slice(0, 10); // Ensure we don't exceed 10 results

    return json({
      results: pdfResults,
      totalResults: data.web.total_results || pdfResults.length,
      query: query.trim(),
      page
    });

  } catch (error) {
    console.error('Search API error:', error);
    
    return json({ 
      error: 'An unexpected error occurred while searching. Please try again.' 
    }, { status: 500 });
  }
};

// Allow CORS for development
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
