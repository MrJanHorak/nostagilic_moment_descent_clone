import * as THREE from 'three';
import { convexSegmentFraction } from './ConvexSolid.js';

// Fractions along a finite segment, including a start already inside a collider.
// Expanded AABBs deliberately give shots a small, conservative edge clearance.
/** @param {THREE.Vector3} start @param {THREE.Vector3} end
 * @param {THREE.Box3} box @param {number} [radius]
 */
export function segmentBoxFraction(start, end, box, radius = 0) {
  if (box.isEmpty()) return null;
  let enter = 0, leave = 1;
  for (const axis of /** @type {const} */ (['x', 'y', 'z'])) {
    const travel = end[axis] - start[axis];
    const min = box.min[axis] - radius, max = box.max[axis] + radius;
    if (Math.abs(travel) < 1e-12) {
      if (start[axis] < min || start[axis] > max) return null;
      continue;
    }
    const a = (min - start[axis]) / travel, b = (max - start[axis]) / travel;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return null;
  }
  return enter;
}

/** @param {THREE.Vector3} start @param {THREE.Vector3} end
 * @param {THREE.Vector3} center @param {number} radius
 */
export function segmentSphereFraction(start, end, center, radius) {
  const offset = start.clone().sub(center), travel = end.clone().sub(start);
  const c = offset.lengthSq() - radius * radius;
  if (c <= 0) return 0;
  const a = travel.lengthSq(), b = offset.dot(travel);
  const discriminant = b * b - a * c;
  if (a === 0 || discriminant < 0) return null;
  const fraction = (-b - Math.sqrt(discriminant)) / a;
  return fraction >= 0 && fraction <= 1 ? fraction : null;
}

/** @template {import('../contracts.js').ShotTarget} [T=import('../contracts.js').ShotTarget]
 * @param {THREE.Vector3} start @param {THREE.Vector3} end
 * @param {import('../contracts.js').ShotOptions<T>} [options]
 * @returns {import('../contracts.js').ShotHit<T> | null}
 */
export function traceShot(start, end, { colliders = [], targets = [], player = null, radius = 0.05 } = {}) {
  /** @type {import('../contracts.js').ShotHit<T> | null} */
  let hit = null;
  /** @param {number | null} fraction @param {import('../contracts.js').TraceContact<T>} contact */
  const consider = (fraction, contact) => {
    // Walls win ties; results don't depend on enemy iteration order.
    if (fraction !== null && (!hit || fraction < hit.fraction - 1e-9)) {
      hit = { ...contact, fraction, point: new THREE.Vector3().lerpVectors(start, end, fraction) };
    }
  };
  for (const collider of colliders) consider('convex' in collider && collider.convex ? convexSegmentFraction(start, end, collider.convex, radius)
    : segmentBoxFraction(start, end, 'box' in collider ? collider.box : collider, radius), { kind: 'wall', target: collider });
  for (const target of targets) {
    if (target.isActive) consider(segmentBoxFraction(start, end, target.collider, radius), { kind: 'enemy', target });
  }
  if (player) consider(segmentSphereFraction(start, end, player.position, player.radius + radius), { kind: 'player', target: player });
  return hit;
}

/** @param {THREE.Vector3} start @param {THREE.Vector3} end
 * @param {readonly import('../contracts.js').SolidCollider[]} [colliders]
 */
export function hasLineOfSight(start, end, colliders = []) {
  return !traceShot(start, end, { colliders, radius: 0.05 });
}
