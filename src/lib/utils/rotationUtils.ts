/**
 * Rotation coordinate transform utilities.
 *
 * All annotations are stored in the rotation-0 coordinate space (page dimensions W×H).
 * These functions convert between rotation-0 (storage) and the current rotation (display).
 *
 * Rotation values: 0, 90, 180, 270 (clockwise degrees).
 */

export type RotationAngle = 0 | 90 | 180 | 270;

/**
 * Normalize a rotation value to one of [0, 90, 180, 270].
 */
export function normalizeRotation(rotation: number): RotationAngle {
	const r = ((rotation % 360) + 360) % 360;
	// Snap to nearest valid angle
	if (r < 45) return 0;
	if (r < 135) return 90;
	if (r < 225) return 180;
	if (r < 315) return 270;
	return 0;
}

/**
 * Forward transform: convert a point from rotation-0 storage space
 * to the current rotation's display space.
 *
 * @param x - X coordinate in rotation-0 space
 * @param y - Y coordinate in rotation-0 space
 * @param rotation - Current rotation angle (0, 90, 180, 270)
 * @param pageW - Unrotated page width (at scale 1, rotation 0)
 * @param pageH - Unrotated page height (at scale 1, rotation 0)
 * @returns {x, y} in the rotated coordinate space
 */
export function transformPoint(
	x: number,
	y: number,
	rotation: RotationAngle,
	pageW: number,
	pageH: number
): { x: number; y: number } {
	switch (rotation) {
		case 0:
			return { x, y };
		case 90:
			return { x: pageH - y, y: x };
		case 180:
			return { x: pageW - x, y: pageH - y };
		case 270:
			return { x: y, y: pageW - x };
		default:
			console.warn('Unexpected rotation in transformPoint, falling back to no-op:', {
				rotation,
				x,
				y,
				pageW,
				pageH
			});
			return { x, y };
	}
}

/**
 * Inverse transform: convert a point from the current rotation's display space
 * back to rotation-0 storage space.
 *
 * @param x - X coordinate in the rotated display space
 * @param y - Y coordinate in the rotated display space
 * @param rotation - Current rotation angle (0, 90, 180, 270)
 * @param pageW - Unrotated page width (at scale 1, rotation 0)
 * @param pageH - Unrotated page height (at scale 1, rotation 0)
 * @returns {x, y} in rotation-0 storage space
 */
export function inverseTransformPoint(
	x: number,
	y: number,
	rotation: RotationAngle,
	pageW: number,
	pageH: number
): { x: number; y: number } {
	switch (rotation) {
		case 0:
			return { x, y };
		case 90:
			// Inverse of (pageH - y, x) => (y, pageH - x)
			return { x: y, y: pageH - x };
		case 180:
			// Inverse of (pageW - x, pageH - y) => same formula
			return { x: pageW - x, y: pageH - y };
		case 270:
			// Inverse of (y, pageW - x) => (pageW - y, x)
			return { x: pageW - y, y: x };
		default:
			console.warn('Unexpected rotation in inverseTransformPoint, falling back to no-op:', {
				rotation,
				x,
				y,
				pageW,
				pageH
			});
			return { x, y };
	}
}

/**
 * Get the dimensions of the page canvas after rotation.
 * At 90° and 270°, width and height are swapped.
 *
 * @param pageW - Unrotated page width
 * @param pageH - Unrotated page height
 * @param rotation - Current rotation angle
 * @returns [rotatedWidth, rotatedHeight]
 */
export function getRotatedDimensions(
	pageW: number,
	pageH: number,
	rotation: RotationAngle
): [number, number] {
	if (rotation === 90 || rotation === 270) {
		return [pageH, pageW];
	}
	return [pageW, pageH];
}
