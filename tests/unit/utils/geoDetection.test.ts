import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGeoCache, isEUUser } from '../../../src/lib/utils/geoDetection';

const EU_RESPONSE = { showCookieBanner: true, country: 'DE', ip: '1.2.3.4' };
const NON_EU_RESPONSE = { showCookieBanner: false, country: 'US', ip: '5.6.7.8' };

function mockFetch(data: object, ok = true) {
	vi.mocked(globalThis.fetch).mockResolvedValueOnce({
		ok,
		status: ok ? 200 : 500,
		json: async () => data
	} as Response);
}

describe('isEUUser', () => {
	beforeEach(() => {
		clearGeoCache();
		vi.mocked(globalThis.fetch).mockReset();
	});

	afterEach(() => {
		clearGeoCache();
	});

	it('returns true for EU users', async () => {
		mockFetch(EU_RESPONSE);
		expect(await isEUUser()).toBe(true);
	});

	it('returns false for non-EU users', async () => {
		mockFetch(NON_EU_RESPONSE);
		expect(await isEUUser()).toBe(false);
	});

	it('caches result and does not re-fetch', async () => {
		mockFetch(EU_RESPONSE);
		await isEUUser();
		await isEUUser();
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it('returns true (EU-safe fallback) on network error', async () => {
		vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'));
		expect(await isEUUser()).toBe(true);
	});

	it('returns true (EU-safe fallback) on non-OK HTTP response', async () => {
		mockFetch({}, false);
		expect(await isEUUser()).toBe(true);
	});

	it('caches fallback result after error', async () => {
		vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('fail'));
		await isEUUser();
		await isEUUser();
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it('handles response with no country field', async () => {
		mockFetch({ showCookieBanner: false });
		expect(await isEUUser()).toBe(false);
	});

	it('fetches again after cache is cleared', async () => {
		mockFetch(NON_EU_RESPONSE);
		await isEUUser();
		clearGeoCache();
		mockFetch(EU_RESPONSE);
		const result = await isEUUser();
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		expect(result).toBe(true);
	});
});

describe('clearGeoCache', () => {
	it('forces a fresh fetch on next call', async () => {
		mockFetch(EU_RESPONSE);
		await isEUUser();
		clearGeoCache();
		mockFetch(NON_EU_RESPONSE);
		await isEUUser();
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});
});
