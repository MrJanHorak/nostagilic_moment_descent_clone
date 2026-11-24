import * as THREE from 'three';
import RoomNavigation from './levels/document/RoomNavigation.js';
import { LOG_RADIUS, PLAYER_RADIUS, SURVIVOR_RADIUS } from './levels/document/LevelContent.js';
import disposeObject from '../utils/disposeObject.js';
import { animateSurvivor, createSurvivorKit } from '../entities/meshBuilders/SurvivorMeshBuilder.js';

/** @typedef {NonNullable<import('../levelDocument.js').ArenaLevel['story']>} CompiledStory */
/** @typedef {{ kind: 'message', id: string, speaker: string, text: string }
 *   | { kind: 'log', id: string, title: string, text: string, found: number, total: number }
 *   | { kind: 'survivor', id: string, name: string, aboard: number, total: number }} StoryEvent */
/** @typedef {{ logsFound: number, logsTotal: number, logIds: readonly string[], rescued: number, survivorsTotal: number }} StorySummary */
/** @typedef {{ kind: 'message' | 'log', label: string, text: string, timeMs: number }} StoryHistoryEntry */

/** Version-13 story runtime for one attempt: radio messages fire once from simulation
 * events, data logs and survivors are collected by flying through them. Survivors count
 * only when the mission is completed (they ride along to extraction). Everything resets
 * with the attempt; meshes use emissive materials and add no lights. */
export default class StoryController {
  /** @param {CompiledStory} story @param {import('../levelDocument.js').LevelDocument} document
   * @param {THREE.Scene} scene @param {(event: StoryEvent) => void} emit */
  constructor(story, document, scene, emit) {
    this.story = story;
    this.emit = emit;
    this.navigation = new RoomNavigation(document);
    /** @type {Set<string>} */ this.fired = new Set();
    /** @type {Set<string>} */ this.foundLogs = new Set();
    /** @type {Set<string>} */ this.aboard = new Set();
    /** @type {string | null} */ this.lastRoom = null;
    /** Everything heard or read this attempt, oldest first, for the comms log.
     * @type {StoryHistoryEntry[]} */ this.history = [];
    this.now = 0;
    this.group = new THREE.Group();
    this.group.name = 'story-content';
    /** @type {Map<string, THREE.Object3D>} */ this.meshes = new Map();
    const logGeometry = new THREE.OctahedronGeometry(0.28, 0);
    const miners = createSurvivorKit();
    /** Shared resources survive removing one collectible; dispose() releases them all. */
    this.shared = new Set([logGeometry, ...miners.keepGeometries]);
    this.sharedMaterials = miners.keepMaterials;
    for (const log of story.logs) {
      const mesh = new THREE.Mesh(logGeometry, new THREE.MeshStandardMaterial({ color: 0x9ff6ff, emissive: 0x2fd8ff, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.3 }));
      mesh.name = `story-log:${log.id}`; mesh.position.fromArray(log.world);
      this.group.add(mesh); this.meshes.set(log.id, mesh);
    }
    for (const [index, survivor] of story.survivors.entries()) {
      const miner = miners.build(); miner.name = `story-survivor:${survivor.id}`; miner.position.fromArray(survivor.world);
      miner.userData.phase = index * 1.7;
      this.group.add(miner); this.meshes.set(survivor.id, miner);
    }
    scene.add(this.group);
  }

  /** Fire every matching unfired message, in authored order.
   * @param {(trigger: import('../levelDocument.js').StoryTrigger) => boolean} matches */
  fire(matches) {
    for (const message of this.story.messages) {
      if (this.fired.has(message.id) || !matches(message.trigger)) continue;
      this.fired.add(message.id);
      this.history.push({ kind: 'message', label: message.speaker, text: message.text, timeMs: this.now });
      this.emit({ kind: 'message', id: message.id, speaker: message.speaker, text: message.text });
    }
  }

  start() { this.fire(trigger => trigger.on === 'start'); }

  /** @param {string} id */
  deviceActivated(id) { this.fire(trigger => trigger.on === 'device' && trigger.deviceId === id); }

  /** @param {string} id */
  enemyDefeated(id) { this.fire(trigger => trigger.on === 'defeat' && trigger.enemyId === id); }

  /** Per simulation step: room-entry messages, collection and presentation.
   * @param {THREE.Vector3} position @param {number} timeMs */
  update(position, timeMs) {
    this.now = timeMs;
    const room = this.navigation.roomAt(position);
    if (room !== null && room !== this.lastRoom) { this.lastRoom = room; this.fire(trigger => trigger.on === 'enter' && trigger.roomId === room); }
    for (const log of this.story.logs) {
      if (this.foundLogs.has(log.id) || !this.touching(log.world, position, LOG_RADIUS)) continue;
      this.foundLogs.add(log.id); this.remove(log.id);
      this.history.push({ kind: 'log', label: log.title, text: log.text, timeMs });
      this.emit({ kind: 'log', id: log.id, title: log.title, text: log.text, found: this.foundLogs.size, total: this.story.logs.length });
    }
    for (const survivor of this.story.survivors) {
      if (this.aboard.has(survivor.id) || !this.touching(survivor.world, position, SURVIVOR_RADIUS)) continue;
      this.aboard.add(survivor.id); this.remove(survivor.id);
      this.emit({ kind: 'survivor', id: survivor.id, name: survivor.name, aboard: this.aboard.size, total: this.story.survivors.length });
    }
    const t = timeMs / 1000;
    for (const [id, mesh] of this.meshes) {
      if (mesh.name.startsWith('story-log:')) { mesh.rotation.y = t * 1.6; mesh.position.y = (this.story.logs.find(log => log.id === id)?.world[1] ?? 0) + Math.sin(t * 2) * 0.08; }
      else animateSurvivor(mesh, t, mesh.userData.phase ?? 0, position);
    }
  }

  /** @private @param {import('../levelDocument.js').Vec3} at @param {THREE.Vector3} position @param {number} radius */
  touching(at, position, radius) {
    return position.distanceTo(new THREE.Vector3(at[0], at[1], at[2])) <= radius + PLAYER_RADIUS;
  }

  /** @private @param {string} id */
  remove(id) {
    const mesh = this.meshes.get(id); if (!mesh) return;
    this.meshes.delete(id); disposeObject(mesh, this.shared, this.sharedMaterials);
  }

  /** @returns {StorySummary} */
  summary() {
    return { logsFound: this.foundLogs.size, logsTotal: this.story.logs.length, logIds: [...this.foundLogs],
      rescued: this.aboard.size, survivorsTotal: this.story.survivors.length };
  }

  dispose() {
    disposeObject(this.group);
    this.meshes.clear();
  }
}
