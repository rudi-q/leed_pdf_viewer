/**
 * Shared Tauri detection utility
 * 
 * This module provides a consistent way to detect if the application is running
 * in a Tauri environment across all components and utilities.
 */

/**
 * Check if running in Tauri environment
 * 
 * This function checks for various Tauri-specific globals to ensure compatibility
 * across different Tauri versions and build configurations.
 */
function detectTauri(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for various Tauri-specific globals for maximum compatibility
  return !!(
    (window as any).__TAURI__ ||
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI_IPC__ ||
    (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__
  );
}

/**
 * Cached Tauri detection result to avoid repeated checks
 * 
 * Since Tauri environment doesn't change during runtime, we can cache
 * the result for better performance.
 */
export const isTauri = detectTauri();

/**
 * Function version for cases where you need to call it dynamically
 * (though in most cases you should use the cached `isTauri` constant)
 */
export function checkIsTauri(): boolean {
  return detectTauri();
}
