import { Mesh, MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three';
import { hasLineOfSight } from '../utils/combatTrace.js';
import { DOOR_OPEN_SECONDS } from './SlidingDoor.js';

export const INTERACTION_DISTANCE = 2.5;

/** Session-owned one-way doors. Old documents retain instant relay gates;
 * v8 panels slide with matching colliders and never close on a ship. */
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
    this.fieldTime = 0;
    /** @type {ShaderMaterial[]} */ this.fieldMaterials = [];
    for (const door of this.doors) if (door.kind === 'force-field') {
      root.children.find(child => child.name === door.id)?.traverse(child => {
        if (child instanceof Mesh && child.material instanceof ShaderMaterial) this.fieldMaterials.push(child.material);
      });
    }
    this.slides = this.doors.filter(door => door.sliding).map(door => ({ door, elapsed: -1,
      panels: [-1, 1].map(side => {
        // Imported IDs may resemble a generated panel name. Resolve parts
        // inside their own door, not through the entire world hierarchy.
        const name = `${door.id}:${side}`, group = root.children.find(child => child.name === door.id);
        const mesh = group?.children.find(child => child.name === name);
        const collider = colliders.find(value => 'id' in value && value.id === name);
        if (!mesh || !collider || !('box' in collider)) throw new Error(`Missing door panel: ${name}`);
        return { mesh, collider, side, origin: mesh.position.clone(), box: collider.box.clone() };
      }),
    }));
  }

  retire() { this.retired = true; }

  isLive() { return !this.retired && this.session.id === this.sessionId && this.session.phase === 'playing'; }

  /** @param {(typeof this.doors)[number]} door */
  open(door) {
    const slide = this.slides.find(value => value.door === door);
    if (slide) { if (slide.elapsed < 0) slide.elapsed = 0; return; }
    this.closedConnections.delete(door.connectionId);
    const mesh = this.root.children.find(child => child.name === door.id); if (mesh) mesh.visible = false;
    for (let i = this.colliders.length - 1; i >= 0; i--) {
      const collider = this.colliders[i];
      if ('id' in collider && collider.id === door.id) this.colliders.splice(i, 1);
    }
  }

  /** Only the first swept player hit on a real closed panel can start opening.
   * @param {import('../contracts.js').SolidCollider} collider */
  hitDoor(collider) {
    if (!this.isLive()) return null;
    const slide = this.slides.find(value => value.door.activation === 'shot' && value.elapsed < 0 && value.panels.some(panel => panel.collider === collider));
    if (!slide) return null;
    this.open(slide.door);
    return { id: slide.door.id, concealed: !!slide.door.concealed };
  }

  /** Simulation time controls both the panels and their collision. Navigation
   * remains closed until the passage is fully clear; pause freezes the motion.
   * @param {number} delta */
  update(delta) {
    if (!this.isLive() || !Number.isFinite(delta) || delta <= 0) return;
    this.fieldTime += delta;
    for (const material of this.fieldMaterials) material.uniforms.time.value = this.fieldTime;
    for (const slide of this.slides) {
      if (slide.elapsed < 0 || slide.elapsed >= DOOR_OPEN_SECONDS) continue;
      slide.elapsed = Math.min(DOOR_OPEN_SECONDS, slide.elapsed + delta);
      const t = slide.elapsed / DOOR_OPEN_SECONDS, eased = t * t * (3 - 2 * t), axis = slide.door.slideAxis ?? 0;
      for (const panel of slide.panels) {
        const offset = new Vector3().setComponent(axis, panel.side * (slide.door.solid.size[axis] / 2 + 0.06) * eased);
        panel.mesh.position.copy(panel.origin).add(offset); panel.collider.box.copy(panel.box).translate(offset);
      }
      if (slide.elapsed === DOOR_OPEN_SECONDS) {
        for (const panel of slide.panels) {
          panel.mesh.visible = false;
          const index = this.colliders.indexOf(panel.collider); if (index !== -1) this.colliders.splice(index, 1);
        }
        this.closedConnections.delete(slide.door.connectionId); this.revision++;
      }
    }
  }

  /** @param {Vector3} position */
  nearest(position) {
    if (!this.isLive()) return null;
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
    // Commit the unlock before publishing; sliding panels clear in simulation.
    this.activatedIds.add(device.id);
    for (const door of this.doors) if (door.deviceId === device.id) this.open(door);
    this.root.children.find(child => child.name === device.id)?.traverse(child => {
      if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) child.material.color.setHex(0x45ff96);
    });
    this.revision++;
    return { id: device.id, label: device.label };
  }
}
