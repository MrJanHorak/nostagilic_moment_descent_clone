import * as THREE from 'three';
import { FACES, MATERIALS, WALL_THICKNESS } from './LevelContent.js';
import { portFrame, toWorld } from './RoomMath.js';
import { LevelDocumentError, validateLevelDocument } from './validateLevelDocument.js';
import buildArena from '../../ArenaGeometry.js';

/** Compile validated data into the existing finite-world adapter. No mesh,
 * material or GPU resources are allocated here. Validation owns the snapshot.
 * @param {unknown} input @returns {import('../../../levelDocument.js').ArenaLevel} */
export default function compileLevelDocument(input) {
  const result = validateLevelDocument(input);
  if (!result.valid) throw new LevelDocumentError(result.errors);
  const document = result.document, rooms = new Map(document.rooms.map(room => [room.id, room]));
  /** @type {Map<string, readonly [number, number]>} */ const openings = new Map();
  for (const connection of document.connections) {
    for (const endpoint of [connection.a, connection.b]) openings.set(`${endpoint.roomId}/${endpoint.port}`, connection.openingSize);
  }
  /** @type {import('../../../levelDocument.js').SolidDefinition[]} */ const solids = [];
  for (const room of document.rooms) {
    const preset = MATERIALS[room.materialPreset];
    for (const face of FACES) {
      const frame = portFrame(room, face), opening = openings.get(`${room.id}/${face}`);
      /** @param {number} u0 @param {number} u1 @param {number} v0 @param {number} v1 @param {string} part */
      const rectangle = (u0, u1, v0, v1, part) => {
        /** @type {[number, number, number]} */ const center = [...frame.center];
        /** @type {[number, number, number]} */ const size = [0, 0, 0];
        center[frame.axis] -= frame.direction * WALL_THICKNESS / 2;
        center[frame.u] += (u0 + u1) / 2; center[frame.v] += (v0 + v1) / 2;
        size[frame.axis] = WALL_THICKNESS; size[frame.u] = u1 - u0; size[frame.v] = v1 - v0;
        const color = frame.axis === 1 ? frame.direction < 0 ? preset.floor : preset.ceiling : preset.wall;
        solids.push(Object.freeze({ id: `@solid/${room.id}/${face}/${part}`, center: Object.freeze(center), size: Object.freeze(size), color }));
      };
      const halfW = frame.width / 2, halfH = frame.height / 2;
      if (!opening) rectangle(-halfW, halfW, -halfH, halfH, 'wall');
      else {
        const [width, height] = opening;
        rectangle(-halfW, -width / 2, -halfH, halfH, 'left');
        rectangle(width / 2, halfW, -halfH, halfH, 'right');
        rectangle(-width / 2, width / 2, -halfH, -height / 2, 'bottom');
        rectangle(-width / 2, width / 2, height / 2, halfH, 'top');
      }
    }
  }
  /** @param {import('../../../levelDocument.js').Placement} placement */
  const world = placement => {
    const room = rooms.get(placement.roomId); if (!room) throw new Error('Validated room disappeared');
    return toWorld(room, placement.position);
  };
  const startRoom = rooms.get(document.playerSpawn.roomId);
  if (!startRoom) throw new Error('Validated spawn room disappeared');
  const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), startRoom.yaw * Math.PI / 180)
    .multiply(new THREE.Quaternion().fromArray(document.playerSpawn.rotation)).normalize();
  const exit = document.entities.find(entity => entity.id === document.mission.exitId);
  if (exit?.kind !== 'exit') throw new Error('Validated exit disappeared');
  const doors = document.formatVersion === 2 ? document.doors.map(door => {
    const connection = document.connections.find(connection => connection.id === door.connectionId);
    const room = connection && rooms.get(connection.a.roomId);
    if (!connection || !room) throw new Error('Validated door connection disappeared');
    const frame = portFrame(room, connection.a.port);
    /** @type {[number, number, number]} */ const size = [0, 0, 0];
    size[frame.axis] = WALL_THICKNESS * 2;
    size[frame.u] = connection.openingSize[0]; size[frame.v] = connection.openingSize[1];
    return Object.freeze({ ...door, solid: Object.freeze({ id: door.id, center: Object.freeze(frame.center), size: Object.freeze(size), color: 0xb66f20 }) });
  }) : [];
  return Object.freeze({
    id: document.id, name: document.name, kind: 'arena', sourceDocument: document,
    spawn: Object.freeze(world(document.playerSpawn)),
    spawnRotation: Object.freeze(/** @type {const} */ ([orientation.x, orientation.y, orientation.z, orientation.w])),
    rendering: Object.freeze({ enemyAccentLights: false, trainingDecorations: false }),
    solids: Object.freeze(solids), combat: document.combat,
    ...(document.formatVersion === 2 ? { doors: Object.freeze(doors),
      devices: Object.freeze(document.devices.map(device => Object.freeze({ id: device.id, label: device.label, position: Object.freeze(world(device)) }))) } : {}),
    enemySpawns: Object.freeze(document.entities.filter(entity => entity.kind === 'enemy').map(entity => Object.freeze({
      id: entity.id, enemyType: entity.type, position: Object.freeze(new THREE.Vector3(...world(entity))),
    }))),
    powerupSpawns: Object.freeze(document.entities.filter(entity => entity.kind === 'pickup').map(entity => Object.freeze({
      id: entity.id, powerupType: entity.type, position: Object.freeze(new THREE.Vector3(...world(entity))),
    }))),
    mission: Object.freeze({ type: document.mission.type, requiredEnemyIds: document.mission.requiredEnemyIds,
      ...(document.formatVersion === 2 ? { requiredDeviceIds: document.mission.requiredDeviceIds } : {}),
      exit: Object.freeze({ id: exit.id, position: Object.freeze(world(exit)), radius: exit.radius }) }),
  });
}

/** Stage an owned, detached candidate before ending an existing run. The runtime
 * claims its world when mounting; until then the caller owns cleanup.
 * @param {unknown} input */
export function prepareLevelDocument(input) {
  const level = compileLevelDocument(input);
  return { level, world: { ...buildArena(level), claimed: false } };
}
