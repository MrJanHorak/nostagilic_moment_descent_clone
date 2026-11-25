import createHeadlessGame, { disposeHeadlessGame } from './HeadlessGame.js';
import { MAX_PLAYERS, MIN_FIRE_INTERVAL_MS, TICK_RATE, packQuaternion, packVector } from './Protocol.js';

/** Seconds between the end of a match and the automatic rematch. */
export const REMATCH_DELAY_MS = 10000;
const STEP = 1 / TICK_RATE;

/** @typedef {{id: string, name: string, lastSeq: number, lastFireMs: number}} RoomPlayer */
/** @typedef {{t: 'shot', owner: string, weapon: string, p: number[], q: number[]} | {t: 'kill', victim: string, attacker: string | null}
 *  | {t: 'respawn', id: string} | {t: 'match-start', seed: number} | {t: 'match-over', winner: string | null}} RoomEvent */

/** One online Anarchy match: the authoritative simulation for a room. It knows
 * nothing of sockets; the server feeds it inputs and sends its snapshots.
 * Pilots are flown only by their inputs, so every client sees the same match. */
export default class MatchRoom {
  /** @param {{code: string, mapId?: string, seed?: number, random?: () => number, rules?: Partial<import('../core/AnarchyMatch.js').ANARCHY_RULES>}} options */
  constructor({ code, mapId = 'foundry-ring', seed, random = Math.random, rules = {} }) {
    this.code = code; this.mapId = mapId; this.random = random; this.rules = rules;
    this.game = createHeadlessGame();
    this.game.dedicated = true;
    this.levelIndex = this.game.levelManager.levels.findIndex(/** @param {any} level */ level => level.id === mapId && level.mode === 'anarchy');
    if (this.levelIndex < 0) throw new Error(`No Anarchy map ${mapId}`);
    /** @type {Map<string, RoomPlayer>} */ this.players = new Map();
    /** Events since the last snapshot. @type {RoomEvent[]} */ this.events = [];
    this.tick = 0; this.nextId = 1; this.seed = 0;
    /** @type {number | null} */ this.overTick = null;
    this.start(seed ?? Math.floor(random() * 4294967296));
  }

  get match() { return this.game.anarchy; }
  get full() { return this.players.size >= MAX_PLAYERS; }

  /** Starts (or restarts) the match with every connected pilot. @param {number} seed */
  start(seed) {
    this.seed = seed;
    if (!this.game.startSession({ endless: false, levelIndex: this.levelIndex, seed })) throw new Error('Unable to start the match');
    Object.assign(this.game.anarchy.rules, this.rules);
    this.overTick = null; this.lastKill = null;
    for (const player of this.players.values()) { player.lastFireMs = -Infinity; }
    this.events.push({ t: 'match-start', seed });
  }

  /** A new pilot joins the match in progress. @param {string} name @returns {RoomPlayer} */
  join(name) {
    if (this.full) throw new Error('room-full');
    const player = { id: `p${this.nextId++}`, name, lastSeq: -1, lastFireMs: -Infinity };
    this.players.set(player.id, player);
    this.game.addPilot(player.id);
    return player;
  }

  /** @param {string} id */
  leave(id) {
    if (!this.players.delete(id)) return false;
    this.game.removePilot(id);
    this.match?.scores.delete(id); this.match?.respawns.delete(id);
    return true;
  }

