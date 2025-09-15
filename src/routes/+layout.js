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
		// Check if PostHog is already initialized to prevent duplicate initialization
		if (window.__posthogInitialized) {
			console.log('PostHog already initialized, skipping...');
			return;
		}
		
		try {
			// Check if EU status is already determined to avoid redundant API calls
			let isEU;
			if (typeof window.__isEUUser !== 'undefined') {
				isEU = window.__isEUUser;
				console.log('Reusing cached EU status:', isEU);
			} else {
				// First time - detect if user is from EU
				isEU = await isEUUser();
				window.__isEUUser = isEU;
				console.log('Detected EU status:', isEU);
			}
			
			// Initialize PostHog with conditional settings
			if (isEU) {
				// EU users: wait for consent banner
				posthog.init(PUBLIC_POSTHOG_KEY, {
					api_host: 'https://eu.i.posthog.com',
					cookieless_mode: 'on_reject',
					person_profiles: 'always'
				});
			} else {
				// Non-EU users: use cookies immediately
				posthog.init(PUBLIC_POSTHOG_KEY, {
					api_host: 'https://eu.i.posthog.com',
					person_profiles: 'always'
				});
			}
			
			// Mark as initialized
			window.__posthogInitialized = true;
			
			console.log(`Analytics initialized: ${isEU ? 'EU (awaiting consent)' : 'Non-EU (with cookies)'}`);
			
		} catch (error) {
			console.error('Error initializing analytics with geo detection:', error);
			// Fallback to EU mode (show consent banner) if detection fails
			posthog.init(PUBLIC_POSTHOG_KEY, {
				api_host: 'https://eu.i.posthog.com',
				cookieless_mode: 'on_reject',
				person_profiles: 'always'
			});
			
			// Set fallback values and mark as initialized
			window.__isEUUser = true; // Default to EU mode for safety
			window.__posthogInitialized = true;
		}
	}
};
