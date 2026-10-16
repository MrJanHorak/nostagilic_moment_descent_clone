import * as THREE from 'three';
import disposeObject from '../utils/disposeObject.js';

// Geometry stays at identity world transform. Keep the complete small arena loaded.
/** @param {import('../levelDocument.js').ArenaLevel} level */
export default function buildArena(level) {
  const group = new THREE.Group();
  group.name = level.id;
  /** @type {{id: string, box: THREE.Box3}[]} */
  const colliders = [];
  try {
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
    if (level.rendering?.trainingDecorations !== false) {
      const grid = new THREE.GridHelper(36, 36, 0x5b99af, 0x4e6475);
      grid.scale.x = 20 / 36;
      grid.position.set(0, -5.99, -8);
      group.add(grid);
    }

    if (level.mission) {
      const exit = new THREE.Group();
      exit.name = level.mission.exit.id ?? 'mission-exit';
      exit.position.fromArray(level.mission.exit.position);
      group.add(exit); // Own partial marker construction before child events run.
      const material = new THREE.MeshBasicMaterial({ color: 0xffb343 });
      exit.add(new THREE.Mesh(new THREE.TorusGeometry(level.mission.exit.radius, 0.09, 8, 48), material));
      // Four inward pointers make the extraction center readable without a texture asset.
      for (let i = 0; i < 4; i++) {
        const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 4), material);
        const angle = i * Math.PI / 2;
        pointer.position.set(Math.sin(angle) * (level.mission.exit.radius + 0.35), Math.cos(angle) * (level.mission.exit.radius + 0.35), 0);
        pointer.rotation.z = Math.PI - angle;
        exit.add(pointer);
      }
      // Decorative marker; the mission owns its trigger, not a solid wall.
    }

    if (level.rendering?.trainingDecorations === false) {
      group.updateMatrixWorld(true);
      return { group, colliders };
    }
    // Flush frame markings: decorative strips stay outside the traversable opening.
    const frameMaterial = new THREE.MeshBasicMaterial({ color: 0x45e5ed });
    for (const z of [-7.47, -8.53]) {
      /** @type {readonly [import('../levelDocument.js').Vec3, import('../levelDocument.js').Vec3][]} */
      const strips = [
        [[-2.6, 0, z], [0.12, 6.3, 0.04]], [[2.6, 0, z], [0.12, 6.3, 0.04]],
        [[0, 3.1, z], [5.3, 0.12, 0.04]], [[0, -3.1, z], [5.3, 0.12, 0.04]],
      ];
      for (const [center, size] of strips) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(...size), frameMaterial);
        strip.position.fromArray(center);
        group.add(strip);
      }
    }
    group.updateMatrixWorld(true);
    return { group, colliders };
  } catch (error) {
    disposeObject(group);
    throw error;
  }
}
