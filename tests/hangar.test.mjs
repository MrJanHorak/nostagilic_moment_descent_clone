import test from 'node:test';
import assert from 'node:assert/strict';
import Hangar, { MAX_LEVEL, UPGRADES, creditsForRun, upgradeEffects } from '../src/js/core/Hangar.js';
import { DailyRecords } from '../src/js/core/DailyChallenge.js';
import { headlessGame } from './helpers/headlessGame.mjs';

const memory = () => { let value = null; return { getItem: () => value, setItem: (_key, next) => { value = next; } }; };

test('credits pay for robots, miners, logs and medals; replays pay half, player levels a quarter', () => {
  assert.equal(creditsForRun({}), 50);
  assert.equal(creditsForRun({ kills: 5, rescued: 2, logs: 3, medal: 'gold' }), 50 + 50 + 80 + 60 + 120);
  assert.equal(creditsForRun({ kills: 5, medal: 'silver', kind: 'replay' }), Math.round((50 + 50 + 50) / 2));
  assert.equal(creditsForRun({ kind: 'other' }), 13);
});

test('upgrades cost credits, cap at level 3, persist, and can be sold back', () => {
  const storage = memory(), hangar = new Hangar(() => /** @type {any} */ (storage));
  assert.throws(() => hangar.buy('plating'), /Not enough credits/);
  hangar.earn(2000);
  for (let i = 0; i < MAX_LEVEL; i++) hangar.buy('plating');
  assert.equal(hangar.level('plating'), 3); assert.equal(hangar.price('plating'), null);
  assert.throws(() => hangar.buy('plating'), /top level/);
  hangar.buy('capacitor');
  assert.equal(hangar.credits, 2000 - 150 - 300 - 500 - 200);
  const reloaded = new Hangar(() => /** @type {any} */ (storage));
  assert.deepEqual([reloaded.credits, reloaded.level('plating'), reloaded.level('capacitor'), reloaded.earned], [hangar.credits, 3, 1, 2000]);
  assert.equal(reloaded.markCleared('witness'), true); assert.equal(reloaded.markCleared('witness'), false);
  assert.equal(new Hangar(() => /** @type {any} */ (storage)).markCleared('witness'), false, 'first clears are remembered');
  reloaded.refund();
  assert.equal(reloaded.credits, 2000); assert.equal(UPGRADES.every(upgrade => reloaded.level(upgrade.id) === 0), true);
  // Tampered saves are clamped.
  storage.setItem('x', JSON.stringify({ version: 1, credits: -50, levels: { plating: 99, bogus: 3 } }));
  const clamped = new Hangar(() => /** @type {any} */ (storage));
  assert.deepEqual([clamped.credits, clamped.level('plating'), 'bogus' in clamped.levels], [0, 3, false]);
});

test('upgrade effects', () => {
  assert.deepEqual(upgradeEffects({}), { maxHealth: 100, power: 1, ammo: 1, speed: 1 });
  const top = upgradeEffects({ plating: 3, capacitor: 3, racks: 3, thrusters: 3 });
  assert.equal(top.maxHealth, 130); assert.ok(Math.abs(top.power - 1.3) < 1e-9); assert.ok(Math.abs(top.ammo - 1.45) < 1e-9); assert.ok(Math.abs(top.speed - 1.15) < 1e-9);
});

test('an online completion does not use the solo first-clear hangar reward', t => {
  const game = headlessGame(t);
  game.hangar = new Hangar(() => /** @type {any} */ (memory()));
  const signal = game.levelManager.levels.findIndex(level => level.id === 'signal-breach');
  game.selectLevel(signal);
  game.online = /** @type {any} */ ({ holdStill() {} });
  game.mission.completed = true;
  game.completeSession();
  assert.equal(game.lastCredits, null);
  assert.equal(game.hangar.cleared.has('signal-breach'), false);
  assert.equal(game.hangar.markCleared('signal-breach'), true);
  game.online = null;
});

test('in the game: upgrades apply in single player, never in the daily challenge, and missions pay credits', t => {
  const game = headlessGame(t);
  game.hangar = new Hangar(() => /** @type {any} */ (memory()));
  game.dailyRecords = new DailyRecords(() => /** @type {any} */ (memory()));
  game.hangar.earn(5000);
  for (const id of ['plating', 'capacitor', 'racks', 'thrusters']) { game.hangar.buy(id); game.hangar.buy(id); }
  const signal = game.levelManager.levels.findIndex(level => level.id === 'signal-breach');
  game.selectLevel(signal);
  assert.equal(game.gameState.localPilot.maxHealth, 120); assert.equal(game.gameState.playerHealth, 120);
  assert.ok(Math.abs(game.gameState.hangarPower - 1.2) < 1e-9); assert.ok(Math.abs(game.spaceship.hangarSpeed - 1.1) < 1e-9);
  assert.equal(game.gameState.weaponInventory.pulse.ammo, Math.round(80 * 1.3));
  // A pulse shot is 20% stronger.
  const shot = game.projectileManager.fireProjectile(game.gameState, { requirePointerLock: false });
  assert.ok(Math.abs(shot.power - 12) < 1e-9);
  // The daily challenge flies the stock ship.
  game.startDailyChallenge(new Date('2026-11-25T12:00:00Z'));
  assert.equal(game.gameState.localPilot.maxHealth, 100); assert.equal(game.gameState.hangarPower, 1); assert.equal(game.spaceship.hangarSpeed, 1);
  // Finishing Signal Breach pays first-clear credits, a replay pays half.
  const before = game.hangar.credits;
  const finish = () => {
    game.selectLevel(signal);
    for (let i = 0; i < 3; i++) game.updateSimulation(1 / 60);
    const relays = game.levelManager.interaction, mission = game.mission;
    for (const id of mission.definition.requiredDeviceIds) { game.spaceship.group.position.copy(relays.devices.find(device => device.id === id).position); game.interact(); }
    game.spaceship.group.position.copy(mission.exitPosition); game.spaceship.velocity.set(0, 0, 0);
    for (let i = 0; i < 12; i++) game.updateSimulation(1 / 60);
    assert.equal(game.session.phase, 'completed');
    return game.lastCredits.earned;
  };
  const first = finish(), replay = finish();
  assert.ok(first >= 50); assert.equal(replay, Math.round(first / 2));
  assert.equal(game.hangar.credits, before + first + replay);
});
