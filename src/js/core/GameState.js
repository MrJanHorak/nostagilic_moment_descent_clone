import GameSession from './GameSession.js';
import { shakeCamera } from '../utils/effectsUtils.js';
import { getDifficulty, scaleIncomingDamage } from './Difficulty.js';
import Pilot from './Pilot.js';

function createEnemyKills() { return { scout: 0, fighter: 0, bomber: 0, destroyer: 0, boss: 0 }; }
function createWeaponPickups() { return { laser: 0, missile: 0, plasma: 0 }; }

export default class GameState {
  constructor() {
    this.session = new GameSession();
    /** This screen's pilot. Single-player properties below are views of it. */
    this.localPilot = new Pilot({ id: 'local', local: true });
    /** Every pilot in the session, local first. @type {Pilot[]} */
    this.pilots = [this.localPilot];
    /** Snapshotted at mission start; Pilot leaves authored balance unchanged.
     * @type {import('./Difficulty.js').DifficultyTier} */
    this.difficulty = getDifficulty(undefined);
    /** Shared by all pilots. @type {number} */
    this.score = 0;
    /** @type {Record<import('../contracts.js').EnemyType, number>} */
    this.enemyKills = createEnemyKills();
    /** @type {Record<Exclude<import('../contracts.js').WeaponType, 'pulse'>, number>} */
    this.weaponPickups = createWeaponPickups();
    /** @type {import('three').Camera | null} */
    this.camera = null;
    /** @type {import('three').Vector3 | null} */
    this.playerVelocity = null;
    /** @type {import('../contracts.js').PlayerAudio | null} */
    this.audioManager = null;
    /** @type {import('../contracts.js').PlayerFeedback | null} */
    this.uiManager = null;
    /** @type {import('../contracts.js').PlayerSessionActions | null} */
    this.game = null;
    /** @type {import('../contracts.js').SimulationAnimation[]} */
    this.activeAnimations = [];
  }

  // Single-player views of the local pilot, kept so the HUD, cockpit and older
  // code read and write exactly as before.
  get maxPlayerHealth() { return this.localPilot.maxHealth; }
  set maxPlayerHealth(value) { this.localPilot.maxHealth = value; }
  get playerHealth() { return this.localPilot.health; }
  set playerHealth(value) { this.localPilot.health = value; }
  get currentWeapon() { return this.localPilot.currentWeapon; }
  set currentWeapon(value) { this.localPilot.currentWeapon = value; }
  get weaponInventory() { return this.localPilot.weaponInventory; }
  set weaponInventory(value) { this.localPilot.weaponInventory = value; }
  get pulseAmmoCapacity() { return this.localPilot.pulseAmmoCapacity; }
  set pulseAmmoCapacity(value) { this.localPilot.pulseAmmoCapacity = value; }
  get speedMultiplier() { return this.localPilot.speedMultiplier; }
  set speedMultiplier(value) { this.localPilot.speedMultiplier = value; }
  get weaponPower() { return this.localPilot.weaponPower; }
  set weaponPower(value) { this.localPilot.weaponPower = value; }
  get modifierTimers() { return this.localPilot.modifierTimers; }

  /** Add another pilot (a remote player, or a second ship in a test).
   * @param {{id: string, ship?: import('../entities/Spaceship.js').default | null, local?: boolean}} options */
  addPilot(options) {
    if (this.pilots.some(pilot => pilot.id === options.id)) throw new Error(`Pilot ${options.id} is already in this session`);
    const pilot = new Pilot({ ...options, local: false, maxHealth: this.localPilot.maxHealth });
    this.pilots.push(pilot);
    return pilot;
  }
  /** @param {string} id */
  removePilot(id) {
    const pilot = this.pilots.find(candidate => candidate.id === id);
    if (!pilot || pilot.local) return false;
    for (const timer of pilot.modifierTimers.values()) this.session.cancel(timer);
    this.pilots = this.pilots.filter(candidate => candidate !== pilot);
    return true;
  }
  /** @param {string} id */
  pilot(id) { return this.pilots.find(candidate => candidate.id === id) ?? null; }

  // Compatibility views; UI/managers no longer independently toggle these flags.
  get isGameStarted() { return ['playing', 'paused', 'dead', 'completed'].includes(this.session.phase); }
  get isGameOver() { return this.session.phase === 'dead'; }
  get isPaused() { return this.session.phase === 'paused'; }

  resetForSession() {
    this.score = 0;
    this.enemyKills = createEnemyKills();
    this.weaponPickups = createWeaponPickups();
    for (const pilot of this.pilots) pilot.resetForSession(this.session);
    this.uiManager?.updateWeaponUI();
  }

