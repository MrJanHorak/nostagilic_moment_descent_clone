import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Quaternion, Scene, Group, Vector3 } from 'three';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import { placementPosition } from '../src/js/editor/EditorPicking.js';
import { FACES } from '../src/js/core/levels/document/LevelContent.js';
import { fitsInside, openingFrame, orient, portFrame, roomVertices, roomsOverlap, toLocal, toWorld } from '../src/js/core/levels/document/RoomMath.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import RoomNavigation from '../src/js/core/levels/document/RoomNavigation.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import { boxCorners } from '../src/js/utils/BoxTopology.js';
import { convexContact, convexHull, convexSegmentFraction } from '../src/js/utils/ConvexSolid.js';
import { moveSphere } from '../src/js/utils/sphereMovement.js';
import { traceShot } from '../src/js/utils/combatTrace.js';
import disposeObject from '../src/js/utils/disposeObject.js';
import RelayController from '../src/js/core/RelayController.js';
import GameState from '../src/js/core/GameState.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';

const v = point => new Vector3(...point);
function modelFor(offset = [0, 8], face = 'negativeZ') {
  const model = new EditorDocument(), middle = model.attachRoom('room-1', face, 'offset-corridor', offset);
  const last = model.attachRoom(middle, 'negativeZ', 'box-room');
  return { model, middle, last };
}
function overlaps(position, radius, collider) {
  return Boolean(collider.convex ? convexContact(position, radius - 1e-5, collider.convex) : collider.box.distanceToPoint(position) < radius - 1e-5);
}

test('sloped solids use rounded sphere edges/corners, stable surface recovery and actual hull shot clipping', () => {
  const rotation = new Quaternion().setFromAxisAngle(v([0, 1, 0]), Math.PI / 4), rotate = point => v(point).applyQuaternion(rotation);
  const hull = convexHull(boxCorners([0, 0, 0], [2, 2, 2]).map(point => rotate(point).toArray()));
  assert.equal(convexContact(rotate([1.4, 1.4, 0]), 0.5, hull), null, 'expanded planes alone would falsely block a rounded edge');
  const contact = convexContact(rotate([1.3, 1.3, 0]), 0.5, hull);
  assert(Math.abs(contact.depth - (0.5 - Math.hypot(0.3, 0.3))) < 1e-12);
  assert(contact.normal.distanceTo(rotate([1, 1, 0]).normalize()) < 1e-12);
  for (const point of [[1, 1, 1], [1, 0, 0], [0, 0, 0]]) {
    const position = rotate(point), collider = { box: hull.box, convex: hull };
    assert(moveSphere(position, v([0, 0, 0]), 0, [collider]).collided);
    assert(position.toArray().every(Number.isFinite)); assert.equal(overlaps(position, 0.5, collider), false);
  }
  const slanted = convexHull(boxCorners([0, 0, 0], [4, 0.5, 4]).map(([x, y, z]) => [x, y + z / 2, z]));
  const empty = v([0, 0.9, -1.5]); assert(slanted.box.containsPoint(empty)); assert.equal(convexContact(empty, 0.5, slanted), null);
  assert.equal(convexSegmentFraction(v([-1, 0.9, -1.5]), v([1, 0.9, -1.5]), slanted, 0), null);
  assert(convexSegmentFraction(v([0, 2, 0]), v([0, -2, 0]), slanted, 0) !== null);
});

test('all quarter turns preserve affine picking, plane normals and true convex overlap rather than surrounding bounds', () => {
  const { model, middle } = modelFor([8, 4]);
  for (const yaw of [0, 90, 180, 270]) for (const pitch of [0, 90, 180, 270]) for (const roll of [0, 90, 180, 270]) {
    const room = { ...model.room(middle), yaw, pitch, roll }, point = [2, -1, 3];
    assert(v(toLocal(room, toWorld(room, point))).distanceTo(v(point)) < 1e-12);
    for (const face of FACES) {
      const frame = portFrame(room, face); assert(Math.abs(Math.hypot(...frame.normal) - 1) < 1e-12);
      const inside = v(toWorld(room, [0, 0, 0])).sub(v(frame.center)); assert(inside.dot(v(frame.normal)) < 0);
    }
    const bounds = new Box3().setFromPoints(roomVertices(room).map(v)); assert(bounds.containsPoint(v(toWorld(room, point))));
  }
  const a = { ...model.room(middle), position: [0, 0, 0], size: [4, 8, 16], endOffset: [16, 0] };
  const b = { ...a, position: [5, 0, 0] };
  assert(new Box3().setFromPoints(roomVertices(a).map(v)).intersectsBox(new Box3().setFromPoints(roomVertices(b).map(v))));
  assert.equal(roomsOverlap(a, b), false, 'parallel diagonal corridors have overlapping bounds but distinct volumes');
  assert.equal(roomsOverlap(a, { ...b, position: [4, 0, 0] }), false, 'touching is allowed');
  assert.equal(roomsOverlap(a, { ...b, position: [3.5, 0, 0] }), true);
});

