import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DESTROYER_ARMOR, armorSide, bossPhase, hitScale } from '../src/js/entities/HeavyRoles.js';
import RobotGenerators from '../src/js/entities/RobotGenerators.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { teamDocuments } from '../src/js/core/levels/TeamMissions.js';
import { startGameServer } from '../server/GameServer.mjs';
import { headlessGame } from './helpers/headlessGame.mjs';

const steps = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) game.updateSimulation(1 / 60); };
const clone = value => JSON.parse(JSON.stringify(value));
const errorsOf = document => { const result = validateLevelDocument(document); return result.valid ? [] : result.errors.map(error => `${error.path} ${error.message}`); };

test('destroyer armour by side, and boss phases by shields', () => {
  const facing = new THREE.Vector3(0, 0, 1);
  assert.equal(armorSide(facing, new THREE.Vector3(0, 0, -1)), 'front', 'a shot flying into its face');
  assert.equal(armorSide(facing, new THREE.Vector3(0, 0, 1)), 'rear');
  assert.equal(armorSide(facing, new THREE.Vector3(1, 0, 0)), 'side');
  const destroyer = { type: { name: 'destroyer' }, mesh: new THREE.Object3D() };
  assert.equal(hitScale(destroyer, { velocity: new THREE.Vector3(0, 0, -5) }).scale, DESTROYER_ARMOR.front);
  assert.equal(hitScale(destroyer, { velocity: new THREE.Vector3(0, 0, 5) }).scale, DESTROYER_ARMOR.rear);
  assert.equal(hitScale(destroyer, { launchOrigin: new THREE.Vector3(10, 0, 0) }, new THREE.Vector3()).scale, DESTROYER_ARMOR.side, 'falls back to where the shot came from');
  assert.equal(hitScale({ type: { name: 'boss' } }, {}).scale, 0.7);
  assert.equal(hitScale({ type: { name: 'scout' } }, {}).scale, 1);
  assert.deepEqual([1, 0.7, 0.66, 0.4, 0.33, 0.1].map(bossPhase), [1, 1, 2, 2, 3, 3]);
});

test('generators wake with a pilot in their room, keep to their interval and limit, and run dry', () => {
  const generators = new RobotGenerators([{ id: 'g', roomId: 'bay', position: new THREE.Vector3(), enemyType: 'scout', count: 3, intervalMs: 1000, maxAlive: 2 }]);
  const spawned = [], alive = { count: 0 };
  const spawn = (definition, name) => { spawned.push(name); alive.count++; };
  assert.deepEqual(generators.update(0, new Set(['hall']), () => alive.count, spawn), []);
  assert.deepEqual(generators.update(100, new Set(['bay']), () => alive.count, spawn), ['g']);
  assert.deepEqual(spawned, ['g#1']);
  generators.update(600, new Set(['bay']), () => alive.count, spawn);
  assert.equal(spawned.length, 1, 'interval');
  generators.update(1100, new Set(), () => alive.count, spawn);
  assert.equal(spawned.length, 2, 'keeps going once awake');
  generators.update(2100, new Set(), () => alive.count, spawn);
  assert.equal(spawned.length, 2, 'at most two alive');
  alive.count = 0;
  generators.update(2200, new Set(), () => alive.count, spawn);
  generators.update(9999, new Set(), () => 0, spawn);
  assert.deepEqual(spawned, ['g#1', 'g#2', 'g#3']); assert.equal(generators.remaining('g'), 0);
});

/** Twin Valves with a generator in the drop and the format raised to 16. */
function generatorDocument() {
  const document = clone(teamDocuments[0]);
  document.formatVersion = 16; document.id = 'generator-test';
  document.generators = [{ id: 'drop-gen', roomId: 'kestrel-drop', position: [-8, 0, -8], enemyType: 'scout', count: 3, intervalSeconds: 2, maxAlive: 2 }];
  return document;
}

test('format v16: generators validate; older versions, unknown rooms and bosses are refused', () => {
  assert.deepEqual(errorsOf(generatorDocument()), []);
  const old = generatorDocument(); old.formatVersion = 15;
  assert.ok(errorsOf(old).some(error => error.includes('formatVersion 16')));
  const room = generatorDocument(); room.generators[0].roomId = 'nowhere';
  assert.ok(errorsOf(room).some(error => error.includes('Unknown generator room')));
  const boss = generatorDocument(); boss.generators[0].enemyType = 'boss';
  assert.ok(errorsOf(boss).some(error => error.includes('enemyType')));
  const many = generatorDocument(); many.generators[0].count = 40;
  assert.ok(errorsOf(many).some(error => error.includes('count')));
  const duplicate = generatorDocument(); duplicate.generators[0].id = 'west-valve';
  assert.ok(errorsOf(duplicate).some(error => error.includes('already used')));
});

