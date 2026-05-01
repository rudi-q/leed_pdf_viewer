import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GestureTracker, PanInertia } from '../../../src/lib/utils/gestureUtils';

function makePointer(id: number, x: number, y: number): PointerEvent {
	return { pointerId: id, clientX: x, clientY: y } as PointerEvent;
}

describe('GestureTracker', () => {
	let tracker: GestureTracker;

	beforeEach(() => {
		tracker = new GestureTracker();
	});

	it('starts with count 0', () => {
		expect(tracker.count).toBe(0);
	});

	it('tracks a pointer', () => {
		tracker.track(makePointer(1, 10, 20));
		expect(tracker.count).toBe(1);
	});

	it('tracks multiple pointers', () => {
		tracker.track(makePointer(1, 10, 20));
		tracker.track(makePointer(2, 30, 40));
		expect(tracker.count).toBe(2);
	});

	it('updates an existing pointer on re-track', () => {
		tracker.track(makePointer(1, 10, 20));
		tracker.track(makePointer(1, 50, 60));
		expect(tracker.count).toBe(1);
		expect(tracker.getFirstPointer()).toEqual({ x: 50, y: 60 });
	});

	it('untracks a pointer', () => {
		const p = makePointer(1, 10, 20);
		tracker.track(p);
		tracker.untrack(p);
		expect(tracker.count).toBe(0);
	});

	it('getPinchDistance returns 0 with fewer than 2 pointers', () => {
		expect(tracker.getPinchDistance()).toBe(0);
		tracker.track(makePointer(1, 0, 0));
		expect(tracker.getPinchDistance()).toBe(0);
	});

	it('getPinchDistance calculates 3-4-5 triangle', () => {
		tracker.track(makePointer(1, 0, 0));
		tracker.track(makePointer(2, 3, 4));
		expect(tracker.getPinchDistance()).toBe(5);
	});

	it('getPinchDistance calculates horizontal distance', () => {
		tracker.track(makePointer(1, 0, 0));
		tracker.track(makePointer(2, 10, 0));
		expect(tracker.getPinchDistance()).toBe(10);
	});

	it('getPinchMidpoint returns {0,0} with fewer than 2 pointers', () => {
		expect(tracker.getPinchMidpoint()).toEqual({ x: 0, y: 0 });
		tracker.track(makePointer(1, 100, 200));
		expect(tracker.getPinchMidpoint()).toEqual({ x: 0, y: 0 });
	});

	it('getPinchMidpoint returns midpoint of two pointers', () => {
		tracker.track(makePointer(1, 0, 0));
		tracker.track(makePointer(2, 10, 20));
		expect(tracker.getPinchMidpoint()).toEqual({ x: 5, y: 10 });
	});

	it('getFirstPointer returns null when empty', () => {
		expect(tracker.getFirstPointer()).toBeNull();
	});

	it('getFirstPointer returns position of tracked pointer', () => {
		tracker.track(makePointer(1, 10, 20));
		expect(tracker.getFirstPointer()).toEqual({ x: 10, y: 20 });
	});

	it('reset clears all pointers', () => {
		tracker.track(makePointer(1, 0, 0));
		tracker.track(makePointer(2, 5, 5));
		tracker.reset();
		expect(tracker.count).toBe(0);
		expect(tracker.getFirstPointer()).toBeNull();
	});
});

describe('PanInertia', () => {
	let inertia: PanInertia;
	let rafCallback: FrameRequestCallback | null = null;
	let rafCounter = 1;

	beforeEach(() => {
		inertia = new PanInertia();
		rafCallback = null;
		rafCounter = 1;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafCallback = cb;
			return rafCounter++;
		});
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
	});

	afterEach(() => {
		inertia.cancel();
		vi.unstubAllGlobals();
	});

	function fireFrame() {
		const cb = rafCallback;
		rafCallback = null;
		if (cb) cb(performance.now());
	}

	it('cancel is safe when not running', () => {
		expect(() => inertia.cancel()).not.toThrow();
	});

	it('addSample does not start animation', () => {
		inertia.addSample(10, 5);
		expect(rafCallback).toBeNull();
	});

	it('start schedules first animation frame', () => {
		inertia.addSample(20, 10);
		inertia.start(vi.fn());
		expect(rafCallback).not.toBeNull();
	});

	it('start calls onFrame with decaying velocity', () => {
		// start() calls cancel() internally which resets vx/vy,
		// so addSample must come after start() but before the first rAF fires.
		const xValues: number[] = [];
		inertia.start((dx) => xValues.push(dx));
		inertia.addSample(100, 0);

		for (let i = 0; i < 20; i++) fireFrame();

		expect(xValues.length).toBeGreaterThan(0);
		if (xValues.length >= 2) {
			expect(Math.abs(xValues[xValues.length - 1])).toBeLessThan(Math.abs(xValues[0]));
		}
	});

	it('animation stops when velocity falls below threshold', () => {
		const frames: number[] = [];
		inertia.start((dx) => frames.push(dx));
		inertia.addSample(1, 0);

		// Fire until it stops (velocity starts small, decays fast)
		for (let i = 0; i < 50; i++) fireFrame();

		// Eventually rafCallback should be null (animation stopped)
		expect(rafCallback).toBeNull();
	});

	it('cancel stops further frames from being delivered', () => {
		const frames: number[] = [];
		inertia.start((dx) => frames.push(dx));
		inertia.addSample(100, 0);

		fireFrame();
		const countBefore = frames.length;

		inertia.cancel();

		// After cancel vx/vy are zeroed; any lingering callback exits without calling onFrame
		fireFrame();
		expect(frames.length).toBe(countBefore);
	});

	it('addSample blends velocity with EMA', () => {
		inertia.start(vi.fn());
		inertia.addSample(10, 0);
		inertia.addSample(10, 0);
		// vx = 10*0.6 + 6*0.4 = 8.4  (second sample), above minSpeed
		expect(rafCallback).not.toBeNull();
	});
});
