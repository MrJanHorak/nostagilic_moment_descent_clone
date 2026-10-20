import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import MissionObjective from '../src/js/core/MissionObjective.js';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import { validateLevelDocument, serializeLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import createCampaign from '../src/js/core/levels/Campaign.js';
import GameSession from '../src/js/core/GameSession.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

const definition = { type: 'relay-clear-and-exit', requiredEnemyIds: ['guard'], requiredDeviceIds: ['coolant', 'reactor'],
  escape: { triggerDeviceId: 'reactor', durationSeconds: 60 }, exit: { position: [0, 0, 0], radius: 1.5 } };
function arm(mission, now = 1000) { mission.recordDefeat('guard', 'shot'); mission.recordDeviceActivation('coolant', now); return mission.recordDeviceActivation('reactor', now); }

test('reactor requires every other objective, arms exactly once and keeps a full simulation-time allowance', () => {
  const mission = new MissionObjective(definition);
  assert.equal(mission.recordDeviceActivation('reactor', 1000), false); assert.equal(mission.escapeDeadline, null);
  mission.recordDeviceActivation('coolant', 1000); assert.equal(mission.recordDeviceActivation('reactor', 1000), false);
  mission.recordDefeat('guard', 'shot'); assert.equal(mission.recordDeviceActivation('reactor', 1234), true);
  assert.equal(mission.remainingEscapeMs(1234), 60000); assert.equal(mission.ready, true);
  assert.equal(mission.recordDeviceActivation('reactor', 10000), false); assert.equal(mission.escapeDeadline, 61234);
  assert.equal(mission.updateEscape(61233), false); assert.equal(mission.updateEscape(61234), true);
  assert.equal(mission.remainingEscapeMs(999999), 0); assert.equal(mission.ready, false);
  assert.equal(mission.updateEscape(999999), false); assert.equal(mission.recordDeviceActivation('reactor', 1000000), false);
});

test('exit succeeds strictly before the deadline, fails at zero, and completed missions cannot melt down later', () => {
  for (const [now, succeeds] of [[60999, true], [61000, false], [61001, false]]) {
    const mission = new MissionObjective(definition); arm(mission);
    assert.equal(mission.tryComplete(new THREE.Vector3(), 0.5, now), succeeds);
    if (succeeds) assert.equal(mission.updateEscape(999999), false); else assert.equal(mission.failed, true);
  }
});

test('pause freezes the escape clock and a new attempt has no stored deadline or scheduled task', () => {
  const session = new GameSession(); session.begin(); session.transition('playing');
  const mission = new MissionObjective(definition); arm(mission, session.timeMs);
  session.advance(12); assert.equal(mission.remainingEscapeMs(session.timeMs), 48000);
  session.transition('paused'); session.advance(200); assert.equal(mission.remainingEscapeMs(session.timeMs), 48000);
  session.transition('playing'); session.advance(48); assert.equal(mission.updateEscape(session.timeMs), true);
  assert.equal(session.tasks.size, 0); assert.equal(new MissionObjective(definition).escapeDeadline, null);
});

function authored() {
  const model = new EditorDocument(), relay = model.addContent('room-1', 'relay', '', [-1, 0, 3]);
  model.setEscape(relay, 60); return { model, relay };
}

test('v10 countdown authoring round-trips, preserves format through face/door edits, and supports disable/undo/delete', () => {
  const { model, relay } = authored(); const original = model.export();
  assert.equal(model.document.formatVersion, 10); assert.equal(validateLevelDocument(JSON.parse(original)).valid, true);
  model.setSurface('room-1', 'negativeY', 0xff5511, 'lava'); assert.equal(model.document.formatVersion, 10);
  model.undo(); assert.equal(model.export(), original);
  const linkRoom = model.attachRoom('room-1', 'negativeZ', 'box-room'); assert(linkRoom);
  model.setDoor(model.document.connections[0].id, relay, { sliding: true }); assert.equal(model.document.formatVersion, 10);
  model.setEscape(''); assert.equal(model.document.mission.escape, undefined); model.undo(); assert.equal(model.document.mission.escape.triggerDeviceId, relay);
  model.deleteContent(relay); assert.equal(model.document.mission.escape, undefined); assert.equal(model.validation.valid, true);
  model.undo(); assert.equal(model.document.mission.escape.triggerDeviceId, relay);
});

test('legacy versions reject the escape field; v10 rejects invalid durations, references and runtime fields', () => {
  const { model } = authored(), valid = JSON.parse(model.export());
  for (let version = 2; version <= 9; version++) {
    const old = structuredClone(valid); old.formatVersion = version; assert.equal(validateLevelDocument(old).valid, false);
  }
  for (const duration of [0, 9, 601, 60.5, NaN, Infinity, '60', null]) {
    const bad = structuredClone(valid); bad.mission.escape.durationSeconds = duration; assert.equal(validateLevelDocument(bad).valid, false);
  }
  for (const duration of [10, 600]) { const doc = structuredClone(valid); doc.mission.escape.durationSeconds = duration; assert.equal(validateLevelDocument(doc).valid, true); }
  for (const mutation of [doc => doc.mission.escape.triggerDeviceId = 'missing', doc => doc.mission.escape.deadline = 1000, doc => doc.mission.escape = null]) {
    const bad = structuredClone(valid); mutation(bad); assert.equal(validateLevelDocument(bad).valid, false);
  }
  assert.equal(serializeLevelDocument(valid), model.export());
});

for (const prerequisite of ['enemy', 'relay']) test(`validation rejects a required ${prerequisite} behind the reactor's own escape door`, () => {
  const { model, relay } = authored(); model.setEscape('');
  const room = model.attachRoom('room-1', 'negativeZ', 'box-room');
  model.addContent(room, prerequisite, prerequisite === 'enemy' ? 'scout' : '', [0, 0, 0]);
  model.setDoor(model.document.connections[0].id, relay, { sliding: true });
  const bad = structuredClone(model.document); bad.mission.escape = { triggerDeviceId: relay, durationSeconds: 60 };
  const result = validateLevelDocument(bad); assert.equal(result.valid, false); assert(result.errors.some(issue => issue.code === 'locked-route'));
  assert.throws(() => model.setEscape(relay), /locked|trapped|reached/);
});

function fixture(t) {
  t.mock.method(console, 'log', () => {}); t.mock.method(Math, 'random', () => 0.5);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game(); game.camera = new THREE.PerspectiveCamera(); game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  const messages = [], results = [];
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {}, hideLevelSelect() {}, showPauseMenu() {}, hidePauseMenu() {},
    showMessage(text) { messages.push(text); }, showCompletion() { results.push('completed'); }, showGameOver() { results.push('dead'); }, showSessionError(error) { throw error; } };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session);
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {}); t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'nightfall-reactor') }); game.updateSimulation(1 / 60);
  t.after(() => game.endSession()); return { game, messages, results };
}
function activate(game, id) { game.spaceship.group.position.fromArray(game.levelManager.currentLevel.devices.find(device => device.id === id).position); return game.interact(); }
function prepareEscape(game) {
  for (const enemy of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(enemy, { power: 1000 }, enemy.mesh.position);
  activate(game, 'relay-coolant'); assert.equal(activate(game, 'relay-reactor'), true);
}

test('real reactor interlock cannot open its gate or start a clock before required guards and coolant', t => {
  const { game, messages } = fixture(t), interaction = game.levelManager.interaction;
  assert.equal(activate(game, 'relay-reactor'), false); assert.equal(game.mission.escapeDeadline, null);
  assert.equal(interaction.activatedIds.has('relay-reactor'), false); assert.equal(interaction.closedConnections.has('return-loop'), true);
  assert(messages.at(-1).includes('INTERLOCK'));
  activate(game, 'relay-coolant'); assert.equal(activate(game, 'relay-reactor'), false);
  for (const enemy of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(enemy, { power: 1000 }, enemy.mesh.position);
  assert.equal(activate(game, 'relay-reactor'), true); assert.equal(game.mission.remainingEscapeMs(game.session.timeMs), 60000);
  assert(messages.at(-1).includes('REACTOR CRITICAL'));
  game.updateSimulation(0.8); assert.equal(interaction.closedConnections.has('return-loop'), false);
  game.pauseGame(); const left = game.mission.remainingEscapeMs(game.session.timeMs); game.updateSimulation(600); assert.equal(game.mission.remainingEscapeMs(game.session.timeMs), left);
});

test('real timeout precedes movement/extraction, awards no completion bonus, and restart rebuilds the closed escape gate', t => {
  const { game, results } = fixture(t); prepareEscape(game); const retired = game.mission;
  game.spaceship.group.position.copy(game.mission.exitPosition); const beforeScore = game.gameState.score;
  game.updateSimulation(60); assert.equal(game.session.phase, 'dead'); assert.equal(game.failureReason, 'reactor');
  assert.equal(game.gameState.score, beforeScore); assert.deepEqual(results, ['dead']); assert.equal(game.session.tasks.size, 0);
  assert.equal(game.completeSession(), false); game.updateSimulation(100); assert.deepEqual(results, ['dead']);
  game.restartGame(); assert.notEqual(game.mission, retired); assert.equal(game.failureReason, null); assert.equal(game.gameState.playerHealth, 100);
  assert.equal(game.mission.escapeDeadline, null); assert.equal(game.levelManager.interaction.closedConnections.has('return-loop'), true);
  assert.equal(game.levelManager.interaction.activatedIds.size, 0); game.updateSimulation(61); assert.notEqual(game.failureReason, 'reactor');
});

test('successful extraction just before expiry stays complete; combat death and switching missions discard the old countdown', t => {
  const { game } = fixture(t); prepareEscape(game);
  game.session.advance(59.9); game.spaceship.group.position.copy(game.mission.exitPosition); game.updateMission();
  assert.equal(game.session.phase, 'completed'); game.updateSimulation(100); assert.equal(game.session.phase, 'completed');
  game.restartGame(); game.updateSimulation(1 / 60); prepareEscape(game); game.gameState.takeDamage(100);
  assert.equal(game.session.phase, 'dead'); assert.equal(game.failureReason, 'combat');
  game.startSession({ endless: false, levelIndex: 0 }); game.updateSimulation(600);
  assert.equal(game.failureReason, null); assert.equal(game.session.phase, 'playing'); assert.equal(game.mission, null);
});

test('Nightfall authors the escape back through known rooms, with its optional upper supply room open before shutdown', () => {
  const level = createCampaign().find(level => level.id === 'nightfall-reactor');
  assert.equal(level.sourceDocument.formatVersion, 10); assert.equal(level.sourceDocument.entities.find(e => e.id === 'exit').roomId, 'arrival');
  assert.equal(level.doors.find(door => door.deviceId === 'relay-reactor').connectionId, 'return-loop');
  assert.equal(level.doors.some(door => door.connectionId === 'upper-cache-entry'), false);
});
