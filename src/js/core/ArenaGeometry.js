import * as THREE from 'three';
import disposeObject from '../utils/disposeObject.js';
import { DEVICE_RADIUS } from './levels/document/LevelContent.js';
import surfaceMaterials from './SurfaceMaterials.js';
import { convexGeometry, convexHull } from '../utils/ConvexSolid.js';
import { buildSlidingDoor } from './SlidingDoor.js';

// Geometry stays at identity world transform. Keep the complete small arena loaded.
/** @param {import('../levelDocument.js').ArenaLevel} level */
export default function buildArena(level) {
  const group = new THREE.Group();
  group.name = level.id;
  /** @type {{id: string, box: THREE.Box3, convex?: import('../contracts.js').ConvexHull}[]} */
  const colliders = [];
  /** @type {import('./SurfaceEnvironment.js').EnvironmentSurface[]} */ const surfaces = [];
  const materialFor = surfaceMaterials();
  try {
    for (const definition of [...level.solids, ...(level.doors ?? []).filter(door => !door.sliding).map(door => door.solid)]) {
      const center = new THREE.Vector3().fromArray(definition.center);
      const size = new THREE.Vector3().fromArray(definition.size);
      const geometry = definition.vertices ? convexGeometry(definition.vertices) : new THREE.BoxGeometry(...definition.size);
      if (!definition.vertices && definition.pattern && definition.pattern !== 'plain') {
        // Keep repeats in world units and continuous across split wall panels.
        const points = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
        const thinAxis = definition.size.indexOf(Math.min(...definition.size));
        const u = thinAxis === 0 ? 2 : 0, v = thinAxis === 1 ? 2 : 1;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (points.getComponent(i, u) + definition.center[u]) / 4, (points.getComponent(i, v) + definition.center[v]) / 4);
      }
      const mesh = new THREE.Mesh(geometry, materialFor(definition));
      mesh.name = definition.id;
      if (!definition.vertices) mesh.position.copy(center);
      group.add(mesh);
      const convex = definition.vertices ? convexHull(definition.vertices) : undefined;
      const collider = { id: definition.id, box: convex?.box ?? new THREE.Box3().setFromCenterAndSize(center, size), ...(convex ? { convex } : {}) };
      colliders.push(collider);
      // Relay/shot doors stay physical doors, even when disguised as a fluid face.
      if (level.solids.includes(definition) && (definition.pattern === 'lava' || definition.pattern === 'water')) surfaces.push({ kind: definition.pattern, collider, material: mesh.material });
    }
    for (const door of level.doors ?? []) if (door.sliding) buildSlidingDoor(group, colliders, door, materialFor);
    group.add(new THREE.HemisphereLight(0xe4f4ff, 0x394455, 2));
    for (const device of level.devices ?? []) {
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(DEVICE_RADIUS - 0.1), new THREE.MeshBasicMaterial({ color: 0x45e5ed }));
      marker.name = device.id; marker.position.fromArray(device.position); group.add(marker);
    }
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
      return { group, colliders, surfaces };
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
    return { group, colliders, surfaces };
  } catch (error) {
    disposeObject(group);
    throw error;
  }
}
