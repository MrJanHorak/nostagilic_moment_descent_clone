import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startGameServer } from '../server/GameServer.mjs';
import { readFileSync } from 'node:fs';
import { parTimeMs, rateMission, bestMedal } from '../src/js/core/MissionRating.js';

async function server(t, options = {}) {
  const running = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {}, ...options });
  t.after(() => running.close());
  const base = `http://127.0.0.1:${running.port}`;
  return { base, post: (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }) };
}

test('medals: gold needs par, every miner and every log; silver allows 1.5x par and half the miners', () => {
  const parMs = parTimeMs({ id: 'signal-breach' });
  assert.equal(parMs, 150_000);
  assert.equal(rateMission({ timeMs: 140_000, parMs, rescued: 2, survivorsTotal: 2, logsFound: 3, logsTotal: 3 }).medal, 'gold');
  const silver = rateMission({ timeMs: 200_000, parMs, rescued: 1, survivorsTotal: 2, logsFound: 3, logsTotal: 3 });
  assert.equal(silver.medal, 'silver'); assert.match(silver.next, /beat par.*rescue every miner/);
  assert.equal(rateMission({ timeMs: 300_000, parMs, rescued: 2, survivorsTotal: 2 }).medal, 'bronze');
  assert.equal(parTimeMs({ mission: { requiredDeviceIds: ['a', 'b'], requiredEnemyIds: ['x'] } }), 140_000);
  assert.equal(bestMedal('silver', 'gold'), 'gold'); assert.equal(bestMedal('silver', null), 'silver');
});

test('leaderboard keeps each pilot\'s best time, ranks by time and persists to DATA_DIR', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'descended-'));
  const { base, post } = await server(t, { dataDir });
  const submit = (name, timeMs, ip) => post('/scores', { mission: 'signal-breach', name, timeMs, score: 5000, medal: 'silver', difficulty: 'pilot' }, { 'x-forwarded-for': ip });
  assert.equal((await submit('Ada', 200_000, '1.1.1.1')).status, 200);
  const second = await (await submit('Bo', 150_000, '2.2.2.2')).json();
  assert.equal(second.rank, 1);
  assert.equal((await submit('Ada', 180_000, '1.1.1.1')).status, 429, 'rate limited');
  const slower = await (await submit('Bo', 400_000, '3.3.3.3')).json();
  assert.equal(slower.personalBest.timeMs, 150_000, 'a slower run keeps the best time');
  const board = await (await fetch(`${base}/scores?mission=signal-breach`)).json();
  assert.deepEqual(board.entries.map(entry => entry.name), ['Bo', 'Ada']);
  assert.equal((await fetch(`${base}/scores?mission=nope`)).status, 404);
  assert.equal((await post('/scores', { mission: 'signal-breach', name: 'X', timeMs: 5, score: 1 }, { 'x-forwarded-for': '4.4.4.4' })).status, 400, 'impossible time');
  const saved = JSON.parse(await readFile(join(dataDir, 'scores.json'), 'utf8'));
  assert.equal(saved['signal-breach'].length, 2);
});

test('shared levels: upload validates, lists, downloads and only an admin can delete', async t => {
  const { base, post } = await server(t, { adminToken: 'secret' });
  const document = JSON.parse(readFileSync(new URL('../src/js/core/levels/documents/relay-gate.v2.json', import.meta.url), 'utf8'));
  const bad = await post('/levels', { document: { formatVersion: 99 } }, { 'x-forwarded-for': '9.9.9.8' });
  assert.equal(bad.status, 400);
  const created = await post('/levels', { document, name: 'My gate', author: 'Ada' }, { 'x-forwarded-for': '9.9.9.9' });
  assert.equal(created.status, 201);
  const { level } = await created.json();
  assert.match(level.id, /^[a-z0-9]{10}$/); assert.equal(level.name, 'My gate');
  const list = await (await fetch(`${base}/levels`)).json();
  assert.equal(list.levels[0].id, level.id);
  const got = await (await fetch(`${base}/levels/${level.id}`)).json();
  assert.equal(got.document.id, document.id); assert.equal(got.level.downloads, 1);
  assert.equal((await fetch(`${base}/levels/${level.id}`, { method: 'DELETE' })).status, 401);
  assert.equal((await fetch(`${base}/levels/${level.id}`, { method: 'DELETE', headers: { authorization: 'Bearer secret' } })).status, 200);
  assert.equal((await fetch(`${base}/levels/${level.id}`)).status, 404);
});

test('API answers CORS preflight only for allowed origins', async t => {
  const { base } = await server(t, { allowOrigins: ['https://game.example'] });
  const ok = await fetch(`${base}/scores`, { method: 'OPTIONS', headers: { origin: 'https://game.example' } });
  assert.equal(ok.status, 204); assert.equal(ok.headers.get('access-control-allow-origin'), 'https://game.example');
  assert.equal((await fetch(`${base}/scores`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })).status, 403);
});