  /** Applies one cleaned input. Old or repeated sequence numbers are ignored; the
   * turn is applied at once, the thrust is held until the next input, and firing
   * is limited to MIN_FIRE_INTERVAL_MS whatever the client sends.
   * @param {string} id @param {import('./Protocol.js').InputMessage} message */
  input(id, message) {
    const player = this.players.get(id), pilot = this.game.gameState.pilot(id);
    if (!player || !pilot || message.seq <= player.lastSeq) return false;
    player.lastSeq = message.seq;
    if (this.game.session.phase !== 'playing' || !pilot.alive || !pilot.ship) { pilot.input = {}; return true; }
    pilot.ship.rotate(message.look[0], message.look[1]);
    this.game.setPilotInput(id, message.input);
    if (message.weapon) this.game.gameState.switchWeapon(/** @type {any} */ (message.weapon), pilot);
    const now = this.game.session.timeMs;
    if (message.fire && now - player.lastFireMs >= MIN_FIRE_INTERVAL_MS) {
      const shot = this.game.pilotFire(id);
      if (shot) {
        player.lastFireMs = now;
        this.events.push({ t: 'shot', owner: id, weapon: shot.type ?? pilot.currentWeapon, p: packVector(shot.mesh.position), q: packQuaternion(shot.mesh.quaternion) });
      }
    }
    return true;
  }

  /** One fixed simulation step; also notes kills and respawns and runs the rematch. */
  step() {
    const game = this.game;
    if (game.session.phase === 'playing') {
      const before = new Set(game.gameState.pilots.filter(/** @param {any} pilot */ pilot => !pilot.alive).map(/** @param {any} pilot */ pilot => pilot.id));
      game.updateSimulation(STEP);
      const kill = this.match?.lastKill;
      if (kill && kill !== this.lastKill) { this.lastKill = kill; this.events.push({ t: 'kill', victim: kill.victimId, attacker: kill.attackerId }); }
      for (const id of before) if (game.gameState.pilot(id)?.alive) this.events.push({ t: 'respawn', id });
      if (game.session.phase === 'completed' && this.overTick === null) {
        this.overTick = this.tick; this.events.push({ t: 'match-over', winner: this.match?.winnerId ?? null });
      }
    } else if (this.overTick !== null && (this.tick - this.overTick) * STEP * 1000 >= REMATCH_DELAY_MS) {
      this.start(Math.floor(this.random() * 4294967296));
    }
    this.tick++;
  }

  /** Events since the last call (sent once with the next snapshot). */
  takeEvents() { const events = this.events; this.events = []; return events; }

  /** The state one player needs: every ship, the pickups in place, the scores, and
   * their own loadout and the last input the server applied (for reconciliation).
   * @param {string} forId @param {RoomEvent[]} [events] */
  snapshot(forId, events = []) {
    const game = this.game, match = this.match, me = game.gameState.pilot(forId), player = this.players.get(forId);
    const pilots = [...this.players.values()].map(entry => {
      const pilot = game.gameState.pilot(entry.id);
      return { id: entry.id, name: entry.name, alive: pilot.alive, hp: Math.round(pilot.health), weapon: pilot.currentWeapon,
        p: packVector(pilot.ship.group.position), q: packQuaternion(pilot.ship.group.quaternion), v: packVector(pilot.ship.velocity) };
    });
    const ammo = me ? Object.fromEntries(Object.entries(me.weaponInventory).filter(([, weapon]) => weapon.unlocked).map(([type, weapon]) => [type, Number.isFinite(weapon.ammo) ? weapon.ammo : -1])) : {};
    return {
      t: 'snapshot', tick: this.tick, timeMs: Math.round(game.session.timeMs), ack: player?.lastSeq ?? -1, ammo,
      pilots,
      pickups: game.powerUpManager.powerups.map(/** @param {any} powerup */ powerup => powerup.spawnId).filter(Boolean),
      // Placed pickups someone has taken and that are waiting to return (clients hide these).
      taken: [...game.powerUpManager.respawnAt.keys()],
      match: match ? { over: match.over, winner: match.winnerId, fragLimit: match.rules.fragLimit, timeLeftMs: Math.max(0, match.rules.timeLimitMs - game.session.timeMs),
        standings: match.standings(), respawnInMs: match.respawns.has(forId) ? Math.max(0, /** @type {number} */ (match.respawns.get(forId)) - game.session.timeMs) : null,
        rematchInMs: this.overTick === null ? null : Math.max(0, REMATCH_DELAY_MS - (this.tick - this.overTick) * STEP * 1000) } : null,
      events,
    };
  }

  dispose() { disposeHeadlessGame(this.game); }
}
