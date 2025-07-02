import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			manifest: {
				short_name: 'LeedPDF',
				name: 'LeedPDF - PDF Viewer & Annotator',
				start_url: '/',
				display: 'standalone',
				theme_color: '#8B9474',
				background_color: '#FDF6E3',
				description: 'A vibey PDF viewer where you can draw, sketch, and annotate with the smoothness of pencil on paper',
				icons: [
					{
						src: 'favicon.png',
						sizes: '192x192',
						type: 'image/png'
					}
				]
			},
			registerType: 'autoUpdate',
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
				cleanupOutdatedCaches: true
			}
		})
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
		assetsInlineLimit: 0, // Don't inline assets, keep them as separate files
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true
			}
		}
	},
	assetsInclude: ['**/*.svg'] // Ensure SVG files are included as assets
});
