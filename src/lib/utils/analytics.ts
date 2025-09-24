import { browser } from '$app/environment';
import { dev } from '$app/environment';
import { consentStore } from '$lib/stores/consentStore';
import { get } from 'svelte/store';

// Event properties interface for type safety
interface EventProperties {
	[key: string]: string | number | boolean | null | undefined;
}

// Normalized error interface
interface NormalizedError {
	message: string;
	name: string;
	stack?: string;
}

/**
 * Safely normalize any error-like value to a consistent format
 * Handles Error objects, strings, objects, and unknown values
 */
function normalizeError(error: unknown): NormalizedError {
	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
			stack: error.stack?.substring(0, 1000) // Truncate stack to prevent huge payloads
		};
	}
	
	if (typeof error === 'string') {
		return {
			message: error,
			name: 'StringError',
			stack: undefined
		};
	}
	
	if (error && typeof error === 'object') {
		const obj = error as any;
		return {
			message: obj.message || obj.reason || JSON.stringify(error).substring(0, 200),
			name: obj.name || 'ObjectError',
			stack: obj.stack?.substring(0, 1000)
		};
	}
	
	return {
		message: String(error),
		name: 'UnknownError',
		stack: undefined
	};
}

/**
 * Safe URL parsing that strips sensitive query params and fragments
 */
function sanitizeUrl(urlString: string): string {
	try {
		const url = new URL(urlString);
		return url.origin + url.pathname;
	} catch {
		return 'invalid_url';
	}
}

/**
 * Extract file extension from filename
 */
function extractFileExtension(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot === -1 || lastDot === filename.length - 1) {
		return 'unknown';
	}
	return filename.substring(lastDot + 1).toLowerCase();
}

// Session tracking
let sessionStartTime: number | null = null;
let lastActivityTime: number = Date.now();

// In-memory deduplication flags
let firstAnnotationTracked = false;

/**
 * Safe wrapper for PostHog event capture
 * Ensures analytics never crash the application
 */
export const trackEvent = (eventName: string, properties: EventProperties = {}): void => {
	// Only track events in browser environment
	if (!browser) return;
	
	try {
	// Check if PostHog is available and user has consented
	const consent = get(consentStore);
	if (!window.posthog || consent.status !== 'accepted') {
		console.log(`Analytics: Skipping event "${eventName}" - PostHog not available or consent not given`);
		return;
	}

	// Type assertion for PostHog capture method
	const posthog = window.posthog as any;

		// Add common properties to all events (privacy-safe)
		const enrichedProperties = {
			...properties,
			timestamp: new Date().toISOString(),
			user_agent: navigator.userAgent,
			viewport_width: window.innerWidth,
			viewport_height: window.innerHeight,
			url: sanitizeUrl(window.location.href),
			referrer: document.referrer ? sanitizeUrl(document.referrer) : undefined
		};

		// Determine if we should send with beacon for reliability
		const useBeacon = document.visibilityState === 'hidden' || eventName === 'session_duration';
		const captureOptions = useBeacon ? { send_instantly: true, transport: 'beacon' } : undefined;

		// Capture the event
		posthog.capture(eventName, enrichedProperties, captureOptions);
		
		// Development-only logging
		if (dev) {
			console.log(`Analytics: Tracked event "${eventName}"`, enrichedProperties);
		} else {
			// Production: minimal logging without sensitive data
			console.debug(`Analytics: Tracked ${eventName}`);
		}
		
		// Update last activity time for session tracking
		updateLastActivity();
		
	} catch (error) {
		console.warn(`Analytics: Failed to track event "${eventName}":`, error);
		// Never throw - analytics should never break the app
	}
};

/**
 * Track application crashes and errors
 */
export const trackError = (error: unknown, context?: string): void => {
	const normalizedError = normalizeError(error);
	trackEvent('app_crashed', {
		error_message: normalizedError.message.substring(0, 500), // Limit message size
		error_stack: normalizedError.stack,
		context: context || 'unknown',
		error_name: normalizedError.name
	});
};

/**
 * Start session tracking
 */
export const startSession = (): void => {
	if (!browser) return;
	
	try {
		sessionStartTime = Date.now();
		lastActivityTime = sessionStartTime;
		
		// Check if this is a returning user (with localStorage safety)
		let isReturningUser = false;
		try {
			isReturningUser = localStorage.getItem('leedpdf_visited') === 'true';
			
			if (!isReturningUser) {
				localStorage.setItem('leedpdf_visited', 'true');
				trackEvent('first_visit');
			} else {
				trackEvent('return_user');
			}
		} catch (error) {
			// localStorage unavailable (private mode, etc.) - treat as first visit
			console.debug('Analytics: localStorage unavailable for visit tracking:', error);
			trackEvent('first_visit', { note: 'localStorage_unavailable' });
		}
		
		// Track session start
		trackEvent('session_start', {
			is_returning_user: isReturningUser
		});
		
		if (dev) {
			console.log('Analytics: Session started');
		}
	} catch (error) {
		console.warn('Analytics: Failed to start session tracking:', error);
	}
};

/**
 * End session tracking
 */
export const endSession = (): void => {
	if (!browser || !sessionStartTime) return;
	
	try {
		const sessionDuration = Math.round((Date.now() - sessionStartTime) / 1000 / 60); // Duration in minutes
		
		trackEvent('session_duration', {
			duration_minutes: sessionDuration,
			session_start: new Date(sessionStartTime).toISOString()
		});
		
		if (dev) {
			console.log(`Analytics: Session ended - Duration: ${sessionDuration} minutes`);
		}
		sessionStartTime = null;
	} catch (error) {
		console.warn('Analytics: Failed to end session tracking:', error);
	}
};

