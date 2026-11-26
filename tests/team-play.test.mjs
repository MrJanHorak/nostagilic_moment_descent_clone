import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import CoopMatch, { COOP_RULES, PER_PILOT_PICKUPS } from '../src/js/core/CoopMatch.js';
import { QUICK_CHAT, SignalLimiter, aimPoint, cleanSignal, MARK_RANGE } from '../src/js/core/TeamSignals.js';
import { parseClientMessage } from '../src/js/net/Protocol.js';
import MatchRoom from '../src/js/net/MatchRoom.js';
import { startGameServer } from '../server/GameServer.mjs';
import { headlessGame } from './helpers/headlessGame.mjs';

const indexOf = (game, id) => game.levelManager.levels.findIndex(level => level.id === id);
const steps = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) game.updateSimulation(1 / 60); };

test('signals: fixed phrases, cleaned pings, aim points that stop at walls, and a rate limit', () => {
  assert.equal(QUICK_CHAT.length, 8);
  assert.deepEqual(cleanSignal({ kind: 'quick', phrase: 2, text: 'free text is dropped' }), { kind: 'quick', phrase: 2 });
  assert.equal(cleanSignal({ kind: 'quick', phrase: 8 }), null);
  assert.equal(cleanSignal({ kind: 'quick', phrase: 1.5 }), null);
  assert.deepEqual(cleanSignal({ kind: 'mark', p: [1.234, 2, 3] }), { kind: 'mark', p: [1.23, 2, 3] });
  assert.equal(cleanSignal({ kind: 'mark', p: [1, NaN, 3] }), null);
  assert.equal(cleanSignal({ kind: 'mark', p: [1, 2] }), null);
  assert.equal(parseClientMessage(JSON.stringify({ t: 'signal', kind: 'quick', phrase: 0 })).message.signal.phrase, 0);
  assert.equal(parseClientMessage(JSON.stringify({ t: 'signal', kind: 'shout' })).error, 'bad-signal');

  const wall = new THREE.Box3(new THREE.Vector3(-5, -5, -12), new THREE.Vector3(5, 5, -10));
  const hit = aimPoint(new THREE.Vector3(), new THREE.Quaternion(), [wall]);
  assert.ok(hit[2] > -10 && hit[2] < -9, `stops just short of the wall (${hit[2]})`);
  assert.deepEqual(aimPoint(new THREE.Vector3(), new THREE.Quaternion(), []).map(Math.round), [0, 0, -MARK_RANGE]);

  const limiter = new SignalLimiter(750);
  assert.equal(limiter.allow('a', 0), true); assert.equal(limiter.allow('a', 500), false);
  assert.equal(limiter.allow('b', 500), true); assert.equal(limiter.allow('a', 750), true);
});

test('revives: a teammate by the wreck for 3 s brings a pilot back and refunds a queued respawn', () => {
  const coop = new CoopMatch(new THREE.Vector3());
  coop.join('a'); coop.join('b');
  const wreck = new THREE.Vector3(10, 0, 0);
  assert.equal(coop.recordDown('a', 0, wreck), true); assert.equal(coop.lives, 3);
  const team = [{ id: 'a', alive: false, position: wreck }, { id: 'b', alive: true, position: new THREE.Vector3(30, 0, 0) }];
  assert.deepEqual(coop.updateRevives(team, 1000), [], 'nobody near');
  team[1].position = new THREE.Vector3(12, 0, 0);
  coop.updateRevives(team, 2000);
  team[1].position = new THREE.Vector3(30, 0, 0);
  coop.updateRevives(team, 1000);
  assert.equal(coop.wrecks.get('a').progressMs, 1500, 'progress drains at half speed away from the wreck');
  team[1].position = new THREE.Vector3(12, 0, 0);
  const revived = coop.updateRevives(team, COOP_RULES.reviveMs);
  assert.deepEqual(revived.map(entry => [entry.id, entry.by]), [['a', 'b']]);
  assert.equal(coop.lives, 4, 'the queued respawn is cancelled and its life refunded');
  assert.equal(coop.respawns.has('a'), false); assert.equal(coop.wrecks.size, 0);
  // With no lives left, a revive is the only way back.
  coop.lives = 0; coop.recordDown('a', 5000, wreck);
  assert.equal(coop.respawns.has('a'), false); assert.ok(coop.wrecks.has('a'));
  assert.equal(coop.checkWipe([{ id: 'a', alive: false }, { id: 'b', alive: true }]), false);
});

