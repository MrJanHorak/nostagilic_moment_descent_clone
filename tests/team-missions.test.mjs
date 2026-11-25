import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { teamDocuments } from '../src/js/core/levels/TeamMissions.js';
import { SOLO_LINK_SCALE } from '../src/js/core/RelayController.js';
import MatchRoom from '../src/js/net/MatchRoom.js';
import { coopMissions } from '../src/js/ui/OnlineLobby.js';
import { headlessGame } from './helpers/headlessGame.mjs';

const indexOf = (game, id) => game.levelManager.levels.findIndex(level => level.id === id);
const steps = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) game.updateSimulation(1 / 60); };
const clone = value => JSON.parse(JSON.stringify(value));
const errorsOf = document => { const result = validateLevelDocument(document); return result.valid ? [] : result.errors.map(error => `${error.path} ${error.message}`); };

test('format v15: linked relay pairs validate, and bad pairs are explained', () => {
  for (const document of teamDocuments) assert.deepEqual(errorsOf(document), [], document.id);
  const base = teamDocuments[0];
  const old = clone(base); old.formatVersion = 14;
  assert.ok(errorsOf(old).some(error => error.includes('linkedRelays') && error.includes('newer formatVersion')), 'v14 cannot link relays');
  const check = (links, expected) => {
    const document = clone(base); document.mission.linkedRelays = links;
    assert.ok(errorsOf(document).some(error => error.includes(expected)), `${JSON.stringify(links)} → ${expected}: ${errorsOf(document).join('; ')}`);
  };
  check([{ ids: ['west-valve', 'nope'], windowSeconds: 10 }], 'Unknown linked relay');
  check([{ ids: ['west-valve', 'west-valve'], windowSeconds: 10 }], 'two different relays');
  check([{ ids: ['west-valve'], windowSeconds: 10 }], 'exactly two');
  check([{ ids: ['west-valve', 'east-valve'], windowSeconds: 0 }], 'windowSeconds');
  check([{ ids: ['west-valve', 'east-valve'], windowSeconds: 10 }, { ids: ['east-valve', 'core-release'], windowSeconds: 10 }], 'more than one linked pair');
  const optional = clone(base); optional.mission.requiredDeviceIds = ['west-valve', 'core-release']; optional.mission.linkedRelays = [{ ids: ['west-valve', 'east-valve'], windowSeconds: 10 }];
  assert.ok(errorsOf(optional).some(error => error.includes('must be required')));
});

