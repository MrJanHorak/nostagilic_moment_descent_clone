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
    this.exitPosition = new THREE.Vector3().fromArray(definition.exit.position);
  }

  get ready() { return this.defeats.size === this.requiredIds.size && this.activatedDevices.size === this.requiredDeviceIds.size; }

  /** @param {string} id */
  recordDeviceActivation(id) {
    if (this.completed || !this.requiredDeviceIds.has(id) || this.activatedDevices.has(id)) return false;
    this.activatedDevices.add(id); return true;
  }

  /** @param {string} id @param {import('../contracts.js').DefeatCause} cause */
  recordDefeat(id, cause) {
    if (this.completed || !this.requiredIds.has(id) || this.defeats.has(id) || !['shot', 'ram'].includes(cause)) return false;
    this.defeats.set(id, cause);
    return true;
  }

  /** @param {THREE.Vector3} position @param {number} [playerRadius] */
  canExit(position, playerRadius = 0.5) {
    const clearance = this.definition.exit.radius - playerRadius;
    return this.ready && clearance >= 0 && position.distanceToSquared(this.exitPosition) <= clearance * clearance;
  }

  /** @param {THREE.Vector3} position @param {number} [playerRadius] */
  tryComplete(position, playerRadius) {
    if (this.completed || !this.canExit(position, playerRadius)) return false;
    this.completed = true;
    return true;
  }
}
