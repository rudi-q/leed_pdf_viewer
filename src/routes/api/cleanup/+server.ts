import { json } from '@sveltejs/kit';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '$lib/services/appwrite.js';

export async function POST() {
  try {
    const now = new Date().toISOString();
    
    // Find expired shared PDFs
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SHARED_PDFS,
      [Query.lessThan('expiresAt', now)]
    );
    
    let cleanedCount = 0;
    
    // Delete expired documents and their associated files
    for (const doc of response.documents) {
      try {
        // Delete database record (files are handled by Appwrite's cleanup)
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SHARED_PDFS, doc.$id);
        cleanedCount++;
      } catch (error) {
        console.error(`Failed to delete expired document ${doc.$id}:`, error);
      }
    }
    
    return json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} expired shared PDFs`
    });
    
  } catch (error) {
    console.error('Cleanup operation failed:', error);
    return json({
      success: false,
      error: 'Cleanup operation failed'
    }, { status: 500 });
  }
}