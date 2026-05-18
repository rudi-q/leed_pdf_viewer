import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkIsTauri, detectOS, isTauri, setWindowTitle } from '../../../src/lib/utils/tauriUtils';

describe('isTauri', () => {
	it('is false in the jsdom test environment', () => {
		expect(isTauri).toBe(false);
	});
});

describe('checkIsTauri', () => {
	it('returns false in jsdom (no Tauri globals)', () => {
		expect(checkIsTauri()).toBe(false);
	});

	it('returns true when __TAURI__ is present', () => {
		(window as any).__TAURI__ = {};
		expect(checkIsTauri()).toBe(true);
		delete (window as any).__TAURI__;
	});

	it('returns true when __TAURI_INTERNALS__ is present', () => {
		(window as any).__TAURI_INTERNALS__ = {};
		expect(checkIsTauri()).toBe(true);
		delete (window as any).__TAURI_INTERNALS__;
	});

	it('returns true when __TAURI_IPC__ is present', () => {
		(window as any).__TAURI_IPC__ = vi.fn();
		expect(checkIsTauri()).toBe(true);
		delete (window as any).__TAURI_IPC__;
	});

	it('returns true when __TAURI_EVENT_PLUGIN_INTERNALS__ is present', () => {
		(window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = {};
		expect(checkIsTauri()).toBe(true);
		delete (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__;
	});
});

describe('setWindowTitle', () => {
	it('is a no-op when not in Tauri (isTauri=false)', async () => {
		await expect(setWindowTitle('Test Title')).resolves.toBeUndefined();
	});
});

describe('detectOS', () => {
	const originalUserAgent = navigator.userAgent;
	const originalPlatform = navigator.platform;

	afterEach(() => {
		Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true });
		Object.defineProperty(window.navigator, 'platform', { value: originalPlatform, configurable: true });
	});

	function setUA(userAgent: string, platform = '') {
		Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
		Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
	}

	it('detects Windows via userAgent', () => {
		setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
		expect(detectOS()).toBe('Windows');
	});

	it('detects Windows via platform', () => {
		setUA('', 'Win32');
		expect(detectOS()).toBe('Windows');
	});

	it('detects macOS via userAgent', () => {
		setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)');
		expect(detectOS()).toBe('macOS');
	});

	it('detects macOS via platform', () => {
		setUA('', 'MacIntel');
		expect(detectOS()).toBe('macOS');
	});

	it('detects Linux via userAgent', () => {
		setUA('Mozilla/5.0 (X11; Linux x86_64)');
		expect(detectOS()).toBe('Linux');
	});

	it('detects Linux via platform', () => {
		setUA('', 'Linux x86_64');
		expect(detectOS()).toBe('Linux');
	});

	it('returns Unknown for unrecognized UA', () => {
		setUA('SomeUnknownBrowser/1.0');
		expect(detectOS()).toBe('Unknown');
	});
});
