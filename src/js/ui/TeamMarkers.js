/** Markers in the world for the team: pings (where a pilot pointed) and wrecks of
 * downed pilots (fly close to revive). Drawn through walls so they are found. */
import * as THREE from 'three';
import { MARK_LIFETIME_MS } from '../core/TeamSignals.js';

/** @typedef {{group: THREE.Group, ring: THREE.Mesh, beam: THREE.Mesh, until: number, kind: 'mark' | 'wreck'}} Marker */

export default class TeamMarkers {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    /** @type {Map<string, Marker>} */ this.markers = new Map();
    this.ringGeometry = new THREE.TorusGeometry(0.7, 0.06, 8, 32);
    this.beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 6, 6, 1, true);
  }

  /** @param {'mark' | 'wreck'} kind @param {number} colour */
  create(kind, colour) {
    const material = () => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false });
    const group = new THREE.Group(); group.name = `team-${kind}`; group.renderOrder = 999;
    const ring = new THREE.Mesh(this.ringGeometry, material()); ring.renderOrder = 999;
    const beam = new THREE.Mesh(this.beamGeometry, material()); beam.renderOrder = 999; beam.position.y = 3;
    if (kind === 'wreck') { ring.rotation.x = Math.PI / 2; ring.scale.setScalar(1.4); }
    group.add(ring, beam);
    this.scene.add(group);
    return { group, ring, beam };
  }

  /** A ping from a pilot: replaces their previous one. @param {string} from @param {readonly number[]} p @param {number} colour @param {number} now */
  mark(from, p, colour, now) {
    const key = `mark:${from}`;
    this.remove(key);
    const parts = this.create('mark', colour);
    parts.group.position.fromArray(p);
    this.markers.set(key, { ...parts, until: now + MARK_LIFETIME_MS, kind: 'mark' });
  }

  /** Show exactly these wrecks; `progress` (0–1) fills the ring as a revive goes on.
   * @param {readonly {id: string, p: readonly number[], progress: number}[]} wrecks @param {(id: string) => number} colourOf */
  syncWrecks(wrecks, colourOf) {
    const keep = new Set(wrecks.map(wreck => `wreck:${wreck.id}`));
    for (const key of [...this.markers.keys()]) if (key.startsWith('wreck:') && !keep.has(key)) this.remove(key);
    for (const wreck of wrecks) {
      const key = `wreck:${wreck.id}`;
      let marker = this.markers.get(key);
      if (!marker) { marker = { ...this.create('wreck', colourOf(wreck.id)), until: Infinity, kind: 'wreck' }; this.markers.set(key, marker); }
      marker.group.position.fromArray(wreck.p);
      marker.ring.scale.setScalar(1.4 - 0.9 * Math.min(1, Math.max(0, wreck.progress)));
    }
  }

  /** Animate and expire. @param {number} now */
  update(now) {
    for (const [key, marker] of this.markers) {
      if (now >= marker.until) { this.remove(key); continue; }
      const pulse = 0.6 + Math.sin(now / 180) * 0.25;
      /** @type {THREE.MeshBasicMaterial} */ (marker.ring.material).opacity = pulse;
      if (marker.kind === 'mark') marker.ring.rotation.y = now / 400;
    }
  }

  /** @param {string} key */
  remove(key) {
    const marker = this.markers.get(key);
    if (!marker) return;
    this.scene.remove(marker.group);
    for (const mesh of [marker.ring, marker.beam]) /** @type {THREE.Material} */ (mesh.material).dispose();
    this.markers.delete(key);
  }

  clear() { for (const key of [...this.markers.keys()]) this.remove(key); }
}
