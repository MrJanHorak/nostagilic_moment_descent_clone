import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { validateLevelDocument, serializeLevelDocument, parseLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument from '../src/js/core/levels/document/compileLevelDocument.js';
import StoryController from '../src/js/core/StoryController.js';
import CampaignProgress from '../src/js/core/CampaignProgress.js';
import EditorDocument from '../src/js/editor/EditorDocument.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

const SIGNAL = JSON.parse(fs.readFileSync(new URL('../src/js/core/levels/documents/signal-breach.v13.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(SIGNAL);
const errors = input => { const result = validateLevelDocument(input); return result.valid ? [] : result.errors.map(error => `${error.path} ${error.code}`); };

test('Signal Breach v13 story validates, round-trips and compiles story placements to world space', () => {
  const text = serializeLevelDocument(SIGNAL);
  assert.equal(serializeLevelDocument(parseLevelDocument(text)), text);
  const level = compileLevelDocument(SIGNAL);
  assert.equal(level.story.messages.length, SIGNAL.story.messages.length);
  assert.deepEqual(level.story.survivors.map(survivor => survivor.name), ['Dara Okafor', 'Teo Brandt']);
  // maintenance is centred at (20, 0, -32); the survivor sits at local (-5, 0, 4).
  assert.deepEqual(level.story.survivors[0].world, [15, 0, -28]);
  assert.ok(Object.isFrozen(level.story.logs[0]) && Object.isFrozen(level.story.logs[0].world));
});

test('story requires format 13 and rejects malformed entries, bad references, overlaps and duplicate ids', () => {
  const old = clone(); old.formatVersion = 12;
  assert.ok(errors(old).some(issue => issue.startsWith('$.story version')));
  const cases = [
    [doc => { doc.story.messages[0].trigger = { on: 'timer', seconds: 3 }; }, '$.story.messages[0].trigger.on choice'],
    [doc => { doc.story.messages[0].trigger = { on: 'start', roomId: 'arrival' }; }, '$.story.messages[0].trigger.roomId field'],
    [doc => { doc.story.messages[0].text = ''; }, '$.story.messages[0].text text'],
    [doc => { doc.story.messages[0].text = 'x'.repeat(281); }, '$.story.messages[0].text text'],
    [doc => { doc.story.messages[1].trigger.roomId = 'nowhere'; }, '$.story.messages[1].trigger.roomId reference'],
    [doc => { doc.story.messages[3].trigger.enemyId = 'arrival-ammo'; }, '$.story.messages[3].trigger.enemyId reference'],
    [doc => { doc.story.messages[4].trigger.deviceId = 'ghost-relay'; }, '$.story.messages[4].trigger.deviceId reference'],
    [doc => { doc.story.logs[0].roomId = 'nowhere'; }, '$.story.logs[0].roomId reference'],
    [doc => { doc.story.logs[0].position = [-2, 0, 2]; }, '$.story.logs[0].position placement-overlap'],
    [doc => { doc.story.survivors[0].position = [9.9, 0, 0]; }, '$.story.survivors[0].position clearance'],
    [doc => { doc.story.survivors[1].id = 'hall-fighter'; }, '$.story.survivors[1].id duplicate-id'],
    [doc => { doc.story.survivors[0].role = 'boss'; }, '$.story.survivors[0].role field'],
    [doc => { doc.story.logs = Array.from({ length: 17 }, (_, i) => ({ ...doc.story.logs[0], id: `log-${i}` })); }, '$.story.logs array'],
  ];
  for (const [mutate, expected] of cases) {
    const doc = clone(); mutate(doc);
    assert.ok(errors(doc).includes(expected), `${expected} in ${JSON.stringify(errors(doc))}`);
  }
  const minimal = clone(); minimal.story = {};
  assert.deepEqual(errors(minimal), [], 'every story list is optional');
});

function controller(t) {
  const level = compileLevelDocument(SIGNAL), scene = new THREE.Scene(), events = [];
  const story = new StoryController(level.story, level.sourceDocument, scene, event => events.push(event));
  t.after(() => story.dispose());
  return { level, scene, story, events };
}

test('messages fire once from start, room entry, relays and defeats, in authored order', t => {
  const { story, events } = controller(t);
  story.start();
  assert.deepEqual(events.map(event => event.id), ['sb:msg-start']);
  story.start(); assert.equal(events.length, 1, 'start fires once');
  story.update(new THREE.Vector3(0, 0, -16), 0); // entry tunnel
  story.update(new THREE.Vector3(0, 0, -16), 16);
  story.update(new THREE.Vector3(0, 0, -30), 32); // signal hall
  story.enemyDefeated('hall-fighter'); story.enemyDefeated('hall-fighter'); story.enemyDefeated('maintenance-scout');
  story.deviceActivated('relay-signal');
  story.update(new THREE.Vector3(0, 0, -16), 48); story.update(new THREE.Vector3(0, 0, -30), 64);
  assert.deepEqual(events.map(event => event.id), ['sb:msg-start', 'sb:msg-foreman-seal', 'sb:msg-hall', 'sb:msg-guard-down', 'sb:msg-uplink']);
  assert.ok(events.every(event => event.kind === 'message' && event.speaker && event.text));
});

test('logs and survivors are collected once by flying through them and reported in the summary', t => {
  const { level, scene, story, events } = controller(t);
  const [dara] = level.story.survivors, [okafor] = level.story.logs;
  assert.ok(scene.getObjectByName(`story-survivor:${dara.id}`) && scene.getObjectByName(`story-log:${okafor.id}`));
  story.update(new THREE.Vector3(...dara.world).add(new THREE.Vector3(1.4, 0, 0)), 0);
  assert.equal(events.filter(event => event.kind === 'survivor').length, 0, 'not collected from outside reach');
  story.update(new THREE.Vector3(...dara.world).add(new THREE.Vector3(1.2, 0, 0)), 0);
  story.update(new THREE.Vector3(...dara.world), 0);
  story.update(new THREE.Vector3(...okafor.world), 0);
  const collected = events.filter(event => event.kind !== 'message');
  assert.deepEqual(collected.map(event => [event.kind, event.id]), [['survivor', dara.id], ['log', okafor.id]]);
  assert.deepEqual([collected[0].aboard, collected[0].total, collected[1].found, collected[1].total], [1, 2, 1, 2]);
  assert.equal(scene.getObjectByName(`story-survivor:${dara.id}`), undefined, 'collected meshes leave the scene');
  assert.deepEqual(story.summary(), { logsFound: 1, logsTotal: 2, logIds: [okafor.id], rescued: 1, survivorsTotal: 2 });
  story.dispose();
  assert.equal(scene.getObjectByName('story-content'), undefined);
});

function signalGame(t) {
  t.mock.method(console, 'log', () => {}); t.mock.method(Math, 'random', () => 0.5);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game(); game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  const story = [], results = [];
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {}, hideLevelSelect() {},
    showMessage() {}, showPauseMenu() {}, hidePauseMenu() {}, showCompletion(hasNext, progress) { results.push(progress); }, showGameOver() {},
    showSessionError(error) { throw error; }, showStoryEvent(event) { story.push(event); }, updateMissionUI() {} };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session); game.projectileManager.setCanvas({});
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {}); t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  game.campaignProgress = new CampaignProgress(() => undefined);
  t.after(() => { game.endSession(); game.projectileManager.dispose(); game.enemyManager.projectileManager.dispose(); game.enemyManager.effectsManager.dispose(); });
  return { game, story, results };
}

test('in the campaign: dispatch speaks at start, rescues count only on extraction and records keep logs found', t => {
  const { game, story, results } = signalGame(t);
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'signal-breach') });
  assert.deepEqual(story.map(event => event.id), ['sb:msg-start']);
  const level = game.levelManager.currentLevel, [dara, teo] = level.story.survivors, [okafor] = level.story.logs;
  for (const at of [dara.world, okafor.world]) { game.spaceship.group.position.fromArray(at); game.updateSimulation(1 / 60); }
  assert.deepEqual(story.filter(event => event.kind !== 'message').map(event => event.id), [dara.id, okafor.id]);
  // Dying or restarting loses everyone aboard.
  game.restartLevel();
  assert.deepEqual(game.story.summary(), { logsFound: 0, logsTotal: 2, logIds: [], rescued: 0, survivorsTotal: 2 });
  for (const at of [dara.world, teo.world, okafor.world]) { game.spaceship.group.position.fromArray(at); game.updateSimulation(1 / 60); }
  game.mission.completed = true; // route/combat are covered elsewhere; isolate the story scoring here
  const before = game.gameState.score;
  assert.equal(game.completeSession(), true);
  assert.equal(game.gameState.score - before, 1000 + 2 * 250 + 100);
  assert.deepEqual(game.lastStorySummary, { logsFound: 1, logsTotal: 2, logIds: [okafor.id], rescued: 2, survivorsTotal: 2 });
  assert.deepEqual([results[0].record.mostRescued, results[0].record.logIds], [2, [okafor.id]]);
});

