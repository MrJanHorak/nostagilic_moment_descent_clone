// DESCENDED online game server: rooms with four-letter codes, each running one
// authoritative Anarchy match (MatchRoom) at 60 steps per second, with snapshots
// to every player 20 times per second.
import { createServer } from 'node:http';
import { acceptWebSocket } from './WebSocket.mjs';
import { createHttpApi } from './HttpApi.mjs';
import { campaignDocuments } from '../src/js/core/levels/Campaign.js';
import { teamDocuments } from '../src/js/core/levels/TeamMissions.js';
import MatchRoom from '../src/js/net/MatchRoom.js';
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION, SNAPSHOT_EVERY, TICK_RATE, makeRoomCode, parseClientMessage } from '../src/js/net/Protocol.js';

const HELLO_TIMEOUT_MS = 5000;
/** An empty room is kept this long so a dropped player can come back to it. */
const EMPTY_ROOM_MS = 30000;
/** Most simulation steps run to catch up after a stall; the rest are skipped. */
const MAX_CATCH_UP = 10;

/**
 * @param {{port?: number, host?: string, log?: (line: string) => void, rules?: object, allowOrigins?: string[] | null, dataDir?: string | null, adminToken?: string | null}} [options]
 * @returns {Promise<{port: number, rooms: Map<string, any>, close: () => Promise<void>}>}
 */
export async function startGameServer({ port = 8787, host = '0.0.0.0', log = line => console.log(line), rules = {}, allowOrigins = null, dataDir = null, adminToken = null } = {}) {
  /** code -> { room, sockets: Map<pilotId, connection>, emptySince } */
  const rooms = new Map();
  let players = 0;

  // Leaderboards and shared levels (Phase 5), stored in dataDir when given.
  const api = await createHttpApi({ dataDir, allowOrigins, adminToken, missionIds: [...campaignDocuments, ...teamDocuments].map(document => document.id) });
  const http = createServer(async (request, response) => {
    if (await api.handle(request, response)) return;
    if (request.url === '/health' || request.url === '/') {
      response.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      response.end(JSON.stringify({ ok: true, game: 'descended', protocol: PROTOCOL_VERSION, rooms: rooms.size, players }));
      return;
    }
    response.writeHead(404).end();
  });

  http.on('upgrade', (request, socket) => {
    if (!request.url?.startsWith('/play')) { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return; }
    const origin = request.headers.origin;
    if (allowOrigins && origin && !allowOrigins.includes(origin)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    const connection = acceptWebSocket(request, socket, { maxMessageBytes: MAX_MESSAGE_BYTES });
    if (connection) welcome(connection);
  });

  const send = (connection, message) => connection.send(JSON.stringify(message));
  const fail = (connection, error) => { send(connection, { t: 'error', error }); connection.close(4000, error); };

  /** @param {'anarchy' | 'coop'} mode @param {string | null} map */
  function newRoom(mode = 'anarchy', map = null) {
    let code;
    do code = makeRoomCode(); while (rooms.has(code));
    const entry = { room: new MatchRoom({ code, rules, mode, mapId: map }), sockets: new Map(), emptySince: Date.now() };
    rooms.set(code, entry);
    log(`room ${code} opened`);
    return entry;
  }

  function roster(entry) {
    const message = { t: 'roster', players: [...entry.room.players.values()].map(({ id, name }) => ({ id, name })) };
    for (const connection of entry.sockets.values()) send(connection, message);
  }

  function welcome(connection) {
    let pilotId = null, entry = null;
    const timer = setTimeout(() => { if (!pilotId) fail(connection, 'hello-timeout'); }, HELLO_TIMEOUT_MS);
    connection.on('message', text => {
      const parsed = parseClientMessage(text);
      if (!parsed.ok) { if (!pilotId) fail(connection, parsed.error); else send(connection, { t: 'error', error: parsed.error }); return; }
      const message = parsed.message;
      if (message.t === 'ping') { send(connection, { t: 'pong', time: message.time, tick: entry?.room.tick ?? 0 }); return; }
      if (message.t === 'hello') {
        if (pilotId) return;
        try { entry = message.room ? rooms.get(message.room) : newRoom(message.mode, message.map); } catch { fail(connection, 'unknown-map'); return; }
        if (!entry) { fail(connection, 'room-not-found'); return; }
        if (entry.room.full) { fail(connection, 'room-full'); return; }
        clearTimeout(timer);
        const player = entry.room.join(message.name);
        pilotId = player.id; players++;
        entry.sockets.set(pilotId, connection); entry.emptySince = null;
        send(connection, { t: 'welcome', id: pilotId, name: player.name, room: entry.room.code, mode: entry.room.mode, map: entry.room.mapId, seed: entry.room.seed,
          tick: entry.room.tick, tickRate: TICK_RATE, snapshotEvery: SNAPSHOT_EVERY, rules: entry.room.match?.rules ?? null });
        log(`room ${entry.room.code}: ${player.name} joined as ${pilotId}`);
        roster(entry);
        return;
      }
      if (message.t === 'input' && pilotId) entry.room.input(pilotId, message);
      if (message.t === 'signal' && pilotId) {
        const relay = entry.room.signal(pilotId, message.signal);
        if (relay) for (const other of entry.sockets.values()) send(other, relay);
      }
    });
    connection.on('close', () => {
      clearTimeout(timer);
      if (!pilotId || !entry) return;
      entry.room.leave(pilotId); entry.sockets.delete(pilotId); players--;
      log(`room ${entry.room.code}: ${pilotId} left`);
      if (!entry.sockets.size) entry.emptySince = Date.now();
      roster(entry);
    });
  }

  // Fixed-step loop on wall-clock time, shared by every room.
  const stepMs = 1000 / TICK_RATE;
  let last = performance.now(), owed = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    owed += now - last; last = now;
    let steps = Math.floor(owed / stepMs);
    owed -= steps * stepMs;
    if (steps > MAX_CATCH_UP) steps = MAX_CATCH_UP;
    for (const [code, entry] of rooms) {
      if (entry.emptySince !== null && Date.now() - entry.emptySince > EMPTY_ROOM_MS) {
        entry.room.dispose(); rooms.delete(code); log(`room ${code} closed`); continue;
      }
      if (!entry.sockets.size) continue;
      for (let i = 0; i < steps; i++) {
        entry.room.step();
        if (entry.room.tick % SNAPSHOT_EVERY === 0) {
          const events = entry.room.takeEvents();
          for (const [id, connection] of entry.sockets) send(connection, entry.room.snapshot(id, events));
        }
      }
    }
  }, Math.max(4, Math.floor(stepMs / 2)));

  await new Promise((resolve, reject) => { http.once('error', reject); http.listen(port, host, resolve); });
  const actual = http.address().port;
  log(`DESCENDED game server on ws://${host}:${actual}/play (protocol ${PROTOCOL_VERSION})`);
  return {
    port: actual, rooms,
    close: () => new Promise(resolve => {
      clearInterval(loop);
      for (const entry of rooms.values()) { for (const connection of entry.sockets.values()) connection.close(1001, 'server-closing'); entry.room.dispose(); }
      rooms.clear();
      http.close(() => resolve());
      http.closeAllConnections?.();
    }),
  };
}
