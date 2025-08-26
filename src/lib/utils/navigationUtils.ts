import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { isTauri } from './tauriUtils';

// Tauri detection is now imported from shared utility

// Dynamic import for Tauri invoke to avoid issues when not in Tauri
async function invokeCommand(command: string, payload?: any): Promise<any> {
	if (!isTauri) return null;
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		return await invoke(command, payload);
	} catch (error) {
		throw new Error(
			`Failed to invoke Tauri command "${command}": ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}

/**
 * Opens the search page:
 * - In Tauri desktop app: opens in external browser
 * - In web: opens in new tab
 * - In same window (fallback): navigates to /search
 */
export async function openSearchPage(): Promise<void> {
	if (!browser) return;

	// Use production URL for Tauri, current origin for web
	const baseUrl = isTauri ? 'https://leed.my' : window.location.origin;
	const searchUrl = `${baseUrl}/search`;

	if (isTauri) {
		try {
			// Use our custom Tauri command to open in external browser
			await invokeCommand('open_external_url', { url: searchUrl });
		} catch (error) {
			// Try fallback with shell plugin
			try {
				const { open } = await import('@tauri-apps/plugin-shell');
				await open(searchUrl);
			} catch (shellError) {
				// Final fallback to same window navigation
				await goto('/search');
			}
		}
	} else {
		// In web environment, open in new tab; popup blockers return null instead of throwing
		const newTab = window.open(searchUrl, '_blank', 'noopener,noreferrer');
	}
}

/**
 * Handles search link clicks with proper target behavior
 */
export function handleSearchLinkClick(event?: MouseEvent): void {
	// Prevent default link behavior if event is provided
	if (event) {
		event.preventDefault();
	}

	// Use our custom navigation function
	openSearchPage();
}
