# URL-based PDF Loading Feature

This feature allows LeedPDF to load PDF files directly from URLs, enabling easy sharing and collaboration.

## How it works

Add a `pdf` query parameter to the LeedPDF URL with a direct link to a PDF file:

```
https://yourapp.com?pdf=DIRECT_PDF_URL
```

## Examples

### Dropbox Direct Download
```
https://yourapp.com?pdf=https://dropbox.com/s/abc123/document.pdf?dl=1
```

### Google Drive Direct Download
```
https://yourapp.com?pdf=https://drive.google.com/uc?export=download&id=FILE_ID
```

### Any Direct PDF URL
```
https://yourapp.com?pdf=https://example.com/public/document.pdf
```

### GitHub Raw Files
```
https://yourapp.com?pdf=https://github.com/user/repo/raw/main/document.pdf
```

## What Works

- ✅ Same drawing and annotation experience as local files
- ✅ All tools work identically (pencil, eraser, shapes, text, etc.)
- ✅ PDF export with annotations
- ✅ Zoom, pan, navigation
- ✅ Keyboard shortcuts
- ✅ Page thumbnails

## Requirements

- The URL must return a PDF file directly (not a webpage)
- The URL should be accessible without authentication
- HTTPS URLs are recommended for security

## Technical Details

- Uses PDF.js `loadFromUrl()` method
- Supports the same features as local file uploads
- Handles both File objects and URL strings internally
- Export function fetches the original PDF for annotation merging

## Security

- Only HTTP and HTTPS URLs are allowed
- URL validation prevents malicious links
- No authentication headers are sent with requests
