// File loading configuration
export const MAX_FILE_LOADING_ATTEMPTS = 10;

// File size limits (in bytes)
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const WARNING_FILE_SIZE = 15 * 1024 * 1024; // 15MB
export const SESSION_MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB for sessionStorage fallback

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