for (const offset of [[0, 8], [0, -8], [8, 0], [-8, 0], [8, 8], [0, 16]]) test(`ramps/diagonal walls share visible geometry, collision and safe navigation both ways: ${offset}`, () => {
  for (const face of FACES) {
    const { model, middle, last } = modelFor(offset, face), level = compileLevelDocument(model.document), world = buildArena(level);
    try {
      assert.equal(level.sourceDocument.formatVersion, 5);
      const navigation = new RoomNavigation(model.document), start = v(model.room('room-1').position), end = v(model.room(last).position);
      for (const radius of [0.5, 0.78, 1.73]) for (const [from, to] of [[start, end], [end, start]]) {
        const route = navigation.route(from, to, radius); assert(route, `route for radius ${radius}`);
        const position = from.clone(); let previous = from;
        for (const point of route) {
          assert.equal(traceShot(previous, point, { colliders: world.colliders }), null, 'shots along the route clear the actual panels');
          const direction = point.clone().sub(position), length = direction.length();
          if (length) moveSphere(position, direction, 1, world.colliders, radius);
          assert(position.distanceTo(point) < 1e-5, 'fast sphere traverses each convex room and opening without snagging');
          previous = point;
        }
      }
      const room = model.room(middle), position = v(toWorld(room, [0, 0, 0]));
      const normal = v(portFrame(room, 'negativeY').normal).negate(), into = normal.clone().negate().multiplyScalar(12);
      const result = moveSphere(position, into, 1, world.colliders);
      assert(result.collided); assert(world.colliders.every(collider => !overlaps(position, 0.5, collider)));
      assert.equal(traceShot(v(room.position), v(toWorld(room, [0, -8, 0])), { colliders: world.colliders })?.kind, 'wall');
      const colliders = new Map(world.colliders.map(collider => [collider.id, collider]));
      world.group.traverse(object => {
        if (!(object instanceof Mesh) || !colliders.has(object.name)) return;
        const bounds = new Box3().setFromObject(object), expected = colliders.get(object.name).box;
        assert(bounds.min.distanceTo(expected.min) < 1e-5 && bounds.max.distanceTo(expected.max) < 1e-5);
      });
    } finally { disposeObject(world.group); }
  }
});

test('sloped floor sliding preserves tangential motion and leaves empty space inside surrounding bounds traversable', () => {
  const { model, middle } = modelFor([8, 8]), world = buildArena(compileLevelDocument(model.document)), room = model.room(middle);
  try {
    const frame = portFrame(room, 'negativeY'), normal = v(frame.normal).negate();
    const start = v(toWorld(room, [0, -3.5, 4])).addScaledVector(normal, 0.5), position = start.clone();
    const tangent = v(orient([0.5, 0.5, -1], room)).normalize().multiplyScalar(6), velocity = tangent.clone().addScaledVector(normal, -3);
    moveSphere(position, velocity, 0.5, world.colliders);
    assert(velocity.dot(normal) >= -1e-8); assert(velocity.dot(tangent) > 30); assert(position.distanceTo(start) > 2);
    assert(world.colliders.every(collider => !overlaps(position, 0.5, collider)));
    const floor = world.colliders.find(collider => collider.id === `@solid/${middle}/negativeY/wall`);
    const empty = v(toWorld(room, [0, 0, 5])); assert(floor.box.containsPoint(empty));
    assert.equal(convexContact(empty, 0.5, floor.convex), null);
    assert.equal(convexSegmentFraction(empty.clone().add(v([0.2, 0, 0])), empty.clone().sub(v([0.2, 0, 0])), floor.convex, 0.05), null);
  } finally { disposeObject(world.group); }
});

test('placement clearance, side-port rejection, profile bounds, version gates and atomic undo/recovery hold for shaped corridors', () => {
  const { model, middle } = modelFor([0, 16]), room = model.room(middle);
  assert.equal(fitsInside(room, [0, 3, 0], 0.5), false, 'sphere radius is measured perpendicular to the sloped wall');
  const snapped = placementPosition(room, [0, -4, 0], 'health'); assert(fitsInside(room, snapped, 0.5));
  const before = model.export(), history = model.past.length;
  assert.throws(() => model.attachRoom(middle, 'positiveX', 'box-room'), /side faces/); assert.equal(model.export(), before); assert.equal(model.past.length, history);
  for (const mutate of [
    input => { input.formatVersion = 4; }, input => { delete input.rooms[1].endOffset; }, input => { input.rooms[1].endOffset = [0.5, 8]; },
    input => { input.rooms[1].endOffset = [16, 16]; }, input => { input.rooms[0].endOffset = [0, 8]; },
    input => { input.connections[1].a.port = 'positiveX'; }, input => { input.rooms[1].endOffset.script = 'x'; },
  ]) { const input = JSON.parse(before); mutate(input); assert.equal(validateLevelDocument(input).valid, false); }
  model.setSurface(middle, 'negativeY', 0xb0a090, 'panels'); model.updateRoom(middle, { pitch: 90 }); assert.equal(model.document.formatVersion, 5);
  assert.equal(model.validation.valid, false); const recovered = new EditorDocument(); recovered.restoreDraft(model.document); assert.deepEqual(recovered.document, model.document);
  model.undo(); assert.equal(model.document.formatVersion, 5); model.undo(); assert.equal(model.export(), before);
  const imported = new EditorDocument(); imported.import(before); assert.equal(imported.export(), before);
  assert.throws(() => model.duplicateRoom(middle, 'negativeZ'), /unused face/, 'occupied end must reject atomically'); assert.equal(model.export(), before);
  const duplicate = new EditorDocument(), source = duplicate.attachRoom('room-1', 'negativeZ', 'offset-corridor', [4, 8]);
  duplicate.setSurface(source, 'negativeY', 0x887766, 'hazard');
  const copied = duplicate.duplicateRoom(source, 'negativeZ'); assert.equal(duplicate.validation.valid, true);
  assert.deepEqual(duplicate.room(copied).endOffset, [4, 8]); assert.deepEqual(duplicate.room(copied).surfaces, duplicate.room(source).surfaces);
});

