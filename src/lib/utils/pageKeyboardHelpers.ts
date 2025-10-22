/**
 * Shared keyboard helper functions used across page components.
 * These are stateless DOM utilities that don't depend on component state.
 */

/**
 * Triggers the file input click to open the file picker dialog.
 */
export function handleFileUploadClick(): void {
	(document.querySelector('input[type="file"]') as HTMLInputElement)?.click();
}

/**
 * Triggers the stamp palette button click to open the stamp selector.
 */
export function handleStampToolClick(): void {
	const stampButton = document.querySelector('.stamp-palette-container button');
	if (stampButton) {
		(stampButton as HTMLButtonElement).click();
	}
}
