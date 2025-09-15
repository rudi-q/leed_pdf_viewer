import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ConsentStatus = 'pending' | 'accepted' | 'declined';

interface ConsentState {
	status: ConsentStatus;
	timestamp: number | null;
	isEU: boolean;
}

// Default state
const defaultState: ConsentState = {
	status: 'pending',
	timestamp: null,
	isEU: false
};

// Storage key
const CONSENT_STORAGE_KEY = 'cookie_consent';

/**
 * Clear PostHog-related cookies
 */
function clearPostHogCookies() {
	if (!browser) return;
	
	try {
		// Common PostHog cookie names
		const posthogCookies = [
			'ph_phc_',
			'_posthog',
			'posthog',
			'ph_',
			'__posthog'
		];
		
		// Get all cookies
		const cookies = document.cookie.split(';');
		
		cookies.forEach(cookie => {
			const cookieName = cookie.split('=')[0].trim();
			
			// Check if it's a PostHog cookie
			const isPostHogCookie = posthogCookies.some(prefix => 
				cookieName.startsWith(prefix)
			);
			
			if (isPostHogCookie) {
				// Delete the cookie by setting it to expire
				document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
				document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
				document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
				console.log(`Cleared PostHog cookie: ${cookieName}`);
			}
		});
	} catch (error) {
		console.error('Error clearing PostHog cookies:', error);
	}
}

/**
 * Clear PostHog data from localStorage and sessionStorage
 */
function clearPostHogStorage() {
	if (!browser) return;
	
	try {
		// PostHog storage key patterns
		const posthogKeys = [
			'ph_phc_',
			'_posthog',
			'posthog',
			'ph_',
			'__posthog',
			'distinct_id',
			'anon_distinct_id',
			'user_id'
		];
		
		// Clear from localStorage
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const key = localStorage.key(i);
			if (key && posthogKeys.some(pattern => key.includes(pattern))) {
				localStorage.removeItem(key);
				console.log(`Cleared localStorage: ${key}`);
			}
		}
		
		// Clear from sessionStorage
		for (let i = sessionStorage.length - 1; i >= 0; i--) {
			const key = sessionStorage.key(i);
			if (key && posthogKeys.some(pattern => key.includes(pattern))) {
				sessionStorage.removeItem(key);
				console.log(`Cleared sessionStorage: ${key}`);
			}
		}
	} catch (error) {
		console.error('Error clearing PostHog storage:', error);
	}
}

/**
 * Load consent state from localStorage
 */
function loadConsentFromStorage(): ConsentState {
	if (!browser) return defaultState;
	
	try {
		const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Validate the stored data structure
			if (parsed && typeof parsed === 'object' && 
				['pending', 'accepted', 'declined'].includes(parsed.status)) {
				return {
					status: parsed.status,
					timestamp: parsed.timestamp || null,
					isEU: parsed.isEU || false
				};
			}
		}
	} catch (error) {
		console.error('Error loading consent from storage:', error);
	}
	
	return defaultState;
}

/**
 * Save consent state to localStorage
 */
function saveConsentToStorage(state: ConsentState) {
	if (!browser) return;
	
	try {
		localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
	} catch (error) {
		console.error('Error saving consent to storage:', error);
	}
}

// Create the store with initial value from localStorage
function createConsentStore() {
	const initialState = loadConsentFromStorage();
	const { subscribe, set, update } = writable<ConsentState>(initialState);

	return {
		subscribe,
		
		/**
		 * Initialize the consent store with EU detection result
		 */
		initialize: (isEU: boolean) => {
			update(state => {
				// If we already have a stored consent decision, keep it
				if (state.status !== 'pending') {
					return { ...state, isEU };
				}
				
				// Otherwise, set up initial state
				const newState = { ...state, isEU };
				saveConsentToStorage(newState);
				return newState;
			});
		},
		
		/**
		 * Accept cookies - triggers PostHog opt-in
		 */
		accept: () => {
			update(state => {
				const newState: ConsentState = {
					...state,
					status: 'accepted',
					timestamp: Date.now()
				};
				
				saveConsentToStorage(newState);
				
				// Trigger PostHog opt-in if available
				if (browser && window.posthog) {
					window.posthog.opt_in_capturing();
					console.log('✅ Cookies accepted - PostHog opt-in activated');
				}
				
				return newState;
			});
		},
		
		/**
		 * Decline cookies - triggers PostHog opt-out and comprehensive cleanup
		 */
		decline: () => {
			update(state => {
				const newState: ConsentState = {
					...state,
					status: 'declined',
					timestamp: Date.now()
				};
				
				saveConsentToStorage(newState);
				
				// Comprehensive cleanup when user declines cookies
				if (browser && window.posthog) {
					// 1. Opt out of capturing
					window.posthog.opt_out_capturing();
					
					// 2. Reset PostHog to clear identifiers if method exists
					if (typeof window.posthog.reset === 'function') {
						window.posthog.reset();
					}
					
					// 3. Clear PostHog cookies
					clearPostHogCookies();
					
					// 4. Clear PostHog data from storage
					clearPostHogStorage();
					
					console.log('❌ Cookies declined - Complete PostHog cleanup performed');
				}
				
				return newState;
			});
		},
		
		/**
		 * Reset consent state (useful for testing)
		 */
		reset: () => {
			const newState = defaultState;
			saveConsentToStorage(newState);
			set(newState);
		},
		
		/**
		 * Check if banner should be shown
		 */
		shouldShowBanner: (state: ConsentState): boolean => {
			return state.isEU && state.status === 'pending';
		}
	};
}

export const consentStore = createConsentStore();

// Type augmentation for PostHog global and app state
declare global {
	interface Window {
		posthog?: {
			opt_in_capturing: () => void;
			opt_out_capturing: () => void;
			get_explicit_consent_status: () => ConsentStatus;
			reset?: () => void; // Optional reset method
		};
		__isEUUser?: boolean;
		__posthogInitialized?: boolean;
	}
}
