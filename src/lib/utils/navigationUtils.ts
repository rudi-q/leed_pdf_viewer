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
 * Opens a URL in the external browser (Tauri) or new tab (web)
 */
export async function openExternalUrl(url: string): Promise<void> {
	if (!browser) return;

	console.log('[openExternalUrl] Opening URL:', url, 'isTauri:', isTauri);

	if (isTauri) {
		try {
			console.log('[openExternalUrl] Attempting to use Tauri command...');
			// Use our custom Tauri command to open in external browser
			await invokeCommand('open_external_url', { url });
			console.log('[openExternalUrl] Successfully opened via Tauri command');
		} catch (error) {
			console.error('[openExternalUrl] Tauri command failed:', error);
			// Try fallback with shell plugin
			try {
				console.log('[openExternalUrl] Trying shell plugin fallback...');
				const { open } = await import('@tauri-apps/plugin-shell');
				await open(url);
				console.log('[openExternalUrl] Successfully opened via shell plugin');
			} catch (shellError) {
				console.error('[openExternalUrl] Shell plugin fallback failed:', shellError);
				// Final fallback to window.open (may not work in Tauri but worth trying)
				console.log('[openExternalUrl] Trying window.open as last resort...');
				window.open(url, '_blank');
			}
		}
	} else {
		// In web environment, open in new tab
		console.log('[openExternalUrl] Opening in web environment...');
		window.open(url, '_blank', 'noopener,noreferrer');
	}
}

/**
 * Navigates to the home page with proper handling for different environments
 */
export async function navigateToHome(): Promise<void> {
	if (!browser) return;

	if (isTauri) {
		// In Tauri, use multiple fallback strategies for reliable navigation
		try {
			// Strategy 1: SvelteKit navigation with forced state reset
			await goto('/', { replaceState: true, invalidateAll: true });

			// Strategy 2: Fallback to window.location if SvelteKit doesn't work
			setTimeout(() => {
				if (typeof window !== 'undefined' && window.location.pathname !== '/') {
					window.location.href = '/';
				}
			}, 100);
		} catch (error) {
			console.warn('SvelteKit navigation failed in Tauri, using window.location:', error);
			if (typeof window !== 'undefined') {
				window.location.href = '/';
			}
		}
	} else {
		// Standard web navigation
		await goto('/');
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
