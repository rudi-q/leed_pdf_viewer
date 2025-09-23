import { injectAnalytics } from '@vercel/analytics/sveltekit';
import posthog from 'posthog-js';
import { PUBLIC_POSTHOG_KEY } from '$env/static/public';
import { isEUUser } from '$lib/utils/geoDetection';
import { buildingTauri, enableAnalytics } from '$lib/utils/buildConstants';

injectAnalytics({ mode: enableAnalytics ? 'production' : 'development' });
export const prerender = true;
export const ssr = !buildingTauri;

export const load = async () => {
	if (enableAnalytics && PUBLIC_POSTHOG_KEY) {
		// Check if PostHog is already initialized to prevent duplicate initialization
		if (window.__posthogInitialized) {
			console.log('PostHog already initialized, skipping...');
			return;
		}

		// Initialize PostHog IMMEDIATELY with EU-safe defaults
		posthog.init(PUBLIC_POSTHOG_KEY, {
			api_host: 'https://eu.i.posthog.com',
			cookieless_mode: 'on_reject', // EU-safe default
			person_profiles: 'always'
		});

		window.__posthogInitialized = true;
		console.log('PostHog initialized with EU-safe defaults');

		// Start geo detection in the background (non-blocking)
		detectGeoAndUpdate();
	}
}

// Background function - doesn't block page load
async function detectGeoAndUpdate() {
	try {
		// Check cache first
		if (typeof window.__isEUUser !== 'undefined') {
			updatePostHogSettings(window.__isEUUser);
			return;
		}

		// Detect geo in background
		const isEU = await isEUUser();
		window.__isEUUser = isEU;

		updatePostHogSettings(isEU);
	} catch (error) {
		console.error('Background geo detection failed:', error);
		// Keep EU-safe defaults
	}
}

function updatePostHogSettings(isEU : boolean) {
	if (!isEU) {
		// Update to enable cookies for non-EU users
		posthog.set_config({
			cookieless_mode: undefined,
			persistence: 'localStorage+cookie'
		});
		posthog.opt_in_capturing();
		console.log('Updated PostHog for non-EU: cookies enabled');
	}
	console.log(`Geo detection complete: ${isEU ? 'EU' : 'Non-EU'}`);
}
