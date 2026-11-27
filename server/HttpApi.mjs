// DESCENDED game server: the HTTP side (Phase 5). Leaderboards for mission times
// and a shared library of player-made levels. Everything a client sends is checked:
// names are cleaned, numbers bounded, levels fully validated, and each address is
// rate limited. Data lives in DATA_DIR as JSON files (or in memory without one).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { cleanName } from '../src/js/net/Protocol.js';
import { isMedal } from '../src/js/core/MissionRating.js';
import { isDifficultyId } from '../src/js/core/Difficulty.js';
import { isCurrentDailyId } from '../src/js/core/DailyChallenge.js';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';

export const API_LIMITS = Object.freeze({
  /** Entries kept per mission leaderboard (one per pilot name). */
  scoresKept: 20,
  /** Entries returned to clients. */
  scoresShown: 10,
  /** Shared levels kept in the library. */
  levels: 500,
  /** Largest request body (a level document). */
  bodyBytes: 600_000,
  /** One score per address this often, one level upload this often. */
  scoreIntervalMs: 5_000,
  levelIntervalMs: 60_000,
  levelNameLength: 48,
});
const LEVEL_ID = /^[a-z0-9]{10}$/;

/** @param {{dataDir?: string | null, allowOrigins?: string[] | null, missionIds?: Iterable<string>, adminToken?: string | null, now?: () => number}} options */
export async function createHttpApi({ dataDir = null, allowOrigins = null, missionIds = [], adminToken = null, now = () => Date.now() } = {}) {
  const missions = new Set(missionIds);
  /** mission id -> best entries @type {Record<string, {name: string, timeMs: number, score: number, medal: string | null, difficulty: string, at: string}[]>} */
  let scores = {};
  /** @type {{id: string, name: string, author: string, rooms: number, version: number, createdAt: string, downloads: number}[]} */
  let levels = [];
  /** id -> document text, when there is no data directory @type {Map<string, string>} */
  const memoryLevels = new Map();
  /** "kind:address" -> last time @type {Map<string, number>} */
  const recent = new Map();

  if (dataDir) {
    await mkdir(join(dataDir, 'levels'), { recursive: true });
    scores = await readJson(join(dataDir, 'scores.json'), {});
    levels = await readJson(join(dataDir, 'levels', 'index.json'), []);
  }
  /** @param {string} path @param {any} fallback */
  async function readJson(path, fallback) {
    try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
  }
  /** Write atomically: a crash never leaves half a file. @param {string} path @param {string} text */
  async function save(path, text) {
    if (!dataDir) return;
    const temp = `${path}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(temp, text); await rename(temp, path);
  }

  /** @param {import('node:http').IncomingMessage} request */
  function corsOrigin(request) {
    const origin = request.headers.origin;
    if (!allowOrigins) return '*';
    return origin && allowOrigins.includes(origin) ? origin : null;
  }
  /** @param {import('node:http').ServerResponse} response @param {number} status @param {any} body @param {string | null} origin */
  function send(response, status, body, origin) {
    response.writeHead(status, { 'content-type': 'application/json', ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}) });
    response.end(JSON.stringify(body));
  }
  /** @param {import('node:http').IncomingMessage} request @returns {Promise<any>} */
  function readBody(request) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      request.on('data', chunk => {
        size += chunk.length;
        if (size > API_LIMITS.bodyBytes) { reject(Object.assign(new Error('too-large'), { status: 413 })); request.destroy(); return; }
        chunks.push(chunk);
      });
      request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('bad-json'), { status: 400 })); } });
      request.on('error', reject);
    });
  }
  /** @param {string} kind @param {import('node:http').IncomingMessage} request @param {number} interval */
  function limited(kind, request, interval) {
    const address = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? '').split(',')[0].trim();
    const key = `${kind}:${address}`, at = now();
    if (at - (recent.get(key) ?? -Infinity) < interval) return true;
    recent.set(key, at);
    if (recent.size > 10_000) for (const [entry, time] of recent) if (at - time > 3_600_000) recent.delete(entry);
    return false;
  }

  /** Board for one mission, best first: fastest time, then highest score. @param {string} mission */
  const board = mission => (scores[mission] ?? []).slice(0, API_LIMITS.scoresShown);

  /** @param {any} body */
  function cleanScore(body) {
    const mission = typeof body?.mission === 'string' ? body.mission : '';
    // Daily boards are open from the day before to the day after (time zones).
    if (!missions.has(mission) && !isCurrentDailyId(mission, new Date(now()))) return { error: 'unknown-mission' };
    const timeMs = Math.round(Number(body.timeMs)), score = Math.round(Number(body.score));
    if (!Number.isFinite(timeMs) || timeMs < 10_000 || timeMs > 7_200_000) return { error: 'bad-time' };
    if (!Number.isFinite(score) || score < 0 || score > 10_000_000) return { error: 'bad-score' };
    return { mission, entry: { name: cleanName(body.name), timeMs, score, medal: isMedal(body.medal) ? body.medal : null,
      difficulty: isDifficultyId(body.difficulty) ? body.difficulty : 'pilot', at: new Date(now()).toISOString() } };
  }

  /** Handle an API request. Returns false for paths that are not the API's.
   * @param {import('node:http').IncomingMessage} request @param {import('node:http').ServerResponse} response */
  async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://local');
    if (!url.pathname.startsWith('/scores') && !url.pathname.startsWith('/levels')) return false;
    const origin = corsOrigin(request);
    if (request.method === 'OPTIONS') {
      response.writeHead(origin ? 204 : 403, origin ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400', vary: 'Origin' } : {});
      response.end(); return true;
    }
    if (allowOrigins && request.headers.origin && !origin) { send(response, 403, { error: 'origin' }, null); return true; }
    try {
      // ── Leaderboards ──
      if (url.pathname === '/scores' && request.method === 'GET') {
        const mission = url.searchParams.get('mission') ?? '';
        if (!missions.has(mission) && !/^daily-\d{4}-\d{2}-\d{2}$/.test(mission)) { send(response, 404, { error: 'unknown-mission' }, origin); return true; }
        send(response, 200, { mission, entries: board(mission) }, origin); return true;
      }
      if (url.pathname === '/scores' && request.method === 'POST') {
        if (limited('score', request, API_LIMITS.scoreIntervalMs)) { send(response, 429, { error: 'slow-down' }, origin); return true; }
        const cleaned = cleanScore(await readBody(request));
        if ('error' in cleaned) { send(response, 400, { error: cleaned.error }, origin); return true; }
        const { mission, entry } = cleaned;
        const list = (scores[mission] ?? []).filter(other => other.name !== entry.name || other.timeMs <= entry.timeMs);
        const kept = list.some(other => other.name === entry.name) ? list : [...list, entry];
        kept.sort((a, b) => a.timeMs - b.timeMs || b.score - a.score);
        scores[mission] = kept.slice(0, API_LIMITS.scoresKept);
        // Keep the last 30 daily boards.
        for (const old of Object.keys(scores).filter(key => key.startsWith('daily-')).sort().slice(0, -30)) delete scores[old];
        await save(join(dataDir ?? '', 'scores.json'), JSON.stringify(scores));
        const rank = scores[mission].findIndex(other => other.name === entry.name) + 1;
        send(response, 200, { mission, rank: rank || null, personalBest: scores[mission].find(other => other.name === entry.name) ?? null, entries: board(mission) }, origin);
        return true;
      }
      // ── Shared levels ──
      if (url.pathname === '/levels' && request.method === 'GET') {
        send(response, 200, { levels: levels.slice(0, 100) }, origin); return true;
      }
      if (url.pathname === '/levels' && request.method === 'POST') {
        if (limited('level', request, API_LIMITS.levelIntervalMs)) { send(response, 429, { error: 'slow-down' }, origin); return true; }
        const body = await readBody(request);
        const result = validateLevelDocument(typeof body?.document === 'string' ? JSON.parse(body.document) : body?.document);
        if (!result.valid) { send(response, 400, { error: 'invalid-level', details: result.errors.slice(0, 5).map(error => `${error.path}: ${error.message}`) }, origin); return true; }
        if (levels.length >= API_LIMITS.levels) { send(response, 507, { error: 'library-full' }, origin); return true; }
        const document = result.document, text = JSON.stringify(document);
        let id; do id = randomBytes(8).toString('hex').replace(/[^a-z0-9]/g, '').slice(0, 10).padEnd(10, '0'); while (levels.some(level => level.id === id));
        const name = (typeof body.name === 'string' && body.name.trim() ? body.name : document.name).replace(/\p{Cc}/gu, '').trim().slice(0, API_LIMITS.levelNameLength) || 'Untitled level';
        const entry = { id, name, author: cleanName(body.author), rooms: document.rooms.length, version: document.formatVersion, createdAt: new Date(now()).toISOString(), downloads: 0 };
        if (dataDir) await save(join(dataDir, 'levels', `${id}.json`), text); else memoryLevels.set(id, text);
        levels = [entry, ...levels];
        await save(join(dataDir ?? '', 'levels', 'index.json'), JSON.stringify(levels));
        send(response, 201, { level: entry }, origin); return true;
      }
      const match = /^\/levels\/([a-z0-9]{10})$/.exec(url.pathname);
      if (match && LEVEL_ID.test(match[1])) {
        const entry = levels.find(level => level.id === match[1]);
        if (!entry) { send(response, 404, { error: 'not-found' }, origin); return true; }
        if (request.method === 'GET') {
          const text = dataDir ? await readFile(join(dataDir, 'levels', `${entry.id}.json`), 'utf8') : memoryLevels.get(entry.id);
          entry.downloads++;
          await save(join(dataDir ?? '', 'levels', 'index.json'), JSON.stringify(levels));
          send(response, 200, { level: entry, document: JSON.parse(text ?? 'null') }, origin); return true;
        }
        if (request.method === 'DELETE') {
          // Moderation: only with the server's ADMIN_TOKEN.
          if (!adminToken || request.headers.authorization !== `Bearer ${adminToken}`) { send(response, 401, { error: 'unauthorized' }, origin); return true; }
          levels = levels.filter(level => level.id !== entry.id); memoryLevels.delete(entry.id);
          await save(join(dataDir ?? '', 'levels', 'index.json'), JSON.stringify(levels));
          send(response, 200, { deleted: entry.id }, origin); return true;
        }
      }
      send(response, 404, { error: 'not-found' }, origin); return true;
    } catch (error) {
      const status = /** @type {any} */ (error).status ?? 500;
      send(response, status, { error: status === 500 ? 'server-error' : /** @type {Error} */ (error).message }, origin);
      return true;
    }
  }

  return { handle, scores: () => scores, levels: () => levels };
}
