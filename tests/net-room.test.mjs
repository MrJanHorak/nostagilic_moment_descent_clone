import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import MatchRoom, { REMATCH_DELAY_MS } from '../src/js/net/MatchRoom.js';
import { MAX_LOOK_PER_INPUT, MIN_FIRE_INTERVAL_MS, isRoomCode, makeRoomCode, parseClientMessage, cleanName } from '../src/js/net/Protocol.js';

const input = (seq, extra = {}) => /** @type {any} */ (parseClientMessage(JSON.stringify({ t: 'input', seq, ...extra }))).message;

test('client messages are cleaned: unknown fields dropped, amounts and turns clamped, bad frames refused', () => {
  const hello = parseClientMessage(JSON.stringify({ t: 'hello', protocol: 1, name: '  <b>Vey</b>!!  ', room: 'abcd', admin: true }));
  assert.deepEqual(hello, { ok: true, message: { t: 'hello', protocol: 1, name: 'bVeyb', room: 'ABCD', mode: 'anarchy', map: null } });
  assert.equal(parseClientMessage(JSON.stringify({ t: 'hello', protocol: 99 })).error, 'protocol-mismatch');
  assert.equal(parseClientMessage(JSON.stringify({ t: 'hello', protocol: 1, room: 'IL01' })).error, 'bad-room-code');
  assert.equal(parseClientMessage('{nope').error, 'bad-json');
  assert.equal(parseClientMessage('x'.repeat(5000)).error, 'too-large');
  assert.equal(parseClientMessage(JSON.stringify({ t: 'teleport' })).error, 'unknown-type');
  const message = input(3, { input: { forward: true, left: 7, speedHack: 9, up: -1 }, look: [5, -5], fire: 'yes', weapon: 'nuke' });
  assert.deepEqual(message, { t: 'input', seq: 3, input: { forward: true, left: 1 }, look: [MAX_LOOK_PER_INPUT, -MAX_LOOK_PER_INPUT], fire: false, weapon: null, interact: false });
  assert.equal(parseClientMessage(JSON.stringify({ t: 'input', seq: -1 })).error, 'bad-seq');
  assert.equal(cleanName(''), 'Pilot'); assert.equal(cleanName('x'.repeat(40)).length, 16);
  for (let i = 0; i < 20; i++) assert.ok(isRoomCode(makeRoomCode()));
});

function room(t, options = {}) {
  t.mock.method(console, 'log', () => {});
  const value = new MatchRoom({ code: 'TEST', seed: 5, ...options });
  t.after(() => value.dispose());
  return value;
}

test('Anarchy bots join within capacity, pursue opponents and fire through the normal simulation', t => {
  const match = room(t), human = match.join('Ana');
  match.addBots(20);
  assert.equal(match.players.size, 8);
  assert.equal(match.bots.size, 7);
  const botId = [...match.bots][0];
  const bot = match.game.gameState.pilot(botId), target = match.game.gameState.pilot(human.id);
  for (const id of [...match.bots].slice(1)) match.leave(id);
  bot.ship.group.position.set(0, 0, 6); bot.ship.group.quaternion.identity();
  target.ship.group.position.set(0, 0, -6);
  match.takeEvents();
  for (let i = 0; i < 120; i++) match.step();
  assert.ok(match.events.some(event => event.t === 'shot' && event.owner === botId));
  assert.ok(target.health < 100 || !target.alive);
  assert.ok(match.snapshot(human.id).pilots.some(pilot => pilot.id === botId));
});

test('co-op rooms do not add Anarchy bots', t => {
  const match = room(t, { mode: 'coop' });
  match.join('Ana'); match.addBots(3);
  assert.equal(match.players.size, 1);
});
const steps = (match, count) => { for (let i = 0; i < count; i++) match.step(); };

test('a room runs Foundry Ring; joining pilots spawn apart and the host never plays', t => {
  const match = room(t), a = match.join('Ana'), b = match.join('Ben');
  assert.deepEqual([a.id, b.id], ['p1', 'p2']);
  assert.equal(match.game.levelManager.currentLevel.id, 'foundry-ring');
  assert.equal(match.game.gameState.localPilot.alive, false, 'the server\'s own ship sits out');
  steps(match, 3);
  const snapshot = match.snapshot('p1');
  assert.deepEqual(snapshot.pilots.map(pilot => pilot.id), ['p1', 'p2']);
  assert.deepEqual(snapshot.match.standings.map(entry => entry.id).sort(), ['p1', 'p2']);
  const [first, second] = snapshot.pilots.map(pilot => new THREE.Vector3(...pilot.p));
  assert.ok(first.distanceTo(second) > 20, 'the second pilot spawns away from the first');
  assert.equal(snapshot.ammo.pulse, 60); assert.ok(snapshot.pickups.length > 0);
});

