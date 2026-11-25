import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import MatchRoom, { DEFAULT_COOP_MAP } from '../src/js/net/MatchRoom.js';
import { parseClientMessage, MAX_COOP_PLAYERS } from '../src/js/net/Protocol.js';
import { startGameServer } from '../server/GameServer.mjs';

function room(t, options) {
  t.mock.method(console, 'log', () => {});
  const value = new MatchRoom({ code: 'TEST', random: () => 0.5, ...options });
  t.after(() => value.dispose());
  return value;
}
const run = (r, seconds) => { const events = []; for (let i = 0; i < Math.round(seconds * 60); i++) { r.step(); events.push(...r.takeEvents()); } return events; };

test('hello chooses a mode and map when creating a room; inputs carry the relay key', () => {
  const hello = parseClientMessage(JSON.stringify({ t: 'hello', protocol: 1, name: 'Ana', mode: 'coop', map: 'the-seal' }));
  assert.equal(hello.ok, true); assert.equal(hello.message.mode, 'coop'); assert.equal(hello.message.map, 'the-seal');
  const odd = parseClientMessage(JSON.stringify({ t: 'hello', protocol: 1, mode: 'raid', map: '../etc' }));
  assert.equal(odd.message.mode, 'anarchy'); assert.equal(odd.message.map, null);
  const input = parseClientMessage(JSON.stringify({ t: 'input', seq: 1, input: {}, interact: true }));
  assert.equal(input.message.interact, true);
});

test('a co-op room flies a mission: robots, lives and story in snapshots; four pilots at most', t => {
  const r = room(t, { mode: 'coop' });
  assert.equal(r.mapId, DEFAULT_COOP_MAP); assert.ok(r.coop, 'co-op rules run on the server');
  const ana = r.join('Ana'), ben = r.join('Ben');
  run(r, 0.2);
  const snap = r.snapshot(ana.id, []);
  assert.equal(snap.match, null, 'no Anarchy scores');
  assert.ok(snap.coop.enemies.length > 0, 'robots are in the snapshot');
  assert.ok(snap.coop.enemies.every(enemy => enemy.id && enemy.type && enemy.p.length === 3 && enemy.q.length === 4));
  assert.equal(snap.coop.lives, 4); assert.equal(snap.coop.toughness, 1.6);
  assert.equal(snap.coop.phase, 'playing');
  for (let i = 2; i < MAX_COOP_PLAYERS; i++) r.join(`P${i}`);
  assert.equal(r.full, true);
  assert.throws(() => r.join('Extra'), /room-full/);
  assert.throws(() => new MatchRoom({ code: 'X', mode: 'coop', mapId: 'foundry-ring' }), /No co-op mission/);
  void ben;
});

test('co-op room events: relay opened by a pilot, robot shots, downs, and a failed mission that restarts', t => {
  const r = room(t, { mode: 'coop', mapId: 'signal-breach' });
  const ana = r.join('Ana'), ben = r.join('Ben');
  run(r, 0.1);
  const game = r.game;
  const relay = game.levelManager.interaction.devices.find(device => device.kind !== 'reactor' && game.mission.canActivateDevice(device.id));
  game.gameState.pilot(ben.id).ship.group.position.copy(relay.position);
  assert.equal(r.input(ben.id, { seq: 1, input: {}, look: [0, 0], fire: false, weapon: null, interact: true }), true);
  const relayEvents = r.takeEvents().filter(event => event.t === 'relay');
  assert.deepEqual(relayEvents, [{ t: 'relay', id: relay.id, by: ben.id }]);
  assert.ok(r.snapshot(ana.id).coop.relays.includes(relay.id));
  assert.equal(r.snapshot(ana.id).coop.checkpoint, relay.label);

  // Wipe the team: both down with no lives left.
  game.coop.lives = 0;
  game.gameState.takeDamage(1000, game.gameState.pilot(ana.id));
  game.gameState.takeDamage(1000, game.gameState.pilot(ben.id));
  const events = run(r, 0.1);
  assert.ok(events.some(event => event.t === 'down' && event.id === ana.id));
  assert.ok(events.some(event => event.t === 'mission-over' && event.result === 'failed'));
  assert.equal(r.snapshot(ana.id).coop.phase, 'dead');
  const restart = run(r, 10.2);
  assert.ok(restart.some(event => event.t === 'match-start'), 'the mission restarts by itself');
  assert.equal(r.snapshot(ana.id).coop.lives, 4);
  assert.ok(game.gameState.pilot(ana.id).alive && game.gameState.pilot(ben.id).alive);
});

test('robot fire in a co-op room is announced to clients', t => {
  const r = room(t, { mode: 'coop', mapId: 'crossfire-relay' });
  const ana = r.join('Ana');
  const ship = r.game.gameState.pilot(ana.id).ship;
  let shots = [];
  // The fighters' sightline used by the multiplayer replay test.
  for (let i = 0; i < 60 * 10 && !shots.length; i++) {
    ship.group.position.set(-3, 0, -24); ship.velocity.set(0, 0, 0);
    r.step(); shots = r.takeEvents().filter(event => event.t === 'eshot');
  }
  assert.ok(shots.length, 'robot fire is announced');
  assert.equal(shots[0].p.length, 3); assert.equal(shots[0].v.length, 3);
  assert.ok(Math.hypot(...shots[0].v) > 1, 'with a real velocity');
});

