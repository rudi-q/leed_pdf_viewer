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
		assetsInlineLimit: 0,
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				dead_code: false,
				inline: false,
				join_vars: false
			},
			mangle: {
				keep_classnames: true,
				keep_fnames: true,
				reserved: [
					'Konva',
					'Stage',
					'Layer',
					'Shape',
					'Circle',
					'Rect',
					'Text',
					'Group',
					'Image',
					'Line',
					'Path',
					'Sprite',
					'Transformer',
					'Node',        // Base class for Konva objects
					'Container',   // Base class for Stage, Layer, Group
				],
			},
		}
	},
	assetsInclude: ['**/*.svg']
});
