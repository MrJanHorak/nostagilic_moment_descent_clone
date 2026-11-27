import test from 'node:test';
import assert from 'node:assert/strict';
import { startGameServer } from '../server/GameServer.mjs';
import { connect as connectTcp } from 'node:net';
import { parseFrame, frame } from '../server/WebSocket.mjs';

/** A test client on Node's built-in WebSocket that queues every message. */
async function connect(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/play`), inbox = [], waiters = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data); inbox.push(message);
    for (const waiter of [...waiters]) if (waiter.match(message)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(message); }
  });
  const closed = new Promise(resolve => socket.addEventListener('close', event => resolve(event.code)));
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  return {
    socket, inbox, closed,
    send: message => socket.send(JSON.stringify(message)),
    next(match, timeoutMs = 3000) {
      const found = inbox.find(match); if (found) { inbox.splice(inbox.indexOf(found), 1); return Promise.resolve(found); }
      return new Promise((resolve, reject) => {
        const waiter = { match, resolve: message => { clearTimeout(timer); inbox.splice(inbox.indexOf(message), 1); resolve(message); } };
        const timer = setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); reject(new Error('timed out waiting for a message')); }, timeoutMs);
        waiters.push(waiter);
      });
    },
  };
}

async function server(t, options = {}) {
  t.mock.method(console, 'log', () => {});
  const value = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {}, ...options });
  t.after(() => value.close());
  return value;
}
const type = name => message => message.t === name;

test('frames: masked client frames decode, server frames encode, unmasked and oversized frames are refused', () => {
  const payload = Buffer.from('hello'), mask = Buffer.from([1, 2, 3, 4]);
  const masked = Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, Buffer.from(payload.map((byte, i) => byte ^ mask[i & 3]))]);
  const parsed = parseFrame(masked, 100);
  assert.equal(parsed.payload.toString(), 'hello'); assert.equal(parsed.length, masked.length); assert.equal(parsed.opcode, 1);
  assert.equal(parseFrame(masked.subarray(0, 5), 100), null, 'incomplete');
  assert.equal(parseFrame(frame(1, payload), 100).error, 1002, 'clients must mask');
  assert.equal(parseFrame(Buffer.from([0x81, 0xfe, 0x10, 0x00]), 100).error, 1009);
  assert.deepEqual([...frame(1, Buffer.alloc(300)).subarray(0, 4)], [0x81, 126, 1, 44]);
});

test('two players create and join a room, fly, see each other, and leaving updates the roster', async t => {
  const { port } = await server(t);
  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.ok, true); assert.equal(health.rooms, 0);

  const ana = await connect(port);
  ana.send({ t: 'hello', protocol: 1, name: 'Ana' });
  const welcome = await ana.next(type('welcome'));
  assert.match(welcome.room, /^[A-Z]{4}$/); assert.equal(welcome.id, 'p1'); assert.equal(welcome.map, 'foundry-ring');
  assert.equal(welcome.tickRate, 60); assert.equal(welcome.rules.fragLimit, 10);

  const ben = await connect(port);
  ben.send({ t: 'hello', protocol: 1, name: 'Ben', room: welcome.room.toLowerCase() });
  assert.equal((await ben.next(type('welcome'))).id, 'p2');
  const roster = await ana.next(message => message.t === 'roster' && message.players.length === 2);
  assert.deepEqual(roster.players, [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Ben' }]);

  const first = await ana.next(message => message.t === 'snapshot' && message.pilots.length === 2);
  const start = first.pilots.find(pilot => pilot.id === 'p1').p;
  for (let seq = 1; seq <= 30; seq++) ana.send({ t: 'input', seq, input: { forward: true } });
  const moved = await ana.next(message => message.t === 'snapshot' && message.ack === 30 && Math.hypot(...message.pilots.find(pilot => pilot.id === 'p1').p.map((value, i) => value - start[i])) > 0.5, 4000);
  assert.ok(moved.tick > first.tick);
  const seen = await ben.next(message => message.t === 'snapshot' && message.tick >= moved.tick);
  assert.deepEqual(seen.pilots.map(pilot => pilot.name), ['Ana', 'Ben'], 'both players get the same ships');

  // Snapshots come about 20 times a second.
  ana.inbox.length = 0;
  await new Promise(resolve => setTimeout(resolve, 1000));
  const count = ana.inbox.filter(type('snapshot')).length;
  assert.ok(count >= 12 && count <= 26, `${count} snapshots in one second`);

  ana.send({ t: 'ping', time: 42 });
  assert.equal((await ana.next(type('pong'))).time, 42);

  ben.socket.close();
  await ana.next(message => message.t === 'roster' && message.players.length === 1);
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/health`)).json()).players, 1);
});

