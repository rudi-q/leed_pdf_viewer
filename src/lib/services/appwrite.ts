import { Client, Databases, ID, Query, Storage } from 'appwrite';
import { browser } from '$app/environment';

import { env } from '$env/dynamic/public';

// Required environment variables for Appwrite configuration
const requiredEnvVars = [
	'PUBLIC_APPWRITE_ENDPOINT',
	'PUBLIC_APPWRITE_PROJECT_ID',
	'PUBLIC_APPWRITE_DATABASE_ID',
	'PUBLIC_APPWRITE_STORAGE_BUCKET_ID',
	'PUBLIC_APPWRITE_SHARED_PDFS_COLLECTION_ID',
	'PUBLIC_APPWRITE_PDF_ANNOTATIONS_COLLECTION_ID'
] as const;

// Check for missing environment variables
const missingVars = requiredEnvVars.filter((varName) => !env[varName]);
// For client-side code, we can detect production by checking the hostname or use a public env var
const isProduction =
	env.PUBLIC_NODE_ENV === 'production' ||
	(typeof window !== 'undefined' &&
		(window.location.hostname === 'leed.my' || window.location.hostname.endsWith('vercel.app')));

if (missingVars.length > 0) {
	const errorMessage = `Missing required Appwrite environment variables: ${missingVars.join(', ')}`;

	if (isProduction) {
		// Fail fast in production
		throw new Error(
			`${errorMessage}. Application cannot start without proper Appwrite configuration.`
		);
	} else {
		// Warn in development but continue with defaults
		console.error(`⚠️  ${errorMessage}`);
		console.error(
			'🔧 Using fallback defaults for development. Please configure these variables for production.'
		);
	}
}

// Appwrite configuration from environment variables with fallbacks
const APPWRITE_ENDPOINT = env.PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = env.PUBLIC_APPWRITE_PROJECT_ID || 'your-project-id';
const DATABASE_ID = env.PUBLIC_APPWRITE_DATABASE_ID || 'leedpdf-database';
const STORAGE_BUCKET_ID = env.PUBLIC_APPWRITE_STORAGE_BUCKET_ID || 'leedpdf-storage';

// Collection IDs from environment variables with fallbacks
export const COLLECTIONS = {
	SHARED_PDFS: env.PUBLIC_APPWRITE_SHARED_PDFS_COLLECTION_ID || 'shared-pdfs',
	PDF_ANNOTATIONS: env.PUBLIC_APPWRITE_PDF_ANNOTATIONS_COLLECTION_ID || 'pdf-annotations'
} as const;

// Initialize Appwrite client
let client: Client;
let databases: Databases;
let storage: Storage;

if (browser) {
	client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);

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
	expiresAt?: string; // ISO date string when the share expires
	isPublic: boolean;
	// Password security fields
	passwordHash?: string; // Hashed password using PBKDF2
	passwordSalt?: string; // Salt for password hashing
	// Download tracking fields
	downloadCount: number; // Current number of downloads/views
	maxDownloads?: number; // Maximum allowed downloads (undefined = unlimited)
	// Permission fields
	viewOnly?: boolean; // If true, recipients can only view, no editing
	allowDownloading?: boolean; // If false, recipients cannot download the file
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