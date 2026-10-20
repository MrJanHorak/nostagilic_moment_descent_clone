import * as THREE from 'three';

/** Small deterministic surface maps; repeating parts share their material/texture.
 * @param {number} color @param {boolean} [metal] */
function finish(color, metal = false) {
  const size = 128, paint = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hash = ((x * 13 + y * 37) ^ (x * y * 3)) & 31;
    const scuff = (y === 13 || y === 111) && x > 11 && x < 51;
    const shade = metal ? 217 + (y * 7 % 19) + hash / 5 : scuff ? 247 : 229 + hash / 2;
    const index = (y * size + x) * 4;
    paint.set([shade, shade, shade, 255], index);
    const textureRoughness = metal ? 155 + y % 4 * 14 : scuff ? 148 : 210 + hash;
    rough.set([textureRoughness, textureRoughness, textureRoughness, 255], index);
  }
  const map = new THREE.DataTexture(paint, size, size), roughnessMap = new THREE.DataTexture(rough, size, size);
  for (const texture of [map, roughnessMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ color, map, roughnessMap, roughness: metal ? 0.65 : 0.95, metalness: metal ? 0.7 : 0.22 });
  material.addEventListener('dispose', () => { map.dispose(); roughnessMap.dispose(); });
  return material;
}

/** Shared hard-surface cabin parts. The cabin has no collision or input authority. */
export default class CockpitInterior {
  constructor() {
    this.group = new THREE.Group(); this.group.name = 'industrialCockpit';
    const shell = finish(0x555c5c);
    const edge = finish(0x8a9290, true);
    const rubber = new THREE.MeshStandardMaterial({ color: 0x12191c, roughness: 0.95 });
    const recess = new THREE.MeshStandardMaterial({ color: 0x071015, roughness: 0.8 });
    const amber = new THREE.MeshBasicMaterial({ color: 0xb98c42 });
    const boxGeometry = new THREE.BoxGeometry();
    const boltGeometry = new THREE.CylinderGeometry(0.016, 0.016, 0.012, 6); boltGeometry.rotateX(Math.PI / 2);
    const box = (/** @type {number[]} */ size, /** @type {number[]} */ position, /** @type {THREE.Material} */ material = shell, parent = this.group) => {
      const mesh = new THREE.Mesh(boxGeometry, material); mesh.scale.fromArray(size); mesh.position.fromArray(position); parent.add(mesh); return mesh;
    };
    const beam = (/** @type {number[]} */ a, /** @type {number[]} */ b, width = 0.08, material = shell) => {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
      const mesh = box([width, start.distanceTo(end), width * 1.4], start.clone().add(end).multiplyScalar(0.5).toArray(), material);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return mesh;
    };
    const casework = (/** @type {number[][]} */ outline, depth = 0.18, material = shell, parent = this.group) => {
      const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.025, bevelThickness: 0.018 }), material);
      parent.add(mesh); return mesh;
    };
    const bolts = (/** @type {number[][]} */ points, parent = this.group) => {
      const mesh = new THREE.InstancedMesh(boltGeometry, edge, points.length), transform = new THREE.Object3D();
      points.forEach((p, i) => { transform.position.fromArray(p); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix); }); parent.add(mesh);
    };
    // A continuous cowl, raised central binnacle and lower apron share one silhouette.
    const cowl = casework([[-1.84, -1.36], [-1.76, -0.55], [-0.47, -0.49], [-0.35, -0.37], [0.35, -0.37], [0.47, -0.49], [1.76, -0.55], [1.84, -1.36], [0.6, -1.47], [-0.6, -1.47]], 0.34);
    cowl.position.z = -2.25;
    const apron = casework([[-1.65, -1.28], [-0.53, -1.22], [0, -1.32], [0.53, -1.22], [1.65, -1.28], [1.46, -1.62], [-1.46, -1.62]], 0.16, rubber);
    apron.position.z = -1.48;
    for (const side of [-1, 1]) {
      // Inward lower pillars define a forward trapezoid and two triangular side panes.
      const a = [side * 1.17, -0.43, -1.94], b = [side * 2.65, 1.8, -2.6], outer = [side * 1.94, -0.48, -1.79];
      beam(a, b, 0.105, rubber); beam(a, b, 0.061, edge);
      beam(outer, b, 0.07, rubber); beam(a, outer, 0.065, shell);
      beam(b, [side * 0.68, 1.45, -1.9], 0.085);
      // Very faint glass only in the side facets; the central sight line stays clear.
      const glassGeometry = new THREE.BufferGeometry();
      glassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...outer], 3));
      const glass = new THREE.Mesh(glassGeometry, new THREE.MeshBasicMaterial({ color: 0xa2c9d2, transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide }));
      this.group.add(glass);
      beam([side * 1.76, -0.48, -1.93], [side * 0.48, -0.43, -1.95], 0.065, rubber);
      box([0.26, 0.55, 0.9], [side * 1.64, -1.14, -1.26], shell);
      box([0.21, 0.028, 0.62], [side * 1.64, -0.85, -1.26], rubber);
      const vent = new THREE.InstancedMesh(boxGeometry, recess, 7), transform = new THREE.Object3D();
      for (let i = 0; i < 7; i++) {
        transform.position.set(side * 1.54, -0.58 - i * 0.038, -1.62); transform.scale.set(0.18, 0.014, 0.025); transform.updateMatrix(); vent.setMatrixAt(i, transform.matrix);
      }
      this.group.add(vent);
      // Small warning chevrons and exposed sill catches, rather than luminous rails.
      for (let i = 0; i < 3; i++) {
        const stripe = box([0.055, 0.018, 0.012], [side * (1.48 + i * 0.06), -0.53, -1.59], amber); stripe.rotation.z = -0.4;
      }
      box([0.15, 0.045, 0.08], [side * 1.48, -0.39, -1.92], edge);
      // Shallow overhangs shade the instrument recesses without covering the text.
      const hood = box([1.12, 0.045, 0.36], [side * 1.02, -0.36, -1.92], shell); hood.rotation.x = -0.12;
      box([1.06, 0.012, 0.3], [side * 1.02, -0.39, -1.92], rubber);
    }
    beam([-0.68, 1.45, -1.9], [0.68, 1.45, -1.9], 0.09);

    // Unequal instrument housings sit in the cowl, with recessed glass and fasteners.
    this.mounts = [-1, 1].map(side => {
      const frame = new THREE.Group(); frame.position.set(side * 1.02, -0.78, -1.72); frame.rotation.set(-0.12, -side * 0.16, 0); this.group.add(frame);
      casework([[-0.59, -0.4], [-0.6, 0.28], [-0.5, 0.4], [0.52, 0.4], [0.6, 0.3], [0.59, -0.4]], 0.09, shell, frame);
      box([1.08, 0.71, 0.025], [0, 0, 0.101], rubber, frame);
      bolts([[-0.54, 0.31, 0.11], [0.54, 0.31, 0.11], [-0.54, -0.33, 0.11], [0.54, -0.33, 0.11]], frame);
      return frame;
    });
    this.gauge = new THREE.Group(); this.gauge.position.set(0, -0.76, -1.57); this.gauge.rotation.x = -0.12; this.group.add(this.gauge);
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.43, 0.11, 12), shell); socket.rotation.x = Math.PI / 2; this.gauge.add(socket);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.354, 0.022, 4, 48), edge); rim.position.z = 0.07; this.gauge.add(rim);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.012, 4, 48), rubber); seal.position.z = 0.083; this.gauge.add(seal);
    bolts([[-0.27, 0.27, 0.09], [0.27, 0.27, 0.09], [-0.27, -0.27, 0.09], [0.27, -0.27, 0.09]], this.gauge);
    this.gauge.scale.setScalar(0.82);
    this.gauge.position.y = -0.8;

    // Painted labels and tactile switch banks keep the operator's scale visible.
    const labels = document.createElement('canvas'); labels.width = 512; labels.height = 96;
    const ctx = labels.getContext('2d');
    if (!ctx) throw new Error('Cockpit label canvas unavailable');
    ctx.fillStyle = '#252c2d'; ctx.fillRect(0, 0, 512, 96);
    ctx.font = '35px monospace'; ctx.fillStyle = '#c2c2aa'; ctx.fillText('D-07 / INTERCEPTOR', 24, 40);
    ctx.font = '23px monospace'; ctx.fillStyle = '#bc934d'; ctx.fillText('CAUTION / SIX AXIS THRUST', 24, 77);
    // Light scratches confined to paint; no windshield dirt obscures the mine.
    ctx.strokeStyle = '#71776b'; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const x = 7 + i * 43; ctx.beginPath(); ctx.moveTo(x, 6 + i % 3 * 41); ctx.lineTo(x + 10, 3 + i % 3 * 41); ctx.stroke(); }
    const labelTexture = new THREE.CanvasTexture(labels); labelTexture.colorSpace = THREE.SRGBColorSpace;
    const placard = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.1), new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false }));
    placard.position.set(0, -0.32, -1.89); this.group.add(placard);
    const switchBank = (/** @type {number} */ side) => {
      const bank = new THREE.Group(); bank.position.set(side * 1.84, -1.03, -1.68); bank.rotation.y = -side * 0.3; this.group.add(bank);
      box([0.22, 0.34, 0.06], [0, 0, 0], rubber, bank);
      for (let i = 0; i < 3; i++) {
        box([0.065, 0.04, 0.018], [0.035, 0.105 - i * 0.1, 0.043], edge, bank);
        const toggle = box([0.018, 0.055, 0.025], [0.035, 0.12 - i * 0.1, 0.07], edge, bank); toggle.rotation.x = -0.35;
      }
    };
    switchBank(-1); switchBank(1);
    this.lampMaterials = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: 0x31413a, emissive: 0x85cf9e, emissiveIntensity: 0.3, roughness: 0.4 }));
    this.lampMaterials.forEach((material, i) => box([0.055, 0.024, 0.035], [(i - 1) * 0.1, -0.32, -1.66], material));
    // A guarded emergency switch and two real-looking hand controls occupy the lower corners.
    box([0.13, 0.075, 0.07], [-0.4, -0.42, -1.75], recess);
    box([0.045, 0.035, 0.04], [-0.4, -0.4, -1.7], new THREE.MeshStandardMaterial({ color: 0xb14b37 }));
    for (const x of [-0.47, -0.33]) box([0.018, 0.11, 0.08], [x, -0.4, -1.69], edge);
    box([0.16, 0.018, 0.08], [-0.4, -0.34, -1.69], edge);
    this.stick = new THREE.Group(); this.stick.position.set(1.66, -1.0, -1.5); this.group.add(this.stick);
    box([0.22, 0.09, 0.23], [0, 0, 0], rubber, this.stick);
    for (let i = 0; i < 4; i++) box([0.15 - i * 0.02, 0.025, 0.13 - i * 0.01], [0, 0.065 + i * 0.025, 0], rubber, this.stick);
    box([0.05, 0.23, 0.06], [0, 0.23, 0], edge, this.stick);
    const grip = casework([[-0.04, -0.1], [-0.06, -0.06], [-0.06, 0.07], [-0.025, 0.11], [0.05, 0.08], [0.06, -0.07], [0.025, -0.1]], 0.09, rubber, this.stick);
    grip.position.set(0, 0.37, -0.045); grip.rotation.x = -0.15;
    box([0.025, 0.055, 0.015], [0, 0.36, 0.08], edge, this.stick);
    box([0.055, 0.025, 0.045], [0, 0.48, -0.02], amber, this.stick);
    this.throttle = new THREE.Group(); this.throttle.position.set(-1.66, -0.80, -1.5); this.group.add(this.throttle);
    box([0.27, 0.05, 0.38], [0, -0.1, 0], rubber, this.throttle);
    box([0.035, 0.22, 0.045], [0, 0, 0], edge, this.throttle);
    box([0.22, 0.075, 0.12], [0, 0.13, 0], rubber, this.throttle);
  }
}
