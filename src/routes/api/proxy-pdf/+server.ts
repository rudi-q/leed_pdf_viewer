import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { url } = await request.json();
    
    if (!url || typeof url !== 'string') {
      throw error(400, 'Invalid URL provided');
    }
    
    // Validate URL format
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
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
    
    // Fetch the PDF with appropriate headers
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'LeedPDF-Proxy/1.0',
        'Accept': 'application/pdf,*/*',
        'Cache-Control': 'no-cache',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000) // 30 second timeout
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
    
    // Get the PDF data
    const pdfData = await response.arrayBuffer();
    
    if (pdfData.byteLength === 0) {
      throw error(502, 'Received empty response from PDF URL');
    }
    
    // Check if it looks like a PDF (starts with %PDF)
    const pdfHeader = new Uint8Array(pdfData.slice(0, 4));
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
    
  } catch (e) {
    console.error('[PDF Proxy] Error:', e);
    
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw error(504, 'Request timeout: The PDF server took too long to respond');
    }
    
    if (e instanceof Error) {
      throw error(500, `Proxy error: ${e.message}`);
    }
    
    throw error(500, 'Unknown proxy error occurred');
  }
};