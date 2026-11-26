import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_MISSIONS, DAILY_MODIFIERS, DailyRecords, dailyChallenge, dayKey, isCurrentDailyId } from '../src/js/core/DailyChallenge.js';
import { createHttpApi } from '../server/HttpApi.mjs';
import { headlessGame } from './helpers/headlessGame.mjs';

const day = (iso, offset = 0) => new Date(Date.parse(`${iso}T12:00:00Z`) + offset * 86_400_000);
const memory = () => { let value = null; return { getItem: () => value, setItem: (_key, next) => { value = next; } }; };

test('the daily challenge is the same all day, changes each day and never repeats a mission two days running', () => {
  const morning = dailyChallenge(new Date('2026-11-25T00:05:00Z')), night = dailyChallenge(new Date('2026-11-25T23:55:00Z'));
  assert.deepEqual([morning.id, morning.missionId, morning.seed, morning.modifier.id], [night.id, night.missionId, night.seed, night.modifier.id]);
  assert.equal(morning.id, 'daily-2026-11-25');
  const seen = new Set(), modifiers = new Set();
  let previous = null;
  for (let i = 0; i < 90; i++) {
    const challenge = dailyChallenge(day('2026-11-25', i));
    assert.ok(DAILY_MISSIONS.includes(challenge.missionId));
    assert.notEqual(challenge.missionId, previous, `${challenge.dayKey} repeats yesterday's mission`);
    previous = challenge.missionId; seen.add(challenge.missionId); modifiers.add(challenge.modifier.id);
  }
  assert.ok(seen.size >= 10, 'most missions come up within three months');
  assert.equal(modifiers.size, DAILY_MODIFIERS.length, 'every modifier comes up');
  // Missions missing from a build are never drawn.
  assert.equal(dailyChallenge(day('2026-11-25'), ['witness']).missionId, 'witness');
});

test('modifiers become a difficulty tier on top of the Pilot balance', () => {
  for (let i = 0; i < 40; i++) {
    const { difficulty, modifier } = dailyChallenge(day('2026-01-01', i));
    assert.match(difficulty.label, /^Daily · /);
    assert.ok(['pilot', 'veteran'].includes(difficulty.id), 'the tier id stays a real tier for saved progress');
    for (const [key, value] of Object.entries(modifier.changes)) assert.equal(difficulty[key], value);
  }
});

test('the server accepts daily boards from yesterday to tomorrow only', async () => {
  const now = new Date('2026-11-25T10:00:00Z');
  assert.equal(isCurrentDailyId('daily-2026-11-25', now), true);
  assert.equal(isCurrentDailyId('daily-2026-11-24', now), true);
  assert.equal(isCurrentDailyId('daily-2026-11-26', now), true);
  assert.equal(isCurrentDailyId('daily-2026-11-20', now), false);
  assert.equal(isCurrentDailyId('daily-nope', now), false);
  const api = await createHttpApi({ missionIds: ['witness'], now: () => now.getTime() });
  const call = body => new Promise(resolve => {
    const response = { status: 0, body: '', writeHead(status) { this.status = status; return this; }, end(text) { this.body = text; resolve(this); } };
    const chunks = [Buffer.from(JSON.stringify(body))];
    const request = { url: '/scores', method: 'POST', headers: { 'x-forwarded-for': String(Math.random()) }, socket: {},
      on(event, handler) { if (event === 'data') chunks.forEach(handler); if (event === 'end') setImmediate(handler); return this; }, destroy() {} };
    api.handle(request, response);
  });
  assert.equal((await call({ mission: 'daily-2026-11-25', name: 'Ada', timeMs: 200_000, score: 10 })).status, 200);
  assert.equal((await call({ mission: 'daily-2026-11-01', name: 'Ada', timeMs: 200_000, score: 10 })).status, 400);
});

test('local daily records keep the best time, count runs and track the streak', () => {
  const storage = memory(), records = new DailyRecords(() => /** @type {any} */ (storage));
  assert.equal(records.record('2026-11-23', { timeMs: 300_000, medal: 'bronze' }).streak, 1);
  records.record('2026-11-24', { timeMs: 250_000 });
  const first = records.record('2026-11-25', { timeMs: 200_000, medal: 'silver' });
  assert.equal(first.streak, 3); assert.equal(first.newBest, false);
  const second = records.record('2026-11-25', { timeMs: 180_000, medal: 'bronze' });
  assert.deepEqual([second.record.timeMs, second.record.medal, second.record.runs, second.newBest], [180_000, 'silver', 2, true]);
  assert.equal(records.record('2026-11-25', { timeMs: 400_000 }).record.timeMs, 180_000, 'a slower run keeps the best');
  assert.equal(new DailyRecords(() => /** @type {any} */ (storage)).streak('2026-11-25'), 3, 'saved');
  assert.equal(records.streak('2026-11-27'), 0, 'a missed day ends the streak');
  assert.equal(dayKey(new Date('2026-11-25T23:59:59Z')), '2026-11-25');
});

test('in the game: the daily run uses its mission, seed and modifier, keeps them on restart and records the result', t => {
  const game = headlessGame(t);
  game.dailyRecords = new DailyRecords(() => /** @type {any} */ (memory()));
  const now = new Date('2026-11-25T15:00:00Z'), challenge = game.todaysChallenge(now);
  assert.ok(game.startDailyChallenge(now));
  assert.equal(game.levelManager.currentLevel.id, challenge.missionId);
  assert.equal(game.gameState.difficulty.label, challenge.difficulty.label);
  const first = game.session.rng.next();
  game.restartLevel();
  assert.equal(game.session.rng.next(), first, 'a restart replays the same seed');
  assert.equal(game.gameState.difficulty.label, challenge.difficulty.label);
  // Finish it.
  const relays = game.levelManager.interaction, mission = game.mission;
  for (let i = 0; i < 3; i++) game.updateSimulation(1 / 60);
  for (const robot of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(robot, { power: 1e6 }, robot.mesh.position.clone());
  for (const pair of mission.definition.linkedRelays ?? []) for (const id of pair.ids) { game.spaceship.group.position.copy(relays.devices.find(device => device.id === id).position); game.interact(); }
  for (const id of mission.definition.requiredDeviceIds) {
    if (relays.activatedIds.has(id)) continue;
    const device = relays.devices.find(value => value.id === id);
    if (device.kind === 'reactor') { const reactor = relays.reactors.find(value => value.device.id === id); game.completeDeviceObjective(relays.hitReactor(reactor.collider, 1e4, value => mission.canActivateDevice(value))); continue; }
    game.spaceship.group.position.copy(device.position); game.interact();
  }
  const choice = mission.definition.choice?.deviceIds[0];
  if (choice) { game.spaceship.group.position.copy(relays.devices.find(device => device.id === choice).position); game.interact(); }
  game.spaceship.group.position.copy(mission.exitPosition); game.spaceship.velocity.set(0, 0, 0);
  for (let i = 0; i < 12; i++) game.updateSimulation(1 / 60);
  assert.equal(mission.ready, true, `objectives: ${[...relays.activatedIds].join(',')} / ${mission.definition.requiredDeviceIds.join(',')} · defeats ${mission.defeats.size}/${mission.requiredIds.size}`);
  assert.equal(game.session.phase, 'completed');
  assert.equal(game.lastDaily?.challenge.id, 'daily-2026-11-25');
  assert.equal(game.lastDaily.record.runs, 1);
  // Choosing a normal mission leaves the daily behind.
  game.selectLevel(0);
  assert.equal(game.daily, null);
});
