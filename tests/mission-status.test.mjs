import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import MissionObjective from '../src/js/core/MissionObjective.js';
import StoryController from '../src/js/core/StoryController.js';
import { describeMissionStatus, optionalSummary } from '../src/js/core/MissionStatus.js';
import InputManager from '../src/js/core/InputManager.js';
import GameState from '../src/js/core/GameState.js';
import Game from '../src/js/main.js';
import { DEFAULT_BINDINGS } from '../src/js/core/ControlBindings.js';
import { GAMEPAD_BUTTONS } from '../src/js/core/GamepadInput.js';

const SIGNAL = JSON.parse(fs.readFileSync(new URL('../src/js/core/levels/documents/signal-breach.v13.json', import.meta.url), 'utf8'));

test('status lists required objectives with progress, then optional counts, time and difficulty', () => {
  const level = compileLevelDocument(SIGNAL), mission = new MissionObjective(level.mission);
  const status = describeMissionStatus({ level, mission, story: { logsFound: 1, logsTotal: 2, logIds: ['x'], rescued: 0, survivorsTotal: 2 },
    timeMs: 75_000, difficulty: 'Veteran', kills: 1 });
  assert.deepEqual(status.required.map(item => [item.label, item.done]), [['Activate Signal uplink', false], ['Reach extraction', false]]);
  assert.match(status.required[1].detail, /Locked/);
  assert.deepEqual(status.optional, [
    { label: 'Survivors aboard', count: 0, total: 2 }, { label: 'Data logs recovered', count: 1, total: 2 }, { label: 'Robots destroyed', count: 1, total: 4 }]);
  assert.deepEqual([status.timeMs, status.difficulty, status.escapeMs, status.exitReady], [75_000, 'Veteran', null, false]);
  assert.equal(optionalSummary(status), 'Aboard 0/2 · Logs 1/2');
  mission.recordDeviceActivation('relay-signal', 1);
  const ready = describeMissionStatus({ level, mission, timeMs: 80_000, difficulty: 'Pilot' });
  assert.equal(ready.required[0].done, true); assert.match(ready.required[1].detail, /Exit open/); assert.equal(ready.exitReady, true);
  assert.equal(optionalSummary(ready), '', 'no story: no HUD counts');
});

test('reactor and guard objectives show their progress and the escape timer', () => {
  const level = { name: 'Test', devices: [{ id: 'core', label: 'Primary reactor', kind: 'reactor' }, { id: 'pump', label: 'Pump relay' }], enemySpawns: [{}, {}, {}] };
  const mission = new MissionObjective({ type: 'relay-clear-and-exit', requiredEnemyIds: ['a', 'b'], requiredDeviceIds: ['pump', 'core'],
    escape: { triggerDeviceId: 'core', durationSeconds: 60 }, exit: { id: 'exit', position: [0, 0, 0], radius: 2 } });
  mission.recordDefeat('a', 'shot');
  let status = describeMissionStatus({ level, mission, timeMs: 1000, difficulty: 'Pilot', kills: 5 });
  assert.deepEqual(status.required.map(item => item.label), ['Activate Pump relay', 'Destroy Primary reactor', 'Destroy required guards (1/2)', 'Reach extraction']);
  assert.equal(status.required[1].detail, 'Starts the escape countdown');
  assert.deepEqual(status.optional, [{ label: 'Robots destroyed', count: 3, total: 3 }], 'kills are capped at the robot count');
  mission.recordDefeat('b', 'shot'); mission.recordDeviceActivation('pump', 2000); mission.recordDeviceActivation('core', 3000);
  status = describeMissionStatus({ level, mission, timeMs: 13_000, difficulty: 'Pilot' });
  assert.equal(status.escapeMs, 50_000);
});

test('the story keeps an ordered history of transmissions and recovered logs for the comms log', () => {
  const level = compileLevelDocument(SIGNAL), story = new StoryController(level.story, level.sourceDocument, new THREE.Scene(), () => {});
  story.start();
  story.update(new THREE.Vector3(...level.story.logs[0].world), 4000);
  story.deviceActivated('relay-signal');
  assert.deepEqual(story.history.map(entry => [entry.kind, entry.label, entry.timeMs]),
    [['message', 'Vey · Kestrel dispatch', 0], ['message', 'Vey · Kestrel dispatch', 4000], ['log', 'Shift log: R. Okafor', 4000], ['message', 'Vey · Kestrel dispatch', 4000]]);
  story.dispose();
});

function fakeGame() {
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  const calls = [];
  const game = { session: state.session, spaceship: { rotate() {}, update() {}, viewEffects: new THREE.Group() }, activeAnimations: [],
    pauseGame: () => true, togglePause: () => true, releasePointerLock() {}, openMissionLog() { calls.push('log'); return true; } };
  const input = new InputManager(null, null, state, { showMessage() {} });
  input.game = game;
  return { state, input, calls };
}

test('J (remappable) and the controller View button open the mission log', () => {
  assert.deepEqual(DEFAULT_BINDINGS.missionLog, ['KeyJ']);
  assert.equal(GAMEPAD_BUTTONS[8], 'missionLog');
  const { state, input, calls } = fakeGame();
  input.onKeyDown({ code: 'KeyJ' }); assert.deepEqual(calls, ['log']);
  input.onKeyDown({ code: 'KeyJ', repeat: true }); assert.deepEqual(calls, ['log']);
  const pad = pressed => ({ id: 'pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });
  input.pollGamepad(() => [pad([])], 0); input.pollGamepad(() => [pad([8])], 0);
  assert.deepEqual(calls, ['log', 'log']);
  state.session.transition('paused');
  input.pollGamepad(() => [pad([])], 0); input.pollGamepad(() => [pad([8])], 0);
  assert.deepEqual(calls, ['log', 'log', 'log'], 'View also opens the log from the pause menu');
});

test('opening the mission log pauses a running mission and expands the comms section', t => {
  const game = Object.create(Game.prototype), shown = [];
  const state = new GameState();
  Object.assign(game, { session: state.session, uiManager: { showPauseMenu: options => shown.push(options) } });
  t.mock.method(game, 'pauseGame', () => { state.session.transition('paused'); shown.push('paused'); return true; });
  assert.equal(game.openMissionLog(), false, 'nothing to show from the main menu');
  state.session.begin(); state.session.transition('playing');
  assert.equal(game.openMissionLog(), true);
  assert.deepEqual(shown, ['paused', { openComms: true }]);
  assert.equal(game.openMissionLog(), true, 'from the pause menu it just expands the log');
  assert.deepEqual(shown.at(-1), { openComms: true });
});
