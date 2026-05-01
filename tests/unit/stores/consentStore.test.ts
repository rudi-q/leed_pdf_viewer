import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { consentStore, type ConsentStatus } from '../../../src/lib/stores/consentStore';

describe('consentStore', () => {
	beforeEach(() => {
		consentStore.reset();
	});

	afterEach(() => {
		consentStore.reset();
	});

	it('starts in pending state', () => {
		const state = get(consentStore);
		expect(state.status).toBe('pending');
		expect(state.timestamp).toBeNull();
		expect(state.isEU).toBe(false);
	});

	describe('initialize', () => {
		it('sets isEU flag', () => {
			consentStore.initialize(true);
			expect(get(consentStore).isEU).toBe(true);
		});

		it('keeps existing status when not pending', () => {
			consentStore.accept();
			consentStore.initialize(true);
			expect(get(consentStore).status).toBe('accepted');
			expect(get(consentStore).isEU).toBe(true);
		});

		it('updates isEU when already decided', () => {
			consentStore.decline();
			consentStore.initialize(true);
			expect(get(consentStore).isEU).toBe(true);
		});
	});

	describe('accept', () => {
		it('changes status to accepted', () => {
			consentStore.accept();
			expect(get(consentStore).status).toBe('accepted');
		});

		it('sets timestamp', () => {
			const before = Date.now();
			consentStore.accept();
			const after = Date.now();
			const ts = get(consentStore).timestamp;
			expect(ts).not.toBeNull();
			expect(ts!).toBeGreaterThanOrEqual(before);
			expect(ts!).toBeLessThanOrEqual(after);
		});
	});

	describe('decline', () => {
		it('changes status to declined', () => {
			consentStore.decline();
			expect(get(consentStore).status).toBe('declined');
		});

		it('sets timestamp', () => {
			const before = Date.now();
			consentStore.decline();
			const ts = get(consentStore).timestamp;
			expect(ts).not.toBeNull();
			expect(ts!).toBeGreaterThanOrEqual(before);
		});
	});

	describe('reset', () => {
		it('returns to pending with no timestamp', () => {
			consentStore.accept();
			consentStore.reset();
			const state = get(consentStore);
			expect(state.status).toBe('pending');
			expect(state.timestamp).toBeNull();
			expect(state.isEU).toBe(false);
		});
	});

	describe('shouldShowBanner', () => {
		it('returns true when EU and pending', () => {
			expect(consentStore.shouldShowBanner({ status: 'pending', timestamp: null, isEU: true })).toBe(true);
		});

		it('returns false when non-EU and pending', () => {
			expect(consentStore.shouldShowBanner({ status: 'pending', timestamp: null, isEU: false })).toBe(false);
		});

		it('returns false when EU and accepted', () => {
			expect(consentStore.shouldShowBanner({ status: 'accepted', timestamp: Date.now(), isEU: true })).toBe(false);
		});

		it('returns false when EU and declined', () => {
			expect(consentStore.shouldShowBanner({ status: 'declined', timestamp: Date.now(), isEU: true })).toBe(false);
		});
	});
});
