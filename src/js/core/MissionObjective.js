import * as THREE from 'three';

// Session state only. The authored level definition is never mutated.
export default class MissionObjective {
  /** @param {import('../contracts.js').MissionDefinition} definition */
  constructor(definition) {
    this.definition = definition;
    this.requiredIds = new Set(definition.requiredEnemyIds);
    /** @type {Map<string, import('../contracts.js').DefeatCause>} */
    this.defeats = new Map();
    this.requiredDeviceIds = new Set(definition.requiredDeviceIds ?? []);
    /** @type {Set<string>} */
    this.activatedDevices = new Set();
    this.completed = false;
    this.failed = false;
    /** @type {number | null} */ this.escapeDeadline = null;
    this.exitPosition = new THREE.Vector3().fromArray(definition.exit.position);
  }

  get ready() { return !this.failed && this.defeats.size === this.requiredIds.size && this.activatedDevices.size === this.requiredDeviceIds.size && (!this.definition.escape || this.escapeDeadline !== null); }

  /** Reactor activation is the last objective; it cannot strand a player behind
   * another required relay or guard once the clock starts. @param {string} id */
  canActivateDevice(id) {
    return !this.completed && !this.failed && (id !== this.definition.escape?.triggerDeviceId ||
      this.defeats.size === this.requiredIds.size && [...this.requiredDeviceIds].every(other => other === id || this.activatedDevices.has(other)));
  }

  /** @param {number} now */
  remainingEscapeMs(now) { return this.escapeDeadline === null ? null : Math.max(0, this.escapeDeadline - now); }

  /** No scheduled callbacks survive an attempt. Called before movement so a
   * frame arriving at the deadline cannot sneak through the exit. @param {number} now */
  updateEscape(now) {
    if (!Number.isFinite(now) || this.completed || this.failed || this.escapeDeadline === null || now < this.escapeDeadline) return false;
    this.failed = true; return true;
  }

  /** @param {string} id @param {number} [now] */
  recordDeviceActivation(id, now = 0) {
    if (!Number.isFinite(now) || now < 0 || !this.canActivateDevice(id) || !this.requiredDeviceIds.has(id) || this.activatedDevices.has(id)) return false;
    this.activatedDevices.add(id);
    if (id === this.definition.escape?.triggerDeviceId) this.escapeDeadline = now + this.definition.escape.durationSeconds * 1000;
    return true;
  }

  /** @param {string} id @param {import('../contracts.js').DefeatCause} cause */
  recordDefeat(id, cause) {
    if (this.completed || this.failed || !this.requiredIds.has(id) || this.defeats.has(id) || !['shot', 'ram'].includes(cause)) return false;
    this.defeats.set(id, cause);
    return true;
  }

  /** @param {THREE.Vector3} position @param {number} [playerRadius] */
  canExit(position, playerRadius = 0.5) {
    const clearance = this.definition.exit.radius - playerRadius;
    return this.ready && clearance >= 0 && position.distanceToSquared(this.exitPosition) <= clearance * clearance;
  }

  /** @param {THREE.Vector3} position @param {number} [playerRadius] @param {number} [now] */
  tryComplete(position, playerRadius, now = 0) {
    this.updateEscape(now);
    if (this.completed || !this.canExit(position, playerRadius)) return false;
    this.completed = true;
    return true;
  }
}
