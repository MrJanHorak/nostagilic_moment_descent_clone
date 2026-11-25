import ring from './documents/foundry-ring.v14.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';
import { toWorld } from './document/RoomMath.js';
import * as THREE from 'three';

/** Weapon salvage placed only in Anarchy (documents author health and ammo only):
 * [pickup type, room id, room-local position].
 * @type {Readonly<Record<string, readonly [string, string, [number, number, number]][]>>} */
const WEAPON_SPOTS = Object.freeze({
  'foundry-ring': [
    ['laserSalvage', 'crane-deck', [6, 0, -6]], ['laserSalvage', 'west-bay', [0, 3, 0]],
    ['missileSalvage', 'slag-pit', [-6, 2, -6]], ['missileSalvage', 'north-gantry', [0, 0, 0]],
    ['plasmaSalvage', 'south-gantry', [0, 0, 0]], ['laserSalvage', 'east-bay', [0, 3, 0]],
  ],
});

/** Respawn points: the centre of every box room without a lava floor.
 * @param {import('../../levelDocument.js').LevelDocument} document @returns {THREE.Vector3[]} */
export function anarchySpawnPoints(document) {
  return document.rooms.filter(room => room.prefab === 'box-room' && room.surfaces?.negativeY?.pattern !== 'lava')
    .map(room => new THREE.Vector3(...toWorld(room, [0, 0, 0])));
}

/** Anarchy (free-for-all) arenas, compiled like missions but flagged `mode: 'anarchy'`. */
export default function createAnarchyMaps() {
  const documents = /** @type {import('../../levelDocument.js').LevelDocument[]} */ (/** @type {unknown} */ ([ring]));
  return documents.map(document => {
    const level = compileLevelDocument(document);
    const rooms = new Map(document.rooms.map(room => [room.id, room]));
    const weapons = (WEAPON_SPOTS[document.id] ?? []).map(([powerupType, roomId, local], index) => {
      const room = rooms.get(roomId); if (!room) throw new Error(`Unknown room ${roomId} in ${document.id}`);
      return Object.freeze({ id: `${document.id}:weapon-${index}`, powerupType, position: Object.freeze(new THREE.Vector3(...toWorld(room, local))) });
    });
    return Object.freeze({ ...level, mode: /** @type {const} */ ('anarchy'), anarchySpawns: Object.freeze(anarchySpawnPoints(document)),
      powerupSpawns: Object.freeze([...level.powerupSpawns, ...weapons]),
      briefing: 'Free-for-all. Every pilot for themselves: destroy other ships to score, collect weapon salvage and repairs, and respawn three seconds after going down. First to the frag limit wins.' });
  });
}