test('relay doors seal sloped ends, unlock bodies/shots and restore on a fresh world', () => {
  const { model, middle } = modelFor([0, 8]), relay = model.addContent('room-1', 'relay', '', [0, 0, 0]); model.setDoor('connection-1', relay);
  const level = compileLevelDocument(model.document), state = new GameState(); state.session.begin(); state.session.transition('playing');
  for (let run = 0; run < 2; run++) {
    const world = buildArena(level), controller = new RelayController(level, world.group, world.colliders, state.session);
    try {
      const frame = openingFrame(model.room(middle), model.document.connections[0].b), normal = v(frame.normal);
      const a = v(frame.center).addScaledVector(normal, 2), b = v(frame.center).addScaledVector(normal, -2);
      assert.equal(traceShot(a, b, { colliders: world.colliders })?.kind, 'wall'); assert(controller.closedConnections.size);
      assert(controller.tryActivate(v([0, 0, 0]))); assert.equal(traceShot(a, b, { colliders: world.colliders }), null);
      const position = a.clone(); moveSphere(position, b.clone().sub(a), 1, world.colliders); assert(position.distanceTo(b) < 1e-6);
    } finally { controller.retire(); disposeObject(world.group); }
  }
  state.session.end();
});

test('corner-offset openings on maximum-slope corridors remain traversable in both directions', () => {
  const { model, last } = modelFor([0, 16]);
  model.anchorOpening('connection-1', 2, 2, 'top-right'); model.anchorOpening('connection-2', 2, 2, 'bottom-left');
  const world = buildArena(compileLevelDocument(model.document)), navigation = new RoomNavigation(model.document);
  try {
    for (const [start, end] of [[[0, 0, 0], model.room(last).position], [model.room(last).position, [0, 0, 0]]]) {
      const position = v(start), route = navigation.route(position, v(end), 0.5); assert(route);
      for (const target of route) {
        moveSphere(position, target.clone().sub(position), 1, world.colliders);
        assert(position.distanceTo(target) < 1e-5);
      }
    }
  } finally { disposeObject(world.group); }
});

test('an alerted scout navigates the actual ramp and diagonal walls to a remembered target and resets cleanly', t => {
  const { model, middle, last } = modelFor([8, 8]); model.addContent('room-1', 'enemy', 'scout', [0, 0, 0]);
  const level = compileLevelDocument(model.document), world = buildArena(level), scene = new Scene(), player = new Group(), state = new GameState();
  player.position.fromArray(model.room(last).position); scene.add(world.group, player); state.session.begin(); state.session.transition('playing');
  const manager = new EnemyManager(scene, player, state, null, { currentLevel: level, solidColliders: world.colliders, isEndless: false, tunnelWidth: 15, tunnelHeight: 12 });
  t.after(() => { state.session.end(); manager.resetLevel(); manager.projectileManager.dispose(); manager.effectsManager.dispose(); disposeObject(world.group); });
  manager.updateEnemies(0); const enemy = manager.enemies[0]; manager.hitEnemy(enemy, { power: 1 }, enemy.mesh.position);
  const target = player.position.clone(); player.position.set(500, 500, 500);
  const navigation = new RoomNavigation(model.document), visited = new Set();
  for (let frame = 0; frame < 2400; frame++) {
    state.session.advance(1 / 60); manager.updateEnemies(1 / 60); visited.add(navigation.roomAt(enemy.mesh.position));
    assert(world.colliders.every(collider => !overlaps(enemy.mesh.position, enemy.collisionRadius, collider)));
  }
  assert(visited.has(middle) && visited.has(last)); assert(enemy.mesh.position.distanceTo(target) < 0.04);
  manager.resetLevel(); manager.updateEnemies(0); assert(manager.enemies[0].mesh.position.equals(v([0, 0, 0])));
});
