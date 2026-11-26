import test from 'node:test';
import assert from 'node:assert/strict';
import CampaignProgress, { CAMPAIGN_PROGRESS_KEY, formatMissionTime } from '../src/js/core/CampaignProgress.js';
import Game from '../src/js/main.js';
import createCampaign from '../src/js/core/levels/Campaign.js';
import { DIFFICULTIES } from '../src/js/core/Difficulty.js';

function memoryStorage(initial = null) {
  let value = initial;
  return { getItem(key) { assert.equal(key, CAMPAIGN_PROGRESS_KEY); return value; },
    setItem(key, next) { assert.equal(key, CAMPAIGN_PROGRESS_KEY); value = next; } };
}

const campaign = Object.freeze([
  { id: 'signal-breach', campaignOrder: 1 }, { id: 'vector-foundry', campaignOrder: 2 },
  { id: 'nightfall-reactor', campaignOrder: 3 }, { id: 'asterion-deepworks', campaignOrder: 4 }, { id: 'the-seal', campaignOrder: 5 },
  { id: 'witness', campaignOrder: 6 }, { id: 'fabricator', campaignOrder: 7 }, { id: 'moving-day', campaignOrder: 8 },
  { id: 'dead-signal', campaignOrder: 9 }, { id: 'breaker-yard', campaignOrder: 10 }, { id: 'core-of-the-matter', campaignOrder: 11 },
]);

test('built-in campaign missions have unique stable ids for saved progress', () => {
  const missions = createCampaign();
  assert.deepEqual(missions.map(mission => [mission.id, mission.campaignOrder]), campaign.map(mission => [mission.id, mission.campaignOrder]));
});

test('a fresh campaign starts at mission 1 and advances past completed missions in order', () => {
  const progress = new CampaignProgress(() => memoryStorage());
  assert.equal(progress.nextMission(campaign)?.id, 'signal-breach');
  assert.equal(progress.completedCount(campaign), 0);
  progress.recordCompletion(campaign[0], { score: 1500, timeMs: 95_000 });
  assert.equal(progress.nextMission(campaign)?.id, 'vector-foundry');
  // Completing a later mission out of order does not skip the earliest unfinished one.
  progress.recordCompletion(campaign[2], { score: 900, timeMs: 60_000 });
  assert.equal(progress.nextMission(campaign)?.id, 'vector-foundry');
  for (const mission of campaign) progress.recordCompletion(mission, { score: 1000, timeMs: 1000 });
  assert.equal(progress.nextMission(campaign), null);
  assert.equal(progress.completedCount(campaign), campaign.length);
});

test('completions persist best score, best time and count, and report new records', () => {
  const storage = memoryStorage();
  const progress = new CampaignProgress(() => storage);
  const first = progress.recordCompletion(campaign[0], { score: 1200, timeMs: 120_000 }, new Date('2026-11-23T12:00:00Z'));
  assert.deepEqual({ first: first?.firstCompletion, score: first?.newBestScore, time: first?.newBestTime }, { first: true, score: false, time: false });
  const slower = progress.recordCompletion(campaign[0], { score: 1800, timeMs: 150_000 });
  assert.deepEqual({ first: slower?.firstCompletion, score: slower?.newBestScore, time: slower?.newBestTime }, { first: false, score: true, time: false });
  const faster = progress.recordCompletion(campaign[0], { score: 1000, timeMs: 90_000 });
  assert.equal(faster?.newBestTime, true); assert.equal(faster?.newBestScore, false);
  assert.equal(progress.saveStatus, 'saved');
  const reloaded = new CampaignProgress(() => storage);
  assert.deepEqual({ ...reloaded.get('signal-breach'), lastCompletedAt: undefined },
    { completions: 3, bestScore: 1800, bestTimeMs: 90_000, lastCompletedAt: undefined, hardestDifficulty: 'pilot', mostRescued: 0, logIds: [] });
  assert.ok(Object.isFrozen(reloaded.missions) && Object.isFrozen(reloaded.get('signal-breach')));
});

test('malformed, future-version and hostile records fall back without rewriting stored data', () => {
  for (const raw of ['{bad json', 'null', '[]', '"x"', '{"version":2,"missions":{"signal-breach":{"completions":1,"bestScore":1,"bestTimeMs":1}}}',
    '{"version":1}', '{"version":1,"missions":[]}']) {
    const storage = memoryStorage(raw);
    const progress = new CampaignProgress(() => storage);
    assert.deepEqual(progress.missions, {});
    assert.equal(storage.getItem(CAMPAIGN_PROGRESS_KEY), raw);
  }
  const mixed = JSON.stringify({ version: 1, missions: {
    'signal-breach': { completions: 2, bestScore: 1400, bestTimeMs: 80_000, lastCompletedAt: 'not a date' },
    'vector-foundry': { completions: 0, bestScore: 10, bestTimeMs: 10 },
    'nightfall-reactor': { completions: '1', bestScore: 10, bestTimeMs: 10 },
    'asterion-deepworks': { completions: 1, bestScore: -5, bestTimeMs: 10 },
    'Bad Id!': { completions: 1, bestScore: 1, bestTimeMs: 1 },
    __proto__: { completions: 1, bestScore: 1, bestTimeMs: 1 },
  } });
  const progress = new CampaignProgress(() => memoryStorage(mixed));
  assert.deepEqual(Object.keys(progress.missions), ['signal-breach']);
  assert.equal(progress.get('signal-breach')?.lastCompletedAt, new Date(0).toISOString());
  assert.equal(progress.get('__proto__'), null);
  assert.equal(progress.get('toString'), null);
});

