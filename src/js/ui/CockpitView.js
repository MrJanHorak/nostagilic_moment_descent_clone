import * as THREE from 'three';
import { drawExploration } from '../core/ExplorationMap.js';

/** A separate near-field scene keeps the cabin solid even beside mine walls.
 * The flight camera and weapon/collision transforms remain independent. */
export default class CockpitView {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 20);
    this.cabin = new THREE.Group(); this.scene.add(this.cabin);
    this.scene.add(new THREE.HemisphereLight(0xb2eaff, 0x111620, 2.4));
    const lamp = new THREE.DirectionalLight(0x7da9c3, 3); lamp.position.set(0, 2, 2); this.scene.add(lamp);
    const metal = new THREE.MeshStandardMaterial({ color: 0x172733, metalness: 0.65, roughness: 0.42 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x526d7b, metalness: 0.7, roughness: 0.35 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x47b4bc });
    const box = (/** @type {number[]} */ size, /** @type {number[]} */ position, /** @type {THREE.Material} */ material = metal) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.fromArray(position); this.cabin.add(mesh); return mesh;
    };
    const beam = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ radius, /** @type {THREE.Material} */ material = metal) => {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 6), material);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); this.cabin.add(mesh);
    };
    // Open windshield: perimeter ribs, sill and a recessed three-screen console.
    for (const side of [-1, 1]) {
      beam([side * 1.72, -1.35, -1.65], [side * 1.9, 1.5, -2.35], 0.065, trim);
      beam([side * 1.9, 1.5, -2.35], [side * 0.7, 1.35, -1.65], 0.075);
      beam([side * 1.6, -0.35, -2], [side * 0.55, -0.37, -1.8], 0.045, trim);
      box([0.4, 0.4, 1], [side * 1.9, -1.3, -1.5]);
      box([0.035, 0.025, 0.7], [side * 1.7, -1.08, -1.3], glow);
    }
    beam([-0.7, 1.35, -1.65], [0.7, 1.35, -1.65], 0.075);
    box([3.6, 0.32, 0.8], [0, -1.58, -1.9]);
    box([0.43, 0.06, 0.35], [0, -0.33, -1.95], trim);
    this.screens = [-1, 0, 1].map(side => {
      const frame = new THREE.Group(); frame.position.set(side * 1.12, -0.77, -1.8);
      frame.rotation.set(-0.16, -side * 0.16, 0); this.cabin.add(frame);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.73, 0.08), metal); frame.add(housing);
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cockpit display canvas unavailable');
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.65), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      panel.position.z = 0.046; frame.add(panel);
      return { ctx, texture, panel };
    });
    this.lastUpdate = -Infinity;
  }

  /** @param {import('../core/GameState.js').default} state
   * @param {import('../entities/Spaceship.js').default} ship
   * @param {import('../core/ExplorationMap.js').default | null} map
   * @param {readonly import('../combatContracts.js').EnemyInstance[]} enemies @param {ReadonlySet<string>} closed
   * @param {number} time */
  update(state, ship, map, enemies, closed, time) {
    if (time >= this.lastUpdate && time - this.lastUpdate < 100) return;
    this.lastUpdate = time;
    const [systems, weapons, survey] = this.screens.map(screen => screen.ctx);
    for (const ctx of [systems, weapons, survey]) {
      ctx.fillStyle = '#04131d'; ctx.fillRect(0, 0, 640, 400);
      ctx.strokeStyle = '#204653'; ctx.strokeRect(8, 8, 624, 384);
    }
    const text = (/** @type {CanvasRenderingContext2D} */ ctx, /** @type {string} */ value, /** @type {number} */ x, /** @type {number} */ y, size = 26, color = '#92c3ce') => {
      ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.fillText(value, x, y);
    };
    const shield = Math.max(0, Math.round(state.playerHealth / state.maxPlayerHealth * 100));
    const color = shield > 30 ? '#75f3cb' : '#ff9c62';
    text(systems, '01 / SHIP SYSTEMS', 24, 38);
    text(systems, `SHIELD  ${shield}%`, 24, 96, 46, color);
    systems.fillStyle = '#163540'; systems.fillRect(24, 117, 590, 12);
    systems.fillStyle = color; systems.fillRect(24, 117, 590 * shield / 100, 12);
    text(systems, `SPEED ${ship.velocity.length().toFixed(1)} m/s`, 24, 169, 30);
    text(systems, shield <= 30 ? 'WARNING / SHIELDS LOW' : 'LOCAL CONTACTS / 40 m', 24, 213, 24, color);
    systems.strokeStyle = '#346371'; systems.lineWidth = 1;
    for (const radius of [50, 76]) { systems.beginPath(); systems.ellipse(320, 303, radius * 2, radius, 0, 0, Math.PI * 2); systems.stroke(); }
    systems.beginPath(); systems.moveTo(155, 303); systems.lineTo(485, 303); systems.moveTo(320, 220); systems.lineTo(320, 380); systems.stroke();
    const inverse = ship.group.quaternion.clone().invert();
    let contacts = 0;
    for (const enemy of enemies) {
      if (!enemy.isActive) continue;
      const local = enemy.mesh.position.clone().sub(ship.group.position).applyQuaternion(inverse);
      if (local.length() > 40) continue;
      contacts++;
      const x = 320 + local.x / 40 * 150, y = 303 + local.z / 40 * 72;
      systems.strokeStyle = '#ff9d66'; systems.beginPath(); systems.moveTo(x, y); systems.lineTo(x, y - local.y * 1.3); systems.stroke();
      systems.fillStyle = '#ff9d66'; systems.fillRect(x - 3, y - local.y * 1.3 - 3, 6, 6);
    }
    text(systems, '▲', 313, 310, 20, '#ffffff'); text(systems, `${contacts}`, 570, 365);
    text(weapons, '02 / ARMAMENT', 24, 38);
    text(weapons, state.currentWeapon.toUpperCase(), 24, 92, 40, '#f8c784');
    const types = /** @type {const} */ (['pulse', 'laser', 'missile', 'plasma']);
    types.forEach((type, i) => {
      const item = state.weaponInventory[type], selected = state.currentWeapon === type;
      const y = 151 + i * 53;
      if (selected) { weapons.fillStyle = '#163a46'; weapons.fillRect(16, y - 28, 608, 43); }
      text(weapons, `${i + 1}  ${type.toUpperCase()}`, 28, y, 32, selected ? '#ffffff' : item.unlocked ? '#92c3ce' : '#506774');
      text(weapons, item.unlocked ? item.ammo === Infinity ? '∞' : String(item.ammo) : 'LOCKED', 470, y, 32, selected ? '#f8c784' : '#92c3ce');
    });
    text(weapons, '1–4 SELECT   /   CLICK · F FIRE', 24, 378, 24);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.group.quaternion);
    survey.save(); survey.translate(0, 55); drawExploration(survey, map, ship.group.position, forward, closed, 640, 292); survey.restore();
    text(survey, '03 / EXPLORED VOLUME', 24, 38);
    text(survey, `${map?.visited.size ?? 0} / ${map?.document.rooms.length ?? 0} ROOMS   ·   M EXPAND`, 24, 378, 24);
    for (const screen of this.screens) screen.texture.needsUpdate = true;
  }

  /** @param {THREE.WebGLRenderer} renderer @param {number} aspect @param {boolean} instruments */
  render(renderer, aspect, instruments) {
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    this.cabin.scale.x = Math.min(1, aspect / 1.5);
    // Hide only display planes when H disables instruments; retain the physical cabin.
    for (const screen of this.screens) screen.panel.visible = instruments;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(this.scene, this.camera); renderer.autoClear = autoClear;
  }
}
