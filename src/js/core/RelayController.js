import { Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { hasLineOfSight } from '../utils/combatTrace.js';

export const INTERACTION_DISTANCE = 2.5;

/** Session-owned, one-way relay unlocks. Door resources stay owned by the world
 * until teardown; activation only hides the mesh and removes its collider. */
export default class RelayController {
  /** @param {import('../levelDocument.js').ArenaLevel} level
   * @param {import('three').Object3D} root
   * @param {import('../contracts.js').SolidCollider[]} colliders
   * @param {import('./GameSession.js').default} session */
  constructor(level, root, colliders, session) {
    this.root = root; this.colliders = colliders; this.session = session;
    this.devices = (level.devices ?? []).map(device => ({ ...device, position: new Vector3(...device.position) }));
    this.doors = level.doors ?? [];
    /** @type {Set<string>} */ this.activatedIds = new Set();
    this.closedConnections = new Set(this.doors.map(door => door.connectionId));
    this.revision = 0;
    this.sessionId = session.id;
    this.retired = false;
  }

  retire() { this.retired = true; }

  /** @param {Vector3} position */
  nearest(position) {
    if (this.retired || this.session.id !== this.sessionId || this.session.phase !== 'playing') return null;
    let distance = INTERACTION_DISTANCE * INTERACTION_DISTANCE;
    /** @type {(typeof this.devices)[number] | null} */ let nearest = null;
    for (const device of this.devices) {
      const squared = position.distanceToSquared(device.position);
      if (!this.activatedIds.has(device.id) && squared <= distance && hasLineOfSight(position, device.position, this.colliders)) {
        nearest = device; distance = squared;
      }
    }
    return nearest;
  }

  /** @param {Vector3} position */
  tryActivate(position) {
    const device = this.nearest(position);
    if (!device) return null;
    // Complete the world change before publishing the objective event to Game.
    this.activatedIds.add(device.id);
    for (const door of this.doors) if (door.deviceId === device.id) {
      this.closedConnections.delete(door.connectionId);
      const mesh = this.root.getObjectByName(door.id); if (mesh) mesh.visible = false;
      for (let i = this.colliders.length - 1; i >= 0; i--) {
        const collider = this.colliders[i];
        if ('id' in collider && collider.id === door.id) this.colliders.splice(i, 1);
      }
    }
    this.root.getObjectByName(device.id)?.traverse(child => {
      if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) child.material.color.setHex(0x45ff96);
    });
    this.revision++;
    return { id: device.id, label: device.label };
  }
}
