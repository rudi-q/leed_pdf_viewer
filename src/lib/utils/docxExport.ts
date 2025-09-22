import { PDFExporter } from './pdfExport';
import { toastStore } from '$lib/stores/toastStore';

/**
 * Export annotated PDF to DOCX format using server-side conversion
 */
export async function exportPDFToDocx(
	pdfBytes: Uint8Array, 
	filename: string = 'document'
): Promise<boolean> {
	try {
		console.log('Starting DOCX export...', { filename, size: pdfBytes.length });
		
		// Show loading toast
		toastStore.info('Converting PDF to DOCX', 'Please wait while we convert your annotated PDF...');
		
		// Convert PDF bytes to base64
		const base64PDF = btoa(String.fromCharCode(...pdfBytes));
		
		// Prepare payload matching server's expected format
		const payload = {
			pdf_data: base64PDF
		};
		
		console.log('Sending request to conversion server...');
		console.log('Payload size:', JSON.stringify(payload).length, 'characters');
		console.log('Base64 PDF size:', base64PDF.length, 'characters');
		
		// Call the server function - remove query params to avoid CORS preflight
		let response: Response;
		try {
			response = await fetch(
				'https://68d0f8e2003044d7955f.fra.appwrite.run/',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(payload)
				}
			);
		} catch (fetchError) {
			console.error('Network error during fetch:', fetchError);
			throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Failed to connect to server'}`);
		}
		
		console.log('Response status:', response.status, response.statusText);
		console.log('Response headers:', Object.fromEntries(response.headers.entries()));
		
		if (!response.ok) {
			let errorText = '';
			try {
				errorText = await response.text();
				console.error('Server error response:', errorText);
			} catch {
				console.error('Could not read error response');
			}
			throw new Error(`Server error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
		}
		
		console.log('Conversion successful, downloading DOCX...');
		
		// Get DOCX binary data
		const docxBlob = await response.blob();
		
		// Generate filename
		const docxFilename = filename.replace(/\.pdf$/i, '') + '.docx';
		
		// Use existing export system
		const success = await PDFExporter.exportFile(
			new Uint8Array(await docxBlob.arrayBuffer()),
			docxFilename,
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		);
		
		if (success) {
			toastStore.success('DOCX Export Complete', `Successfully exported ${docxFilename}`);
		}
		
		return success;
		
	} catch (error) {
		console.error('DOCX export failed:', error);
		
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		toastStore.error('DOCX Export Failed', `Failed to convert PDF to DOCX: ${errorMessage}`);
		
		return false;
	}
}

/**
 * Export current PDF with annotations to DOCX format
 */
export async function exportCurrentPDFAsDocx(
	pdfBytes: Uint8Array,
	fileName: string = 'document.pdf'
): Promise<boolean> {
	return await exportPDFToDocx(pdfBytes, fileName);
}