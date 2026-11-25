import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import CoopMatch, { COOP_RULES, enemyToughness } from '../src/js/core/CoopMatch.js';
import { headlessGame } from './helpers/headlessGame.mjs';

const indexOf = (game, id) => game.levelManager.levels.findIndex(level => level.id === id);
const steps = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) game.updateSimulation(1 / 60); };
const boxOf = collider => collider.box ?? collider;

test('co-op rules: a shared pool of lives, respawn queue, wipe and team extraction', () => {
  const coop = new CoopMatch(new THREE.Vector3(1, 2, 3));
  assert.equal(coop.join('a'), true); assert.equal(coop.join('b'), true); assert.equal(coop.join('a'), false, 'rejoining adds no lives');
  assert.equal(coop.lives, 2 * COOP_RULES.livesPerPilot);
  assert.equal(coop.recordDown('a', 1000), true); assert.equal(coop.lives, 3);
  assert.deepEqual(coop.dueRespawns(5999), []); assert.deepEqual(coop.dueRespawns(6000), ['a']);
  coop.setCheckpoint(new THREE.Vector3(9, 9, 9), 'Relay B');
  assert.deepEqual(coop.checkpoint.toArray(), [9, 9, 9]); assert.deepEqual(coop.spawn.toArray(), [1, 2, 3]);
  // Nobody flying but someone due back: not a wipe yet.
  coop.recordDown('b', 7000);
  assert.equal(coop.checkWipe([{ id: 'a', alive: false }, { id: 'b', alive: false }]), false);
  coop.lives = 0; coop.dueRespawns(99999);
  assert.equal(coop.recordDown('a', 8000), false, 'no lives left: stays down');
  assert.equal(coop.checkWipe([{ id: 'a', alive: false }, { id: 'b', alive: false }]), true);
  const at = new Set(['a']);
  assert.equal(coop.everyoneOut([{ id: 'a', alive: true }, { id: 'b', alive: true }], pilot => at.has(pilot.id)), false);
  assert.equal(coop.everyoneOut([{ id: 'a', alive: true }, { id: 'b', alive: false }], pilot => at.has(pilot.id)), true, 'downed pilots are not waited for');
  assert.equal(coop.everyoneOut([{ id: 'b', alive: false }], () => true), false, 'someone must be alive');
  assert.deepEqual([1, 2, 3, 4, 9].map(n => enemyToughness(n)), [1, 1.6, 2.2, 2.8, 2.8]);
});

