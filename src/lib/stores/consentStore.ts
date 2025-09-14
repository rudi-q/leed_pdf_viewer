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
		 * Decline cookies - triggers PostHog opt-out (stays cookieless)
		 */
		decline: () => {
			update(state => {
				const newState: ConsentState = {
					...state,
					status: 'declined',
					timestamp: Date.now()
				};
				
				saveConsentToStorage(newState);
				
				// Trigger PostHog opt-out if available
				if (browser && window.posthog) {
					window.posthog.opt_out_capturing();
					console.log('❌ Cookies declined - PostHog stays in cookieless mode');
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

// Type augmentation for PostHog global
declare global {
	interface Window {
		posthog?: {
			opt_in_capturing: () => void;
			opt_out_capturing: () => void;
			get_explicit_consent_status: () => ConsentStatus;
		};
		__isEUUser?: boolean;
	}
}