  /** @param {import('../contracts.js').EnemyType} type */
  recordEnemyKill(type) {
    if (this.enemyKills[type] !== undefined) this.enemyKills[type]++;
    this.uiManager?.updateKillCounter?.(this.enemyKills);
  }

  /** @param {Exclude<import('../contracts.js').WeaponType, 'pulse'>} type */
  recordWeaponPickup(type) {
    if (this.weaponPickups[type] !== undefined) this.weaponPickups[type]++;
  }

  /** @param {import('../contracts.js').WeaponType} type @param {Pilot} [pilot] */
  switchWeapon(type, pilot = this.localPilot) {
    if (this.session.phase !== 'playing' || !pilot.weaponInventory[type]?.unlocked) return false;
    pilot.currentWeapon = type;
    if (pilot.local) { this.uiManager?.updateWeaponUI(); this.audioManager?.playSound('weaponSwitch', { volume: 0.3 }); }
    return true;
  }

  /** @param {import('../contracts.js').WeaponType} type @param {number} amount @param {Pilot} [pilot] */
  addWeaponAmmo(type, amount, pilot = this.localPilot) {
    const weapon = pilot.weaponInventory[type];
    if (!weapon) return;
    weapon.unlocked = true;
    if (weapon.ammo !== Infinity) weapon.ammo += amount;
    if (pilot.local) this.uiManager?.updateWeaponUI();
  }

  /** @param {Pilot} [pilot] */
  resetWeaponInventory(pilot = this.localPilot) {
    pilot.resetWeapons();
    if (pilot.local) this.uiManager?.updateWeaponUI();
  }

  /** @param {import('three').Camera | null} camera
   * @param {import('../contracts.js').PlayerAudio | null} audioManager
   * @param {import('../contracts.js').PlayerFeedback | null} uiManager
   * @param {import('../contracts.js').SimulationAnimation[]} activeAnimations
   * @param {import('../contracts.js').PlayerSessionActions | null} [game]
   */
  setReferences(camera, audioManager, uiManager, activeAnimations, game = null) {
    this.camera = camera;
    this.audioManager = audioManager;
    this.uiManager = uiManager;
    this.activeAnimations = activeAnimations;
    this.game = game;
  }

  /** @param {import('../contracts.js').TimedModifier} property @param {number} value
   * @param {number} durationMs @param {string} expiredMessage @param {Pilot} [pilot]
   */
  applyTimedModifier(property, value, durationMs, expiredMessage, pilot = this.localPilot) {
    if (this.session.phase !== 'playing') return false;
    if (!['speedMultiplier', 'weaponPower'].includes(property)) throw new Error('Unknown timed modifier');
    const previous = pilot.modifierTimers.get(property);
    if (previous !== undefined) this.session.cancel(previous);
    pilot[property] = value;
    pilot.modifierTimers.set(property, this.session.schedule(durationMs, () => {
      pilot[property] = 1;
      pilot.modifierTimers.delete(property);
      if (pilot.local) this.uiManager?.showMessage(expiredMessage, 1500, '#00ffff');
    }));
  }

  /** Damage one pilot (the local one by default). Only the local pilot's damage
   * reaches this screen's HUD, audio and camera.
   * @param {number} amount @param {Pilot} [pilot] */
  takeDamage(amount, pilot = this.localPilot) {
    if (this.session.phase !== 'playing' || amount <= 0 || !pilot.alive) return;
    amount = scaleIncomingDamage(amount, this.difficulty);
    pilot.health = Math.max(0, pilot.health - amount);
    if (!pilot.local) { if (pilot.health === 0) pilot.alive = false; return; }
    this.audioManager?.playSound('playerDamage', { volume: 0.6 });
    this.uiManager?.updateHUD();
    this.uiManager?.flash?.('rgba(255, 0, 0, 0.3)');
    if (this.playerHealth === 0) this.gameOver();
    else if (this.camera) {
      const viewEffects = this.game?.spaceship?.viewEffects;
      this.activeAnimations.push(shakeCamera(viewEffects ?? this.camera,
        Math.min(1, amount / 20), viewEffects ? { x: 0, y: 0, z: 0 } : this.camera.position));
    }
  }

  /** @param {number} amount @param {Pilot} [pilot] */
  healPlayer(amount, pilot = this.localPilot) {
    if (this.session.phase !== 'playing' || !pilot.alive) return;
    pilot.health = Math.min(pilot.maxHealth, pilot.health + amount);
    if (!pilot.local) return;
    this.uiManager?.updateHUD();
    this.uiManager?.flash?.('rgba(0, 255, 0, 0.2)');
    this.audioManager?.playSound('healSound', { volume: 0.5 });
  }

  gameOver() { return this.game?.die() ?? false; }
  levelCompleted() { return this.game?.completeSession() ?? false; }
}
