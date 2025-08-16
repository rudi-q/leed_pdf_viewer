// Disable prerendering for this dynamic route since we can't know all possible template names in advance
export const prerender = false;

// Load function to validate template exists and pass template info to the page
export async function load({ params, fetch, url }) {
    const { templateName } = params;
    
    // Construct the relative URL to the template PDF in static assets
    const relativeUrl = `/templates/${templateName}.pdf`;
    
    // Construct the absolute URL for PDF.js
    const templateUrl = new URL(relativeUrl, url.origin).toString();
    
    try {
        // Check if the template exists by attempting to fetch it
        const response = await fetch(relativeUrl, { method: 'HEAD' });
        
        if (!response.ok) {
            throw new Error(`Template "${templateName}" not found`);
        }
        
        return {
            templateName,
            templateUrl,
            exists: true
        };
    } catch (error) {
        // Template doesn't exist, return error info
        return {
            templateName,
            templateUrl: null,
            exists: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
