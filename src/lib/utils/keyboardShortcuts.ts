import { setTool, undo, redo } from '$lib/stores/drawingStore';

export interface KeyboardShortcutsParams {
	pdfViewer: {
		zoomIn: () => void;
		zoomOut: () => void;
		resetZoom: () => void;
		previousPage: () => void;
		nextPage: () => void;
		fitToHeight: () => void;
		fitToWidth: () => void;
	} | null;
	showShortcuts: boolean;
	showThumbnails: boolean;
	focusMode: boolean;
	onShowShortcutsChange: (value: boolean) => void;
	onShowThumbnailsChange: (value: boolean) => void;
	onFocusModeChange: (value: boolean) => void;
	onFileUploadClick: () => void;
	onStampToolClick: () => void;
}

/**
 * Svelte action for handling keyboard shortcuts across the application.
 * Provides a DRY approach to keyboard event handling.
 * 
 * @param node - The DOM element to attach the keyboard listener to (typically window)
 * @param params - Configuration object with callbacks and state
 */
export function keyboardShortcuts(node: Window | HTMLElement, params: KeyboardShortcutsParams) {
	function handleKeyboard(event: Event) {
		if (!(event instanceof KeyboardEvent)) return;
		
		const isTyping = 
			event.target instanceof HTMLInputElement || 
			event.target instanceof HTMLTextAreaElement ||
			(event.target instanceof HTMLElement && event.target.isContentEditable);
		if (isTyping && event.key !== 'Escape') {
			return;
		}

		if (event.ctrlKey || event.metaKey) {
			switch (event.key) {
				case 'z':
					if (event.shiftKey) {
						event.preventDefault();
						redo();
					} else {
						event.preventDefault();
						undo();
					}
					break;
				case 'y':
					event.preventDefault();
					redo();
					break;
				case '=':
				case '+':
					event.preventDefault();
					params.pdfViewer?.zoomIn();
					break;
				case '-':
					event.preventDefault();
					params.pdfViewer?.zoomOut();
					break;
				case '0':
					event.preventDefault();
					params.pdfViewer?.resetZoom();
					break;
			}
		} else {
			switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				params.pdfViewer?.previousPage();
				break;
			case 'ArrowRight':
				event.preventDefault();
				params.pdfViewer?.nextPage();
				break;
				case '1':
					event.preventDefault();
					setTool('pencil');
					break;
				case '2':
					event.preventDefault();
					setTool('eraser');
					break;
				case '3':
					event.preventDefault();
					setTool('text');
					break;
				case '4':
					event.preventDefault();
					setTool('arrow');
					break;
				case '5':
					event.preventDefault();
					setTool('highlight');
					break;
				case '6':
					event.preventDefault();
					setTool('note');
					break;
				case '7':
					event.preventDefault();
					setTool('select');
					break;
				case 'h':
				case 'H':
					event.preventDefault();
					params.pdfViewer?.fitToHeight();
					break;
				case 'w':
				case 'W':
					event.preventDefault();
					params.pdfViewer?.fitToWidth();
					break;
				case '?':
					event.preventDefault();
					params.onShowShortcutsChange(true);
					break;
				case 'F1':
					event.preventDefault();
					params.onShowShortcutsChange(true);
					break;
				case 't':
				case 'T':
					event.preventDefault();
					params.onShowThumbnailsChange(!params.showThumbnails);
					break;
				case 'u':
				case 'U':
					event.preventDefault();
					params.onFileUploadClick();
					break;
				case 'f':
				case 'F':
					event.preventDefault();
					params.onFocusModeChange(!params.focusMode);
					break;
				case 's':
				case 'S':
					event.preventDefault();
					setTool('stamp');
					params.onStampToolClick();
					break;
			}
		}
	}

	node.addEventListener('keydown', handleKeyboard);

	return {
		update(newParams: KeyboardShortcutsParams) {
			// Update params when they change
			params = newParams;
		},
		destroy() {
			node.removeEventListener('keydown', handleKeyboard);
		}
	};
}
