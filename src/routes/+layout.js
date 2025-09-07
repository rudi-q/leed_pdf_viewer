import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import posthog from 'posthog-js'
import { browser } from '$app/environment';
import { PUBLIC_POSTHOG_KEY } from '$env/static/public';

injectAnalytics({ mode: dev ? 'development' : 'production' });

export const prerender = true;
export const ssr = false; // Disable SSR for the full client-side app

export const load = async () => {
	if (browser && !dev && PUBLIC_POSTHOG_KEY) {
		posthog.init(
			PUBLIC_POSTHOG_KEY,
			{
				api_host: 'https://eu.i.posthog.com',
				defaults: '2025-05-24',
				cookieless_mode: 'always',
				person_profiles: 'always'
			}
		)
	}
};
