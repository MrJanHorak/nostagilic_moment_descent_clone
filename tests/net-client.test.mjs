import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import Spaceship from '../src/js/entities/Spaceship.js';
import { InputHistory, ServerClock, SnapshotInterpolator, reconcileShip, clampLook, MAX_PENDING } from '../src/js/net/ClientPrediction.js';
import OnlineMatch, { describeNetError } from '../src/js/net/OnlineMatch.js';
import { startGameServer } from '../server/GameServer.mjs';
import { headlessGame } from './helpers/headlessGame.mjs';
import { normalizeServerUrl, defaultServerUrl, parseInvite, inviteLink } from '../src/js/ui/OnlineLobby.js';

const packShip = ship => ({ p: ship.group.position.toArray(), q: ship.group.quaternion.toArray(), v: ship.velocity.toArray() });
const fly = (ship, steps) => { for (const step of steps) { ship.rotate(step.look[0], step.look[1]); ship.update(step.dt, step.input); ship.group.position.addScaledVector(ship.velocity, step.dt); } };

test('input history numbers inputs, clamps turns and drops what the server acknowledged', () => {
  const history = new InputHistory();
  const a = history.push({ forward: true }, [0.1, 2], 1 / 60), b = history.push({}, [0, 0], 1 / 60);
  history.push({ left: true }, [0, 0], 1 / 60);
  assert.deepEqual([a.seq, b.seq], [1, 2]);
  assert.equal(a.look[1], 0.6, 'turns are capped like the server caps them');
  assert.equal(clampLook(NaN), 0);
  assert.deepEqual(history.acknowledge(2).map(entry => entry.seq), [3]);
  assert.deepEqual(history.acknowledge(1).map(entry => entry.seq), [3], 'an older ack changes nothing');
  for (let i = 0; i < MAX_PENDING + 10; i++) history.push({}, [0, 0], 1 / 60);
  assert.equal(history.pending.length, MAX_PENDING);
});

test('reconciling replays unacknowledged inputs from the server state and keeps agreed aim', () => {
  const steps = Array.from({ length: 20 }, (_, i) => ({ seq: i + 1, input: { forward: true, ...(i % 3 ? {} : { yawLeft: true }) }, look: [0.01, -0.005], dt: 1 / 60 }));
  // The server applied the first 8 inputs; this screen has predicted all 20.
  const server = new Spaceship(); fly(server, steps.slice(0, 8));
  const local = new Spaceship(); fly(local, steps);
  const expected = local.group.position.clone();
  const result = reconcileShip(local, packShip(server), steps.slice(8));
  assert.ok(result.error < 1e-9, `prediction agrees with the server (${result.error})`);
  assert.ok(local.group.position.distanceTo(expected) < 1e-9);

  // A small disagreement is eased in, not snapped; a big one snaps.
  const drifted = new Spaceship(); fly(drifted, steps); drifted.group.position.x += 1;
  const eased = reconcileShip(drifted, packShip(server), steps.slice(8));
  assert.equal(eased.snapped, false);
  assert.ok(Math.abs(drifted.group.position.x - expected.x - 0.65) < 1e-6, 'a 1-unit error closes by 35%');
  const far = new Spaceship(); fly(far, steps); far.group.position.x += 10;
  assert.equal(reconcileShip(far, packShip(server), steps.slice(8)).snapped, true);
  assert.ok(far.group.position.distanceTo(expected) < 1e-9);

  // Mouse turn not yet sent is kept after the replay.
  const turning = new Spaceship(); fly(turning, steps); turning.rotate(0.2, 0);
  const aim = turning.group.quaternion.clone();
  reconcileShip(turning, packShip(server), steps.slice(8), { unsentLook: [0.2, 0] });
  assert.ok(turning.group.quaternion.angleTo(aim) < 1e-6);
});

test('the server clock tracks snapshot time and resets on a rematch', () => {
  const clock = new ServerClock();
  assert.equal(clock.now(5), 0);
  clock.sample(1000, 10000); assert.equal(clock.now(10050), 1050);
  clock.sample(1100, 10150); // 50 ms late: pulled gently
  assert.ok(clock.now(10150) > 1100 && clock.now(10150) < 1150, "between the old estimate and the late sample");
  clock.sample(0, 20000); assert.equal(clock.now(20000), 0, 'match clock restarted');
});

