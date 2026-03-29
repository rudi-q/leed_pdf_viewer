/**
 * Touch gesture utilities for multi-pointer tracking, pinch-to-zoom,
 * and pan inertia on mobile/tablet devices.
 *
 * These classes are only meaningful for touch input (pointerType === 'touch').
 * Desktop mouse users will never engage them because a mouse can only
 * produce a single pointer — the multi-pointer guards ensure zero impact.
 */

// ─── GestureTracker ──────────────────────────────────────────────────

export interface Point2D {
    x: number;
    y: number;
}

/**
 * Tracks active pointers (fingers) and provides pinch distance / midpoint
 * calculations for two-finger gestures.
 */
export class GestureTracker {
    private activePointers = new Map<number, PointerEvent>();

    /** Update or insert a pointer. Call on pointerdown AND pointermove. */
    track(e: PointerEvent): void {
        this.activePointers.set(e.pointerId, e);
    }

    /** Remove a pointer. Call on pointerup and pointerleave. */
    untrack(e: PointerEvent): void {
        this.activePointers.delete(e.pointerId);
    }

    /** Number of fingers currently touching. */
    get count(): number {
        return this.activePointers.size;
    }

    /** Euclidean distance between the first two tracked pointers, or 0. */
    getPinchDistance(): number {
        if (this.activePointers.size < 2) return 0;
        const [a, b] = this.firstTwo();
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /** Midpoint between the first two tracked pointers in client space. */
    getPinchMidpoint(): Point2D {
        if (this.activePointers.size < 2) return { x: 0, y: 0 };
        const [a, b] = this.firstTwo();
        return {
            x: (a.clientX + b.clientX) / 2,
            y: (a.clientY + b.clientY) / 2
        };
    }

    /** Return the position of the first (remaining) tracked pointer, or null. */
    getFirstPointer(): Point2D | null {
        for (const e of this.activePointers.values()) {
            return { x: e.clientX, y: e.clientY };
        }
        return null;
    }

    /** Clear all tracked pointers. */
    reset(): void {
        this.activePointers.clear();
    }

    /** Return the first two pointers as a tuple. */
    private firstTwo(): [PointerEvent, PointerEvent] {
        const iter = this.activePointers.values();
        return [iter.next().value!, iter.next().value!];
    }
}

// ─── PanInertia ──────────────────────────────────────────────────────

/**
 * Provides momentum-based scrolling after a touch pan gesture ends.
 * Tracks recent velocity from pointermove deltas and, on release,
 * continues the motion with exponential decay via requestAnimationFrame.
 */
export class PanInertia {
    private vx = 0;
    private vy = 0;
    private rafId: number | null = null;

    /** Decay factor applied per frame (~60 fps). 0.92 feels natural. */
    private readonly decay = 0.92;
    /** Speed threshold below which the animation stops. */
    private readonly minSpeed = 0.5;

    /**
     * Feed in the delta from the latest pointermove.
     * We use a simple exponential moving average so the velocity
     * reflects the most recent movement, not the entire gesture.
     */
    addSample(dx: number, dy: number): void {
        // Blend factor: weight recent movement heavily
        this.vx = dx * 0.6 + this.vx * 0.4;
        this.vy = dy * 0.6 + this.vy * 0.4;
    }

    /**
     * Start the inertia animation. `onFrame` is called with (dx, dy)
     * deltas each frame until the velocity decays below threshold.
     */
    start(onFrame: (dx: number, dy: number) => void): void {
        this.cancel();
        const tick = () => {
            this.vx *= this.decay;
            this.vy *= this.decay;

            if (Math.abs(this.vx) < this.minSpeed && Math.abs(this.vy) < this.minSpeed) {
                this.vx = 0;
                this.vy = 0;
                this.rafId = null;
                return;
            }

            onFrame(this.vx, this.vy);
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    /** Cancel any running inertia animation. */
    cancel(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.vx = 0;
        this.vy = 0;
    }
}
