import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// EU country codes (27 EU member states + EEA countries)
const EU_COUNTRIES = new Set([
	// EU Member States
	'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
	'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
	'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
	// EEA Countries
	'IS', 'LI', 'NO',
	// UK (depending on requirements)
	'GB'
]);

// Strict EU/EEA timezones only (legally accurate for GDPR compliance)
// Excludes non-EU countries like Turkey, Switzerland, Bosnia, etc.
const STRICT_EU_EEA_TIMEZONES = new Set([
	// EU Member States
	'Europe/Amsterdam', // Netherlands
	'Europe/Athens',    // Greece
	'Europe/Berlin',    // Germany
	'Europe/Bratislava', // Slovakia
	'Europe/Brussels',  // Belgium
	'Europe/Bucharest', // Romania
	'Europe/Budapest',  // Hungary
	'Europe/Copenhagen', // Denmark
	'Europe/Dublin',    // Ireland
	'Europe/Helsinki',  // Finland
	'Europe/Lisbon',    // Portugal
	'Europe/Ljubljana', // Slovenia
	'Europe/Luxembourg', // Luxembourg
	'Europe/Madrid',    // Spain
	'Europe/Malta',     // Malta
	'Europe/Paris',     // France
	'Europe/Prague',    // Czech Republic
	'Europe/Riga',      // Latvia
	'Europe/Rome',      // Italy
	'Europe/Sofia',     // Bulgaria
	'Europe/Stockholm', // Sweden
	'Europe/Tallinn',   // Estonia
	'Europe/Vienna',    // Austria
	'Europe/Vilnius',   // Lithuania
	'Europe/Warsaw',    // Poland
	'Europe/Zagreb',    // Croatia
	// EEA Countries (non-EU but GDPR applies)
	'Europe/Oslo',      // Norway
	'Europe/Reykjavik', // Iceland
	// UK (post-Brexit but similar privacy laws)
	'Europe/London'     // United Kingdom
	// Removed: Europe/Istanbul (Turkey), Europe/Zurich (Switzerland), 
	// Europe/Belgrade (Serbia), Europe/Sarajevo (Bosnia), etc.
]);

function detectEUFromHeaders(request: Request): boolean | null {
	// Check Cloudflare country header (if using Cloudflare)
	const cfCountry = request.headers.get('CF-IPCountry');
	if (cfCountry && EU_COUNTRIES.has(cfCountry.toUpperCase())) {
		return true;
	}

	// Check other proxy headers that might contain country info
	const xCountry = request.headers.get('X-Country') || 
		request.headers.get('X-Country-Code') ||
		request.headers.get('X-Forwarded-Country');
	
	if (xCountry && EU_COUNTRIES.has(xCountry.toUpperCase())) {
		return true;
	}

	// Check Accept-Language header for EU language patterns
	const acceptLanguage = request.headers.get('Accept-Language');
	if (acceptLanguage) {
		const languages = acceptLanguage.toLowerCase();
		// Common EU language patterns
		const euLanguagePatterns = [
			'de-', 'fr-', 'es-', 'it-', 'nl-', 'sv-', 'da-', 'fi-', 'no-',
			'pl-', 'cs-', 'sk-', 'hu-', 'ro-', 'bg-', 'hr-', 'sl-', 'et-',
			'lv-', 'lt-', 'mt-', 'el-', 'pt-', 'ga-', 'cy-'
		];
		
		const hasEuLanguage = euLanguagePatterns.some(pattern => 
			languages.includes(pattern)
		);
		
		if (hasEuLanguage) {
			return true;
		}
	}

	return null; // Unable to determine from headers
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Try to detect from headers first
		const headerResult = detectEUFromHeaders(request);
		if (headerResult !== null) {
			return json({ 
				isEU: headerResult, 
				method: 'headers',
				timestamp: new Date().toISOString() 
			});
		}

		// If headers don't provide clear info, check if client sent timezone
		// Note: Timezone detection is used as supporting evidence, not definitive
		const body = await request.json().catch(() => ({}));
		const { timezone } = body;
		
		if (timezone && STRICT_EU_EEA_TIMEZONES.has(timezone)) {
			return json({ 
				isEU: true, 
				method: 'timezone',
				timestamp: new Date().toISOString() 
			});
		}

		// Default to EU-safe behavior when detection is inconclusive
		// Better to show consent banner unnecessarily than violate GDPR
		return json({ 
			isEU: true, 
			method: 'default_eu_safe',
			timestamp: new Date().toISOString() 
		});
		
	} catch (error) {
		console.error('Error in geo detection:', error);
		// Default to EU (more privacy-focused) if there's an error
		return json({ 
			isEU: true, 
			method: 'error_fallback',
			timestamp: new Date().toISOString() 
		});
	}
};