import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import UserLevelLibrary, { LIBRARY_LIMITS } from '../src/js/core/UserLevelLibrary.js';
import UserCampaignLibrary, { CAMPAIGN_LIMITS, USER_CAMPAIGNS_KEY, exportCampaignBundle, importCampaignBundle, nextCampaignMission, parseCampaignBundle } from '../src/js/core/UserCampaignLibrary.js';
import { createDocument } from '../src/js/editor/EditorDocument.js';
import Game from '../src/js/main.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import InputManager from '../src/js/core/InputManager.js';
import LevelManager from '../src/js/core/LevelManager.js';
import ProjectileManager from '../src/js/entities/ProjectileManager.js';
import EnemyManager from '../src/js/entities/EnemyManager.js';
import PowerUpManager from '../src/js/entities/PowerUpManager.js';

function stores() {
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  return { data, storage, levels: new UserLevelLibrary(() => storage), campaigns: new UserCampaignLibrary(() => storage) };
}
/** @param {string} name */
const mine = name => ({ ...createDocument(), name });

test('campaigns order missions, keep briefings and survive a reload', () => {
  const { storage, levels, campaigns } = stores();
  const a = levels.save(mine('Alpha')), b = levels.save(mine('Bravo'));
  const created = campaigns.create('  The Ridge ', 'Act one');
  assert.equal(created.name, 'The Ridge');
  campaigns.addMission(created.key, a.key, 'Restore the relay.');
  const after = campaigns.addMission(created.key, b.key);
  const [first, second] = after.missions;
  campaigns.moveMission(created.key, second.id, -1);
  campaigns.setBriefing(created.key, second.id, 'Find the miners.');
  const reloaded = new UserCampaignLibrary(() => storage).get(created.key);
  assert.deepEqual(reloaded?.missions.map(mission => [mission.levelKey, mission.briefing]), [[b.key, 'Find the miners.'], [a.key, 'Restore the relay.']]);
  assert.equal(nextCampaignMission(/** @type {any} */ (reloaded)), 0);
  campaigns.removeMission(created.key, first.id);
  assert.equal(campaigns.get(created.key)?.missions.length, 1);
  assert.deepEqual(campaigns.usage(b.key), ['The Ridge']); assert.deepEqual(campaigns.usage(a.key), []);
});

test('progress follows missions through reordering and resets on request', () => {
  const { levels, campaigns } = stores();
  const keys = ['A', 'B', 'C'].map(name => levels.save(mine(name)).key);
  let campaign = campaigns.create('Run');
  for (const key of keys) campaign = campaigns.addMission(campaign.key, key);
  const [one, two] = campaign.missions;
  assert.deepEqual(campaigns.recordCompletion(campaign.key, one.id), { completed: 1, total: 3, saved: true });
  assert.equal(nextCampaignMission(/** @type {any} */ (campaigns.get(campaign.key))), 1);
  campaigns.moveMission(campaign.key, two.id, -1);
  assert.equal(nextCampaignMission(/** @type {any} */ (campaigns.get(campaign.key))), 0, 'the unplayed mission moved to the front');
  campaigns.recordCompletion(campaign.key, one.id);
  assert.equal(campaigns.get(campaign.key)?.completed.length, 1, 'replays do not double count');
  campaigns.removeMission(campaign.key, one.id);
  assert.deepEqual(campaigns.get(campaign.key)?.completed, [], 'removed missions drop their progress');
  campaigns.recordCompletion(campaign.key, two.id); campaigns.resetProgress(campaign.key);
  assert.deepEqual(campaigns.get(campaign.key)?.completed, []);
});

test('invalid edits and limits leave saved campaigns untouched', () => {
  const { data, levels, campaigns } = stores();
  const level = levels.save(mine('Alpha')), campaign = campaigns.create('Keep');
  const before = data.get(USER_CAMPAIGNS_KEY);
  assert.throws(() => campaigns.update(campaign.key, { name: '  ' }), /campaign name/);
  assert.throws(() => campaigns.update(campaign.key, { description: 'x'.repeat(CAMPAIGN_LIMITS.description + 1) }), /limited/);
  assert.throws(() => campaigns.addMission(campaign.key, 'bad key!'), /Choose a level/);
  assert.throws(() => campaigns.addMission('missing', level.key), /no longer saved/);
  assert.equal(data.get(USER_CAMPAIGNS_KEY), before);
  for (let index = 0; index < CAMPAIGN_LIMITS.missions; index++) campaigns.addMission(campaign.key, level.key);
  assert.throws(() => campaigns.addMission(campaign.key, level.key), /at most/);
  for (let index = 1; index < CAMPAIGN_LIMITS.campaigns; index++) campaigns.create(`C${index}`);
  assert.throws(() => campaigns.create('One too many'), /full/);
});

