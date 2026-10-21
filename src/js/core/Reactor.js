import * as THREE from 'three';

export const REACTOR_RADIUS = 1.5;

/** Physical shot target owned by the level, separate from robot kill credit.
 * @param {THREE.Group} root @param {import('../contracts.js').SolidCollider[]} colliders
 * @param {NonNullable<import('../levelDocument.js').ArenaLevel['devices']>[number]} device */
export function buildReactor(root, colliders, device) {
  const group = new THREE.Group(); group.name = device.id; group.position.fromArray(device.position); root.add(group);
  const metal = new THREE.MeshStandardMaterial({ color: 0x394550, metalness: 0.65, roughness: 0.45 });
  const energy = new THREE.MeshStandardMaterial({ color: 0xffb35a, emissive: 0xff6418, emissiveIntensity: 0.85, metalness: 0.25, roughness: 0.35, flatShading: true });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), energy); group.add(core);
  for (const y of [-1.1, 1.1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 12), metal); cap.position.y = y; group.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.055, 6, 24), energy); ring.rotation.x = Math.PI / 2; ring.position.y = y - Math.sign(y) * 0.17; group.add(ring);
  }
  for (let i = 0; i < 4; i++) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), metal);
    const angle = Math.PI / 4 + i * Math.PI / 2; strut.position.set(Math.cos(angle) * 1.1, 0, Math.sin(angle) * 1.1); group.add(strut);
  }
  colliders.push({ id: device.id, box: new THREE.Box3().setFromCenterAndSize(group.position, new THREE.Vector3(2.6, 2.6, 2.6)) });
}
