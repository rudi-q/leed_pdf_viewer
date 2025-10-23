/**
 * Shared keyboard helper functions used across page components.
 * These are stateless DOM utilities that don't depend on component state.
 */

/**
 * Triggers the file input click to open the file picker dialog.
 * Safe for SSR - only executes in browser environment.
 */
export function handleFileUploadClick(): void {
	if (typeof document === 'undefined') return;
	const input = document.querySelector('input[type="file"]');
	if (input instanceof HTMLInputElement) {
		input.click();
	}
}

/**
 * Triggers the stamp palette button click to open the stamp selector.
 * Safe for SSR - only executes in browser environment.
 */
export function handleStampToolClick(): void {
	if (typeof document === 'undefined') return;
	const stampButton = document.querySelector('.stamp-palette-container button');
	if (stampButton instanceof HTMLButtonElement) {
		stampButton.click();
	}
}
