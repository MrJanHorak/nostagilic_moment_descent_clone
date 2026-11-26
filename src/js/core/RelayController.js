import { Mesh, MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three';
import { hasLineOfSight } from '../utils/combatTrace.js';
import { DOOR_OPEN_SECONDS } from './SlidingDoor.js';

export const INTERACTION_DISTANCE = 2.5;
/** A solo pilot gets this many times a linked pair's window, to make the run between the two relays alone. */
export const SOLO_LINK_SCALE = 4;
const ARMED_COLOUR = 0xffb347;
/** A choice relay that can no longer be picked. */
const LOCKED_COLOUR = 0x3a3f44;

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
    /** Linked relays (v15): each relay's partner and window. @type {Map<string, {partner: string, windowMs: number}>} */
    this.links = new Map();
    for (const link of level.mission?.linkedRelays ?? []) {
      this.links.set(link.ids[0], { partner: link.ids[1], windowMs: link.windowSeconds * 1000 });
      this.links.set(link.ids[1], { partner: link.ids[0], windowMs: link.windowSeconds * 1000 });
    }
    /** Choice relays (v17): activating one locks the others. @type {string[]} */
    this.choiceIds = [...(level.mission?.choice?.deviceIds ?? [])];
    /** @type {Set<string>} */ this.lockedIds = new Set();
    /** The choice made, once one is. @type {string | null} */ this.chosenId = null;
    /** Window multiplier: 1 for a team, SOLO_LINK_SCALE alone (set by the game). */
    this.linkScale = 1;
    /** Armed linked relays and when they disarm (simulation ms). @type {Map<string, number>} */ this.armed = new Map();
    /** Relays that disarmed during the last update (read by the game and the server). @type {string[]} */ this.expired = [];
    this.closedConnections = new Set(this.doors.map(door => door.connectionId));
    this.revision = 0;
    this.sessionId = session.id;
    this.retired = false;
    this.fieldTime = 0;
    this.reactors = this.devices.filter(device => device.kind === 'reactor').map(device => ({ device, health: device.health ?? 100,
      collider: colliders.find(value => 'id' in value && value.id === device.id), mesh: root.children.find(child => child.name === device.id) }));
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

  /** Player shots use the actual swept collider. Enemy fire and R never invoke
   * this path. Interlocked cores absorb shots without accumulating damage.
   * @param {import('../contracts.js').SolidCollider} collider @param {number} damage
   * @param {(id: string) => boolean} [allowed] */
  hitReactor(collider, damage, allowed = () => true) {
    if (!this.isLive() || !Number.isFinite(damage) || damage <= 0) return null;
    const reactor = this.reactors.find(value => value.collider === collider && value.health > 0);
    if (!reactor) return null;
    if (!allowed(reactor.device.id)) return { ...reactor.device, health: reactor.health, destroyed: false, blocked: true };
    reactor.health = Math.max(0, reactor.health - damage);
    if (!reactor.health) {
      this.activate(reactor.device);
      if (reactor.mesh) reactor.mesh.visible = false;
      const index = this.colliders.indexOf(collider); if (index !== -1) this.colliders.splice(index, 1);
    }
    return { ...reactor.device, health: reactor.health, destroyed: !reactor.health, blocked: false };
  }

  /** Simulation time controls both the panels and their collision. Navigation
   * remains closed until the passage is fully clear; pause freezes the motion.
   * @param {number} delta */
  update(delta) {
    this.expired = [];
    if (!this.isLive() || !Number.isFinite(delta) || delta <= 0) return;
    for (const [id, until] of this.armed) {
      if (this.session.timeMs <= until) continue;
      this.armed.delete(id); this.expired.push(id); this.paint(id, null);
    }
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
      if (device.kind !== 'reactor' && !this.activatedIds.has(device.id) && !this.lockedIds.has(device.id) && squared <= distance && hasLineOfSight(position, device.position, this.colliders)) {
        nearest = device; distance = squared;
      }
    }
    return nearest;
  }

  /** @param {Vector3} position
   * @returns {{id: string, label: string, armed?: boolean, partnerId?: string, partnerLabel?: string, windowMs?: number,
   *   linked?: {id: string, label: string}[]} | null} A linked relay arms (and waits for its partner) or completes the pair. */
  tryActivate(position) {
    const device = this.nearest(position);
    if (!device) return null;
    const link = this.links.get(device.id);
    if (link) {
      const partner = this.devices.find(candidate => candidate.id === link.partner);
      const partnerUntil = this.armed.get(link.partner);
      if (partner && partnerUntil !== undefined && this.session.timeMs <= partnerUntil) {
        this.armed.delete(link.partner); this.armed.delete(device.id);
        this.activate(partner); this.activate(device);
        return { id: device.id, label: device.label, linked: [{ id: partner.id, label: partner.label }, { id: device.id, label: device.label }] };
      }
      const windowMs = link.windowMs * this.linkScale;
      this.armed.set(device.id, this.session.timeMs + windowMs); this.paint(device.id, ARMED_COLOUR);
      return { id: device.id, label: device.label, armed: true, partnerId: link.partner, partnerLabel: partner?.label ?? link.partner, windowMs };
    }
    this.activate(device);
    return { id: device.id, label: device.label };
  }

  /** Armed linked relays and the time each has left. @returns {{id: string, ms: number}[]} */
  armedState() { return [...this.armed].map(([id, until]) => ({ id, ms: Math.max(0, Math.round(until - this.session.timeMs)) })); }

  /** Tint a relay's light (null restores its idle colour). @param {string} id @param {number | null} colour */
  paint(id, colour) {
    this.root.children.find(child => child.name === id)?.traverse(child => {
      if (!(child instanceof Mesh) || !(child.material instanceof MeshBasicMaterial)) return;
      child.userData.idleColour ??= child.material.color.getHex();
      child.material.color.setHex(colour ?? child.userData.idleColour);
    });
  }

  /** @param {(typeof this.devices)[number]} device */
  activate(device) {
    // Commit the unlock before publishing; sliding panels clear in simulation.
    this.activatedIds.add(device.id);
    if (this.choiceIds.includes(device.id) && !this.chosenId) {
      this.chosenId = device.id;
      for (const other of this.choiceIds) if (other !== device.id) { this.lockedIds.add(other); this.paint(other, LOCKED_COLOUR); }
    }
    for (const door of this.doors) if (door.deviceId === device.id) this.open(door);
    this.root.children.find(child => child.name === device.id)?.traverse(child => {
      if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) child.material.color.setHex(0x45ff96);
    });
    this.revision++;
  }
}
