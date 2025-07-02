import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['pdfjs-dist'],
		exclude: ['pdfjs-dist/build/pdf.worker.mjs']
	},
	worker: {
		format: 'es'
	},
	server: {
		fs: {
			allow: ['..', 'node_modules/pdfjs-dist']
		},
		headers: {
			'Cache-Control': 'public, max-age=31536000',
		}
	},
	build: {
		target: 'esnext',
		chunkSizeWarningLimit: 1000,
		assetsInlineLimit: 0 // Don't inline assets, keep them as separate files
	},
	assetsInclude: ['**/*.svg'] // Ensure SVG files are included as assets
});