test('another tab\'s campaign survives a save here; unreadable data is preserved', () => {
  const { data, storage, campaigns } = stores();
  const other = new UserCampaignLibrary(() => storage);
  other.create('From tab two'); campaigns.create('From tab one');
  assert.deepEqual(new UserCampaignLibrary(() => storage).list().map(campaign => campaign.name), ['From tab two', 'From tab one']);
  data.set(USER_CAMPAIGNS_KEY, '{"version":1,"campaigns":[{"key":"bad key"}]}');
  const broken = new UserCampaignLibrary(() => storage);
  assert.equal(broken.persistent, false); assert.match(broken.status, /Temporary/);
  broken.create('Temporary'); assert.equal(data.get(USER_CAMPAIGNS_KEY), '{"version":1,"campaigns":[{"key":"bad key"}]}');
});

test('bundles embed every level and import as new library entries plus one campaign', () => {
  const source = stores(), target = stores();
  const a = source.levels.save(mine('Alpha')), b = source.levels.save(mine('Bravo'));
  let campaign = source.campaigns.create('Shared', 'Two missions');
  campaign = source.campaigns.addMission(campaign.key, a.key, 'First.');
  campaign = source.campaigns.addMission(campaign.key, b.key, 'Second.');
  source.campaigns.recordCompletion(campaign.key, campaign.missions[0].id);
  const text = exportCampaignBundle(/** @type {any} */ (source.campaigns.get(campaign.key)), source.levels);
  const bundle = JSON.parse(text);
  assert.equal(bundle.format, 'descended-campaign'); assert.equal(bundle.missions[1].level.name, 'Bravo');
  assert.equal('completed' in bundle, false, 'progress is personal and not exported');
  const imported = importCampaignBundle(text, target.levels, target.campaigns);
  assert.equal(imported.name, 'Shared'); assert.deepEqual(imported.completed, []);
  assert.deepEqual(imported.missions.map(mission => [target.levels.get(mission.levelKey)?.document.name, mission.briefing]), [['Alpha', 'First.'], ['Bravo', 'Second.']]);
  importCampaignBundle(text, target.levels, target.campaigns);
  assert.equal(target.levels.list().length, 4, 'importing twice creates independent copies');
});

test('bad bundles and full libraries import nothing', () => {
  const { data, levels, campaigns } = stores();
  assert.throws(() => parseCampaignBundle('nope'), /not valid JSON/);
  assert.throws(() => parseCampaignBundle(JSON.stringify(mine('Solo'))), /not a DESCENDED campaign/);
  assert.throws(() => parseCampaignBundle(JSON.stringify({ format: 'descended-campaign', version: 2, name: 'x', missions: [] })), /newer version/);
  const broken = mine('Broken'); broken.playerSpawn.roomId = 'missing';
  const good = { briefing: '', level: mine('Good') };
  assert.throws(() => importCampaignBundle(JSON.stringify({ format: 'descended-campaign', version: 1, name: 'Bad', missions: [good, { briefing: '', level: broken }] }), levels, campaigns), /^Error: Mission 2/);
  assert.equal(data.size, 0, 'nothing was written');
  for (let index = 0; index < LIBRARY_LIMITS.levels - 1; index++) levels.save(mine(`L${index}`));
  assert.throws(() => importCampaignBundle(JSON.stringify({ format: 'descended-campaign', version: 1, name: 'Too big', missions: [good, good] }), levels, campaigns), /room for 1/);
  assert.equal(levels.list().length, LIBRARY_LIMITS.levels - 1); assert.equal(campaigns.list().length, 0);
});

test('exports refuse campaigns with missing levels', () => {
  const { levels, campaigns } = stores();
  const level = levels.save(mine('Gone'));
  let campaign = campaigns.create('Broken');
  assert.throws(() => exportCampaignBundle(campaign, levels), /at least one mission/);
  campaign = campaigns.addMission(campaign.key, level.key); levels.remove(level.key);
  assert.throws(() => exportCampaignBundle(campaign, levels), /Mission 1 uses a level/);
});

