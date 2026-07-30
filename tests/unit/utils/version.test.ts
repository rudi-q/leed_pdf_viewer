import { describe, expect, it } from 'vitest';
import { getAppVersion, getFormattedVersion } from '../../../src/lib/utils/version';

describe('getAppVersion', () => {
	it('returns a semver string', () => {
		expect(getAppVersion()).toMatch(/^\d+\.\d+\.\d+/);
	});

	it('returns a non-empty string', () => {
		expect(getAppVersion().length).toBeGreaterThan(0);
	});
});

describe('getFormattedVersion', () => {
	it('starts with "v"', () => {
		expect(getFormattedVersion()).toMatch(/^v/);
	});

	it('equals "v" + getAppVersion()', () => {
		expect(getFormattedVersion()).toBe(`v${getAppVersion()}`);
	});
});
