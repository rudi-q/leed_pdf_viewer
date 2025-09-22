/**
 * Detects if the user is from the EU using external Appwrite API
 * Falls back to EU-safe behavior if API fails
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
		
		// Default to showing cookie banner (EU-safe) if API fails
		geoDetectionCache = {
			showCookieBanner: true,
			timestamp: Date.now() - (CACHE_DURATION / 2) // Shorter cache for fallback
		};

		return true;
	}
}


/**
 * Clear the geo detection cache (useful for testing)
 */
export function clearGeoCache(): void {
	geoDetectionCache = null;
}