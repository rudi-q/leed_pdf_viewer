import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Security constants
const MAX_URL_LENGTH = 2048; // Industry standard URL length limit
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB - smaller than upload limit for proxy safety
const TIMEOUT_MS = 30000; // 30 seconds
const CHUNK_SIZE = 64 * 1024; // 64KB chunks for streaming

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      throw error(400, 'Invalid URL provided');
    }
    
    // Validate URL length to prevent DoS
    const trimmedUrl = url.trim();
    if (trimmedUrl.length === 0) {
      throw error(400, 'URL cannot be empty');
    }
    if (trimmedUrl.length > MAX_URL_LENGTH) {
      throw error(413, `URL too long: maximum ${MAX_URL_LENGTH} characters allowed`);
    }
    
    // Validate URL format
    let targetUrl: URL;
    try {
      targetUrl = new URL(trimmedUrl);
    } catch (e) {
      throw error(400, 'Invalid URL format');
    }
    
    // Security: Only allow HTTPS URLs (and HTTP for localhost/development)
    if (targetUrl.protocol !== 'https:' && 
        !(targetUrl.protocol === 'http:' && (
          targetUrl.hostname === 'localhost' || 
          targetUrl.hostname === '127.0.0.1' ||
          targetUrl.hostname.endsWith('.local')
        ))) {
      throw error(400, 'Only HTTPS URLs are allowed (except localhost for development)');
    }
    
    console.log('[PDF Proxy] Fetching PDF from:', targetUrl.toString());
    
    // Create AbortController for timeout and size limit control
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);
    
    try {
      // Fetch the PDF with enhanced security headers
      const response = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'LeedPDF-Proxy/1.0',
          'Accept': 'application/pdf,*/*',
          'Cache-Control': 'no-cache',
          'DNT': '1', // Do Not Track header
        },
        signal: abortController.signal
      });
      
      if (!response.ok) {
        console.error('[PDF Proxy] Failed to fetch PDF:', response.status, response.statusText);
        throw error(502, `Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      // Verify content type
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('pdf') && !contentType.includes('octet-stream')) {
        console.warn('[PDF Proxy] Unexpected content type:', contentType);
      }
      
      // Check Content-Length if available
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > MAX_PDF_SIZE) {
          throw error(413, `PDF too large: ${Math.round(contentLength / 1024 / 1024)}MB exceeds limit of ${Math.round(MAX_PDF_SIZE / 1024 / 1024)}MB`);
        }
        console.log('[PDF Proxy] Content-Length:', contentLength, 'bytes');
      }
      
      // Stream the response with size validation
      const reader = response.body?.getReader();
      if (!reader) {
        throw error(502, 'Cannot read response body');
      }
      
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          if (value) {
            totalSize += value.length;
            
            // Enforce size limit during streaming
            if (totalSize > MAX_PDF_SIZE) {
              reader.cancel();
              throw error(413, `PDF too large: exceeds limit of ${Math.round(MAX_PDF_SIZE / 1024 / 1024)}MB during download`);
            }
            
            chunks.push(value);
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      // Combine all chunks
      const pdfData = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        pdfData.set(chunk, offset);
        offset += chunk.length;
      }
      
      if (pdfData.byteLength === 0) {
        throw error(502, 'Received empty response from PDF URL');
      }
    
      // Check if it looks like a PDF (starts with %PDF)
      const pdfHeader = pdfData.slice(0, 4);
      const pdfSignature = String.fromCharCode(...pdfHeader);
      if (pdfSignature !== '%PDF') {
        throw error(502, 'Response does not appear to be a valid PDF file');
      }
      
      console.log('[PDF Proxy] Successfully proxied PDF:', pdfData.byteLength, 'bytes');
      
      // Return the PDF data as base64 to avoid binary JSON issues
      const base64Data = Buffer.from(pdfData).toString('base64');
      
      return json({
        success: true,
        data: base64Data,
        size: pdfData.byteLength,
        contentType: contentType || 'application/pdf'
      });
      
    } finally {
      // Clean up timeout
      clearTimeout(timeoutId);
    }
    
  } catch (e) {
    console.error('[PDF Proxy] Error:', e);
    
    // Handle specific error types
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw error(504, 'Request timeout: The PDF server took too long to respond');
    }
    
    if (e instanceof Error) {
      throw error(500, `Proxy error: ${e.message}`);
    }
    
    throw error(500, 'Unknown proxy error occurred');
  }
};