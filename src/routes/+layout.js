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
			const posthogConfig = {
				api_host: 'https://eu.i.posthog.com',
				defaults: '2025-05-24',
				person_profiles: 'always'
			};
			
			// EU users: wait for consent banner, Non-EU users: use cookies immediately
			if (isEU) {
				posthogConfig.cookieless_mode = 'on_reject';
			}
			// For non-EU users, we omit cookieless_mode (defaults to using cookies)
			
			posthog.init(PUBLIC_POSTHOG_KEY, posthogConfig);
			
			console.log(`Analytics initialized: ${isEU ? 'EU (awaiting consent)' : 'Non-EU (with cookies)'}`);
			
			// Store EU status globally for the consent banner
			window.__isEUUser = isEU;
		} catch (error) {
			console.error('Error initializing analytics with geo detection:', error);
			// Fallback to EU mode (show consent banner) if detection fails
			posthog.init(
				PUBLIC_POSTHOG_KEY,
				{
					api_host: 'https://eu.i.posthog.com',
					defaults: '2025-05-24',
					cookieless_mode: 'on_reject',
					person_profiles: 'always'
				}
			);
			
			window.__isEUUser = true; // Default to EU mode for safety
		}
	}
};
