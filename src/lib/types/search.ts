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
}