test('storage failures keep progress for the visit without throwing', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  for (const provider of [() => undefined, () => { throw new Error('blocked'); }, () => throwing]) {
    const progress = new CampaignProgress(provider);
    assert.equal(progress.saveStatus, 'unavailable');
    progress.recordCompletion(campaign[0], { score: 1000, timeMs: 1000 });
    assert.equal(progress.saveStatus, 'unavailable');
    assert.equal(progress.nextMission(campaign)?.id, 'vector-foundry');
  }
});

test('invalid missions are ignored, results are bounded and reset clears saved progress', () => {
  const storage = memoryStorage();
  const progress = new CampaignProgress(() => storage);
  assert.equal(progress.recordCompletion({ id: 'custom', campaignOrder: 0 }, { score: 1, timeMs: 1 }), null);
  assert.equal(progress.recordCompletion(/** @type {any} */ (null), { score: 1, timeMs: 1 }), null);
  const result = progress.recordCompletion(campaign[1], { score: Number.NaN, timeMs: Infinity });
  assert.deepEqual([result?.record.bestScore, result?.record.bestTimeMs], [0, 864e5]);
  progress.reset();
  assert.deepEqual(progress.missions, {});
  assert.deepEqual(JSON.parse(storage.getItem(CAMPAIGN_PROGRESS_KEY)), { version: 1, missions: {} });
});

test('mission times format as minutes and seconds', () => {
  assert.equal(formatMissionTime(0), '0:00');
  assert.equal(formatMissionTime(65_400), '1:05');
  assert.equal(formatMissionTime(3_725_000), '62:05');
  assert.equal(formatMissionTime(-5), '0:00');
});

function gameWithCampaign(storage) {
  const game = Object.create(Game.prototype);
  const missions = createCampaign();
  const practice = { id: 'crossfire-relay', name: 'Crossfire Relay' };
  Object.assign(game, {
    levelManager: { levels: [{ name: 'Flight Training Arena' }, ...missions, practice, { ...missions[0] }] },
    importedLevelIndex: missions.length + 2, currentLevelIndex: 1,
    campaignProgress: new CampaignProgress(() => storage),
    gameState: { score: 2400, difficulty: DIFFICULTIES.veteran }, session: { timeMs: 101_000 }, started: [],
  });
  game.startSession = options => { game.started.push(options.levelIndex); return true; };
  return game;
}

test('the game records only built-in campaign completions and continues at the next mission', () => {
  const storage = memoryStorage();
  const game = gameWithCampaign(storage);
  assert.deepEqual(game.campaignMissions().map(mission => mission.id), campaign.map(mission => mission.id));
  game.continueCampaign();
  assert.equal(game.started.at(-1), 1, 'fresh progress starts Signal Breach');

  const recorded = game.recordCampaignProgress();
  assert.deepEqual([recorded?.firstCompletion, recorded?.completed, recorded?.total, recorded?.saved, recorded?.timeMs], [true, 1, 11, true, 101_000]);
  assert.equal(recorded?.record.hardestDifficulty, 'veteran'); assert.equal(recorded?.difficulty, DIFFICULTIES.veteran);
  game.continueCampaign();
  assert.equal(game.started.at(-1), 2, 'continue resumes at Vector Foundry');

  // An imported document reusing a campaign id and a practice level never change progress.
  for (const index of [game.importedLevelIndex, campaign.length + 1, 0]) {
    game.currentLevelIndex = index;
    assert.equal(game.recordCampaignProgress(), null);
  }
  assert.equal(game.campaignProgress.completedCount(game.campaignMissions()), 1);

  for (const index of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) { game.currentLevelIndex = index; game.recordCampaignProgress(); }
  game.continueCampaign();
  assert.equal(game.started.at(-1), 1, 'a finished campaign replays from mission 1');
  assert.equal(new CampaignProgress(() => storage).completedCount(game.campaignMissions()), 11);

  assert.equal(game.resetCampaignProgress(), 'saved');
  game.continueCampaign();
  assert.equal(game.started.at(-1), 1);
});

test('records keep the hardest difficulty cleared and older saves count as Pilot', () => {
  const legacy = JSON.stringify({ version: 1, missions: { 'signal-breach': { completions: 1, bestScore: 1000, bestTimeMs: 60_000 },
    'vector-foundry': { completions: 1, bestScore: 1000, bestTimeMs: 60_000, hardestDifficulty: 'impossible' } } });
  const storage = memoryStorage(legacy);
  const progress = new CampaignProgress(() => storage);
  assert.equal(progress.get('signal-breach')?.hardestDifficulty, 'pilot');
  assert.equal(progress.get('vector-foundry')?.hardestDifficulty, 'pilot');
  const veteran = progress.recordCompletion(campaign[0], { score: 900, timeMs: 70_000, difficulty: 'veteran' });
  assert.equal(veteran?.newHardestDifficulty, true); assert.equal(veteran?.record.hardestDifficulty, 'veteran');
  const trainee = progress.recordCompletion(campaign[0], { score: 900, timeMs: 70_000, difficulty: 'trainee' });
  assert.equal(trainee?.newHardestDifficulty, false); assert.equal(trainee?.record.hardestDifficulty, 'veteran');
  const first = progress.recordCompletion(campaign[3], { score: 1, timeMs: 1, difficulty: 'trainee' });
  assert.equal(first?.newHardestDifficulty, false, 'a first clear is reported as a first completion, not a difficulty upgrade');
  assert.equal(first?.record.hardestDifficulty, 'trainee');
  assert.equal(progress.recordCompletion(campaign[2], { score: 1, timeMs: 1, difficulty: /** @type {any} */ ('bogus') })?.record.hardestDifficulty, 'pilot');
  assert.equal(new CampaignProgress(() => storage).get('signal-breach')?.hardestDifficulty, 'veteran');
});
