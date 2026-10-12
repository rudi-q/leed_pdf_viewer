import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	handleFileUploadClick,
	handleStampToolClick
} from '../../../src/lib/utils/pageKeyboardHelpers';

describe('handleFileUploadClick', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('clicks the file input when one exists', () => {
		const input = document.createElement('input');
		input.type = 'file';
		const clickSpy = vi.spyOn(input, 'click');
		document.body.appendChild(input);

		handleFileUploadClick();

		expect(clickSpy).toHaveBeenCalledOnce();
	});

	it('does nothing when no file input exists', () => {
		expect(() => handleFileUploadClick()).not.toThrow();
	});

	it('does nothing when querySelector matches a non-input element', () => {
		const div = document.createElement('div');
		div.setAttribute('type', 'file');
		document.body.appendChild(div);
		// querySelector('input[type="file"]') won't match a div, so no-op
		expect(() => handleFileUploadClick()).not.toThrow();
	});
});

describe('handleStampToolClick', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('clicks the stamp palette button when it exists', () => {
		const container = document.createElement('div');
		container.className = 'stamp-palette-container';
		const btn = document.createElement('button');
		const clickSpy = vi.spyOn(btn, 'click');
		container.appendChild(btn);
		document.body.appendChild(container);

		handleStampToolClick();

		expect(clickSpy).toHaveBeenCalledOnce();
	});

	it('does nothing when no stamp button exists', () => {
		expect(() => handleStampToolClick()).not.toThrow();
	});
});
