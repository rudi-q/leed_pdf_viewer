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

// EU timezones (approximate list of major EU timezones)
const EU_TIMEZONES = new Set([
	'Europe/Amsterdam', 'Europe/Andorra', 'Europe/Athens', 'Europe/Belfast',
	'Europe/Belgrade', 'Europe/Berlin', 'Europe/Bratislava', 'Europe/Brussels',
	'Europe/Bucharest', 'Europe/Budapest', 'Europe/Copenhagen', 'Europe/Dublin',
	'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Lisbon', 'Europe/Ljubljana',
	'Europe/London', 'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta',
	'Europe/Monaco', 'Europe/Oslo', 'Europe/Paris', 'Europe/Prague',
	'Europe/Reykjavik', 'Europe/Riga', 'Europe/Rome', 'Europe/San_Marino',
	'Europe/Sarajevo', 'Europe/Skopje', 'Europe/Sofia', 'Europe/Stockholm',
	'Europe/Tallinn', 'Europe/Tirane', 'Europe/Vaduz', 'Europe/Vatican',
	'Europe/Vienna', 'Europe/Vilnius', 'Europe/Warsaw', 'Europe/Zagreb',
	'Europe/Zurich'
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
		const body = await request.json().catch(() => ({}));
		const { timezone } = body;
		
		if (timezone && EU_TIMEZONES.has(timezone)) {
			return json({ 
				isEU: true, 
				method: 'timezone',
				timestamp: new Date().toISOString() 
			});
		}

		// Default to non-EU if we can't determine
		return json({ 
			isEU: false, 
			method: 'default',
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