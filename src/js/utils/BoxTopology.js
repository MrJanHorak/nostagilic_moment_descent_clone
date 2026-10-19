/** Consistent outward winding for an affine image of a box. */
export const BOX_FACES = Object.freeze({
  negativeX: [0, 4, 7, 3], positiveX: [1, 2, 6, 5],
  negativeY: [0, 1, 5, 4], positiveY: [3, 7, 6, 2],
  negativeZ: [0, 3, 2, 1], positiveZ: [4, 5, 6, 7],
});

/** @param {readonly number[]} center @param {readonly number[]} size
 * @returns {[number, number, number][]} */
export function boxCorners(center, size) {
  return /** @type {[number, number, number][]} */ ([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(signs => signs.map((sign, axis) => center[axis] + sign * size[axis] / 2)));
}
