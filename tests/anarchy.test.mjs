import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import AnarchyMatch from '../src/js/core/AnarchyMatch.js';
import createAnarchyMaps from '../src/js/core/levels/Anarchy.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import ring from '../src/js/core/levels/documents/foundry-ring.v14.json' with { type: 'json' };
import { headlessGame } from './helpers/headlessGame.mjs';

const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(40, 0, 0), new THREE.Vector3(0, 0, 40)];

test('frags, deaths and penalties: a kill scores for the attacker, a self-inflicted death costs a frag', () => {
  const match = new AnarchyMatch(points, { fragLimit: 3 });
  match.recordDeath('b', 'a', 100); match.recordDeath('a', null, 200); match.recordDeath('b', 'b', 300);
  assert.deepEqual(match.standings().map(({ id, frags, deaths }) => [id, frags, deaths]), [['a', 0, 1], ['b', -1, 2]]);
  assert.deepEqual(match.dueRespawns(3250), ['a'], 'respawns come due three seconds after each death');
  assert.deepEqual(match.dueRespawns(3300), ['b'], 'dying again restarts that pilot\'s timer');
  assert.deepEqual(match.dueRespawns(9999), []);
  assert.equal(match.over, false);
  for (let i = 0; i < 3; i++) match.recordDeath('b', 'a', 400 + i);
  assert.equal(match.over, true); assert.equal(match.winnerId, 'a');
  match.recordDeath('a', 'b', 500); assert.equal(match.standing('a').deaths, 1, 'nothing counts after the match ends');
});

test('respawn goes to the spawn farthest from live pilots; the time limit picks the leader', () => {
  const match = new AnarchyMatch(points, { timeLimitMs: 1000 });
  assert.equal(match.safestSpawn([new THREE.Vector3(1, 0, 1), new THREE.Vector3(0, 0, 38)]), points[1]);
  assert.equal(match.safestSpawn([]), points[0]);
  match.recordDeath('x', 'y', 0); match.recordDeath('y', 'z', 1);
  assert.equal(match.checkTime(999), false);
  assert.equal(match.checkTime(1000), true); assert.equal(match.over, true);
  assert.equal(match.winnerId, 'z', 'equal frags: fewer deaths wins');
  assert.throws(() => new AnarchyMatch([]), /spawn points/);
});

test('Foundry Ring is a valid, looping arena with spread-out spawns and weapon salvage', () => {
  assert.equal(validateLevelDocument(ring).valid, true);
  const [arena] = createAnarchyMaps();
  assert.equal(arena.mode, 'anarchy'); assert.equal(arena.id, 'foundry-ring');
  assert.equal(arena.enemySpawns.length, 0, 'no robots in a free-for-all');
  assert.ok(ring.rooms.length >= 30 && ring.connections.length - ring.rooms.length + 1 >= 5, 'big, with at least five loops');
  assert.ok(arena.anarchySpawns.length >= 10, 'enough respawn points that a camper cannot cover them');
  assert.ok(!ring.rooms.find(room => room.id === 'slag-pit') || arena.anarchySpawns.every(point => point.y > -20), 'never respawn on the lava');
  const types = new Set(arena.powerupSpawns.map(spawn => spawn.powerupType));
  for (const type of ['health', 'pulseAmmo', 'laserSalvage', 'missileSalvage', 'plasmaSalvage']) assert.ok(types.has(type), type);
  assert.equal(new Set(arena.powerupSpawns.map(spawn => spawn.id)).size, arena.powerupSpawns.length, 'unique pickup ids');
});

function anarchyGame(t) {
  const game = headlessGame(t), results = [];
  game.uiManager.showAnarchyResult = (...args) => results.push(args);
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'foundry-ring'), seed: 11 });
  const rival = game.addPilot('rival');
  return { game, rival, results };
}

/** The rival hovers ahead of the local ship and fires at it every step until it goes down. */
function rivalShootsLocal(game, rival) {
  game.spaceship.group.position.set(0, 0, -6); game.spaceship.velocity.set(0, 0, 0);
  rival.ship.group.position.set(0, 0, 6); rival.ship.group.quaternion.identity();
  for (let step = 0; step < 20 * 60 && game.gameState.localPilot.alive; step++) { game.pilotFire('rival'); game.updateSimulation(1 / 60); }
}

test('in Anarchy pilots hurt each other: a downed pilot respawns and the match goes on', t => {
  const { game, rival } = anarchyGame(t), local = game.gameState.localPilot;
  assert.equal(game.mission, null); assert.equal(game.anarchy.standing('rival').frags, 0);
  assert.equal(local.weaponInventory.pulse.ammo, 60, 'arena loadout');
  rivalShootsLocal(game, rival);
  assert.equal(local.alive, false, 'the rival\'s shots destroyed the local ship');
  assert.equal(game.session.phase, 'playing', 'going down does not end an Anarchy session');
  assert.equal(game.anarchy.standing('rival').frags, 1); assert.equal(game.anarchy.standing(local.id).deaths, 1);
  assert.equal(rival.health, rival.maxHealth, 'a pilot\'s own shots never hit them');
  game.pilotFire('rival');
  const lockedOut = game.projectileManager.fireProjectile(game.gameState, { requirePointerLock: false });
  assert.equal(lockedOut, undefined, 'a downed pilot cannot fire');
  for (let step = 0; step < 3.2 * 60; step++) game.updateSimulation(1 / 60);
  assert.equal(local.alive, true); assert.equal(game.gameState.playerHealth, game.gameState.maxPlayerHealth);
  const spawn = game.anarchy.safestSpawn([rival.ship.group.position]);
  assert.ok(game.spaceship.group.position.distanceTo(spawn) < 1, 'back in at the spawn farthest from the rival');
  assert.ok(game.spaceship.group.position.distanceTo(rival.ship.group.position) > 40);
});

test('reaching the frag limit ends the match with standings', t => {
  const { game, rival, results } = anarchyGame(t);
  game.anarchy.rules.fragLimit = 1;
  rivalShootsLocal(game, rival);
  game.updateSimulation(1 / 60);
  assert.equal(game.session.phase, 'completed');
  assert.equal(results.length, 1);
  const [standings, winner] = results[0];
  assert.equal(winner, 'rival'); assert.equal(standings[0].id, 'rival');
});

test('placed pickups come back 20 seconds after they are taken', t => {
  const { game } = anarchyGame(t);
  const spawn = game.levelManager.currentLevel.powerupSpawns.find(entry => entry.powerupType === 'pulseAmmo');
  game.gameState.weaponInventory.pulse.ammo = 0;
  game.spaceship.group.position.copy(spawn.position);
  game.updateSimulation(1 / 60); game.updateSimulation(1 / 60);
  const present = () => game.powerUpManager.powerups.some(powerup => powerup.spawnId === spawn.id);
  assert.equal(present(), false, 'collected'); assert.ok(game.gameState.weaponInventory.pulse.ammo > 0);
  game.spaceship.group.position.copy(spawn.position).add(new THREE.Vector3(0, 0, 3));
  game.gameState.weaponInventory.pulse.ammo = game.gameState.pulseAmmoCapacity;
  for (let step = 0; step < 19 * 60; step++) game.updateSimulation(1 / 60);
  assert.equal(present(), false, 'still away at 19 s');
  for (let step = 0; step < 2 * 60; step++) game.updateSimulation(1 / 60);
  assert.equal(present(), true, 'back after 20 s');
});