test('editor deletes story entries that refer to removed rooms, relays or robots, and never reuses story ids', () => {
  const model = new EditorDocument(SIGNAL);
  model.deleteContent('hall-fighter');
  assert.ok(!model.document.story.messages.some(message => message.trigger.enemyId === 'hall-fighter'));
  model.deleteContent('relay-signal');
  assert.ok(!model.document.story.messages.some(message => message.trigger.deviceId === 'relay-signal'));
  const before = model.document.story.survivors.length;
  model.deleteRoom('maintenance');
  assert.equal(model.document.story.survivors.length, before - 1);
  assert.ok(!model.document.story.messages.some(message => message.trigger.roomId === 'maintenance'));
  assert.equal(validateLevelDocument(model.document).valid, true, 'the edited document stays valid');
  model.undo(); model.undo(); model.undo();
  assert.deepEqual(model.document.story, SIGNAL.story, 'undo restores the story');
  assert.equal(JSON.parse(model.export()).story.messages.length, SIGNAL.story.messages.length, 'export keeps the story');
});

test('campaign records keep the best rescue count and a bounded union of recovered log ids', () => {
  let stored = null;
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  const progress = new CampaignProgress(() => storage);
  const mission = { id: 'signal-breach', campaignOrder: 1 };
  progress.recordCompletion(mission, { score: 1, timeMs: 1, rescued: 2, logIds: ['sb:log-memo'] });
  progress.recordCompletion(mission, { score: 1, timeMs: 1, rescued: 1, logIds: ['sb:log-okafor', 'sb:log-memo'] });
  const record = new CampaignProgress(() => storage).get('signal-breach');
  assert.equal(record.mostRescued, 2);
  assert.deepEqual([...record.logIds].sort(), ['sb:log-memo', 'sb:log-okafor']);
  stored = JSON.stringify({ version: 1, missions: { 'signal-breach': { completions: 1, bestScore: 1, bestTimeMs: 1, mostRescued: -3, logIds: ['ok', 7, 'bad id!', 'ok'] } } });
  const cleaned = new CampaignProgress(() => storage).get('signal-breach');
  assert.equal(cleaned.mostRescued, 0); assert.deepEqual(cleaned.logIds, ['ok']);
});