test('solo: a linked relay arms, disarms when its window runs out, and the pair opens the core together', t => {
  const game = headlessGame(t);
  assert.ok(game.startSession({ endless: false, levelIndex: indexOf(game, 'team-twin-valves'), seed: 2, coop: false }));
  const relays = game.levelManager.interaction, shown = [];
  game.uiManager.showMessage = text => shown.push(text);
  assert.equal(relays.linkScale, SOLO_LINK_SCALE);
  // Robots spawn on the first step; clear them so the waiting ship is not shot down.
  steps(game, 0.05);
  for (const robot of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(robot, { power: 1e6 }, robot.mesh.position.clone());
  const west = relays.devices.find(device => device.id === 'west-valve'), east = relays.devices.find(device => device.id === 'east-valve');
  game.spaceship.group.position.copy(west.position);
  const armed = game.interactAt(game.spaceship.group.position, true);
  assert.equal(armed.armed, true); assert.equal(armed.windowMs, 10000 * SOLO_LINK_SCALE);
  assert.ok(shown.some(text => text.includes('WEST VALVE ARMED') && text.includes('East valve')));
  assert.equal(relays.activatedIds.size, 0, 'nothing opens on one valve');
  assert.deepEqual(relays.armedState().map(entry => entry.id), ['west-valve']);
  steps(game, 41);
  assert.equal(relays.armed.size, 0, 'disarmed after 40 s alone');
  assert.ok(shown.some(text => text.startsWith('LINK LOST')));
  // Arm west, then reach east inside the window: both open, and the core lines with them.
  game.interact();
  game.spaceship.group.position.copy(east.position);
  const linked = game.interactAt(game.spaceship.group.position, true);
  assert.deepEqual(linked.linked.map(part => part.id), ['west-valve', 'east-valve']);
  assert.ok(relays.activatedIds.has('west-valve') && relays.activatedIds.has('east-valve'));
  assert.ok(game.mission.activatedDevices.has('west-valve') && game.mission.activatedDevices.has('east-valve'));
  assert.ok(shown.some(text => text.startsWith('LINKED RELAYS ONLINE')));
  steps(game, 2);
  assert.equal(relays.closedConnections.has('west-core-line-in'), false, 'west core gate open');
  assert.equal(relays.closedConnections.has('east-core-line-out'), false, 'east core gate open');
});

test('co-op: two pilots turn the valves together inside the team window (no solo stretch)', t => {
  const game = headlessGame(t);
  game.startSession({ endless: false, levelIndex: indexOf(game, 'team-twin-valves'), seed: 3, coop: true });
  const wing = game.addPilot('p2'), relays = game.levelManager.interaction;
  assert.equal(relays.linkScale, 1);
  steps(game, 0.05);
  for (const robot of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(robot, { power: 1e6 }, robot.mesh.position.clone());
  const west = relays.devices.find(device => device.id === 'west-valve'), east = relays.devices.find(device => device.id === 'east-valve');
  game.spaceship.group.position.copy(west.position);
  assert.equal(game.interactAt(game.spaceship.group.position, true).windowMs, 10000);
  steps(game, 11);
  assert.equal(relays.armed.size, 0, 'a team gets 10 s');
  game.interact();
  wing.ship.group.position.copy(east.position); wing.input = {};
  steps(game, 3);
  assert.ok(game.pilotInteract('p2').linked);
  assert.equal(game.mission.activatedDevices.size, 2);
});

test('the team missions are playable end to end in the simulation and show in the menus', t => {
  const game = headlessGame(t);
  for (const id of ['team-twin-valves', 'team-deep-freight']) {
    const index = indexOf(game, id);
    assert.ok(index >= 0); assert.equal(game.levelManager.levels[index].team, true);
    assert.ok(game.startSession({ endless: false, levelIndex: index, seed: 4, coop: true }), id);
    const relays = game.levelManager.interaction, mission = game.mission;
    // Clear the required robots (they spawn on the first step), then work through the relays in order (pairs together).
    steps(game, 0.05);
    for (const robot of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(robot, { power: 1e6 }, robot.mesh.position.clone());
    for (const pair of mission.definition.linkedRelays) {
      for (const deviceId of pair.ids) { game.spaceship.group.position.copy(relays.devices.find(device => device.id === deviceId).position); game.interact(); }
    }
    for (const deviceId of mission.definition.requiredDeviceIds) {
      if (relays.activatedIds.has(deviceId)) continue;
      game.spaceship.group.position.copy(relays.devices.find(device => device.id === deviceId).position);
      assert.ok(game.interact(), `${id}: ${deviceId}`);
    }
    assert.equal(mission.ready, true, `${id} objectives complete`);
    assert.ok(mission.escapeDeadline !== null, 'the escape clock runs');
    game.spaceship.group.position.copy(mission.exitPosition); game.spaceship.velocity.set(0, 0, 0);
    steps(game, 0.2);
    assert.equal(game.session.phase, 'completed', `${id} extracted`);
  }
  const picks = coopMissions(game);
  assert.deepEqual(picks.slice(0, 2).map(pick => pick.id), ['team-twin-valves', 'team-deep-freight'], 'team missions first in the co-op picker');
  assert.match(picks[0].name, /\(team\)/);
});

test('co-op rooms announce armed and disarmed relays and list them in snapshots', t => {
  t.mock.method(console, 'log', () => {});
  const room = new MatchRoom({ code: 'TEST', mode: 'coop', mapId: 'team-twin-valves', random: () => 0.5 });
  t.after(() => room.dispose());
  const ana = room.join('Ana'), ben = room.join('Ben'), game = room.game, relays = game.levelManager.interaction;
  const west = relays.devices.find(device => device.id === 'west-valve'), east = relays.devices.find(device => device.id === 'east-valve');
  game.gameState.pilot(ana.id).ship.group.position.copy(west.position);
  room.input(ana.id, { seq: 1, input: {}, look: [0, 0], fire: false, weapon: null, interact: true });
  assert.deepEqual(room.takeEvents().filter(event => event.t === 'armed'), [{ t: 'armed', id: 'west-valve', by: ana.id, partner: 'east-valve', ms: 10000 }]);
  assert.equal(room.snapshot(ana.id).coop.armed[0].id, 'west-valve');
  for (let i = 0; i < 11 * 60; i++) room.step();
  assert.ok(room.takeEvents().some(event => event.t === 'disarmed' && event.id === 'west-valve'));
  room.input(ana.id, { seq: 2, input: {}, look: [0, 0], fire: false, weapon: null, interact: true });
  game.gameState.pilot(ben.id).ship.group.position.copy(east.position);
  room.input(ben.id, { seq: 1, input: {}, look: [0, 0], fire: false, weapon: null, interact: true });
  const relayEvents = room.takeEvents().filter(event => event.t === 'relay').map(event => event.id).sort();
  assert.deepEqual(relayEvents, ['east-valve', 'west-valve']);
  assert.deepEqual(room.snapshot(ana.id).coop.armed, []);
  void new THREE.Vector3();
});
