/**
 * Font configuration for the text tool
 * Single source of truth for all available fonts
 * 
 * In the web app, only bundled fonts are available.
 * In the Tauri desktop app (Windows, macOS, Linux), system fonts are dynamically added.
 */

export interface FontOption {
	id: string;
	name: string;
	fontFamily: string;
	isSystemFont?: boolean;
}

// Bundled fonts that work on both web and desktop
export const BUNDLED_FONTS: FontOption[] = [
	{
		id: 'reenie',
		name: 'Reenie Beanie',
		fontFamily: 'ReenieBeanie, cursive'
	},
	{
		id: 'inter',
		name: 'Inter',
		fontFamily: 'Inter, sans-serif'
	},
	{
		id: 'lora',
		name: 'Lora',
		fontFamily: 'Lora, serif'
	},
	{
		id: 'urbanist',
		name: 'Urbanist',
		fontFamily: 'Urbanist, sans-serif'
	}
];

// Legacy export for backwards compatibility
export const TEXT_TOOL_FONTS = BUNDLED_FONTS;

// Default font for new text annotations
export const DEFAULT_TEXT_FONT = BUNDLED_FONTS[0].fontFamily;

/**
 * Convert a system font name to a FontOption
 */
export function systemFontToOption(fontName: string): FontOption {
	// Create a safe ID from the font name
	const id = `system-${fontName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

	return {
		id,
		name: fontName,
		fontFamily: `"${fontName}", sans-serif`,
		isSystemFont: true
	};
}

/**
 * Fetch system fonts from Tauri backend (all desktop platforms)
 * Uses font-kit for native cross-platform font enumeration
 * Returns empty array if not running in Tauri or if API is unavailable
 */
export async function fetchSystemFonts(): Promise<FontOption[]> {
	try {
		// Check if we're running in Tauri
		const { invoke } = await import('@tauri-apps/api/core');

		// Call the Rust backend to get system fonts
		const fontNames = await invoke<string[]>('get_system_fonts');

		if (!fontNames || fontNames.length === 0) {
			console.log('No system fonts returned from Tauri backend');
			return [];
		}

		console.log(`Loaded ${fontNames.length} system fonts from Windows`);

		// Convert font names to FontOption objects
		// Filter out fonts that are already in bundled fonts
		const bundledFontNames = new Set(BUNDLED_FONTS.map(f => f.name.toLowerCase()));

		return fontNames
			.filter(name => !bundledFontNames.has(name.toLowerCase()))
			.map(systemFontToOption);
	} catch (error) {
		// Not running in Tauri or Tauri API not available
		console.log('System fonts not available (not in Tauri or API error):', error);
		return [];
	}
}

/**
 * Get all available fonts (bundled + system fonts if in Tauri)
 * This is an async function that should be called once at app initialization
 */
export async function getAllAvailableFonts(): Promise<FontOption[]> {
	const systemFonts = await fetchSystemFonts();

	// Bundled fonts first, then system fonts alphabetically
	return [...BUNDLED_FONTS, ...systemFonts];
}
