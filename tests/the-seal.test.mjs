import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { openingFrame } from '../src/js/core/levels/document/RoomMath.js';
import buildArena from '../src/js/core/ArenaGeometry.js';
import PortalVisibility from '../src/js/core/PortalVisibility.js';
import MineGuide from '../src/js/core/levels/document/MineGuide.js';
import createCampaign, { campaignDocuments } from '../src/js/core/levels/Campaign.js';
import disposeObject from '../src/js/utils/disposeObject.js';

const v = (...p) => new THREE.Vector3(...p);
const level = () => createCampaign().find(level => level.id === 'the-seal');

test('The Seal is mission 05: a valid, labelled two-level mine with loops, secrets and the full objective chain', () => {
  const mission = level(), doc = mission.sourceDocument;
  assert.equal(mission.campaignOrder, 5); assert.equal(campaignDocuments.at(-1), campaignDocuments.find(d => d.id === 'the-seal'));
  assert.equal(validateLevelDocument(doc).valid, true); assert.equal(doc.formatVersion, 14);
  assert.equal(doc.rooms.length, 26); assert.equal(doc.connections.length - doc.rooms.length + 1, 3, 'three independent loops');
  assert(doc.rooms.every(room => room.label), 'every space has a readable name for the pilot guide');
  assert.deepEqual(doc.mission.requiredDeviceIds, ['shaft-power', 'seal-release', 'evac-power']);
  assert.deepEqual(doc.mission.escape, { triggerDeviceId: 'evac-power', durationSeconds: 75 });
  assert.equal(doc.entities.find(e => e.kind === 'exit').roomId, doc.playerSpawn.roomId, 'the escape ends back at the dock');
  const kinds = new Set(doc.doors.map(door => door.kind === 'force-field' ? 'field' : door.concealed ? 'concealed' : door.activation === 'shot' ? 'shot' : 'relay'));
  assert.deepEqual([...kinds].sort(), ['concealed', 'field', 'relay', 'shot']);
  assert.deepEqual([...new Set(doc.entities.filter(e => e.kind === 'enemy').map(e => e.type))].sort(), ['bomber', 'destroyer', 'fighter', 'scout']);
  const floors = doc.rooms.map(room => room.surfaces?.negativeY?.pattern);
  assert(floors.includes('lava') && floors.includes('water'));
  const minimumShots = doc.entities.filter(e => e.kind === 'enemy').reduce((n, e) => n + ({ scout: 1, fighter: 3, bomber: 5, destroyer: 10, boss: 20 })[e.type], 0);
  assert(doc.combat.initialPulseAmmo > minimumShots, 'starting ammunition can defeat every robot before optional supplies');
});

test('The Seal story covers every beat, and the guide names rooms by their labels', () => {
  const doc = level().sourceDocument, story = /** @type {any} */ (doc).story;
  assert.equal(story.survivors.length, 4); assert.equal(story.logs.length, 4);
  assert.deepEqual(story.messages.filter(m => m.trigger.on === 'device').map(m => m.trigger.deviceId), ['shaft-power', 'seal-release', 'evac-power', 'evac-power']);
  assert(story.messages.some(m => m.trigger.on === 'defeat' && m.trigger.enemyId === 'asset-destroyer'));
  const guide = new MineGuide(doc);
  assert.equal(guide.roomName('pump-hall'), 'Pump hall'); assert.equal(guide.roomName('evac-shaft'), 'Evac lift shaft');
});

test('every portal in The Seal stays visible from both sides, including both vertical shafts', t => {
  const mission = level(), world = buildArena(mission);
  t.after(() => disposeObject(world.group));
  const visibility = new PortalVisibility(mission.sourceDocument, world.group), camera = new THREE.PerspectiveCamera(65, 1.6, 0.1, 1000);
  for (const link of mission.sourceDocument.connections) {
    const room = mission.sourceDocument.rooms.find(r => r.id === link.a.roomId), frame = openingFrame(room, link.a), center = v(...frame.center), normal = v(...frame.normal);
    for (const sign of [-1, 1]) {
      camera.position.copy(center).addScaledVector(normal, sign * 2);
      camera.up.set(normal.y ? 1 : 0, normal.y ? 0 : 1, 0);
      camera.lookAt(center.clone().addScaledVector(normal, -sign * 8)); visibility.update(camera);
      const destination = sign < 0 ? link.b.roomId : link.a.roomId;
      assert(visibility.visibleRooms.has(destination), `${link.id}: ${destination} must remain visible across the opening`);
    }
  }
});
