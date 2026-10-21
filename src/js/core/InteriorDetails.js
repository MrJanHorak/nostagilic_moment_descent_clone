import * as THREE from 'three';

/** Flush fixtures sit in the existing wall thickness, leaving flight clearance
 * and authored portals unchanged. Emission needs no per-room dynamic lights.
 * @param {THREE.Group} root @param {import('../levelDocument.js').ArenaLevel} level */
export default function interiorDetails(root, level) {
  const housing = new THREE.MeshStandardMaterial({ color: 0x253540, metalness: 0.65, roughness: 0.5 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xb8e7df });
  let used = false;
  for (const room of level.sourceDocument?.rooms ?? []) {
    if (room.prefab !== 'box-room') continue;
    const group = new THREE.Group(); group.name = `@detail/${room.id}/fixtures`;
    group.position.fromArray(room.position); group.rotation.set((room.pitch ?? 0) * Math.PI / 180, room.yaw * Math.PI / 180, (room.roll ?? 0) * Math.PI / 180, 'YXZ'); root.add(group);
    const length = Math.min(10, room.size[2] * 0.5);
    for (const side of [-1, 1]) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, length + 0.4), housing);
      body.position.set(side * room.size[0] * 0.3, room.size[1] / 2 - 0.35, 0); group.add(body);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, length), lamp);
      strip.position.copy(body.position); strip.position.y -= 0.16; group.add(strip);
    }
    used = true;
  }
  if (!used) { housing.dispose(); lamp.dispose(); }
}
