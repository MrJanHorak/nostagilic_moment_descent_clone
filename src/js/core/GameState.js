import GameSession from './GameSession.js';
import { shakeCamera } from '../utils/effectsUtils.js';

export default class GameState {
  constructor() {
    this.session = new GameSession();
    this.maxPlayerHealth = 100;
    this.activeAnimations = [];
    this.modifierTimers = new Map();
    this.resetForSession();
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
    this.enemyKills = { scout: 0, fighter: 0, bomber: 0, destroyer: 0, boss: 0 };
    this.weaponPickups = { laser: 0, missile: 0, plasma: 0 };
    this.resetWeaponInventory();
  }

  recordEnemyKill(type) {
    if (this.enemyKills[type] !== undefined) this.enemyKills[type]++;
    this.uiManager?.updateKillCounter?.(this.enemyKills);
  }

  recordWeaponPickup(type) {
    if (this.weaponPickups[type] !== undefined) this.weaponPickups[type]++;
  }

  switchWeapon(type) {
    if (this.session.phase !== 'playing' || !this.weaponInventory[type]?.unlocked) return false;
    this.currentWeapon = type;
    this.uiManager?.updateWeaponUI();
    this.audioManager?.playSound('weaponSwitch', { volume: 0.3 });
    return true;
  }

  addWeaponAmmo(type, amount) {
    const weapon = this.weaponInventory[type];
    if (!weapon) return;
    weapon.unlocked = true;
    if (weapon.ammo !== Infinity) weapon.ammo += amount;
    this.uiManager?.updateWeaponUI();
  }

  resetWeaponInventory() {
    this.currentWeapon = 'pulse';
    this.weaponInventory = {
      pulse: { unlocked: true, ammo: Infinity },
      laser: { unlocked: false, ammo: 0 },
      missile: { unlocked: false, ammo: 0 },
      plasma: { unlocked: false, ammo: 0 },
    };
    this.uiManager?.updateWeaponUI();
  }

  setReferences(camera, audioManager, uiManager, activeAnimations, game = null) {
    Object.assign(this, { camera, audioManager, uiManager, activeAnimations, game });
  }

  applyTimedModifier(property, value, durationMs, expiredMessage) {
    if (this.session.phase !== 'playing') return false;
    if (!['speedMultiplier', 'weaponPower'].includes(property)) throw new Error('Unknown timed modifier');
    this.session.cancel(this.modifierTimers.get(property));
    this[property] = value;
    this.modifierTimers.set(property, this.session.schedule(durationMs, () => {
      this[property] = 1;
      this.modifierTimers.delete(property);
      this.uiManager?.showMessage(expiredMessage, 1500, '#00ffff');
    }));
  }

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
