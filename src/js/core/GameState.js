import GameSession from './GameSession.js';
import { shakeCamera } from '../utils/effectsUtils.js';

function createEnemyKills() { return { scout: 0, fighter: 0, bomber: 0, destroyer: 0, boss: 0 }; }
function createWeaponPickups() { return { laser: 0, missile: 0, plasma: 0 }; }
/** @returns {import('../contracts.js').WeaponInventory} */
function createWeaponInventory() {
  return {
    pulse: { unlocked: true, ammo: Infinity },
    laser: { unlocked: false, ammo: 0 },
    missile: { unlocked: false, ammo: 0 },
    plasma: { unlocked: false, ammo: 0 },
  };
}

export default class GameState {
  constructor() {
    this.session = new GameSession();
    this.maxPlayerHealth = 100;
    /** @type {number} */
    this.playerHealth = this.maxPlayerHealth;
    /** @type {number} */
    this.score = 0;
    /** @type {number} */
    this.speedMultiplier = 1;
    /** @type {number} */
    this.weaponPower = 1;
    /** @type {number} */
    this.pulseAmmoCapacity = Infinity;
    /** @type {import('../contracts.js').WeaponType} */
    this.currentWeapon = 'pulse';
    /** @type {import('../contracts.js').WeaponInventory} */
    this.weaponInventory = createWeaponInventory();
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
    /** @type {Map<import('../contracts.js').TimedModifier, number>} */
    this.modifierTimers = new Map();
  }

  // Compatibility views; UI/managers no longer independently toggle these flags.
  get isGameStarted() { return ['playing', 'paused', 'dead', 'completed'].includes(this.session.phase); }
  get isGameOver() { return this.session.phase === 'dead'; }
  get isPaused() { return this.session.phase === 'paused'; }

  resetForSession() {
    this.playerHealth = this.maxPlayerHealth;
    this.score = 0;
    this.speedMultiplier = 1;
    this.weaponPower = 1;
    for (const timer of this.modifierTimers.values()) this.session.cancel(timer);
    this.modifierTimers.clear();
    this.enemyKills = createEnemyKills();
    this.weaponPickups = createWeaponPickups();
    this.resetWeaponInventory();
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

  /** @param {import('../contracts.js').WeaponType} type */
  switchWeapon(type) {
    if (this.session.phase !== 'playing' || !this.weaponInventory[type]?.unlocked) return false;
    this.currentWeapon = type;
    this.uiManager?.updateWeaponUI();
    this.audioManager?.playSound('weaponSwitch', { volume: 0.3 });
    return true;
  }

  /** @param {import('../contracts.js').WeaponType} type @param {number} amount */
  addWeaponAmmo(type, amount) {
    const weapon = this.weaponInventory[type];
    if (!weapon) return;
    weapon.unlocked = true;
    if (weapon.ammo !== Infinity) weapon.ammo += amount;
    this.uiManager?.updateWeaponUI();
  }

  resetWeaponInventory() {
    this.pulseAmmoCapacity = Infinity;
    this.currentWeapon = 'pulse';
    this.weaponInventory = createWeaponInventory();
    this.uiManager?.updateWeaponUI();
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
   * @param {number} durationMs @param {string} expiredMessage
   */
  applyTimedModifier(property, value, durationMs, expiredMessage) {
    if (this.session.phase !== 'playing') return false;
    if (!['speedMultiplier', 'weaponPower'].includes(property)) throw new Error('Unknown timed modifier');
    const previous = this.modifierTimers.get(property);
    if (previous !== undefined) this.session.cancel(previous);
    this[property] = value;
    this.modifierTimers.set(property, this.session.schedule(durationMs, () => {
      this[property] = 1;
      this.modifierTimers.delete(property);
      this.uiManager?.showMessage(expiredMessage, 1500, '#00ffff');
    }));
  }

  /** @param {number} amount */
  takeDamage(amount) {
    if (this.session.phase !== 'playing' || amount <= 0) return;
    this.playerHealth = Math.max(0, this.playerHealth - amount);
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

  /** @param {number} amount */
  healPlayer(amount) {
    if (this.session.phase !== 'playing') return;
    this.playerHealth = Math.min(this.maxPlayerHealth, this.playerHealth + amount);
    this.uiManager?.updateHUD();
    this.uiManager?.flash?.('rgba(0, 255, 0, 0.2)');
    this.audioManager?.playSound('healSound', { volume: 0.5 });
  }

  gameOver() { return this.game?.die() ?? false; }
  levelCompleted() { return this.game?.completeSession() ?? false; }
}
