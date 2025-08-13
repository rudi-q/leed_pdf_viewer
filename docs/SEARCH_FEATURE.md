# PDF Search Feature

The PDF Search feature allows users to search for PDF documents across the web using the Brave Search API and open them directly in LeedPDF for annotation.

## Setup Instructions

### 1. Get a Brave Search API Key

1. Visit [Brave Search API](https://api.search.brave.com/app/keys)
2. Sign up for a free account
3. Generate an API key (free tier includes 2000 queries per month)

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your API key to `.env`:
   ```
   BRAVE_SEARCH_API_KEY=your_actual_api_key_here
   ```

### 3. Development Setup

The search feature is already integrated into the project. After setting up the API key, users can:

- Click the "Search PDFs" button on the welcome screen
- Use the search icon in the toolbar while viewing a PDF
- Navigate directly to `/search`

## Features

### Search Functionality
- **PDF-focused search**: Automatically appends `filetype:pdf` to search queries
- **Real-time results**: Fast search powered by Brave Search API
- **Pagination**: Browse through multiple pages of results
- **Result filtering**: Filters results to prioritize actual PDF documents

### Integration with LeedPDF
- **Direct PDF opening**: Click "Open in LeedPDF" to load PDFs directly
- **Original link access**: Option to visit the original source
- **Seamless workflow**: Search → Open → Annotate in one flow

### User Experience
- **Responsive design**: Works on desktop and mobile devices
- **Dark mode support**: Follows LeedPDF's theme system
- **Loading states**: Clear feedback during search operations
- **Error handling**: Graceful error messages for API issues

## Technical Implementation

### Backend API (`/api/search`)
- Built with SvelteKit API routes
- Handles Brave Search API integration
- Implements rate limiting and error handling
- Filters and processes search results

### Frontend (`/search`)
- Clean, Google-like search interface
- Real-time search with URL parameter support
- Pagination and result management
- Mobile-responsive design

### Search Flow
1. User enters search query
2. Frontend sends request to `/api/search`
3. Backend queries Brave Search API with `filetype:pdf`
4. Results are filtered and formatted
5. User can open PDFs directly in LeedPDF

## API Rate Limits

- **Free tier**: 2000 queries per month
- **Paid tiers**: Available for higher usage
- **Rate limiting**: Built-in handling for API limits

## Security Considerations

- API key stored as environment variable
- No user data stored or logged
- Direct PDF URLs are validated before opening
- CORS properly configured for API endpoints

## Future Enhancements

- [ ] Search history and favorites
- [ ] Advanced search filters (date, file size, domain)
- [ ] Preview thumbnails for PDF results
- [ ] Integration with academic databases
- [ ] Saved searches and alerts

## Troubleshooting

### Common Issues

1. **"API key not configured"**
   - Ensure `BRAVE_SEARCH_API_KEY` is set in `.env`
   - Restart the development server after adding the key

2. **"Rate limit exceeded"**
   - You've exceeded your monthly quota
   - Consider upgrading to a paid plan or wait for quota reset

3. **"No PDFs found"**
   - Try different search terms
   - Some queries may not return PDF results

### API Key Validation

Test your API key setup:
```bash
curl -H "Accept: application/json" \
     -H "X-Subscription-Token: YOUR_API_KEY" \
     "https://api.search.brave.com/res/v1/web/search?q=machine%20learning%20filetype:pdf&count=5"
```

## Contributing

When contributing to the search feature:

1. Test with various search queries
2. Ensure mobile responsiveness
3. Handle edge cases (no results, API errors)
4. Update documentation for new features
5. Consider accessibility requirements

## License

This feature is part of LeedPDF and follows the same open-source license.
