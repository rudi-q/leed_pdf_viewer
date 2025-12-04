/**
 * Font configuration for the text tool
 * Single source of truth for all available fonts
 */

export interface FontOption {
	id: string;
	name: string;
	fontFamily: string;
}

export const TEXT_TOOL_FONTS: FontOption[] = [
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

// Default font for new text annotations
export const DEFAULT_TEXT_FONT = TEXT_TOOL_FONTS[0].fontFamily;
