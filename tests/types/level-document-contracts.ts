import { Vector3 } from 'three';
import type { EntityDocument, LevelDocument, RoomDocument, ConnectionDocument, SurfaceStyle } from '../../src/js/levelDocument.js';
import { parseLevelDocument, serializeLevelDocument, validateLevelDocument } from '../../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument, { prepareLevelDocument } from '../../src/js/core/levels/document/compileLevelDocument.js';
import { portFrame, toWorld } from '../../src/js/core/levels/document/RoomMath.js';
import buildArena from '../../src/js/core/ArenaGeometry.js';
import RoomNavigation from '../../src/js/core/levels/document/RoomNavigation.js';
import RelayController from '../../src/js/core/RelayController.js';
import GameSession from '../../src/js/core/GameSession.js';
import MissionObjective from '../../src/js/core/MissionObjective.js';

const result = validateLevelDocument({ untrusted: 'data' });
if (result.valid) {
  const document: LevelDocument = result.document;
  const text: string = serializeLevelDocument(document); parseLevelDocument(text);
  const runtime = compileLevelDocument(document); buildArena(runtime);
  const navigation = new RoomNavigation(document);
  navigation.route(new Vector3(), new Vector3(), 1)?.[0].clone();
  navigation.roomAt(new Vector3())?.toUpperCase();
  // @ts-expect-error Navigation accepts a validated document, not an arbitrary import value.
  new RoomNavigation({ formatVersion: 999 });
  // @ts-expect-error Route queries use runtime vectors.
  navigation.route([0, 0, 0], new Vector3(), 1);
  // @ts-expect-error Body clearance must be numeric.
  navigation.destination(new Vector3(), 'fighter');
  // @ts-expect-error A route can be unavailable for this enemy body.
  navigation.route(new Vector3(), new Vector3(), 1).map(point => point.clone());
  const controller = new RelayController(runtime, buildArena(runtime).group, [], new GameSession());
  controller.tryActivate(new Vector3());
  // @ts-expect-error Interactions use runtime vectors, not JSON positions.
  controller.tryActivate([0, 0, 0]);
  // @ts-expect-error Closed connections are identified by a set, not an array.
  navigation.route(new Vector3(), new Vector3(), 1, ['door']);
  if (document.formatVersion !== 1) {
    document.devices[0].label.toUpperCase();
    // @ts-expect-error Validated relay positions are immutable.
    document.devices[0].position[0] = 10;
    // @ts-expect-error Validated door definitions cannot acquire live session state.
    document.doors[0].open = true;
    // @ts-expect-error Relay documents require the relay objective, not the v1 objective.
    const wrongMission: LevelDocument = { ...document, mission: { ...document.mission, type: 'clear-and-exit' } };
    // @ts-expect-error Version 2 requires an explicit devices list.
    const missingDevices: LevelDocument = { formatVersion: 2, id: document.id, name: document.name, rooms: document.rooms, connections: document.connections, entities: document.entities, playerSpawn: document.playerSpawn, mission: document.mission, combat: document.combat, doors: document.doors };
    void [wrongMission, missingDevices];
  } else {
    // @ts-expect-error Old version-1 snapshots do not contain door fields.
    document.doors;
  }
  if (runtime.mission) {
    // @ts-expect-error Activation events require stable string IDs.
    new MissionObjective(runtime.mission).recordDeviceActivation(42);
  }
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
const badVersion: LevelDocument['formatVersion'] = 8;
// @ts-expect-error Surface patterns are a bounded local registry, not executable or remote content.
const badStyle: SurfaceStyle = { color: 0x112233, pattern: 'https://example.com/texture.png' };
if (connection.a.offset) {
  // @ts-expect-error Validated opening offsets are immutable.
  connection.a.offset[0] = 1;
}
// @ts-expect-error JSON parsing accepts text, not a runtime world.
parseLevelDocument(compileLevelDocument({}));
void [badYaw, badPrefab, badMaterial, badPosition, badOpening, badEntity, badPickup, badExit, badMission, badVersion, badStyle];
