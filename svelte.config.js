import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-static for static site generation
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '200.html', // Important for SPA mode
			precompress: true,
			strict: true
		})
	}
};

export default config;