test('other ships are interpolated 100 ms behind, coast briefly, and never blend across a respawn', () => {
  const buffer = new SnapshotInterpolator(), out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const q = [0, 0, 0, 1];
  assert.equal(buffer.sample('p2', 0, out), null);
  buffer.push('p2', 1000, { p: [0, 0, 0], q, v: [10, 0, 0], alive: true });
  buffer.push('p2', 1050, { p: [1, 0, 0], q, v: [10, 0, 0], alive: true });
  buffer.push('p2', 1050, { p: [9, 9, 9], q, v: [0, 0, 0], alive: true }); // duplicate time ignored
  assert.equal(buffer.sample('p2', 1125, out).alive, true);
  assert.ok(Math.abs(out.position.x - 0.5) < 1e-9, 'halfway between the two snapshots');
  buffer.sample('p2', 1200, out); // 50 ms past the newest snapshot: coasts at 10 u/s
  assert.ok(Math.abs(out.position.x - 1.5) < 1e-9);
  buffer.sample('p2', 2000, out);
  assert.ok(Math.abs(out.position.x - 2.5) < 1e-9, 'coasting is capped at 150 ms');
  buffer.push('p2', 1100, { p: [1, 0, 0], q, v: [0, 0, 0], alive: false });
  buffer.push('p2', 1150, { p: [50, 0, 0], q, v: [0, 0, 0], alive: true });
  const respawn = buffer.sample('p2', 1225, out);
  assert.equal(respawn.alive, true); assert.equal(out.position.x, 50, 'respawned ships appear at the spawn, not sliding there');
});

test('lobby: server addresses, defaults and invite links', () => {
  assert.equal(normalizeServerUrl('localhost:8787'), 'ws://localhost:8787/play');
  assert.equal(normalizeServerUrl('game.example.com', { protocol: 'https:' }), 'wss://game.example.com/play');
  assert.equal(normalizeServerUrl('https://game.example.com'), 'wss://game.example.com/play');
  assert.equal(normalizeServerUrl('ws://10.0.0.5:9000/play'), 'ws://10.0.0.5:9000/play');
  assert.equal(normalizeServerUrl('  '), null);
  assert.equal(normalizeServerUrl('ws://'), null);
  assert.equal(defaultServerUrl({ hostname: 'localhost' }), 'ws://localhost:8787/play');
  assert.equal(defaultServerUrl({ hostname: 'descended.netlify.app', protocol: 'https:' }), '', 'no guess for a hosted site');
  assert.equal(defaultServerUrl({ hostname: 'descended.netlify.app', protocol: 'https:' }, 'play.example.com'), 'wss://play.example.com/play');
  assert.equal(defaultServerUrl({ hostname: 'localhost' }, undefined, 'ws://saved:1/play'), 'ws://saved:1/play');
  assert.deepEqual(parseInvite('?room=abcd&server=ws%3A%2F%2Fx%3A1%2Fplay'), { room: 'ABCD', server: 'ws://x:1/play' });
  assert.deepEqual(parseInvite('?room=ABIO'), { room: null, server: null }, 'I and O are never in codes');
  const link = inviteLink('https://descended.netlify.app/?x=1#top', 'QRST', 'wss://play.example.com/play');
  assert.deepEqual(parseInvite(new URL(link).search), { room: 'QRST', server: 'wss://play.example.com/play' });
});

test('server errors are explained to the player', () => {
  assert.match(describeNetError('room-not-found'), /No room/);
  assert.match(describeNetError('weird'), /weird/);
});