test('the server creates co-op rooms on request and refuses unknown maps', async t => {
  t.mock.method(console, 'log', () => {});
  const server = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {} });
  t.after(() => server.close());
  const ask = hello => new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/play`);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ t: 'hello', protocol: 1, ...hello })));
    socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (['welcome', 'error'].includes(message.t)) { socket.close(); resolve(message); } });
    socket.addEventListener('error', reject);
  });
  const welcome = await ask({ name: 'Ana', mode: 'coop', map: 'the-seal' });
  assert.equal(welcome.t, 'welcome'); assert.equal(welcome.mode, 'coop'); assert.equal(welcome.map, 'the-seal'); assert.equal(welcome.rules, null);
  assert.deepEqual(await ask({ name: 'Ben', mode: 'coop', map: 'no-such-mine' }), { t: 'error', error: 'unknown-map' });
});

test('live co-op: a client game flies a mission online with puppet robots, shared relays, harmless pictures of robot fire, and the server\'s result', async t => {
  const { headlessGame } = await import('./helpers/headlessGame.mjs');
  const server = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {} });
  t.after(() => server.close());
  const game = headlessGame(t);
  const until = async (check, label, timeoutMs = 4000) => {
    const end = Date.now() + timeoutMs;
    while (!check()) { if (Date.now() > end) throw new Error(`timed out waiting for ${label}`); await new Promise(resolve => setTimeout(resolve, 10)); }
  };
  const match = await game.joinOnline({ url: `ws://127.0.0.1:${server.port}/play`, name: 'Ana', mode: 'coop', map: 'signal-breach' });
  assert.equal(match.mode, 'coop'); assert.ok(game.coop); assert.equal(game.enemyManager.remote, true);
  assert.equal(game.enemyManager.projectileManager.harmless, true);
  const loop = setInterval(() => { game.advanceFrame(1 / 60); game.online?.frame(); }, 1000 / 60);
  t.after(() => clearInterval(loop));
  const serverGame = server.rooms.get(match.room).room.game;

  // A second pilot joins with a raw socket.
  const ben = new WebSocket(`ws://127.0.0.1:${server.port}/play`), benInbox = [];
  ben.addEventListener('message', event => benInbox.push(JSON.parse(event.data)));
  await new Promise(resolve => ben.addEventListener('open', resolve));
  ben.send(JSON.stringify({ t: 'hello', protocol: 1, name: 'Ben', room: match.room }));
  t.after(() => ben.close());
  await until(() => game.gameState.pilot('p2'), 'Ben here');
  await until(() => match.coopState?.toughness === 1.6 && match.coopState?.lives === 4, 'team state');

  // Robots here follow the server's.
  await new Promise(resolve => setTimeout(resolve, 400));
  for (const robot of game.enemyManager.enemies) {
    const remote = serverGame.enemyManager.enemies.find(enemy => enemy.mesh.userData.spawnPointId === robot.mesh.userData.spawnPointId);
    assert.ok(remote, 'the same robots on both sides');
    assert.ok(robot.mesh.position.distanceTo(remote.mesh.position) < 2, 'posed near the server\'s robot');
  }

  // Ben opens a relay on the server; it opens here too.
  const relay = serverGame.levelManager.interaction.devices.find(device => device.kind !== 'reactor' && serverGame.mission.canActivateDevice(device.id));
  serverGame.gameState.pilot('p2').ship.group.position.copy(relay.position);
  ben.send(JSON.stringify({ t: 'input', seq: 1, input: {}, interact: true }));
  await until(() => game.levelManager.interaction.activatedIds.has(relay.id), 'relay opened here');
  assert.ok(game.mission.activatedDevices.has(relay.id));

  // A robot destroyed on the server is destroyed here, and counts for the mission.
  const target = serverGame.enemyManager.enemies[0], targetId = target.mesh.userData.spawnPointId;
  serverGame.enemyManager.hitEnemy(target, { power: 1e6, ownerId: 'p2' }, target.mesh.position.clone());
  await until(() => !game.enemyManager.enemies.some(enemy => enemy.mesh.userData.spawnPointId === targetId), 'robot gone here');
  assert.ok(game.enemyManager.destroyedPredefinedEnemies.has(targetId));

  // Robot fire drawn here never hurts this screen's ship.
  const health = game.gameState.playerHealth;
  const at = game.spaceship.group.position;
  for (let i = 0; i < 5; i++) game.enemyManager.projectileManager.spawnRemoteShot('standard', [at.x, at.y, at.z + 3], [0, 0, -20]);
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(game.gameState.playerHealth, health);

  // Our own shots here are pictures too: robots lose health only on the server.
  const robot = game.enemyManager.enemies[0];
  const before = robot.health;
  game.enemyManager.hitEnemy = () => { throw new Error('online clients must not damage robots locally'); };
  game.projectileManager.combatWorld.onTargetHit(robot, { power: 5 }, robot.mesh.position.clone());
  assert.equal(robot.health, before);

  // The server wipes the team: this screen shows the failure, then the mission restarts.
  serverGame.coop.lives = 0;
  for (const pilot of serverGame.gameState.pilots) if (!(pilot.local && serverGame.dedicated)) serverGame.gameState.takeDamage(1000, pilot);
  await until(() => game.session.phase === 'dead', 'failure shown here');
  await until(() => game.session.phase === 'playing' && match.coopState?.lives === 4, 'mission restarted', 14000);
  assert.ok(game.coop, 'still co-op after the restart');
});
