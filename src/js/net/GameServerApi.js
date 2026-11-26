/** The game server's HTTP side, as seen from the browser (Phase 5): mission
 * leaderboards and shared player levels. The server address comes from the online
 * lobby's saved server, else the build's VITE_GAME_SERVER. Every call fails soft:
 * no server, offline or an error all resolve to null. */
import { normalizeServerUrl } from '../ui/OnlineLobby.js';

const LOBBY_KEY = 'descended.online.v1';
const TIMEOUT_MS = 6000;

/** HTTP base for a play address: wss://host/play -> https://host. @param {string | null | undefined} play */
export function apiBase(play) {
  const url = normalizeServerUrl(play ?? '', globalThis.location ?? null);
  if (!url) return null;
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
  parsed.pathname = ''; parsed.search = ''; parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

/** @param {any} [storage] @returns {{base: string | null, name: string}} */
export function savedServer(storage = globalThis.localStorage) {
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(LOBBY_KEY) ?? 'null') ?? {}; } catch { /* storage unavailable */ }
  const configured = /** @type {any} */ (import.meta).env?.VITE_GAME_SERVER;
  return { base: apiBase(/** @type {any} */ (saved).server || configured || null), name: String(/** @type {any} */ (saved).name ?? '').trim() };
}

/** @param {string} url @param {RequestInit} [init] */
async function request(url, init = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
    const body = await response.json().catch(() => null);
    return response.ok ? body : { error: body?.error ?? `http-${response.status}`, details: body?.details };
  } catch { return null; } finally { clearTimeout(timer); }
}

/** @param {{base?: string | null, fetchImpl?: typeof fetch}} [options] */
export function createGameServerApi({ base = savedServer().base } = {}) {
  return {
    base,
    get available() { return !!base; },
    /** @param {string} mission */
    leaderboard: mission => base ? request(`${base}/scores?mission=${encodeURIComponent(mission)}`) : Promise.resolve(null),
    /** @param {{mission: string, name: string, timeMs: number, score: number, medal?: string | null, difficulty?: string}} run */
    submitScore: run => base && run.name ? request(`${base}/scores`, { method: 'POST', body: JSON.stringify(run) }) : Promise.resolve(null),
    listLevels: () => base ? request(`${base}/levels`) : Promise.resolve(null),
    /** @param {string} id */
    getLevel: id => base ? request(`${base}/levels/${encodeURIComponent(id)}`) : Promise.resolve(null),
    /** @param {object} document @param {{name?: string, author?: string}} [meta] */
    shareLevel: (document, meta = {}) => base ? request(`${base}/levels`, { method: 'POST', body: JSON.stringify({ document, ...meta }) }) : Promise.resolve(null),
  };
}

/** Lines for the result screen. @param {any} result @param {string} name @returns {string[]} */
export function leaderboardLines(result, name) {
  if (!result || result.error || !Array.isArray(result.entries)) return [];
  const time = /** @param {number} ms */ ms => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const lines = [result.rank ? `Server leaderboard: you are #${result.rank}` : 'Server leaderboard'];
  for (const [i, entry] of result.entries.slice(0, 5).entries()) lines.push(`${i + 1}. ${entry.name} ${time(entry.timeMs)}${entry.name === name ? ' ◀' : ''}`);
  return lines;
}