test('inputs fly the pilot; stale sequence numbers are ignored and the turn is limited', t => {
  const match = room(t), { id } = match.join('Ana'), pilot = match.game.gameState.pilot(id);
  const start = pilot.ship.group.position.clone();
  assert.equal(match.input(id, input(1, { input: { forward: true }, look: [0.2, 0] })), true);
  steps(match, 60);
  assert.ok(pilot.ship.group.position.distanceTo(start) > 1, 'held thrust moves the ship');
  assert.equal(match.input(id, input(1, { input: {} })), false, 'a repeated sequence number does nothing');
  assert.equal(match.input(id, input(0, { input: {} })), false);
  assert.equal(match.snapshot(id).ack, 1, 'the snapshot tells the client which input was applied');
  const before = pilot.ship.group.quaternion.clone();
  match.input(id, input(2, { look: [99, 0] }));
  assert.ok(pilot.ship.group.quaternion.angleTo(before) <= MAX_LOOK_PER_INPUT + 1e-6);
});

/** p1 hovers in the atrium facing p2 and holds fire until p2 goes down. */
function duel(match) {
  const [a, b] = [match.game.gameState.pilot('p1'), match.game.gameState.pilot('p2')];
  a.ship.group.position.set(0, 0, 6); a.ship.group.quaternion.identity(); a.ship.velocity.set(0, 0, 0);
  b.ship.group.position.set(0, 0, -6); b.ship.velocity.set(0, 0, 0);
  match.takeEvents();
  for (let seq = 10; seq < 10 + 30 * 60 && b.alive; seq++) { match.input('p1', input(seq, { fire: true })); match.step(); }
  return { a, b, shots: match.events.filter(event => event.t === 'shot').length };
}

test('the server limits the fire rate, scores kills and reports them as events', t => {
  const match = room(t); match.join('Ana'); match.join('Ben');
  const startTime = match.game.session.timeMs, { b, shots } = duel(match);
  assert.equal(b.alive, false);
  const elapsed = match.game.session.timeMs - startTime;
  assert.ok(shots <= Math.floor(elapsed / MIN_FIRE_INTERVAL_MS) + 1, `${shots} shots in ${elapsed} ms: one every ${MIN_FIRE_INTERVAL_MS} ms at most`);
  assert.ok(match.events.some(event => event.t === 'kill' && event.victim === 'p2' && event.attacker === 'p1'));
  assert.equal(match.match.standing('p1').frags, 1);
  steps(match, 3.2 * 60);
  assert.ok(match.takeEvents().some(event => event.t === 'respawn' && event.id === 'p2'));
});

test('a won match ends, then restarts by itself with the same pilots', t => {
  const match = room(t, { rules: { fragLimit: 1 } }); match.join('Ana'); match.join('Ben');
  duel(match); match.step();
  assert.equal(match.game.session.phase, 'completed');
  assert.ok(match.takeEvents().some(event => event.t === 'match-over' && event.winner === 'p1'));
  assert.equal(match.snapshot('p1').match.winner, 'p1');
  steps(match, REMATCH_DELAY_MS / 1000 * 60 + 2);
  assert.equal(match.game.session.phase, 'playing');
  assert.ok(match.takeEvents().some(event => event.t === 'match-start'));
  assert.deepEqual(match.match.standings().map(entry => entry.frags), [0, 0]);
  assert.equal(match.game.anarchy.rules.fragLimit, 1, 'room rules carry into the rematch');
});

test('leaving removes the pilot and their score; the room fills at eight', t => {
  const match = room(t);
  const ids = Array.from({ length: 8 }, (_, i) => match.join(`P${i}`).id);
  assert.throws(() => match.join('late'), /room-full/);
  assert.equal(match.leave(ids[0]), true); assert.equal(match.leave(ids[0]), false);
  assert.equal(match.game.gameState.pilot(ids[0]), null);
  assert.ok(!match.match.standings().some(entry => entry.id === ids[0]));
  match.join('late');
});
