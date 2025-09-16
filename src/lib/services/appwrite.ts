import { Client, Databases, Storage, ID, Query } from 'appwrite';
import { browser } from '$app/environment';

import { env } from '$env/dynamic/public';

// Appwrite configuration from environment variables
const APPWRITE_ENDPOINT = env.PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = env.PUBLIC_APPWRITE_PROJECT_ID || 'your-project-id';
const DATABASE_ID = env.PUBLIC_APPWRITE_DATABASE_ID || 'leedpdf-database';
const STORAGE_BUCKET_ID = env.PUBLIC_APPWRITE_STORAGE_BUCKET_ID || 'leedpdf-storage';

// Collection IDs from environment variables
export const COLLECTIONS = {
  SHARED_PDFS: env.PUBLIC_APPWRITE_SHARED_PDFS_COLLECTION_ID || 'shared-pdfs',
  PDF_ANNOTATIONS: env.PUBLIC_APPWRITE_PDF_ANNOTATIONS_COLLECTION_ID || 'pdf-annotations'
} as const;

// Initialize Appwrite client
let client: Client;
let databases: Databases;
let storage: Storage;

if (browser) {
  client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

  databases = new Databases(client);
  storage = new Storage(client);
}

export { client, databases, storage, DATABASE_ID, STORAGE_BUCKET_ID, ID, Query };

// Types for our data structures
export interface SharedPDF {
  $id?: string;
  shareId: string;
  originalFileName: string;
  pdfStorageId: string; // Reference to PDF file in storage
  annotationsStorageId?: string; // Reference to annotations file in storage
  createdAt: string;
  expiresAt?: string;
  isPublic: boolean;
  password?: string;
  downloadCount: number;
  maxDownloads?: number;
  metadata?: {
    fileSize: number;
    pageCount: number;
    hasAnnotations: boolean;
  };
}

export interface PDFAnnotationData {
  $id?: string;
  shareId: string;
  annotationType: 'drawing' | 'text' | 'sticky' | 'stamp' | 'arrow';
  pageNumber: number;
  data: string; // JSON stringified annotation data
  createdAt: string;
}