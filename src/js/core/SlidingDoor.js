import * as THREE from 'three';

export const DOOR_OPEN_SECONDS = 0.8;

/** Door panels share world-aligned wall UVs while shut. Both broad faces can
 * match their own room; hidden panels have only a narrow discovery seam.
 * @param {THREE.Group} root
 * @param {{id: string, box: THREE.Box3}[]} colliders
 * @param {NonNullable<import('../levelDocument.js').ArenaLevel['doors']>[number]} door
 * @param {(definition: import('../levelDocument.js').SolidDefinition) => THREE.Material} materialFor */
export function buildSlidingDoor(root, colliders, door, materialFor) {
  const axis = door.slideAxis ?? 0, normal = door.normalAxis ?? 2, v = normal === 1 ? 2 : 1;
  const group = new THREE.Group(); group.name = door.id; group.position.fromArray(door.solid.center); root.add(group);
  const size = [...door.solid.size]; size[axis] /= 2;
  const front = materialFor(door.solid), back = door.concealed && door.reverseStyle
    ? materialFor({ ...door.solid, ...door.reverseStyle }) : front;
  const materials = Array(6).fill(front);
  materials[normal * 2 + ((door.direction ?? 1) > 0 ? 0 : 1)] = back;
  for (const side of [-1, 1]) {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const points = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i,
      (points.getComponent(i, axis) + door.solid.center[axis] + side * size[axis] / 2) / 4,
      (points.getComponent(i, v) + door.solid.center[v]) / 4);
    const panel = new THREE.Mesh(geometry, materials); panel.name = `${door.id}:${side}`;
    panel.userData.doorId = door.id; panel.position.setComponent(axis, side * size[axis] / 2); group.add(panel);
    const center = group.position.clone().add(panel.position);
    colliders.push({ id: panel.name, box: new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(...size)) });
    // A fine dark seam hints at a hidden panel. Marked doors have a striped
    // central band and amber shot indicator on each side of the opening.
    const stripeSize = [...size]; stripeSize[axis] = door.concealed ? 0.018 : 0.18; stripeSize[normal] += 0.012;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(...stripeSize), door.concealed
      ? new THREE.MeshStandardMaterial({ color: 0x26343a, roughness: 1 })
      : materialFor({ ...door.solid, color: 0xe6aa4b, pattern: 'hazard' }));
    stripe.position.setComponent(axis, -side * (size[axis] / 2 - stripeSize[axis] / 2)); panel.add(stripe);
    if (!door.concealed && door.activation === 'shot') {
      const lampSize = [0.22, 0.22, 0.22]; lampSize[normal] = door.solid.size[normal] + 0.04;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(...lampSize), new THREE.MeshBasicMaterial({ color: 0xffd477 }));
      lamp.position.setComponent(axis, -side * (size[axis] / 2 - 0.4)); panel.add(lamp);
    }
  }
  return group;
}
