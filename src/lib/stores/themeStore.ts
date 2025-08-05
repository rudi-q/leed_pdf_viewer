import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Theme store
export const isDarkMode = writable(false);

// Initialize theme from localStorage or system preference
if (browser) {
	const savedTheme = localStorage.getItem('leedpdf-theme');

	if (savedTheme) {
		// Use saved preference
		const isDark = savedTheme === 'dark';
		isDarkMode.set(isDark);
		document.documentElement.classList.toggle('dark', isDark);
	} else {
		// Check system preference
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		isDarkMode.set(prefersDark);
		document.documentElement.classList.toggle('dark', prefersDark);
	}
}

// Toggle theme function
export const toggleTheme = () => {
	isDarkMode.update((dark) => {
		const newTheme = !dark;

		if (browser) {
			// Save to localStorage
			localStorage.setItem('leedpdf-theme', newTheme ? 'dark' : 'light');

			// Apply to document
			document.documentElement.classList.toggle('dark', newTheme);
		}

		return newTheme;
	});
};

// Listen for system theme changes
if (browser) {
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', (e) => {
		// Only update if user hasn't manually set a preference
		const savedTheme = localStorage.getItem('leedpdf-theme');
		if (!savedTheme) {
			isDarkMode.set(e.matches);
			document.documentElement.classList.toggle('dark', e.matches);
		}
	});
}
