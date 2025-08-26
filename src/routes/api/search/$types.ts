import type { RequestHandler as GenericRequestHandler } from '@sveltejs/kit';

export interface SearchRequest {
	query: string;
	page?: number;
}

export interface SearchResult {
	title: string;
	url: string;
	description: string;
	date?: string;
	snippet?: string;
}

export interface SearchResponse {
	results: SearchResult[];
	totalResults: number;
	query: string;
	page?: number;
	error?: string;
}

export type RequestHandler = GenericRequestHandler;
