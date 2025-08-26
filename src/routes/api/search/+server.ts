import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import type { SearchResult } from '$lib/types/search';

// You'll need to set this environment variable
const BRAVE_API_KEY = env.BRAVE_SEARCH_API_KEY || '';

// CORS configuration - allowed origins from environment variable
const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS
	? env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
	: ['http://localhost:5173', 'http://localhost:4173']; // Default SvelteKit dev/preview ports

// Helper function to validate allowed origins
function isAllowedOrigin(origin: string): boolean {
	try {
		const parsedOrigin = new URL(origin);
		const hostname = parsedOrigin.hostname.toLowerCase();
		
		// Exact match for main domain
		if (hostname === 'leed.my') {
			return true;
		}
		
		// Allow specific subdomains if needed
		if (hostname.endsWith('.leed.my')) {
			// Optional: add specific subdomain whitelist
			const allowedSubdomains = ['app', 'beta', 'staging', 'www'];
			const subdomain = hostname.replace('.leed.my', '');
			return allowedSubdomains.includes(subdomain);
		}
		
		return false;
	} catch {
		return false; // Invalid URL
	}
}

// Helper function to validate origin and get CORS headers
function validateOriginAndGetCorsHeaders(request: Request): {
	valid: boolean;
	headers?: Record<string, string>;
} {
	const origin = request.headers.get('origin');

	// Same-origin request (no origin header) - always allowed
	if (!origin) {
		return { valid: true };
	}

	// In development, allow any localhost origin
	if (env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
		return {
			valid: true,
			headers: {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
				'Vary': 'Origin'
			}
		};
	}

	// Use secure origin validation for production domains
	if (isAllowedOrigin(origin)) {
		return {
			valid: true,
			headers: {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type',
				'Vary': 'Origin'
			}
		};
	}

	// Cross-origin request - check against allowlist
	if (!ALLOWED_ORIGINS.includes(origin)) {
		return { valid: false };
	}

	// Valid cross-origin request - return CORS headers
	return {
		valid: true,
		headers: {
			'Access-Control-Allow-Origin': origin,
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	};
}

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

export const POST: RequestHandler = async ({ request }) => {
	// Validate origin for CORS
	const corsValidation = validateOriginAndGetCorsHeaders(request);

	if (!corsValidation.valid) {
		return new Response(null, { status: 403 });
	}

	try {
		const { query, page = 1 } = await request.json();

		if (env.NODE_ENV === 'development') {
			console.log('Search API called with query:', query, 'page:', page);
		}

		if (!query || typeof query !== 'string' || query.trim().length === 0) {
			console.log('Invalid query provided');
			return json({ error: 'Search query is required' }, { status: 400 });
		}

		if (!BRAVE_API_KEY) {
			console.log('No API key found');
			return json(
				{
					error:
						'Brave Search API key not configured. Please add BRAVE_SEARCH_API_KEY to your environment variables.'
				},
				{ status: 500 }
			);
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
				Accept: 'application/json',
				'X-Subscription-Token': BRAVE_API_KEY
			},
			signal: AbortSignal.timeout(10000) // 10 second timeout
		});

		if (!response.ok) {
			console.error('Brave API error:', response.status, response.statusText);

			if (response.status === 401) {
				return json(
					{
						error: 'Invalid Brave Search API key. Please check your API key configuration.'
					},
					{ status: 401 }
				);
			}

			if (response.status === 429) {
				return json(
					{
						error: 'API rate limit exceeded. Please try again later.'
					},
					{ status: 429 }
				);
			}

			return json(
				{
					error: `Search service error: ${response.status} ${response.statusText}`
				},
				{ status: response.status }
			);
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
			.filter((result) => {
				// Check if URL ends with .pdf or contains PDF-related indicators
				const url = result.url.toLowerCase();
				return (
					url.includes('.pdf') ||
					url.includes('filetype:pdf') ||
					result.title?.toLowerCase().includes('pdf') ||
					result.description?.toLowerCase().includes('pdf')
				);
			})
			.map((result) => ({
				title: result.title || 'PDF Document',
				url: result.url,
				description: result.description || result.snippet || '',
				date: result.date,
				snippet: result.snippet
			}))
			.slice(0, 10); // Ensure we don't exceed 10 results

		const responseData = {
			results: pdfResults,
			totalResults: data.web.total_results || pdfResults.length,
			query: query.trim(),
			page
		};

		// Include CORS headers if needed
		if (corsValidation.headers) {
			return json(responseData, { headers: corsValidation.headers });
		}

		return json(responseData);
	} catch (error) {
		console.error('Search API error:', error);

		return json(
			{
				error: 'An unexpected error occurred while searching. Please try again.'
			},
			{ status: 500 }
		);
	}
};

export const OPTIONS: RequestHandler = async ({ request }) => {
	const corsValidation = validateOriginAndGetCorsHeaders(request);

	if (!corsValidation.valid) {
		return new Response(null, { status: 403 });
	}

	return new Response(null, {
		status: 200,
		headers: corsValidation.headers || {}
	});
};
