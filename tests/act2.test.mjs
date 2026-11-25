import test from 'node:test';
import assert from 'node:assert/strict';
import createCampaign, { campaignDocuments } from '../src/js/core/levels/Campaign.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';
import { headlessGame } from './helpers/headlessGame.mjs';

const ACT2 = ['witness', 'fabricator', 'moving-day'];
const steps = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) game.updateSimulation(1 / 60); };

test('Act 2 missions 06–08 follow The Seal in the campaign, with story, generators and heavy robots', () => {
  const campaign = createCampaign();
  assert.deepEqual(campaign.slice(5).map(level => [level.campaignOrder, level.id]), [[6, 'witness'], [7, 'fabricator'], [8, 'moving-day']]);
  for (const id of ACT2) {
    const document = campaignDocuments.find(value => value.id === id), level = campaign.find(value => value.id === id);
    assert.equal(validateLevelDocument(document).valid, true, id);
    assert.equal(document.formatVersion, 16);
    assert.ok(level.generators.length >= 2, `${id} has fabricators`);
    assert.ok(level.enemySpawns.filter(enemy => enemy.enemyType === 'destroyer').length >= 1, `${id} has a destroyer`);
    assert.ok(level.story.messages.length >= 7 && level.story.logs.length >= 2 && level.story.survivors.length >= 1, `${id} story`);
    assert.ok(document.connections.length - document.rooms.length + 1 >= 2, `${id} has loops`);
    assert.ok(level.briefing.length > 200);
    for (const message of level.story.messages) assert.ok(message.text.length <= 280, `${message.id} fits the radio`);
  }
  assert.ok(campaign.find(level => level.id === 'moving-day').mission.linkedRelays.length === 1, 'Moving Day hands the core over with a linked pair');
});

test('each Act 2 mission plays through in the simulation: fabricators wake, objectives complete, the team gets out', t => {
  const game = headlessGame(t);
  for (const id of ACT2) {
    const index = game.levelManager.levels.findIndex(level => level.id === id);
    assert.ok(game.startSession({ endless: false, levelIndex: index, seed: 6, coop: false }), id);
    const relays = game.levelManager.interaction, mission = game.mission;
    steps(game, 0.05);
    for (const robot of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(robot, { power: 1e6 }, robot.mesh.position.clone());
    // Visit a fabricator's room: it wakes.
    const fabricator = game.levelManager.currentLevel.generators[0];
    game.spaceship.group.position.copy(fabricator.position);
    steps(game, 0.1);
    assert.ok(game.enemyManager.generators.generators[0].awake, `${id}: fabricator woke`);
    for (const robot of [...game.enemyManager.enemies]) game.enemyManager.hitEnemy(robot, { power: 1e6 }, robot.mesh.position.clone());
    for (const pair of mission.definition.linkedRelays ?? []) for (const deviceId of pair.ids) {
      game.spaceship.group.position.copy(relays.devices.find(device => device.id === deviceId).position); game.interact();
    }
    for (const deviceId of mission.definition.requiredDeviceIds) {
      if (relays.activatedIds.has(deviceId)) continue;
      const device = relays.devices.find(value => value.id === deviceId);
      if (device.kind === 'reactor') {
        const reactor = relays.reactors.find(value => value.device.id === deviceId);
        const result = relays.hitReactor(reactor.collider, 10000, value => mission.canActivateDevice(value));
        assert.ok(result?.destroyed, `${id}: ${deviceId} ruptures once everything else is done`);
        game.completeDeviceObjective(result);
        continue;
      }
      game.spaceship.group.position.copy(device.position);
      assert.ok(game.interact(), `${id}: ${deviceId}`);
    }
    assert.equal(mission.ready, true, `${id}: objectives complete`);
    game.spaceship.group.position.copy(mission.exitPosition); game.spaceship.velocity.set(0, 0, 0);
    steps(game, 0.2);
    assert.equal(game.session.phase, 'completed', `${id}: extracted`);
    assert.equal(game.nextMissionIndex(), id === 'moving-day' ? -1 : index + 1, `${id}: next mission`);
  }
});
