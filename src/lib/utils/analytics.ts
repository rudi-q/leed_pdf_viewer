import { browser } from '$app/environment';
import { consentStore } from '$lib/stores/consentStore';
import { get } from 'svelte/store';

// Event properties interface for type safety
interface EventProperties {
	[key: string]: string | number | boolean | null | undefined;
}

// Session tracking
let sessionStartTime: number | null = null;
let lastActivityTime: number = Date.now();

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

		// Add common properties to all events
		const enrichedProperties = {
			...properties,
			timestamp: new Date().toISOString(),
			user_agent: navigator.userAgent,
			viewport_width: window.innerWidth,
			viewport_height: window.innerHeight,
			url: window.location.href,
			referrer: document.referrer || undefined
		};

	// Capture the event
	posthog.capture(eventName, enrichedProperties);
		console.log(`Analytics: Tracked event "${eventName}"`, enrichedProperties);
		
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
export const trackError = (error: Error, context?: string): void => {
	trackEvent('app_crashed', {
		error_message: error.message,
		error_stack: error.stack?.substring(0, 1000) || undefined, // Limit stack trace size
		context: context || 'unknown',
		error_name: error.name
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
		
		// Check if this is a returning user
		const isReturningUser = localStorage.getItem('leedpdf_visited') === 'true';
		
		if (!isReturningUser) {
			localStorage.setItem('leedpdf_visited', 'true');
			trackEvent('first_visit');
		} else {
			trackEvent('return_user');
		}
		
		// Track session start
		trackEvent('session_start', {
			is_returning_user: isReturningUser
		});
		
		console.log('Analytics: Session started');
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
		
		console.log(`Analytics: Session ended - Duration: ${sessionDuration} minutes`);
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
		file_name: file.name.replace(/[^a-zA-Z0-9.-]/g, '_'), // Sanitize filename
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
 */
export const trackFirstAnnotation = (annotationType: string): void => {
	// Check if this is the first annotation ever created
	const hasCreatedAnnotation = localStorage.getItem('leedpdf_first_annotation_created') === 'true';
	
	if (!hasCreatedAnnotation) {
		localStorage.setItem('leedpdf_first_annotation_created', 'true');
		
		trackEvent('first_annotation_created', {
			annotation_type: annotationType,
			first_annotation_time: new Date().toISOString()
		});
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
export const trackPdfShare = (shareMethod: string, shareUrl?: string): void => {
	trackEvent('pdf_shared', {
		share_method: shareMethod,
		has_url: !!shareUrl,
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
		
		// Set up error tracking
		window.addEventListener('error', (event) => {
			trackError(new Error(event.message), 'global_error_handler');
		});
		
		window.addEventListener('unhandledrejection', (event) => {
			trackError(new Error(event.reason), 'unhandled_promise_rejection');
		});
		
		// Set up session end tracking
		window.addEventListener('beforeunload', endSession);
		window.addEventListener('pagehide', endSession);
		
		// Track activity to extend session
		const activityEvents = ['click', 'keydown', 'scroll', 'mousemove'];
		activityEvents.forEach(eventType => {
			document.addEventListener(eventType, updateLastActivity, { passive: true });
		});
		
		console.log('Analytics: Initialized successfully');
	} catch (error) {
		console.warn('Analytics: Failed to initialize:', error);
	}
};

// Note: PostHog types are already defined in consentStore.ts, so we don't redeclare them here
