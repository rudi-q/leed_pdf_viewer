import { isTauri } from '$lib/utils/tauriUtils';

// File size limits (in bytes)
export const MAX_FILE_SIZE = isTauri ? 500 * 1024 * 1024 : 100 * 1024 * 1024; // 500MB for Desktop, 100MB for Web
export const WARNING_FILE_SIZE = 15 * 1024 * 1024; // 15MB
export const SESSION_MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB for sessionStorage fallback

// LPDF security limits
export const LPDF_MAX_PDF_SIZE = MAX_FILE_SIZE; // Max size for PDF inside LPDF
export const LPDF_MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB max for annotations.json
export const LPDF_MAX_TOTAL_UNCOMPRESSED = 100 * 1024 * 1024; // 100MB max total uncompressed size

// Storage configuration
export const MAX_STORAGE_TIME = 2 * 60 * 60 * 1000; // 2 hours
export const AUTO_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

// UI configuration
export const DRAG_OVERLAY_Z_INDEX = 40;
export const TOOLBAR_Z_INDEX = 50;
export const TOOLBAR_HEIGHT = 100; // Height in pixels for toolbar and page info spacing

// Animation durations (in milliseconds)
export const TRANSITION_DURATION = 200;
export const HOVER_TRANSITION_DURATION = 300;