/**
 * Update last activity time (called by trackEvent automatically)
 */
const updateLastActivity = (): void => {
	lastActivityTime = Date.now();
};

/**
 * Track PDF file upload with detailed properties
 */
export const trackPdfUpload = (file: File, uploadMethod: string = 'unknown'): void => {
	trackEvent('pdf_uploaded', {
		file_size: file.size,
		file_type: file.type,
		file_extension: extractFileExtension(file.name), // Privacy-safe: extension only
		upload_method: uploadMethod,
		file_size_mb: Math.round((file.size / 1024 / 1024) * 100) / 100
	});
};

/**
 * Track PDF loading performance
 */
export const trackPdfLoadTime = (loadTimeMs: number, fileSize?: number, source?: string): void => {
	trackEvent('pdf_load_time', {
		load_time_ms: Math.round(loadTimeMs),
		load_time_seconds: Math.round(loadTimeMs / 1000 * 100) / 100,
		file_size: fileSize,
		file_size_mb: fileSize ? Math.round((fileSize / 1024 / 1024) * 100) / 100 : undefined,
		source: source || 'unknown'
	});
};

/**
 * Track tool selection
 */
export const trackToolSelection = (toolName: string, previousTool?: string): void => {
	trackEvent('tool_selected', {
		tool_name: toolName,
		previous_tool: previousTool,
		selection_time: new Date().toISOString()
	});
};

/**
 * Track first annotation creation
 * Uses dual-layer deduplication: in-memory flag + localStorage persistence
 * Prevents double-counting across multiple overlay components
 */
export const trackFirstAnnotation = (annotationType: string): void => {
	// In-memory guard - prevents multiple calls in same session (bulletproof)
	if (firstAnnotationTracked) {
		console.debug('Analytics: First annotation already tracked in this session');
		return;
	}
	
	try {
		// Check persistent storage to handle across page reloads
		const hasCreatedAnnotation = localStorage.getItem('leedpdf_first_annotation_created') === 'true';
		
		if (!hasCreatedAnnotation) {
			// Set both flags before tracking (prevent race conditions)
			firstAnnotationTracked = true;
			localStorage.setItem('leedpdf_first_annotation_created', 'true');
			
			trackEvent('first_annotation_created', {
				annotation_type: annotationType,
				first_annotation_time: new Date().toISOString()
			});
			
			if (dev) {
				console.log(`Analytics: First annotation tracked (${annotationType})`);
			}
		} else {
			// Already tracked in previous session, just set in-memory flag
			firstAnnotationTracked = true;
			console.debug('Analytics: First annotation already tracked in previous session');
		}
	} catch (error) {
		// localStorage unavailable (private mode, etc.)
		console.debug('Analytics: localStorage unavailable for first annotation tracking:', error);
		
		// Set in-memory flag to prevent multiple fallback events in same session
		firstAnnotationTracked = true;
		
		// Track as fallback (only once per session due to in-memory flag)
		try {
			trackEvent('first_annotation_created', {
				annotation_type: annotationType,
				first_annotation_time: new Date().toISOString(),
				note: 'localStorage_unavailable'
			});
			if (dev) {
				console.log(`Analytics: First annotation tracked as fallback (${annotationType})`);
			}
		} catch (trackingError) {
			console.debug('Analytics: Failed to track first annotation:', trackingError);
		}
	}
};

/**
 * Track PDF export
 */
export const trackPdfExport = (exportFormat: string, pageCount?: number, fileSize?: number): void => {
	trackEvent('pdf_exported', {
		export_format: exportFormat,
		page_count: pageCount,
		file_size: fileSize,
		file_size_mb: fileSize ? Math.round((fileSize / 1024 / 1024) * 100) / 100 : undefined
	});
};

/**
 * Track PDF sharing
 */
export const trackPdfShare = (shareMethod: string): void => {
	trackEvent('pdf_shared', {
		share_method: shareMethod,
		share_time: new Date().toISOString()
	});
};

/**
 * Track fullscreen toggle
 */
export const trackFullscreenToggle = (isFullscreen: boolean, trigger: string = 'unknown'): void => {
	trackEvent('fullscreen_toggled', {
		is_fullscreen: isFullscreen,
		trigger: trigger
	});
};

/**
 * Track help/feature views
 */
export const trackFeatureHelp = (helpTopic: string, helpType: string = 'unknown'): void => {
	trackEvent('feature_help_viewed', {
		help_topic: helpTopic,
		help_type: helpType,
		view_time: new Date().toISOString()
	});
};

/**
 * Initialize analytics (call this on app start)
 */
export const initializeAnalytics = (): void => {
	if (!browser) return;
	
	try {
		// Start session tracking
		startSession();
		
		// Set up error tracking with normalized errors
		window.addEventListener('error', (event) => {
			trackError(event.error || event.message, 'global_error_handler');
		});
		
		window.addEventListener('unhandledrejection', (event) => {
			trackError(event.reason, 'unhandled_promise_rejection');
		});
		
		// Set up reliable session end tracking with beacon
		window.addEventListener('beforeunload', endSession);
		window.addEventListener('pagehide', endSession);
		window.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') {
				// Page might be closing, send any pending events with beacon
				endSession();
			}
		});
		
		// Track activity to extend session
		const activityEvents = ['click', 'keydown', 'scroll', 'mousemove'];
		activityEvents.forEach(eventType => {
			document.addEventListener(eventType, updateLastActivity, { passive: true });
		});
		
		if (dev) {
			console.log('Analytics: Initialized successfully');
		}
	} catch (error) {
		console.warn('Analytics: Failed to initialize:', error);
	}
};

// Note: PostHog types are already defined in consentStore.ts, so we don't redeclare them here
