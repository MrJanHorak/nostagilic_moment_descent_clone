import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import { serializeLevelDocument, validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { toWorld, portFrame } from '../src/js/core/levels/document/RoomMath.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import SurfaceEnvironment from '../src/js/core/SurfaceEnvironment.js';
import GameSession from '../src/js/core/GameSession.js';
import createCampaign from '../src/js/core/levels/Campaign.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import disposeObject from '../src/js/utils/disposeObject.js';

function fixture(t, model = new EditorDocument()) {
  const level = compileLevelDocument(model.document), world = buildArena(level), session = new GameSession();
  session.begin(); session.transition('playing');
  const environment = new SurfaceEnvironment(world.surfaces);
  t.after(() => disposeObject(world.group));
  return { level, world, session, environment, update: position => environment.update(session, position, 0.5) };
}

test('fluid face authoring upgrades to v9, round-trips and preserves v9 through door edits and undo', () => {
  const model = new EditorDocument(), original = model.document.formatVersion;
  model.setSurface('room-1', 'negativeY', 0xcc5511, 'lava');
  assert.equal(model.document.formatVersion, 9);
  const raw = serializeLevelDocument(model.document); assert.equal(validateLevelDocument(JSON.parse(raw)).valid, true);
  for (const version of [3, 4, 5, 6, 7, 8]) {
    const old = JSON.parse(raw); old.formatVersion = version;
    assert.equal(validateLevelDocument(old).valid, false);
  }
  model.undo(); assert.equal(model.document.formatVersion, original); model.redo();
  assert.equal(serializeLevelDocument(model.document), raw);
  model.attachRoom('room-1', 'negativeZ', 'box-room');
  const link = model.document.connections[0]; model.setDoor(link.id, '@shot', { sliding: true });
  assert.equal(model.document.formatVersion, 9); assert.equal(model.validation.valid, true);
});

test('existing hazard stripes remain decorative and do not allocate an environmental contact surface', t => {
  const model = new EditorDocument(); model.setSurface('room-1', 'all', 0xcc5511, 'hazard');
  const { world, update } = fixture(t, model); assert.equal(world.surfaces.length, 0);
  assert.equal(update(new THREE.Vector3(0, -5, 0)).damage, 0);
});

test('lava contact follows physical panels, pulses once per cadence and never stacks at seams or re-entry', t => {
  const model = new EditorDocument(); model.setSurface('room-1', 'all', 0xcc5511, 'lava');
  const { update, session, environment } = fixture(t, model);
  const room = model.document.rooms[0], floor = new THREE.Vector3(0, -room.size[1] / 2 + 1, 0);
  moveSphere(floor, new THREE.Vector3(0, -5, 0), 1, environment.surfaces.map(s => s.collider));
  assert.deepEqual(update(floor), { damage: 6, entered: 'lava' });
  for (let i = 0; i < 29; i++) { session.advance(1 / 60); assert.equal(update(floor).damage, 0); }
  update(new THREE.Vector3()); assert.equal(update(floor).damage, 0);
  session.advance(0.02); assert.equal(update(floor).damage, 6);
  session.advance(100); assert.equal(update(floor).damage, 6); assert.equal(update(floor).damage, 0);
  const corner = new THREE.Vector3(room.size[0] / 2 - 1, -room.size[1] / 2 + 1, 0);
  session.advance(0.6); assert.equal(update(corner).damage, 6, 'two touching faces are one exposure');
  assert.equal(update(new THREE.Vector3(0, 0, 0)).damage, 0);
});

test('water animates without damage; pause freezes contact and animation; replacement starts fresh', t => {
  const model = new EditorDocument(); model.setSurface('room-1', 'negativeY', 0x237d99, 'water');
  const { world, session, environment, update } = fixture(t, model);
  const floor = new THREE.Vector3(0, -model.document.rooms[0].size[1] / 2 + 1, 0);
  assert.deepEqual(update(floor), { damage: 0, entered: 'water' });
  const texture = world.surfaces[0].material.map;
  session.advance(1); update(floor); assert(texture.offset.length() > 0); const offset = texture.offset.clone();
  session.transition('paused'); session.advance(10); update(new THREE.Vector3());
  assert(texture.offset.equals(offset)); assert.equal(environment.contact, 'water');
  session.transition('playing'); update(new THREE.Vector3()); assert.equal(environment.contact, null);
  assert.equal(new SurfaceEnvironment(world.surfaces).contact, null);
});

test('lava uses exact sloped hulls and every oriented face instead of axis-aligned bounding box approximations', t => {
  for (const orientation of [{ yaw: 0 }, { yaw: 90, pitch: 90 }, { yaw: 270, roll: 90 }]) {
    const model = new EditorDocument();
    model.updateRoom('room-1', { prefab: 'offset-corridor', size: [8, 8, 24], endOffset: [6, 6], ...orientation });
    model.change(draft => { draft.playerSpawn.position = [0, 0, 6]; draft.entities[0].position = [0, 0, -6]; });
    model.setSurface('room-1', 'all', 0xcc5511, 'lava');
    const { update, session, world } = fixture(t, model), room = model.document.rooms[0];
    for (const face of ['negativeX', 'positiveX', 'negativeY', 'positiveY', 'negativeZ', 'positiveZ']) {
      const frame = portFrame(room, face), position = new THREE.Vector3(...frame.center).addScaledVector(new THREE.Vector3(...frame.normal), -1.2);
      moveSphere(position, new THREE.Vector3(...frame.normal).multiplyScalar(4), 0.5, world.colliders);
      session.advance(0.6); assert.equal(update(position).damage, 6, face);
    }
    assert.equal(update(new THREE.Vector3(...toWorld(room, [0, 0, 0]))).damage, 0);
  }
});

test('a lava face leaves connected doorway and hatch openings harmless while the rim still burns', t => {
  for (const face of ['negativeZ', 'positiveY']) {
    const model = new EditorDocument(); model.attachRoom('room-1', face, 'box-room');
    model.setSurface('room-1', face, 0xcc5511, 'lava');
    const { update, session } = fixture(t, model), frame = portFrame(model.document.rooms[0], face);
    assert.equal(update(new THREE.Vector3(...frame.center)).damage, 0);
    const rim = new THREE.Vector3(...frame.center).addScaledVector(new THREE.Vector3(...frame.normal), -1);
    rim.setComponent(frame.u, frame.center[frame.u] + frame.width / 2 - 1);
    session.advance(0.6); assert.equal(update(rim).damage, 6);
  }
});

test('campaign environments have safe spawns, relay positions, pickups and exits, and own/dispose their textures', t => {
  for (const level of createCampaign()) {
    const world = buildArena(level), environment = new SurfaceEnvironment(world.surfaces), session = new GameSession();
    session.begin(); session.transition('playing');
    t.after(() => disposeObject(world.group));
    for (const point of [level.spawn, ...level.devices.map(d => d.position), ...level.powerupSpawns.map(p => p.position.toArray()), level.mission.exit.position]) {
      assert.equal(environment.update(session, new THREE.Vector3(...point), 0.5).damage, 0, `${level.id} safe authored placement`);
    }
    const textures = new Set(world.surfaces.map(s => s.material.map)), disposals = new Map();
    for (const texture of textures) texture.addEventListener('dispose', () => disposals.set(texture, (disposals.get(texture) ?? 0) + 1));
    disposeObject(world.group); assert([...textures].every(texture => disposals.get(texture) === 1));
    world.group.clear(); // after-hook has no owned meshes left.
  }
});