test('in a co-op mission: revive at the wreck, per-pilot ammunition, quick-chat keys and pings', t => {
  const game = headlessGame(t);
  game.startSession({ endless: false, levelIndex: indexOf(game, 'signal-breach'), seed: 8, coop: true });
  const wing = game.addPilot('p2');
  assert.equal(game.powerUpManager.perPilot, PER_PILOT_PICKUPS);

  // Wingmate down with no lives: the local ship hovers by the wreck and revives them.
  game.coop.lives = 0;
  const fallen = wing.ship.group.position.clone();
  game.gameState.takeDamage(1000, wing);
  assert.equal(wing.alive, false); assert.equal(game.session.phase, 'playing');
  game.spaceship.group.position.copy(fallen).add(new THREE.Vector3(1, 0, 0));
  steps(game, COOP_RULES.reviveMs / 1000 + 0.1);
  assert.equal(wing.alive, true, 'revived'); assert.equal(wing.health, COOP_RULES.reviveHealth);
  assert.ok(wing.ship.group.position.distanceTo(fallen) < 1e-6, 'back where they fell');

  // An ammunition pickup: each pilot gets their own share; repairs are first come.
  game.gameState.weaponInventory.pulse.ammo = 0; wing.weaponInventory.pulse.ammo = 0;
  const spot = game.spaceship.group.position.clone().add(new THREE.Vector3(0, 0, -0.2));
  const ammo = game.powerUpManager.spawnPowerup(spot, 'pulseAmmo', { persistent: true, spawnId: 'test-ammo' });
  wing.ship.group.position.copy(spot); wing.ship.velocity.set(0, 0, 0); wing.input = {};
  game.spaceship.velocity.set(0, 0, 0);
  steps(game, 0.05);
  assert.ok(game.gameState.weaponInventory.pulse.ammo > 0 && wing.weaponInventory.pulse.ammo > 0, 'both pilots took ammunition');
  assert.ok(game.powerUpManager.powerups.includes(ammo), 'the pickup stays in the world');
  assert.equal(ammo.mesh.visible, false, 'but is hidden on this screen once taken here');
  assert.deepEqual(game.powerUpManager.takenIds('p2'), ['test-ammo']);
  const before = game.gameState.weaponInventory.pulse.ammo;
  steps(game, 0.05);
  assert.equal(game.gameState.weaponInventory.pulse.ammo, before, 'one share each');
  wing.health = 50;
  const repair = game.powerUpManager.spawnPowerup(spot, 'health', { persistent: true, spawnId: 'test-repair' });
  steps(game, 0.05);
  assert.equal(game.powerUpManager.powerups.includes(repair), false, 'repairs go to whoever reaches them first');

  // Quick-chat: T opens the strip and a number key sends the phrase instead of switching weapons.
  const shown = [];
  game.uiManager.showMessage = text => shown.push(text);
  game.uiManager.showQuickChat = () => shown.push('strip');
  game.uiManager.hideQuickChat = () => {};
  game.inputManager.onKeyDown({ code: 'KeyT' });
  assert.equal(game.quickChatOpen, true);
  const weapon = game.gameState.currentWeapon;
  game.inputManager.onKeyDown({ code: 'Digit3' });
  assert.equal(game.quickChatOpen, false);
  assert.equal(game.gameState.currentWeapon, weapon);
  assert.ok(shown.includes(`You: ${QUICK_CHAT[2]}`));
  // A ping drops a marker where the ship aims (after the rate limit).
  steps(game, 1);
  game.inputManager.onKeyDown({ code: 'KeyG' });
  assert.ok(game.teamMarkers.markers.has('mark:p1') || game.teamMarkers.markers.has(`mark:${game.gameState.localPilot.id}`), 'ping marker placed');
  game.updateTeamMarkers();
  game.teamMarkers.update(game.wallClock() + 9000);
  assert.equal([...game.teamMarkers.markers.keys()].filter(key => key.startsWith('mark:')).length, 0, 'pings fade after 8 s');
});

