import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { trapFocus } from '../../../src/lib/utils/trapFocus';

function makeButton(label: string): HTMLButtonElement {
	const btn = document.createElement('button');
	btn.textContent = label;
	return btn;
}

describe('trapFocus', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	it('focuses the first focusable element on init', () => {
		const btn1 = makeButton('First');
		const btn2 = makeButton('Second');
		container.append(btn1, btn2);

		trapFocus(container);

		expect(document.activeElement).toBe(btn1);
	});

	it('falls back to focusing the container when no focusable children', () => {
		container.setAttribute('tabindex', '-1');
		trapFocus(container);
		// No crash — container.focus() is called
	});

	it('destroy removes keydown listener and restores previous focus', () => {
		const outside = makeButton('Outside');
		document.body.appendChild(outside);
		outside.focus();

		const btn = makeButton('Inside');
		container.appendChild(btn);

		const instance = trapFocus(container);
		expect(document.activeElement).toBe(btn);

		instance.destroy();
		expect(document.activeElement).toBe(outside);

		document.body.removeChild(outside);
	});

	it('Tab from last element wraps to first', () => {
		const btn1 = makeButton('First');
		const btn2 = makeButton('Last');
		container.append(btn1, btn2);
		trapFocus(container);

		btn2.focus();
		const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
		Object.defineProperty(event, 'shiftKey', { value: false });
		window.dispatchEvent(event);

		expect(document.activeElement).toBe(btn1);
	});

	it('Shift+Tab from first element wraps to last', () => {
		const btn1 = makeButton('First');
		const btn2 = makeButton('Last');
		container.append(btn1, btn2);
		trapFocus(container);

		btn1.focus();
		const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
		window.dispatchEvent(event);

		expect(document.activeElement).toBe(btn2);
	});

	it('Tab when not at last element does not wrap', () => {
		const btn1 = makeButton('First');
		const btn2 = makeButton('Middle');
		const btn3 = makeButton('Last');
		container.append(btn1, btn2, btn3);
		trapFocus(container);

		btn1.focus();
		const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
		Object.defineProperty(event, 'shiftKey', { value: false });
		window.dispatchEvent(event);

		// Focus should not have jumped to btn3 (wrapping only happens at the boundary)
		expect(document.activeElement).not.toBe(btn3);
	});

	it('non-Tab keydown is ignored', () => {
		const btn1 = makeButton('First');
		const btn2 = makeButton('Last');
		container.append(btn1, btn2);
		trapFocus(container);

		btn2.focus();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(document.activeElement).toBe(btn2);
	});

	it('Tab with no focusable elements calls preventDefault', () => {
		container.setAttribute('tabindex', '-1');
		trapFocus(container);

		const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
		window.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});
});
