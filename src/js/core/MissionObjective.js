import * as THREE from 'three';

// Session state only. The internal level definition is never annotated.
export default class MissionObjective {
  constructor(definition) {
    this.definition = definition;
    this.requiredIds = new Set(definition.requiredEnemyIds);
    this.defeats = new Map();
    this.completed = false;
    this.exitPosition = new THREE.Vector3().fromArray(definition.exit.position);
  }

  get ready() { return this.defeats.size === this.requiredIds.size; }

  recordDefeat(id, cause) {
    if (this.completed || !this.requiredIds.has(id) || this.defeats.has(id) || !['shot', 'ram'].includes(cause)) return false;
    this.defeats.set(id, cause);
    return true;
  }

  canExit(position, playerRadius = 0.5) {
    const clearance = this.definition.exit.radius - playerRadius;
    return this.ready && clearance >= 0 && position.distanceToSquared(this.exitPosition) <= clearance * clearance;
  }

  tryComplete(position, playerRadius) {
    if (this.completed || !this.canExit(position, playerRadius)) return false;
    this.completed = true;
    return true;
  }
}
