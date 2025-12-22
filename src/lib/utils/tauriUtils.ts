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

/**
 * Detect operating system from userAgent and platform strings
 * 
 * @deprecated This function uses unreliable userAgent/platform sniffing.
 * Use the Tauri OS plugin instead: `import { platform } from '@tauri-apps/plugin-os'`
 * and call `await platform()` which returns 'macos', 'windows', 'linux', etc.
 * 
 * @returns OS name: 'Windows', 'macOS', 'Linux', or 'Unknown'
 */
export function detectOS(): string {
	if (typeof window === 'undefined') return 'Unknown';

	const userAgent = window.navigator.userAgent;
	const platform = window.navigator.platform;

	if (userAgent.includes('Windows') || platform.includes('Win')) {
		return 'Windows';
	} else if (userAgent.includes('Mac') || platform.includes('Mac')) {
		return 'macOS';
	} else if (userAgent.includes('Linux') || platform.includes('Linux')) {
		return 'Linux';
	}
	return 'Unknown';
}
