import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { defineConfig } from 'vite';

export const dropConsoleAndDebug = (import.meta.env?.VITE_BUILDING_TAURI === 'true') as boolean || !((import.meta.env?.VITE_DEV_MODE === 'true') as boolean)

export default defineConfig({
	plugins: [
		enhancedImages(),
		sveltekit()
	],
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
		},
		hmr: {
			port: 5173,
			host: 'localhost'
		}
	},
	build: {
		target: 'esnext',
		chunkSizeWarningLimit: 1000,
		assetsInlineLimit: 0,
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: dropConsoleAndDebug,
				drop_debugger: dropConsoleAndDebug,
				dead_code: false,
				inline: false,
				join_vars: false
			},
			mangle: {
				keep_classnames: true,
				keep_fnames: true,
			reserved: []
			},
		}
	},
	assetsInclude: ['**/*.svg']
});
