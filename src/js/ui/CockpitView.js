import * as THREE from 'three';
import { drawExploration } from '../core/ExplorationMap.js';
import CockpitInterior from './CockpitInterior.js';
import { MATERIALS } from '../core/levels/document/LevelContent.js';

/** Near-field presentation only; the flight camera and weapon origin stay fixed. */
export default class CockpitView {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 20);
    this.interior = new CockpitInterior(); this.cabin = this.interior.group; this.scene.add(this.cabin);
    this.ambient = new THREE.HemisphereLight(0xa4bdca, 0x24221e, 1.7); this.scene.add(this.ambient);
    this.keyLight = new THREE.DirectionalLight(0xffe0b9, 2.6); this.keyLight.position.set(-1, 2, 3); this.scene.add(this.keyLight);
    this.warningLight = new THREE.PointLight(0xff4f29, 0, 4, 2); this.warningLight.position.set(0, -0.15, -1.1); this.scene.add(this.warningLight);
    this.weaponLight = new THREE.PointLight(0x8adeff, 0, 4, 2); this.weaponLight.position.set(-0.9, -0.3, -1.2); this.scene.add(this.weaponLight);
    const screen = (/** @type {THREE.Group} */ mount, /** @type {number} */ width, /** @type {number} */ height, round = false) => {
      const canvas = document.createElement('canvas'); canvas.width = round ? 512 : 640; canvas.height = round ? 512 : 440;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Cockpit display canvas unavailable');
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
      const panel = new THREE.Mesh(round ? new THREE.CircleGeometry(width / 2, 64) : new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
      panel.position.z = round ? 0.09 : 0.12; mount.add(panel);
      return { ctx, texture, panel };
    };
    this.screens = [screen(this.interior.mounts[0], 1.02, 0.68), screen(this.interior.gauge, 0.64, 0.64, true), screen(this.interior.mounts[1], 1.02, 0.68)];
    this.lastUpdate = -Infinity; this.lastHealth = 100; this.lastAmmo = Infinity; this.lastWeapon = 'pulse';
    this.damageAt = -Infinity; this.shotAt = -Infinity; this.attitude = new THREE.Quaternion();
  }

  /** @param {import('../core/GameState.js').default} state
   * @param {import('../entities/Spaceship.js').default} ship
   * @param {import('../core/ExplorationMap.js').default | null} map
   * @param {readonly import('../combatContracts.js').EnemyInstance[]} enemies @param {ReadonlySet<string>} closed
   * @param {number} time @param {boolean} [headlights] */
  update(state, ship, map, enemies, closed, time, headlights = true) {
    if (time >= this.lastUpdate && time - this.lastUpdate < 100) return;
    if (time < this.lastUpdate || this.lastUpdate === -Infinity) {
      this.damageAt = this.shotAt = -Infinity; this.lastHealth = state.playerHealth;
      this.lastWeapon = state.currentWeapon; this.lastAmmo = state.weaponInventory[state.currentWeapon].ammo; this.attitude.copy(ship.group.quaternion);
    }
    this.lastUpdate = time;
    // Approximate room bounce from authored surface colors, without another world render.
    const room = map?.current ? map.navigation.rooms.get(map.current)?.room : null;
    const tint = new THREE.Color(room ? MATERIALS[room.materialPreset].wall : 0x647883);
    let samples = 1;
    for (const face of Object.values(room?.surfaces ?? {})) if (typeof face.color === 'number') tint.lerp(new THREE.Color(face.color), 1 / ++samples);
    this.ambient.color.set(0xa4bdca).lerp(tint, 0.28);
    this.ambient.groundColor.set(0x24221e).lerp(tint, 0.3);
    this.keyLight.color.set(0xffe0b9).lerp(tint, 0.16);
    const [weapons, systems, survey] = this.screens.map(screen => screen.ctx);
    for (const ctx of [weapons, systems, survey]) {
      ctx.fillStyle = '#071316'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.strokeStyle = '#28413f'; ctx.lineWidth = 1; ctx.strokeRect(10, 10, ctx.canvas.width - 20, ctx.canvas.height - 20);
    }
    const text = (/** @type {CanvasRenderingContext2D} */ ctx, /** @type {string} */ value, /** @type {number} */ x, /** @type {number} */ y, size = 26, color = '#b5c6b9') => {
      ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.fillText(value, x, y);
    };
    const shield = Math.max(0, Math.min(100, Math.round(state.playerHealth / state.maxPlayerHealth * 100)));
    const color = shield > 30 ? '#9be2ca' : '#ff8861';
    const inventory = state.weaponInventory[state.currentWeapon], ammo = inventory.ammo;
    if (state.playerHealth < this.lastHealth) this.damageAt = time;
    if (this.lastWeapon === state.currentWeapon && ammo < this.lastAmmo) this.shotAt = time;
    this.lastHealth = state.playerHealth; this.lastAmmo = ammo; this.lastWeapon = state.currentWeapon;
    this.warningLight.intensity = Math.max(0, 1 - (time - this.damageAt) / 500) * 1.6 + (shield <= 30 ? 0.25 + Math.sin(time / 230) * 0.12 : 0);
    this.weaponLight.intensity = Math.max(0, 1 - (time - this.shotAt) / 200) * 0.9;
    this.interior.lampMaterials.forEach((material, i) => {
      material.emissive.set(i === 2 ? shield > 30 ? 0x76cbaa : 0xff5130 : i === 0 ? 0xb3d9e0 : 0xd8a553);
      material.emissiveIntensity = i === 0 && !headlights || i === 1 && ammo <= 0 ? 0 : 0.9;
    });
    const localVelocity = ship.velocity.clone().applyQuaternion(ship.group.quaternion.clone().invert());
    const turn = new THREE.Euler().setFromQuaternion(this.attitude.clone().invert().multiply(ship.group.quaternion)); this.attitude.copy(ship.group.quaternion);
    this.interior.stick.rotation.set(THREE.MathUtils.clamp(-turn.x * 2, -0.18, 0.18), 0, THREE.MathUtils.clamp(turn.y * 2, -0.18, 0.18));
    this.interior.throttle.rotation.x = THREE.MathUtils.clamp(localVelocity.z / ship.maxSpeed * 0.25, -0.25, 0.25);

    // A dedicated round defence instrument, with a ship outline and local drift cue.
    systems.lineWidth = 16;
    for (let i = 0; i < 24; i++) {
      systems.strokeStyle = i < Math.ceil(shield / 100 * 24) ? color : '#233a39';
      systems.beginPath(); systems.arc(256, 256, 220, -Math.PI * 0.5 + i * Math.PI / 12 + 0.025, -Math.PI * 0.5 + (i + 1) * Math.PI / 12 - 0.025); systems.stroke();
    }
    systems.textAlign = 'center'; text(systems, 'SHIELDS', 256, 103, 30);
    text(systems, `${shield}%`, 256, 183, 80, '#eff8e8');
    systems.strokeStyle = color; systems.lineWidth = 4;
    systems.beginPath(); systems.moveTo(256, 207); systems.lineTo(282, 250); systems.lineTo(333, 280); systems.lineTo(333, 306); systems.lineTo(279, 285); systems.lineTo(256, 300); systems.lineTo(233, 285); systems.lineTo(179, 306); systems.lineTo(179, 280); systems.lineTo(230, 250); systems.closePath(); systems.stroke();
    text(systems, shield <= 30 ? 'SHIELD CRITICAL' : 'DEFENCE ONLINE', 256, 346, 22, color);
    text(systems, `${ship.velocity.length().toFixed(1)} m/s`, 256, 402, 40, '#e6e6d1');
    // No gravity horizon: the small cue shows velocity in the ship's own axes.
    systems.strokeStyle = '#d7ad66'; systems.lineWidth = 3; systems.beginPath(); systems.moveTo(256, 264); systems.lineTo(256 + localVelocity.x * 8, 264 - localVelocity.y * 8); systems.stroke();
    systems.textAlign = 'left';

    text(weapons, '01 / WEAPONS', 24, 40, 25, '#afbaac');
    text(weapons, state.currentWeapon.toUpperCase(), 24, 104, 54, '#efd6a5');
    text(weapons, 'ROUNDS', 414, 159, 23);
    text(weapons, ammo === Infinity ? '∞' : String(ammo), 410, 232, 76, ammo === 0 ? '#ff8861' : '#f7efda');
    this.drawWeapon(weapons, state.currentWeapon);
    const types = /** @type {const} */ (['pulse', 'laser', 'missile', 'plasma']);
    types.forEach((type, i) => {
      const selected = type === state.currentWeapon, item = state.weaponInventory[type], x = 20 + i * 153;
      weapons.fillStyle = selected ? '#30443c' : '#0d1c1e'; weapons.fillRect(x, 310, 145, 82);
      text(weapons, `${i + 1} ${type.toUpperCase()}`, x + 9, 340, 21, item.unlocked ? '#e7dfc7' : '#697b73');
      text(weapons, item.unlocked ? item.ammo === Infinity ? '∞' : String(item.ammo) : '—', x + 9, 375, 27, selected ? '#f4cb7c' : '#899b90');
    });
    text(weapons, '1–4 SELECT    CLICK / F FIRE', 24, 425, 23);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.group.quaternion);
    survey.save(); survey.translate(0, 48); drawExploration(survey, map, ship.group.position, forward, closed, 640, 245); survey.restore();
    text(survey, '02 / NAVIGATION', 24, 40, 25, '#afbaac');
    text(survey, `${map?.visited.size ?? 0}/${map?.document.rooms.length ?? 0} ROOMS   M: MAP`, 24, 320, 24);
    survey.save(); survey.beginPath(); survey.rect(14, 331, 612, 78); survey.clip();
    survey.strokeStyle = '#41625b'; survey.lineWidth = 1.5;
    for (const r of [0.5, 1]) { survey.beginPath(); survey.ellipse(320, 371, 220 * r, 34 * r, 0, 0, Math.PI * 2); survey.stroke(); }
    survey.beginPath(); survey.moveTo(100, 371); survey.lineTo(540, 371); survey.moveTo(320, 334); survey.lineTo(320, 408); survey.stroke();
    let contacts = 0;
    const inverse = ship.group.quaternion.clone().invert();
    for (const enemy of enemies) {
      if (!enemy.isActive) continue;
      const local = enemy.mesh.position.clone().sub(ship.group.position).applyQuaternion(inverse);
      if (local.length() > 40) continue;
      contacts++; const x = 320 + local.x / 40 * 220, y = 371 + local.z / 40 * 34, tip = y - THREE.MathUtils.clamp(local.y, -22, 22);
      survey.strokeStyle = '#edaf72'; survey.beginPath(); survey.moveTo(x, y); survey.lineTo(x, tip); survey.stroke();
      survey.fillStyle = '#edaf72'; survey.fillRect(x - 4, tip - 4, 8, 8);
    }
    text(survey, '▲', 310, 380, 25, '#ffffff'); survey.restore();
    text(survey, `CONTACTS ${contacts}    RANGE 40 m`, 24, 430, 22);
    for (const screen of this.screens) screen.texture.needsUpdate = true;
  }

  /** Original simple weapon silhouettes, drawn directly on the instrument.
   * @param {CanvasRenderingContext2D} ctx @param {import('../contracts.js').WeaponType} type */
  drawWeapon(ctx, type) {
    ctx.save(); ctx.translate(50, 155); ctx.fillStyle = '#7c9691'; ctx.strokeStyle = '#c5d6bb'; ctx.lineWidth = 3;
    if (type === 'missile') {
      ctx.beginPath(); ctx.moveTo(275, 62); ctx.lineTo(220, 37); ctx.lineTo(55, 37); ctx.lineTo(28, 12); ctx.lineTo(28, 112); ctx.lineTo(55, 87); ctx.lineTo(220, 87); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(30, 28, 95, 80); ctx.strokeRect(30, 28, 95, 80); ctx.fillStyle = '#acb8a4';
      for (const y of type === 'pulse' ? [36, 84] : [60]) { ctx.fillRect(108, y, 168, 16); ctx.strokeRect(108, y, 168, 16); }
      if (type === 'plasma') for (let i = 0; i < 5; i++) { ctx.strokeStyle = '#83d7c7'; ctx.strokeRect(125 + i * 28, 41, 12, 53); }
      if (type === 'laser') { ctx.strokeStyle = '#e7bd79'; ctx.beginPath(); ctx.arc(75, 68, 24, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
  }

  /** @param {THREE.WebGLRenderer} renderer @param {number} aspect @param {boolean} instruments */
  render(renderer, aspect, instruments) {
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); this.cabin.scale.x = Math.min(1, aspect / 1.5);
    for (const screen of this.screens) screen.panel.visible = instruments;
    const autoClear = renderer.autoClear;
    try { renderer.autoClear = false; renderer.clearDepth(); renderer.render(this.scene, this.camera); }
    finally { renderer.autoClear = autoClear; }
  }
}