test('a two-pilot co-op mission: tougher robots, shared lives, relay checkpoint, team story pickups and extraction', t => {
  const game = headlessGame(t);
  assert.ok(game.startSession({ endless: false, levelIndex: indexOf(game, 'signal-breach'), seed: 3, coop: true }));
  assert.ok(game.coop, 'co-op rules are running');
  const wing = game.addPilot('p2');
  assert.equal(game.coop.lives, 4);
  steps(game, 0.1);
  assert.equal(game.enemyManager.toughness, 1.6, 'robots are tougher for two');

  // Robots take less damage from each shot.
  const robot = game.enemyManager.enemies[0];
  const before = robot.health;
  game.enemyManager.hitEnemy(robot, { power: 1.6, ownerId: 'p2' }, robot.mesh.position.clone());
  assert.ok(Math.abs(before - robot.health - 1) < 1e-9, 'a 1.6 hit does 1 damage for a team of two');

  // The local pilot goes down: the session goes on and they come back at the checkpoint.
  // (The wingmate flies off, or they would revive the wreck first.)
  wing.ship.group.position.copy(game.coop.spawn).add(new THREE.Vector3(0, 0, -30)); wing.input = {};
  game.gameState.takeDamage(1000);
  assert.equal(game.session.phase, 'playing'); assert.equal(game.gameState.localPilot.alive, false);
  assert.equal(game.coop.lives, 3);
  steps(game, COOP_RULES.respawnMs / 1000 + 0.1);
  assert.equal(game.gameState.localPilot.alive, true); assert.equal(game.gameState.playerHealth, 100);
  assert.ok(game.spaceship.group.position.distanceTo(game.coop.spawn) < 1e-6, 'respawned at the drop point');

  // The wingmate activates a relay: it becomes the team checkpoint.
  const relay = game.levelManager.interaction.devices.find(device => device.kind !== 'reactor' && game.mission.canActivateDevice(device.id));
  assert.ok(relay, 'Signal Breach has a relay');
  wing.ship.group.position.copy(relay.position).add(new THREE.Vector3(0, 0, 0.5));
  assert.equal(game.pilotInteract('p2'), true);
  assert.ok(game.coop.checkpoint.distanceTo(relay.position) < 1e-6);
  assert.equal(game.mission.activatedDevices.has(relay.id), true);

  // The wingmate picks up a data log for the team.
  const log = game.levelManager.currentLevel.story.logs[0];
  wing.ship.group.position.set(...log.world);
  steps(game, 0.05);
  assert.equal(game.story.summary().logsFound, 1);

  // Extraction waits for every living pilot.
  Object.defineProperty(game.mission, 'ready', { get: () => true });
  game.spaceship.group.position.copy(game.mission.exitPosition);
  wing.ship.group.position.set(...log.world);
  steps(game, 0.1);
  assert.equal(game.session.phase, 'playing', 'one pilot at the exit is not enough');
  wing.ship.group.position.copy(game.mission.exitPosition).add(new THREE.Vector3(0.3, 0, 0));
  wing.input = {}; wing.ship.velocity.set(0, 0, 0);
  steps(game, 0.1);
  assert.equal(game.session.phase, 'completed');
});

test('co-op: the mission is lost only when the whole team is down with no lives left', t => {
  const game = headlessGame(t);
  game.startSession({ endless: false, levelIndex: indexOf(game, 'signal-breach'), seed: 4, coop: true });
  const wing = game.addPilot('p2');
  game.coop.lives = 1;
  game.gameState.takeDamage(1000, wing);
  assert.equal(game.coop.lives, 0); assert.equal(game.session.phase, 'playing');
  game.gameState.takeDamage(1000);
  assert.equal(game.session.phase, 'playing', 'the wingmate is still due back');
  steps(game, COOP_RULES.respawnMs / 1000 + 0.1);
  assert.equal(wing.alive, true);
  game.gameState.takeDamage(1000, wing);
  assert.equal(game.session.phase, 'dead', 'everyone down, no lives: mission failed');
  // A restart stays co-op; choosing a mission from the menu is solo again.
  game.restartLevel(); assert.ok(game.coop);
  game.selectLevel(indexOf(game, 'signal-breach')); assert.equal(game.coop, null);
});

test('lava hurts every pilot on their own cadence; in Anarchy a lava death costs a frag', t => {
  const game = headlessGame(t);
  game.startSession({ endless: false, levelIndex: indexOf(game, 'foundry-ring'), seed: 5 });
  const rival = game.addPilot('p2');
  const lava = game.levelManager.environment.surfaces.find(surface => surface.kind === 'lava');
  assert.ok(lava, 'the slag pit has lava');
  const box = boxOf(lava.collider), centre = box.getCenter(new THREE.Vector3());
  rival.ship.group.position.set(centre.x, box.max.y + rival.radius * 0.5, centre.z);
  rival.input = {}; rival.ship.velocity.set(0, 0, 0);
  const local = game.gameState.playerHealth;
  game.updateSimulation(1 / 60);
  assert.ok(rival.health < 100, 'the rival is burned');
  assert.equal(game.gameState.playerHealth, local, 'the local ship is not');
  for (let i = 0; i < 60 * 12 && rival.alive; i++) { rival.ship.group.position.set(centre.x, box.max.y + rival.radius * 0.5, centre.z); rival.ship.velocity.set(0, 0, 0); game.updateSimulation(1 / 60); }
  assert.equal(rival.alive, false, 'lava finished the rival');
  assert.equal(game.anarchy.standing('p2').frags, -1, 'an environmental death costs a frag');
});
