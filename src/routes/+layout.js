import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import posthog from 'posthog-js'
import { browser } from '$app/environment';
import { PUBLIC_POSTHOG_KEY } from '$env/static/public';
import { isEUUser } from '$lib/utils/geoDetection';

injectAnalytics({ mode: dev ? 'development' : 'production' });

export const prerender = true;
export const ssr = false; // Disable SSR for the full client-side app

export const load = async () => {
	if (browser && !dev && PUBLIC_POSTHOG_KEY) {
		try {
			// Detect if user is from EU
			const isEU = await isEUUser();
			
			// Initialize PostHog with conditional settings
			posthog.init(
				PUBLIC_POSTHOG_KEY,
				{
					api_host: 'https://eu.i.posthog.com',
					defaults: '2025-05-24',
					// EU users get cookieless mode, non-EU users get regular analytics
					cookieless_mode: isEU ? 'always' : 'on_reject',
					person_profiles: 'always'
				}
			);
			
			console.log(`Analytics initialized: ${isEU ? 'EU (cookieless)' : 'Non-EU (with cookies)'}`);
		} catch (error) {
			console.error('Error initializing analytics with geo detection:', error);
			// Fallback to cookieless mode if geo detection fails (privacy-first)
			posthog.init(
				PUBLIC_POSTHOG_KEY,
				{
					api_host: 'https://eu.i.posthog.com',
					defaults: '2025-05-24',
					cookieless_mode: 'always',
					person_profiles: 'always'
				}
			);
		}
	}
};
