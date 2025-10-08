// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Extend Window interface for our custom cleanup properties
	interface Window {
		__pdfRouteCleanup?: {
			unlistenFileOpened: Promise<() => void>;
			unlistenStartupReady: Promise<() => void>;
			unlistenDeepLink: Promise<() => void>;
			unlistenDebug: Promise<() => void>;
		};
		__pdfUploadCleanup?: {
			unlistenFileOpened: Promise<() => void>;
			unlistenStartupReady: Promise<() => void>;
			unlistenDebug: Promise<() => void>;
		};
	}
}

// Declare .svelte modules for TypeScript
declare module '*.svelte' {
	import type { ComponentType, SvelteComponent } from 'svelte';
	const component: ComponentType<SvelteComponent>;
	export default component;
}

export {};
