import adapterVercel from '@sveltejs/adapter-vercel';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use static adapter for Tauri builds, Vercel adapter for web deployments
const isTauriBuild = process.env.VITE_BUILDING_TAURI === 'true';
const adapter = isTauriBuild 
	? adapterStatic({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		})
	: adapterVercel();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter
	}
};

export default config;