test('bad hellos are refused with a reason: unknown room, wrong protocol, garbage', async t => {
  const { port } = await server(t);
  const lost = await connect(port);
  lost.send({ t: 'hello', protocol: 1, name: 'X', room: 'ZZZZ' });
  assert.equal((await lost.next(type('error'))).error, 'room-not-found'); assert.equal(await lost.closed, 4000);
  const old = await connect(port);
  old.send({ t: 'hello', protocol: 0 });
  assert.equal((await old.next(type('error'))).error, 'protocol-mismatch');
  const noise = await connect(port);
  noise.socket.send('not json');
  assert.equal((await noise.next(type('error'))).error, 'bad-json');
});

test('waiting room freezes the clock, restricts start to the host and transfers host on departure', async t => {
  const { port, rooms } = await server(t);
  const host = await connect(port);
  host.send({ t: 'hello', protocol: 1, name: 'Host', lobby: true });
  const welcome = await host.next(type('welcome'));
  assert.equal(welcome.waiting, true); assert.equal(welcome.host, welcome.id);
  const guest = await connect(port);
  guest.send({ t: 'hello', protocol: 1, name: 'Guest', room: welcome.room, lobby: true });
  const joined = await guest.next(type('welcome'));
  await host.next(message => message.t === 'roster' && message.players.length === 2);
  guest.send({ t: 'start', bots: 2, botDifficulty: 'hard' });
  await new Promise(resolve => setTimeout(resolve, 150));
  const entry = rooms.get(welcome.room);
  assert.equal(entry.waiting, true); assert.equal(entry.room.tick, 0); assert.equal(entry.room.game.session.timeMs, 0);
  host.socket.close();
  const roster = await guest.next(message => message.t === 'roster' && message.host === joined.id);
  assert.equal(roster.players.length, 1);
  guest.send({ t: 'start', bots: 2, botDifficulty: 'hard' });
  await guest.next(type('started'));
  const snapshot = await guest.next(type('snapshot'));
  assert.ok(snapshot.timeMs > 0); assert.equal(entry.waiting, false);
  assert.equal(entry.room.botDifficulty, 'hard');
  assert.equal(entry.room.bots.size, 2);
  assert.equal(snapshot.pilots.length, 3);
});

test('a room refuses a ninth player and other origins can be blocked', async t => {
  const { port } = await server(t);
  const host = await connect(port); host.send({ t: 'hello', protocol: 1, name: 'Host' });
  const { room } = await host.next(type('welcome'));
  for (let i = 0; i < 7; i++) { const guest = await connect(port); guest.send({ t: 'hello', protocol: 1, name: `G${i}`, room }); await guest.next(type('welcome')); }
  const late = await connect(port); late.send({ t: 'hello', protocol: 1, name: 'Late', room });
  assert.equal((await late.next(type('error'))).error, 'room-full');

  const strict = await server(t, { allowOrigins: ['https://descended.example'] });
  const upgrade = origin => new Promise(resolve => {
    const socket = connectTcp(strict.port, '127.0.0.1', () => socket.write(`GET /play HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nOrigin: ${origin}\r\n\r\n`));
    socket.once('data', data => { resolve(data.toString().split('\r\n')[0]); socket.destroy(); });
  });
  assert.match(await upgrade('https://evil.example'), /403/);
  assert.match(await upgrade('https://descended.example'), /101/);
});