test('in a mission: a generator releases named robots that never count or drop salvage; destroyers and bosses fight as designed', t => {
  const game = headlessGame(t);
  assert.ok(game.startLevelDocument(generatorDocument()));
  const shown = [];
  game.uiManager.showMessage = text => shown.push(text);
  steps(game, 0.1);
  const generated = () => game.enemyManager.enemies.filter(enemy => enemy.mesh.userData.generatorId === 'drop-gen');
  assert.equal(generated().length, 1); assert.equal(generated()[0].mesh.userData.spawnPointId, 'drop-gen#1');
  assert.ok(shown.some(text => text.startsWith('ROBOT GENERATOR ACTIVE · 2')), shown.join('|'));
  steps(game, 2.1);
  assert.equal(generated().length, 2);
  steps(game, 2.1);
  assert.equal(generated().length, 2, 'never more than two alive');
  const pickups = game.powerUpManager.powerups.length;
  const robot = generated()[0];
  game.enemyManager.hitEnemy(robot, { power: 1e6 }, robot.mesh.position.clone());
  assert.equal(game.powerUpManager.powerups.length, pickups, 'no salvage from generated robots');
  assert.equal(game.mission.defeats.size, 0, 'and no mission credit');
  steps(game, 2.1);
  assert.equal(generated().length, 2, 'the third robot replaces it');
  assert.equal(game.enemyManager.generators.remaining('drop-gen'), 0);

  // A destroyer shot in the face barely notices; shot in the back it hurts.
  const destroyer = game.enemyManager.enemies.find(enemy => enemy.type.name === 'destroyer');
  const facing = destroyer.mesh.getWorldDirection(new THREE.Vector3());
  const before = destroyer.health;
  game.enemyManager.hitEnemy(destroyer, { power: 10, velocity: facing.clone().negate() }, destroyer.mesh.position.clone());
  const front = before - destroyer.health;
  game.enemyManager.hitEnemy(destroyer, { power: 10, velocity: facing.clone() }, destroyer.mesh.position.clone());
  const rear = before - front - destroyer.health;
  assert.ok(Math.abs(front - 2.5) < 1e-9 && Math.abs(rear - 20) < 1e-9, `front ${front}, rear ${rear}`);
  assert.ok(shown.some(text => text.startsWith('DESTROYER FRONT ARMOR')));

  // A boss calls two escorts at each new phase.
  const boss = game.enemyManager.spawnEnemy(game.spaceship.group.position.clone().add(new THREE.Vector3(0, 0, -6)), 'boss');
  boss.mesh.userData.spawnPointId = 'test-boss';
  const escorts = () => game.enemyManager.enemies.filter(enemy => enemy.mesh.userData.generatorId === 'test-boss#escorts').length;
  boss.health = boss.maxHealth * 0.6; steps(game, 0.05);
  assert.equal(boss.bossPhase, 2); assert.equal(escorts(), 2);
  assert.ok(shown.some(text => text.startsWith('BOSS SHIELDS FAILING')));
  boss.health = boss.maxHealth * 0.2; steps(game, 0.05);
  assert.equal(boss.bossPhase, 3); assert.equal(escorts(), 4);
});

test('online co-op: robots the server generates appear on clients as puppets and vanish when destroyed', async t => {
  const server = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {} });
  t.after(() => server.close());
  const game = headlessGame(t);
  const match = await game.joinOnline({ url: `ws://127.0.0.1:${server.port}/play`, name: 'Ana', mode: 'coop', map: 'team-twin-valves' });
  const loop = setInterval(() => { game.advanceFrame(1 / 60); game.online?.frame(); }, 1000 / 60);
  t.after(() => clearInterval(loop));
  const until = async (check, label) => { const end = Date.now() + 5000; while (!check()) { if (Date.now() > end) throw new Error(`timed out: ${label}`); await new Promise(resolve => setTimeout(resolve, 10)); } };
  const serverGame = server.rooms.get(match.room).room.game;
  const drop = serverGame.levelManager.currentLevel.sourceDocument.rooms.find(room => room.id === 'kestrel-drop');
  serverGame.enemyManager.generators = new RobotGenerators([{ id: 'test-gen', roomId: drop.id, position: serverGame.gameState.pilot('p1').ship.group.position.clone().add(new THREE.Vector3(-6, 0, -6)),
    enemyType: 'fighter', count: 1, intervalMs: 2000, maxAlive: 1 }]);
  const puppet = () => game.enemyManager.enemies.find(enemy => enemy.mesh.userData.spawnPointId === 'test-gen#1');
  await until(() => puppet(), 'generated robot drawn here');
  assert.equal(puppet().type.name, 'fighter');
  const real = serverGame.enemyManager.enemies.find(enemy => enemy.mesh.userData.spawnPointId === 'test-gen#1');
  serverGame.enemyManager.hitEnemy(real, { power: 1e6 }, real.mesh.position.clone());
  await until(() => !puppet(), 'puppet removed');
  match.close();
});
