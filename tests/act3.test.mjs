import test from 'node:test';
import assert from 'node:assert/strict';
import createCampaign, { campaignDocuments, campaignEnding, FINAL_CHOICE } from '../src/js/core/levels/Campaign.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { headlessGame } from './helpers/headlessGame.mjs';

const ACT3 = ['dead-signal', 'breaker-yard', 'core-of-the-matter'];
const steps = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) game.updateSimulation(1 / 60); };
const clone = value => JSON.parse(JSON.stringify(value));

test('Act 3 missions 09–11 close the campaign with two bosses and a final choice', () => {
  const campaign = createCampaign();
  assert.deepEqual(campaign.slice(8).map(level => [level.campaignOrder, level.id]), [[9, 'dead-signal'], [10, 'breaker-yard'], [11, 'core-of-the-matter']]);
  for (const id of ACT3) {
    const document = campaignDocuments.find(value => value.id === id), level = campaign.find(value => value.id === id);
    assert.equal(validateLevelDocument(document).valid, true, id);
    assert.ok(level.generators.length >= 3, `${id} has fabricators`);
    assert.ok(level.story.messages.length >= 7 && level.story.logs.length >= 2 && level.story.survivors.length >= 2, `${id} story`);
    assert.ok(document.connections.length - document.rooms.length + 1 >= 2, `${id} has loops`);
    assert.ok(level.briefing.length > 200);
    for (const message of level.story.messages) assert.ok(message.text.length <= 280, `${message.id} fits the radio`);
  }
  const bosses = id => campaignDocuments.find(value => value.id === id).entities.filter(entity => entity.type === 'boss').map(entity => entity.id);
  assert.deepEqual(bosses('breaker-yard'), ['warden']); assert.deepEqual(bosses('core-of-the-matter'), ['executor']);
  const final = campaign.at(-1);
  assert.equal(final.sourceDocument.formatVersion, 17);
  assert.deepEqual(final.mission.choice.deviceIds, [FINAL_CHOICE.free, FINAL_CHOICE.destroy]);
});

test('format 17 choice relays: validation rules', () => {
  const base = campaignDocuments.find(value => value.id === 'core-of-the-matter');
  const issues = mutate => { const doc = clone(base); mutate(doc); const result = validateLevelDocument(doc); return result.valid ? [] : result.errors.map(error => error.message); };
  assert.ok(issues(doc => { doc.formatVersion = 16; }).some(message => /field|Unknown|choice/i.test(message)), 'choice needs v17');
  assert.ok(issues(doc => { doc.mission.choice.deviceIds = ['release-foreman']; }).some(message => /two or three/.test(message)));
  assert.ok(issues(doc => { doc.mission.choice.deviceIds = ['release-foreman', 'relay-sync']; }).some(message => /cannot also be required/.test(message)));
  assert.ok(issues(doc => { doc.mission.choice.deviceIds = ['release-foreman', 'nope']; }).some(message => /Unknown choice relay/.test(message)));
  assert.ok(issues(doc => { delete doc.mission.choice; }).some(message => /must be required/.test(message)), 'without a choice, optional relays are not allowed');
  // Choosing must never strand the pilot: move the exit behind the release route only.
  assert.ok(issues(doc => { doc.doors.find(door => door.id === 'purge-door').deviceId = 'release-foreman'; })
    .some(message => /Choosing purge-foreman leaves the exit unreachable/.test(message)));
});

test('campaign endings depend on the choice and on miners rescued', () => {
  assert.equal(campaignEnding('free', 30, 32).tier, 'all');
  assert.equal(campaignEnding('destroy', 20, 32).tier, 'most');
  assert.equal(campaignEnding('free', 3, 32).tier, 'few');
  assert.match(campaignEnding('free', 30, 32).title, /OPEN LINE/);
  assert.match(campaignEnding('destroy', 30, 32).title, /CONTRACT CLOSED/);
  assert.notEqual(campaignEnding('free', 3, 32).text, campaignEnding('free', 30, 32).text);
});

test('each Act 3 mission plays through: bosses fall, the choice locks, the epilogue follows', t => {
  const game = headlessGame(t);
  for (const [run, id] of [...ACT3, 'core-of-the-matter'].entries()) {
    const index = game.levelManager.levels.findIndex(level => level.id === id);
    assert.ok(game.startSession({ endless: false, levelIndex: index, seed: 9, coop: false }), id);
    const relays = game.levelManager.interaction, mission = game.mission;
    steps(game, 0.05);
    for (const robot of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(robot, { power: 1e6 }, robot.mesh.position.clone());
    for (const pair of mission.definition.linkedRelays ?? []) for (const deviceId of pair.ids) {
      game.spaceship.group.position.copy(relays.devices.find(device => device.id === deviceId).position); game.interact();
    }
    for (const deviceId of mission.definition.requiredDeviceIds) {
      if (relays.activatedIds.has(deviceId)) continue;
      game.spaceship.group.position.copy(relays.devices.find(value => value.id === deviceId).position);
      assert.ok(game.interact(), `${id}: ${deviceId}`);
    }
    assert.equal(mission.ready, true, `${id}: objectives complete`);
    if (id === 'core-of-the-matter') {
      // The second visit picks the other side.
      const [first, second] = run === 2 ? [FINAL_CHOICE.free, FINAL_CHOICE.destroy] : [FINAL_CHOICE.destroy, FINAL_CHOICE.free];
      game.spaceship.group.position.copy(relays.devices.find(value => value.id === first).position);
      assert.ok(game.interact(), `${id}: choose ${first}`);
      assert.equal(relays.chosenId, first);
      game.spaceship.group.position.copy(relays.devices.find(value => value.id === second).position);
      assert.equal(relays.tryActivate(game.spaceship.group.position.clone()), null, 'the other choice is locked');
    }
    game.spaceship.group.position.copy(mission.exitPosition); game.spaceship.velocity.set(0, 0, 0);
    steps(game, 0.2);
    assert.equal(game.session.phase, 'completed', `${id}: extracted`);
    if (id === 'core-of-the-matter') {
      assert.equal(game.nextMissionIndex(), -1, 'the campaign ends here');
      assert.equal(game.lastEnding?.choice, run === 2 ? 'free' : 'destroy');
      assert.ok(game.lastEnding.total >= 22, 'every campaign miner counts toward the ending');
    } else assert.equal(game.nextMissionIndex(), index + 1);
  }
});
