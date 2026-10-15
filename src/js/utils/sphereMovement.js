import * as THREE from 'three';

const SKIN = 1e-5;
const MAX_SUBSTEPS = 512;
const MAX_CONTACT_PASSES = 12;

// Sphere/axis-aligned box contact, including recovery from an overlapping spawn.
/** @param {THREE.Vector3} position @param {number} radius @param {THREE.Box3} box */
function contact(position, radius, box) {
  const nearest = position.clone().clamp(box.min, box.max);
  const normal = position.clone().sub(nearest);
  const distance = normal.length();
  if (distance >= radius) return null;
  if (distance > 1e-10) return { normal: normal.divideScalar(distance), depth: radius - distance };

  // Center is inside the solid: leave through its closest face.
  let depth = Infinity;
  const faceNormal = new THREE.Vector3();
  for (const axis of /** @type {const} */ (['x', 'y', 'z'])) {
    for (const sign of [-1, 1]) {
      const gap = sign < 0 ? position[axis] - box.min[axis] : box.max[axis] - position[axis];
      if (gap < depth) { depth = gap; faceNormal.set(0, 0, 0); faceNormal[axis] = sign; }
    }
  }
  return { normal: faceNormal, depth: radius + depth };
}

/** Move a sphere against static world AABBs, projecting inward velocity off contacts.
 * Steps travel at most radius/4, so even a thin wall cannot be skipped. A fixed
 * work budget discards excessive travel for pathological speeds/deltas. Gameplay
 * uses 60 Hz and capped speed, normally requiring just one or two substeps.
 * Mutates world position/velocity; preserves orientation and tangential velocity.
 * @param {THREE.Vector3} position @param {THREE.Vector3} velocity @param {number} delta
 * @param {readonly import('../contracts.js').SolidCollider[]} colliders @param {number} [radius]
 */
export function moveSphere(position, velocity, delta, colliders, radius = 0.5) {
  if (!Number.isFinite(delta) || delta < 0 || !Number.isFinite(radius) || radius <= 0 ||
    !position.toArray().every(Number.isFinite) || !velocity.toArray().every(Number.isFinite)) {
    throw new RangeError('Sphere movement requires finite position/velocity, nonnegative time, and positive radius');
  }
  const travel = velocity.length() * delta;
  const budget = radius * 0.25 * MAX_SUBSTEPS;
  const limited = travel > budget;
  const coveredTime = limited ? delta * budget / travel : delta;
  const steps = Math.max(1, Math.min(MAX_SUBSTEPS, Math.ceil(Math.min(travel, budget) / (radius * 0.25))));
  let collided = false, unresolved = false;
  for (let step = 0; step < steps; step++) {
    const previous = position.clone();
    position.addScaledVector(velocity, coveredTime / steps);
    for (let pass = 0; pass < MAX_CONTACT_PASSES; pass++) {
      let found = false;
      for (const collider of colliders) {
        const hit = contact(position, radius, 'box' in collider ? collider.box : collider);
        if (!hit) continue;
        collided = found = true;
        position.addScaledVector(hit.normal, hit.depth + SKIN);
        const inwardSpeed = velocity.dot(hit.normal);
        if (inwardSpeed < 0) velocity.addScaledVector(hit.normal, -inwardSpeed);
      }
      if (!found) break;
    }
    // Conflicting solids/invalid space must stop motion, never eject through a wall.
    if (colliders.some(collider => contact(position, radius - SKIN / 2, 'box' in collider ? collider.box : collider))) {
      position.copy(previous); velocity.set(0, 0, 0); unresolved = true; break;
    }
  }
  if (limited) velocity.set(0, 0, 0);
  return { collided, limited, unresolved, steps };
}
