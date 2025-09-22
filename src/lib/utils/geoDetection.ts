/**
 * Detects if the user is from the EU using server-side geo detection
 * Combined with client-side timezone detection as fallback
 */

interface GeoDetectionResponse {
	showCookieBanner: boolean;
	country?: string;
	ip?: string;
}

let geoDetectionCache: { showCookieBanner: boolean; timestamp: number } | null = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Detects if user is from EU using external Appwrite API
 */
export async function isEUUser(): Promise<boolean> {
	// Check cache first
	if (geoDetectionCache && Date.now() - geoDetectionCache.timestamp < CACHE_DURATION) {
		return geoDetectionCache.showCookieBanner;
	}

	try {
		const response = await fetch('https://68cfe47c002decae7030.fra.appwrite.run//api/check-eu', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			}
		});

		if (!response.ok) {
			throw new Error(`Geo detection failed: ${response.status}`);
		}

		const data: GeoDetectionResponse = await response.json();
		
		// Cache the result
		geoDetectionCache = {
			showCookieBanner: data.showCookieBanner,
			timestamp: Date.now()
		};

		console.log(`Geo detection: ${data.showCookieBanner ? 'EU - Show Banner' : 'Non-EU - No Banner'} (Country: ${data.country || 'Unknown'})`);
		return data.showCookieBanner;

	} catch (error) {
		console.error('Error detecting user location:', error);
		
		// Fallback to timezone-based detection if API fails
		const fallbackResult = detectEUFromTimezone();
		
		// Cache fallback result with shorter duration
		geoDetectionCache = {
			showCookieBanner: fallbackResult,
			timestamp: Date.now() - (CACHE_DURATION / 2) // Shorter cache for fallback
		};

		return fallbackResult;
	}
}

/**
 * Fallback: Client-side EU detection based on strict EU/EEA timezones
 */
function detectEUFromTimezone(): boolean {
	try {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		// Strict EU/EEA timezones only (matches server-side list)
		const strictEuEeaTimezones = [
			// EU Member States
			'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Bratislava',
			'Europe/Brussels', 'Europe/Bucharest', 'Europe/Budapest', 'Europe/Copenhagen',
			'Europe/Dublin', 'Europe/Helsinki', 'Europe/Lisbon', 'Europe/Ljubljana',
			'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta', 'Europe/Paris',
			'Europe/Prague', 'Europe/Riga', 'Europe/Rome', 'Europe/Sofia',
			'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Vienna', 'Europe/Vilnius',
			'Europe/Warsaw', 'Europe/Zagreb',
			// EEA Countries
			'Europe/Oslo', 'Europe/Reykjavik',
			// UK (post-Brexit but similar privacy laws)
			'Europe/London'
			// Removed: Europe/Zurich, Europe/Istanbul, Europe/Belgrade, etc.
		];
		
		const isEU = strictEuEeaTimezones.includes(timezone);
		console.log(`Timezone fallback: ${isEU ? 'EU' : 'Non-EU'} (timezone: ${timezone})`);
		return isEU;
	} catch (error) {
		console.error('Error detecting timezone:', error);
		// Default to EU for privacy compliance if all else fails
		return true;
	}
}

/**
 * Clear the geo detection cache (useful for testing)
 */
export function clearGeoCache(): void {
	geoDetectionCache = null;
}