/**
 * Svelte action to trap focus within an element
 * Used for accessible modals and dialogs
 */
export function trapFocus(node: HTMLElement) {
    const previousActiveElement = document.activeElement as HTMLElement;

    // Focusable elements selector
    const focusableSelector =
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, details, [tabindex]:not([tabindex="-1"])';

    function getFocusableElements(): HTMLElement[] {
        return Array.from(node.querySelectorAll(focusableSelector)) as HTMLElement[];
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) {
            event.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey) {
            // Shift + Tab
            if (activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    }

    // Move focus to first element inside the trap
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
        focusableElements[0].focus();
    } else {
        // Fallback if no focusable elements found
        node.focus();
    }

    window.addEventListener('keydown', handleKeydown);

    return {
        destroy() {
            window.removeEventListener('keydown', handleKeydown);
            if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
                previousActiveElement.focus();
            }
        }
    };
}
