import { describe, expect, it } from 'vitest';
import {
	getRotatedDimensions,
	inverseTransformPoint,
	normalizeRotation,
	rotateDelta,
	transformPoint
} from '../../../src/lib/utils/rotationUtils';

describe('normalizeRotation', () => {
	it('keeps 0 as 0', () => expect(normalizeRotation(0)).toBe(0));
	it('snaps 44 to 0', () => expect(normalizeRotation(44)).toBe(0));
	it('snaps 45 to 90', () => expect(normalizeRotation(45)).toBe(90));
	it('keeps 90 as 90', () => expect(normalizeRotation(90)).toBe(90));
	it('snaps 134 to 90', () => expect(normalizeRotation(134)).toBe(90));
	it('snaps 135 to 180', () => expect(normalizeRotation(135)).toBe(180));
	it('keeps 180 as 180', () => expect(normalizeRotation(180)).toBe(180));
	it('snaps 224 to 180', () => expect(normalizeRotation(224)).toBe(180));
	it('snaps 225 to 270', () => expect(normalizeRotation(225)).toBe(270));
	it('keeps 270 as 270', () => expect(normalizeRotation(270)).toBe(270));
	it('snaps 314 to 270', () => expect(normalizeRotation(314)).toBe(270));
	it('snaps 315 back to 0', () => expect(normalizeRotation(315)).toBe(0));
	it('wraps 360 to 0', () => expect(normalizeRotation(360)).toBe(0));
	it('wraps 450 to 90', () => expect(normalizeRotation(450)).toBe(90));
	it('handles negative -90', () => expect(normalizeRotation(-90)).toBe(270));
	it('handles negative -180', () => expect(normalizeRotation(-180)).toBe(180));
});

describe('transformPoint', () => {
	const W = 200;
	const H = 100;

	it('rotation 0 is identity', () => {
		expect(transformPoint(30, 40, 0, W, H)).toEqual({ x: 30, y: 40 });
	});

	it('rotation 90: x = H - y, y = x', () => {
		expect(transformPoint(30, 40, 90, W, H)).toEqual({ x: H - 40, y: 30 });
	});

	it('rotation 180: x = W - x, y = H - y', () => {
		expect(transformPoint(30, 40, 180, W, H)).toEqual({ x: W - 30, y: H - 40 });
	});

	it('rotation 270: x = y, y = W - x', () => {
		expect(transformPoint(30, 40, 270, W, H)).toEqual({ x: 40, y: W - 30 });
	});

	it('origin stays at origin for rotation 0', () => {
		expect(transformPoint(0, 0, 0, W, H)).toEqual({ x: 0, y: 0 });
	});
});

describe('inverseTransformPoint', () => {
	const W = 200;
	const H = 100;
	const testPoints: [number, number][] = [
		[0, 0],
		[30, 40],
		[W, H],
		[10, 90]
	];
	const rotations = [0, 90, 180, 270] as const;

	for (const rotation of rotations) {
		it(`round-trips correctly at rotation ${rotation}`, () => {
			for (const [x, y] of testPoints) {
				const fwd = transformPoint(x, y, rotation, W, H);
				const back = inverseTransformPoint(fwd.x, fwd.y, rotation, W, H);
				expect(back.x).toBeCloseTo(x);
				expect(back.y).toBeCloseTo(y);
			}
		});
	}
});

describe('getRotatedDimensions', () => {
	it('rotation 0 preserves [W, H]', () => {
		expect(getRotatedDimensions(200, 100, 0)).toEqual([200, 100]);
	});

	it('rotation 90 swaps to [H, W]', () => {
		expect(getRotatedDimensions(200, 100, 90)).toEqual([100, 200]);
	});

	it('rotation 180 preserves [W, H]', () => {
		expect(getRotatedDimensions(200, 100, 180)).toEqual([200, 100]);
	});

	it('rotation 270 swaps to [H, W]', () => {
		expect(getRotatedDimensions(200, 100, 270)).toEqual([100, 200]);
	});

	it('works with square pages', () => {
		expect(getRotatedDimensions(100, 100, 90)).toEqual([100, 100]);
	});
});

describe('rotateDelta', () => {
	it('rotation 0 is identity', () => {
		expect(rotateDelta(5, 10, 0)).toEqual({ dx: 5, dy: 10 });
	});

	it('rotation 90: dx = screenDy, dy = -screenDx', () => {
		expect(rotateDelta(5, 10, 90)).toEqual({ dx: 10, dy: -5 });
	});

	it('rotation 180 negates both', () => {
		expect(rotateDelta(5, 10, 180)).toEqual({ dx: -5, dy: -10 });
	});

	it('rotation 270: dx = -screenDy, dy = screenDx', () => {
		expect(rotateDelta(5, 10, 270)).toEqual({ dx: -10, dy: 5 });
	});

	it('handles zero deltas at all rotations', () => {
		for (const r of [0, 90, 180, 270] as const) {
			const { dx, dy } = rotateDelta(0, 0, r);
			expect(dx).toBeCloseTo(0);
			expect(dy).toBeCloseTo(0);
		}
	});

	it('falls back to no-op for invalid rotation', () => {
		const result = rotateDelta(5, 10, 45 as any);
		expect(result).toEqual({ dx: 5, dy: 10 });
	});
});

describe('transformPoint default fallback', () => {
	it('returns original coords for invalid rotation', () => {
		expect(transformPoint(30, 40, 45 as any, 200, 100)).toEqual({ x: 30, y: 40 });
	});
});

describe('inverseTransformPoint default fallback', () => {
	it('returns original coords for invalid rotation', () => {
		expect(inverseTransformPoint(30, 40, 45 as any, 200, 100)).toEqual({ x: 30, y: 40 });
	});
});
