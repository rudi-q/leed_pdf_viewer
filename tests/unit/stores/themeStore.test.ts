import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { isDarkMode, toggleTheme } from '../../../src/lib/stores/themeStore';

describe('themeStore', () => {
	beforeEach(() => {
		isDarkMode.set(false);
	});

	afterEach(() => {
		isDarkMode.set(false);
	});

	it('starts as light mode', () => {
		expect(get(isDarkMode)).toBe(false);
	});

	it('toggleTheme switches to dark', () => {
		toggleTheme();
		expect(get(isDarkMode)).toBe(true);
	});

	it('toggleTheme switches back to light', () => {
		toggleTheme();
		toggleTheme();
		expect(get(isDarkMode)).toBe(false);
	});

	it('isDarkMode can be set directly', () => {
		isDarkMode.set(true);
		expect(get(isDarkMode)).toBe(true);
	});

	it('multiple toggles alternate correctly', () => {
		for (let i = 1; i <= 6; i++) {
			toggleTheme();
			expect(get(isDarkMode)).toBe(i % 2 === 1);
		}
	});
});