function gameFixture(t, libraries) {
  t.mock.method(console, 'log', () => {}); t.mock.method(Math, 'random', () => 0.5);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: null } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const game = new Game(); game.camera = new THREE.PerspectiveCamera(); game.scene.add(game.camera);
  game.spaceship = new Spaceship(); game.spaceship.attachCamera(game.camera);
  const events = [];
  game.uiManager = { resetSessionUI() {}, updateHUD() {}, updateEnemyCount() {}, updateWeaponUI() {}, hideStartScreen() {}, hideLevelSelect() { events.push('hide'); },
    showMessage() {}, showPauseMenu() {}, hidePauseMenu() {}, showGameOver() {}, showSessionError(error) { throw error; },
    userLibraries: () => libraries, createUserLevels() { events.push('levels'); },
    showCampaignBriefing(info, launch, back) { events.push({ briefing: info, launch, back }); },
    showCompletion(hasNext, progress, campaign) { events.push({ completion: { hasNext, progress, campaign } }); } };
  game.levelManager = new LevelManager(game.scene, game.spaceship.group);
  game.projectileManager = new ProjectileManager(game.scene, game.spaceship.group, null, game.session); game.projectileManager.setCanvas({});
  game.enemyManager = new EnemyManager(game.scene, game.spaceship.group, game.gameState, null, game.levelManager);
  game.powerUpManager = new PowerUpManager(game.scene, game.spaceship.group, game.gameState, null, game.uiManager, game.levelManager);
  game.inputManager = new InputManager(game.camera, game.projectileManager, game.gameState, game.uiManager); game.inputManager.game = game;
  t.mock.method(game, 'initializeAudio', () => {}); t.mock.method(game.inputManager, 'requestPointerLock', () => Promise.resolve(true));
  game.gameState.setReferences(game.camera, null, game.uiManager, game.activeAnimations, game);
  t.after(() => { game.endSession(); game.projectileManager.dispose(); game.enemyManager.projectileManager.dispose(); game.enemyManager.effectsManager.dispose(); });
  return { game, events };
}

test('the game briefs, launches, records and chains user campaign missions', t => {
  const libraries = stores();
  const a = libraries.levels.save(mine('Alpha')), b = libraries.levels.save(mine('Bravo'));
  let campaign = libraries.campaigns.create('Chain');
  campaign = libraries.campaigns.addMission(campaign.key, a.key, 'Go in.');
  campaign = libraries.campaigns.addMission(campaign.key, b.key, 'Go deeper.');
  const { game, events } = gameFixture(t, libraries);
  assert.equal(game.playUserCampaign(campaign.key, 0), true);
  const briefing = events.find(event => event.briefing);
  assert.deepEqual(briefing.briefing, { campaignName: 'Chain', index: 0, total: 2, levelName: 'Alpha', briefing: 'Go in.' });
  assert.equal(game.session.phase !== 'playing', true, 'nothing launches before the briefing is accepted');
  briefing.launch();
  assert.equal(game.session.phase, 'playing'); assert.equal(game.levelManager.currentLevel.name, 'Alpha');
  assert.deepEqual(game.userCampaign, { key: campaign.key, missionId: campaign.missions[0].id });
  game.mission = null; assert.equal(game.completeSession(), true);
  const completion = events.find(event => event.completion).completion;
  assert.equal(completion.hasNext, true); assert.equal(completion.progress, null, 'built-in campaign progress is untouched');
  assert.deepEqual(completion.campaign, { completed: 1, total: 2, saved: true, name: 'Chain' });
  assert.equal(game.nextMission(), true);
  const second = events.filter(event => event.briefing)[1];
  assert.equal(second.briefing.levelName, 'Bravo'); second.launch();
  game.restartLevel(); assert.equal(game.userCampaign?.missionId, campaign.missions[1].id, 'replay keeps the campaign');
  game.mission = null; game.completeSession();
  const last = events.filter(event => event.completion)[1].completion;
  assert.equal(last.hasNext, false); assert.deepEqual(last.campaign, { completed: 2, total: 2, saved: true, name: 'Chain' });
  game.selectLevel(0); assert.equal(game.userCampaign, null, 'other entries leave the campaign');
  assert.equal(game.playUserCampaign(campaign.key, 9), false);
});
