import * as THREE from 'three';

// Geometry stays at identity world transform. Keep the complete small arena loaded.
export default function buildArena(level) {
  const group = new THREE.Group();
  group.name = level.id;
  const colliders = [];
  for (const definition of level.solids) {
    const center = new THREE.Vector3().fromArray(definition.center);
    const size = new THREE.Vector3().fromArray(definition.size);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...definition.size),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.9, metalness: 0.1 }));
    mesh.name = definition.id;
    mesh.position.copy(center);
    group.add(mesh);
    colliders.push({ id: definition.id, box: new THREE.Box3().setFromCenterAndSize(center, size) });
  }
  group.add(new THREE.HemisphereLight(0xe4f4ff, 0x394455, 2));
  const grid = new THREE.GridHelper(36, 36, 0x5b99af, 0x4e6475);
  grid.scale.x = 20 / 36;
  grid.position.set(0, -5.99, -8);
  group.add(grid);

  // Flush frame markings: decorative strips stay outside the traversable opening.
  const frameMaterial = new THREE.MeshBasicMaterial({ color: 0x45e5ed });
  for (const z of [-7.47, -8.53]) {
    for (const [center, size] of [
      [[-2.6, 0, z], [0.12, 6.3, 0.04]], [[2.6, 0, z], [0.12, 6.3, 0.04]],
      [[0, 3.1, z], [5.3, 0.12, 0.04]], [[0, -3.1, z], [5.3, 0.12, 0.04]],
    ]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(...size), frameMaterial);
      strip.position.fromArray(center);
      group.add(strip);
    }
  }
  group.updateMatrixWorld(true);
  return { group, colliders };
}
