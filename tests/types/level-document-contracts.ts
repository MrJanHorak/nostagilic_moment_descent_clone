import { Vector3 } from 'three';
import type { EntityDocument, LevelDocument, RoomDocument, ConnectionDocument } from '../../src/js/levelDocument.js';
import { parseLevelDocument, serializeLevelDocument, validateLevelDocument } from '../../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument, { prepareLevelDocument } from '../../src/js/core/levels/document/compileLevelDocument.js';
import { portFrame, toWorld } from '../../src/js/core/levels/document/RoomMath.js';
import buildArena from '../../src/js/core/ArenaGeometry.js';

const result = validateLevelDocument({ untrusted: 'data' });
if (result.valid) {
  const document: LevelDocument = result.document;
  const text: string = serializeLevelDocument(document); parseLevelDocument(text);
  const runtime = compileLevelDocument(document); buildArena(runtime);
  prepareLevelDocument(document).world.claimed = true; // Explicit runtime ownership handoff.
  // @ts-expect-error Authored room lists cannot be changed through validated snapshots.
  document.rooms.push(document.rooms[0]);
  // @ts-expect-error Session state does not belong in the document.
  document.spawned = true;
  // @ts-expect-error Room-local positions remain JSON tuples, not runtime vectors.
  document.entities[0].position.copy(new Vector3());
} else {
  result.errors[0]?.path.toUpperCase();
  // @ts-expect-error An invalid result has no usable document.
  result.document;
}
const room: RoomDocument = { id: 'bay', prefab: 'box-room', position: [0, 0, 0], size: [16, 12, 16], yaw: 90, materialPreset: 'industrial-blue' };
const connection: ConnectionDocument = { id: 'door', a: { roomId: 'bay', port: 'negativeZ' }, b: { roomId: 'other', port: 'positiveZ' }, openingSize: [6, 6] };
portFrame(room, connection.a.port); toWorld(room, [0, 0, 1]);
// @ts-expect-error Room rotations are bounded quarter-turn yaw values.
const badYaw: RoomDocument = { ...room, yaw: 45 };
// @ts-expect-error Version 1 has a bounded prefab registry.
const badPrefab: RoomDocument = { ...room, prefab: 'freeform-mine' };
// @ts-expect-error Materials name registered presets, not asset URLs.
const badMaterial: RoomDocument = { ...room, materialPreset: 'https://example.com/texture.png' };
// @ts-expect-error Documents contain tuple coordinates, not Three.js objects.
const badPosition: RoomDocument = { ...room, position: new Vector3() };
// @ts-expect-error The documented port names are exact.
portFrame(room, 'north');
// @ts-expect-error Door openings have exactly two dimensions.
const badOpening: ConnectionDocument = { ...connection, openingSize: [6, 6, 6] };
// @ts-expect-error Imported documents support data, not executable spawns.
const badEntity: EntityDocument = { id: 'guard', kind: 'enemy', type: () => 'scout', roomId: 'bay', position: [0, 0, 0] };
// @ts-expect-error Unfinished weapon pickups are excluded from this format.
const badPickup: EntityDocument = { id: 'pickup', kind: 'pickup', type: 'weaponPickup', roomId: 'bay', position: [0, 0, 0] };
// @ts-expect-error Exit geometry uses a numeric radius.
const badExit: EntityDocument = { id: 'exit', kind: 'exit', radius: 'large', roomId: 'bay', position: [0, 0, 0] };
// @ts-expect-error Only the implemented completion objective belongs in version 1.
const badMission: LevelDocument['mission'] = { type: 'activate-switch', requiredEnemyIds: [], exitId: 'exit' };
// @ts-expect-error Authored version is a literal compatibility boundary.
const badVersion: LevelDocument['formatVersion'] = 2;
// @ts-expect-error JSON parsing accepts text, not a runtime world.
parseLevelDocument(compileLevelDocument({}));
void [badYaw, badPrefab, badMaterial, badPosition, badOpening, badEntity, badPickup, badExit, badMission, badVersion];