test('the server relays signals to the whole room, rate-limited, and lists wrecks for revives', async t => {
  t.mock.method(console, 'log', () => {});
  const room = new MatchRoom({ code: 'TEST', mode: 'coop', mapId: 'signal-breach', random: () => 0.5 });
  t.after(() => room.dispose());
  const ana = room.join('Ana'), ben = room.join('Ben');
  assert.deepEqual(room.signal(ana.id, { kind: 'quick', phrase: 0 }), { t: 'signal', from: ana.id, kind: 'quick', phrase: 0 });
  assert.equal(room.signal(ana.id, { kind: 'quick', phrase: 1 }), null, 'too fast');
  assert.ok(room.signal(ben.id, { kind: 'mark', p: [1, 2, 3] }));
  room.game.gameState.takeDamage(1000, room.game.gameState.pilot(ben.id));
  room.step();
  assert.equal(room.snapshot(ana.id).coop.wrecks[0].id, ben.id);

  const server = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {} });
  t.after(() => server.close());
  const open = async (hello) => {
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/play`), inbox = [];
    socket.addEventListener('message', event => inbox.push(JSON.parse(event.data)));
    await new Promise(resolve => socket.addEventListener('open', resolve));
    socket.send(JSON.stringify({ t: 'hello', protocol: 1, ...hello }));
    return { socket, inbox };
  };
  const a = await open({ name: 'Ana', mode: 'coop', map: 'signal-breach' });
  const until = async check => { const end = Date.now() + 3000; while (!check()) { if (Date.now() > end) throw new Error('timeout'); await new Promise(resolve => setTimeout(resolve, 10)); } };
  await until(() => a.inbox.some(message => message.t === 'welcome'));
  const b = await open({ name: 'Ben', room: a.inbox.find(message => message.t === 'welcome').room });
  await until(() => b.inbox.some(message => message.t === 'welcome'));
  a.socket.send(JSON.stringify({ t: 'signal', kind: 'quick', phrase: 6 }));
  await until(() => b.inbox.some(message => message.t === 'signal'));
  assert.deepEqual(b.inbox.find(message => message.t === 'signal'), { t: 'signal', from: 'p1', kind: 'quick', phrase: 6 });
  await until(() => a.inbox.some(message => message.t === 'signal'));
  a.socket.close(); b.socket.close();
});

test('controller: L3 opens quick-chat, the D-pad and face buttons send phrases, R3 pings', t => {
  const game = headlessGame(t);
  game.startSession({ endless: false, levelIndex: indexOf(game, 'signal-breach'), seed: 9, coop: true });
  const shown = [];
  game.uiManager.showMessage = text => shown.push(text);
  game.uiManager.showQuickChat = () => {}; game.uiManager.hideQuickChat = () => {};
  const pad = pressed => ({ id: 'Test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });
  let now = 0;
  const press = index => { game.inputManager.pollGamepad(() => [pad([index])], now += 100); game.inputManager.pollGamepad(() => [pad([])], now += 100); };
  game.inputManager.pollGamepad(() => [pad([])], now);
  press(10);
  assert.equal(game.quickChatOpen, true, 'L3 opens the strip');
  press(15);
  assert.equal(game.quickChatOpen, false);
  assert.ok(shown.includes(`You: ${QUICK_CHAT[1]}`), 'D-pad → sends phrase 2');
  steps(game, 1);
  press(11);
  assert.equal([...game.teamMarkers.markers.keys()].filter(key => key.startsWith('mark:')).length, 1, 'R3 pings');
});