/** A raw second player for the integration test. */
async function rawPlayer(port, room, name) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/play`), inbox = [];
  socket.addEventListener('message', event => inbox.push(JSON.parse(event.data)));
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  socket.send(JSON.stringify({ t: 'hello', protocol: 1, name, room }));
  return { socket, inbox, send: message => socket.send(JSON.stringify(message)) };
}
const until = async (check, timeoutMs = 4000, label = 'condition') => {
  const end = Date.now() + timeoutMs;
  while (!check()) { if (Date.now() > end) throw new Error(`timed out waiting for ${label}`); await new Promise(resolve => setTimeout(resolve, 10)); }
};

test('a browser-side game joins the server, predicts its ship, sees another pilot interpolated and draws their shots', async t => {
  const server = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {} });
  t.after(() => server.close());
  const game = headlessGame(t);
  const url = `ws://127.0.0.1:${server.port}/play`;

  await assert.rejects(game.joinOnline({ url, name: 'Ana', room: 'ZZZZ' }), /No room with that code/);
  assert.equal(game.online, null);

  const match = await game.joinOnline({ url, name: 'Ana' });
  assert.equal(game.online, match);
  assert.equal(game.gameState.localPilot.id, 'p1');
  assert.ok(game.anarchy, 'the arena is running here');
  assert.equal(game.session.phase, 'playing');
  assert.equal(game.powerUpManager.remoteTaken instanceof Set, true, 'pickups are the server\'s');

  // The client loop: 60 steps a second, interpolation every frame.
  const loop = setInterval(() => { game.advanceFrame(1 / 60); game.online?.frame(); }, 1000 / 60);
  t.after(() => clearInterval(loop));
  await until(() => match.stats.reconciles > 3, 4000, 'first reconciles');

  const ben = await rawPlayer(server.port, match.room, 'Ben');
  await until(() => game.gameState.pilot('p2'), 3000, 'Ben in the roster');
  const benPilot = game.gameState.pilot('p2');
  assert.equal(match.nameOf('p2'), 'Ben');
  assert.equal(benPilot.ship.model.visible, true, 'other ships are drawn');
  assert.equal(game.anarchy.names.get('p2'), 'Ben');

  // Fly forward for a second: the predicted ship moves and the server agrees.
  const start = game.spaceship.group.position.clone();
  game.inputManager.keyStates.KeyW = true;
  await new Promise(resolve => setTimeout(resolve, 1000));
  game.inputManager.keyStates.KeyW = false;
  const moved = game.spaceship.group.position.distanceTo(start);
  assert.ok(moved > 1, `the local ship flew ${moved.toFixed(2)}`);
  await new Promise(resolve => setTimeout(resolve, 400));
  const mine = match.lastSnapshot.pilots.find(pilot => pilot.id === 'p1');
  const gap = game.spaceship.group.position.distanceTo(new THREE.Vector3().fromArray(mine.p));
  assert.ok(gap < 1, `prediction and the server agree once settled (${gap.toFixed(3)})`);
  assert.ok(match.stats.snaps <= 1, `no repeated snapping (${match.stats.snaps})`);

  // Ben drifts forward and fires; this game draws him and his shots.
  for (let seq = 1; seq <= 40; seq++) { ben.send({ t: 'input', seq, input: { forward: true }, look: [0, 0], fire: seq === 20 }); await new Promise(resolve => setTimeout(resolve, 16)); }
  await until(() => game.projectileManager.getProjectiles().some(shot => shot.ownerId === 'p2'), 3000, 'Ben\'s shot drawn here');
  await new Promise(resolve => setTimeout(resolve, 300));
  const benServer = ben.inbox.filter(message => message.t === 'snapshot').at(-1).pilots.find(pilot => pilot.id === 'p2');
  const benGap = benPilot.ship.group.position.distanceTo(new THREE.Vector3().fromArray(benServer.p));
  assert.ok(benGap < 1.5, `Ben is drawn near where the server has him (${benGap.toFixed(3)})`);

  // Leaving the room returns to single player.
  ben.socket.close();
  await until(() => !game.gameState.pilot('p2'), 3000, 'Ben removed');
  game.showMainMenu = game.showMainMenu.bind(game);
  assert.equal(game.leaveOnline(), true);
  assert.equal(game.online, null); assert.equal(game.gameState.localPilot.id, 'local');
  await until(() => server.rooms.values().next().value?.sockets.size === 0, 3000, 'the server to see us leave');
});
