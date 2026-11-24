import * as THREE from 'three';

/** Shared geometry and materials for stranded miners. One kit per story controller:
 * every miner reuses these, so removing one miner must keep them (see `keep`).
 * Original low-poly figure: orange high-vis suit with reflective bands, white helmet
 * hard hat with an emissive lamp and dark visor, one arm raised to wave, a blinking amber
 * beacon on the backpack and a marker ring below the boots. Emissive only, no lights.
 * About 1.4 units tall; with the raised arm and beacon it stays inside the 1-unit survivor clearance. */
export function createSurvivorKit() {
  const geometries = {
    torso: new THREE.BoxGeometry(0.42, 0.5, 0.26),
    band: new THREE.BoxGeometry(0.44, 0.05, 0.28),
    pack: new THREE.BoxGeometry(0.32, 0.36, 0.12),
    limb: new THREE.CylinderGeometry(0.075, 0.07, 0.42, 8),
    leg: new THREE.CylinderGeometry(0.09, 0.08, 0.5, 8),
    boot: new THREE.BoxGeometry(0.16, 0.1, 0.24),
    glove: new THREE.SphereGeometry(0.075, 8, 6),
    helmet: new THREE.SphereGeometry(0.17, 16, 12),
    // Three.js sphere longitude PI/2 points along +Z, the figure's front.
    visor: new THREE.SphereGeometry(0.175, 16, 8, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.26),
    lamp: new THREE.CylinderGeometry(0.045, 0.05, 0.07, 10),
    ring: new THREE.TorusGeometry(0.62, 0.025, 6, 32),
    beacon: new THREE.BoxGeometry(0.08, 0.1, 0.06),
  };
  geometries.lamp.rotateX(Math.PI / 2);
  const materials = {
    suit: new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x6a2a00, emissiveIntensity: 0.6, roughness: 0.7 }),
    reflective: new THREE.MeshStandardMaterial({ color: 0xdfe6ea, emissive: 0xbfd2db, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.8 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0xffcf3a, emissive: 0x5a4300, emissiveIntensity: 0.6, roughness: 0.35 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x1a2f3a, metalness: 0.6, roughness: 0.15, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
    beacon: new THREE.MeshBasicMaterial({ color: 0xffc04d }),
  };

  /** @param {THREE.BufferGeometry} geometry @param {THREE.Material} material @param {[number, number, number]} at @param {string} [name] */
  const part = (geometry, material, at, name) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...at); if (name) mesh.name = name; return mesh;
  };

  /** A new miner figure (a Group with named `body`, `waveArm` and `beacon` children). */
  function build() {
    const root = new THREE.Group();
    const body = new THREE.Group(); body.name = 'body';
    body.add(
      part(geometries.torso, materials.suit, [0, 0.2, 0]),
      part(geometries.band, materials.reflective, [0, 0.3, 0]),
      part(geometries.band, materials.reflective, [0, 0.08, 0]),
      part(geometries.pack, materials.dark, [0, 0.22, -0.19]),
      part(geometries.beacon, materials.beacon, [0.1, 0.44, -0.2], 'packBeacon'),
      part(geometries.helmet, materials.helmet, [0, 0.62, 0]),
      part(geometries.visor, materials.visor, [0, 0.61, 0.02]),
      part(geometries.lamp, materials.lamp, [0, 0.74, 0.15], 'lamp'),
    );
    // Legs drift slightly apart, as in zero gravity.
    for (const side of [-1, 1]) {
      const leg = part(geometries.leg, materials.suit, [side * 0.11, -0.3, 0.02]); leg.rotation.z = side * 0.12; body.add(leg);
      body.add(part(geometries.boot, materials.dark, [side * 0.14, -0.57, 0.05]));
    }
    // Left arm relaxed; right arm raised and waving from the shoulder.
    const rest = new THREE.Group(); rest.position.set(-0.27, 0.4, 0); rest.rotation.z = -0.35;
    rest.add(part(geometries.limb, materials.suit, [0, -0.2, 0]), part(geometries.glove, materials.dark, [0, -0.43, 0]));
    const wave = new THREE.Group(); wave.name = 'waveArm'; wave.position.set(0.27, 0.4, 0);
    wave.add(part(geometries.limb, materials.suit, [0, 0.2, 0]), part(geometries.glove, materials.dark, [0, 0.43, 0]));
    body.add(rest, wave);
    // Marker ring under the boots: reads as a rescue point, not a hoop around the waist.
    const beacon = part(geometries.ring, materials.beacon, [0, -0.72, 0], 'beacon'); beacon.rotation.x = Math.PI / 2;
    root.add(body, beacon);
    return root;
  }

  return { build, keepGeometries: new Set(Object.values(geometries)), keepMaterials: new Set(Object.values(materials)) };
}

/** Bob, slow drift turn toward the viewer, waving and a pulsing beacon. Derived from
 * time each frame, so nothing accumulates.
 * @param {THREE.Object3D} figure @param {number} t seconds @param {number} phase per-miner offset
 * @param {THREE.Vector3 | null} [viewer] world position to turn toward */
export function animateSurvivor(figure, t, phase, viewer = null) {
  const body = figure.getObjectByName('body'), wave = figure.getObjectByName('waveArm'), beacon = figure.getObjectByName('beacon');
  if (body) {
    body.position.y = Math.sin(t * 1.3 + phase) * 0.07;
    body.rotation.z = Math.sin(t * 0.7 + phase) * 0.08;
    if (viewer) {
      const local = viewer.clone().sub(figure.position);
      body.rotation.y = Math.atan2(local.x, local.z);
    }
  }
  if (wave) wave.rotation.z = -0.45 - 0.45 * (0.5 + 0.5 * Math.sin(t * 6 + phase));
  if (beacon) beacon.scale.setScalar(1 + 0.12 * Math.sin(t * 4 + phase));
  // The backpack beacon blinks on for 40% of each 0.8 s cycle.
  const blink = figure.getObjectByName('packBeacon');
  if (blink) blink.visible = ((t + phase) % 0.8 + 0.8) % 0.8 < 0.32;
}
