import os
import tempfile
from appwrite.client import Client
from pdf2docx import Converter
import json

def main(context):
    """
    Appwrite function to convert PDF to DOCX
    Expects PDF file in POST request, returns DOCX file
    """
    
    def cors_response(data, status=200, headers=None):
        """Helper to add CORS headers to all responses"""
        cors_headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Appwrite-Project'
        }
        if headers:
            cors_headers.update(headers)
        
        if isinstance(data, dict):
            return context.res.json(data, status, cors_headers)
        else:
            return context.res.send(data, status, cors_headers)
    
    try:
        # Handle CORS preflight OPTIONS request
        if context.req.method == 'OPTIONS':
            return cors_response('', 200, {
                'Access-Control-Max-Age': '86400'
            })
        
        # Only allow POST for actual processing
        if context.req.method != 'POST':
            return cors_response({
                'error': 'Only POST requests allowed'
            }, 405)
        
        # Handle both raw PDF and JSON with base64
        pdf_data = None
        
        try:
            # Check content type to determine how to handle the data
            content_type = context.req.headers.get('content-type', '').lower()
            context.log(f"Content-Type: {content_type}")
            
            if 'application/pdf' in content_type:
                # Raw PDF binary data
                if hasattr(context.req, 'bodyBinary') and context.req.bodyBinary:
                    pdf_data = context.req.bodyBinary
                    context.log(f"Using bodyBinary, size: {len(pdf_data)} bytes")
                elif hasattr(context.req, 'body') and context.req.body:
                    if isinstance(context.req.body, bytes):
                        pdf_data = context.req.body
                        context.log(f"Using body (bytes), size: {len(pdf_data)} bytes")
                    elif isinstance(context.req.body, str):
                        # Try latin-1 encoding for binary-as-string
                        pdf_data = context.req.body.encode('latin-1')
                        context.log(f"Using body (string->bytes), size: {len(pdf_data)} bytes")
                        
            elif 'application/json' in content_type:
                # Base64 encoded JSON
                import base64
                
                # Body might already be parsed as dict in Appwrite
                if hasattr(context.req, 'body') and isinstance(context.req.body, dict):
                    data = context.req.body
                    context.log("Using pre-parsed JSON body")
                else:
                    # Parse JSON manually if it's still a string
                    import json
                    body_text = context.req.bodyText if hasattr(context.req, 'bodyText') else context.req.body
                    data = json.loads(body_text)
                    context.log("Parsed JSON body manually")
                
                if 'pdf_data' in data:
                    pdf_data = base64.b64decode(data['pdf_data'])
                    context.log(f"Decoded base64 PDF, size: {len(pdf_data)} bytes")
                else:
                    return cors_response({'error': 'Missing pdf_data field'}, 400)
            
            if not pdf_data:
                return cors_response({
                    'error': 'No PDF data found. Check content-type and data format.'
                }, 400)
                
        except Exception as data_error:
            context.log(f"Error processing request data: {str(data_error)}")
            return cors_response({
                'error': f'Failed to process PDF data: {str(data_error)}'
            }, 400)
        
        # Create temporary files
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            temp_pdf.write(pdf_data)
            temp_pdf_path = temp_pdf.name
        
        with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as temp_docx:
            temp_docx_path = temp_docx.name
        
        try:
            # Convert PDF to DOCX
            cv = Converter(temp_pdf_path)
            cv.convert(temp_docx_path, start=0, end=None)
            cv.close()
            
            # Read the converted DOCX file
            with open(temp_docx_path, 'rb') as docx_file:
                docx_content = docx_file.read()
            
            # Clean up temp files
            os.unlink(temp_pdf_path)
            os.unlink(temp_docx_path)
            
            # Return the DOCX file with CORS headers
            return cors_response(
                docx_content,
                200,
                {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'Content-Disposition': 'attachment; filename="converted.docx"',
                    'Access-Control-Expose-Headers': 'Content-Disposition'
                }
            )
            
        except Exception as conversion_error:
            # Clean up temp files on error
            try:
                os.unlink(temp_pdf_path)
                os.unlink(temp_docx_path)
            except:
                pass
            
            return cors_response({
                'error': f'Conversion failed: {str(conversion_error)}'
            }, 500)
            
    except Exception as e:
        return cors_response({
            'error': f'Request processing failed: {str(e)}'
        }, 500)
