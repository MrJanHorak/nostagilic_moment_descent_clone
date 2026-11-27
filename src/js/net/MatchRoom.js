import createHeadlessGame, { disposeHeadlessGame } from './HeadlessGame.js';
import BotPilot from './BotPilot.js';
import { SignalLimiter } from '../core/TeamSignals.js';
import LagHistory, { rewindFor } from './LagCompensation.js';
import { MAX_COOP_PLAYERS, MAX_PLAYERS, MIN_FIRE_INTERVAL_MS, TICK_RATE, packQuaternion, packVector } from './Protocol.js';

/** Seconds between the end of a match and the automatic rematch. */
export const REMATCH_DELAY_MS = 10000;
const STEP = 1 / TICK_RATE;
/** Expensive perception and route decisions run at 10 Hz; flight still runs at 60 Hz. */
const BOT_DECISION_STEPS = 6;

/** @typedef {{id: string, name: string, lastSeq: number, lastFireMs: number, rttMs: number | null}} RoomPlayer */
/** @typedef {{t: 'shot', owner: string, weapon: string, p: number[], q: number[]} | {t: 'kill', victim: string, attacker: string | null}
 *  | {t: 'respawn', id: string} | {t: 'match-start', seed: number} | {t: 'match-over', winner: string | null}
 *  | {t: 'eshot', kind: string, p: number[], v: number[]} | {t: 'down', id: string} | {t: 'relay', id: string, by: string | null}
 *  | {t: 'mission-over', result: 'extracted' | 'failed'} | {t: 'armed', id: string, by: string, partner: string | null, ms: number}
 *  | {t: 'disarmed', id: string}} RoomEvent */

/** The missions a co-op room may fly by default. */
export const DEFAULT_COOP_MAP = 'asterion-deepworks';

/** One online match: the authoritative simulation for a room, either an Anarchy
 * deathmatch or a co-op mission. It knows nothing of sockets; the server feeds it
 * inputs and sends its snapshots. Pilots are flown only by their inputs, so every
 * client sees the same match. */
export default class MatchRoom {
  /** @param {{code: string, mode?: 'anarchy' | 'coop', mapId?: string | null, seed?: number, random?: () => number, rules?: Partial<import('../core/AnarchyMatch.js').ANARCHY_RULES>}} options */
  constructor({ code, mode = 'anarchy', mapId = null, seed, random = Math.random, rules = {} }) {
    this.code = code; this.mode = mode; this.random = random; this.rules = rules;
    this.mapId = mapId ?? (mode === 'coop' ? DEFAULT_COOP_MAP : 'foundry-ring');
    this.game = createHeadlessGame();
    this.game.dedicated = true;
    /** Recent positions for lag compensation. */
    this.lagHistory = new LagHistory();
    this.game.lagHistory = this.lagHistory;
    /** Rewind pilots' shots to what they saw (off only for tests). */
    this.lagCompensation = true;
    this.levelIndex = this.game.levelManager.levels.findIndex(/** @param {any} level */ level => level.id === this.mapId &&
      (mode === 'coop' ? level.mission && level.mode !== 'anarchy' : level.mode === 'anarchy'));
    if (this.levelIndex < 0) throw new Error(mode === 'coop' ? `No co-op mission ${this.mapId}` : `No Anarchy map ${this.mapId}`);
    /** Enemy shots already announced. @type {WeakSet<object>} */ this.seenEnemyShots = new WeakSet();
    /** Relays already announced. @type {Set<string>} */ this.announcedRelays = new Set();
    /** Pilots announced as down. @type {Set<string>} */ this.downIds = new Set();
    this.signals = new SignalLimiter();
    /** @type {Map<string, RoomPlayer>} */ this.players = new Map();
    /** Events since the last snapshot. @type {RoomEvent[]} */ this.events = [];
    this.tick = 0; this.nextId = 1; this.seed = 0;
    /** @type {Set<string>} */ this.bots = new Set();
    /** @type {Map<string, BotPilot>} */ this.botPilots = new Map();
    /** @type {Map<string, {command: any, remaining: number}>} */ this.botCommands = new Map();
    /** @type {'easy' | 'normal' | 'hard'} */ this.botDifficulty = 'normal';
    /** @type {number | null} */ this.overTick = null;
    this.start(seed ?? Math.floor(random() * 4294967296));
  }

  get match() { return this.game.anarchy; }
  get coop() { return this.game.coop; }
  get maxPlayers() { return this.mode === 'coop' ? MAX_COOP_PLAYERS : MAX_PLAYERS; }
  get full() { return this.players.size >= this.maxPlayers; }

  /** Starts (or restarts) the match with every connected pilot. @param {number} seed */
  start(seed) {
    this.seed = seed;
    if (!this.game.startSession({ endless: false, levelIndex: this.levelIndex, seed, coop: this.mode === 'coop' })) throw new Error('Unable to start the match');
    if (this.game.anarchy) Object.assign(this.game.anarchy.rules, this.rules);
    this.botPilots.clear(); this.botCommands.clear();
    this.lagHistory.clear();
    this.overTick = null; this.lastKill = null; this.announcedRelays.clear(); this.downIds.clear(); this.seenEnemyShots = new WeakSet();
    for (const player of this.players.values()) { player.lastFireMs = -Infinity; }
    this.events.push({ t: 'match-start', seed });
  }

  /** A new pilot joins the match in progress. @param {string} name @returns {RoomPlayer} */
  join(name) {
    if (this.full) throw new Error('room-full');
    const player = { id: `p${this.nextId++}`, name, lastSeq: -1, lastFireMs: -Infinity, rttMs: null };
    this.players.set(player.id, player);
    this.game.addPilot(player.id);
    return player;
  }

  /** @param {string} id */
  leave(id) {
    if (!this.players.delete(id)) return false;
    this.game.removePilot(id); this.bots.delete(id); this.botPilots.delete(id); this.botCommands.delete(id);
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
    if (message.rtt !== undefined) player.rttMs = message.rtt;
    if (this.game.session.phase !== 'playing' || !pilot.alive || !pilot.ship) { pilot.input = {}; return true; }
    pilot.ship.rotate(message.look[0], message.look[1]);
    this.game.setPilotInput(id, message.input);
    if (message.interact && this.game.coop) {
      const result = this.game.pilotInteract(id);
      if (result?.armed) this.events.push({ t: 'armed', id: result.id, by: id, partner: result.partnerId ?? null, ms: result.windowMs ?? 0 });
      if (result) this.noteRelays(id);
    }
    if (message.weapon) this.game.gameState.switchWeapon(/** @type {any} */ (message.weapon), pilot);
    const now = this.game.session.timeMs;
    if (message.fire && now - player.lastFireMs >= MIN_FIRE_INTERVAL_MS) {
      const shot = this.game.pilotFire(id);
      if (shot) {
        player.lastFireMs = now;
        const rewindMs = this.lagCompensation ? rewindFor(player.rttMs) : 0;
        if (rewindMs) /** @type {any} */ (shot).rewindMs = rewindMs;
        this.events.push({ t: 'shot', owner: id, weapon: shot.type ?? pilot.currentWeapon, p: packVector(shot.mesh.position), q: packQuaternion(shot.mesh.quaternion) });
      }
    }
    return true;
  }

  /** Add computer pilots up to the available room capacity. @param {number} count @param {'easy' | 'normal' | 'hard'} [difficulty] */
  addBots(count, difficulty = 'normal') {
    if (this.mode !== 'anarchy') return;
    this.botDifficulty = difficulty;
    for (let i = 0; i < count && !this.full; i++) {
      const player = this.join(`Bot ${i + 1}`);
      this.bots.add(player.id);
    }
  }

  /** Run server-controlled pilots through the same input path as human players. */
  updateBots() {
    for (const id of this.bots) {
      const pilot = this.game.gameState.pilot(id), player = this.players.get(id);
      if (!pilot?.alive || !pilot.ship || !player) { this.botPilots.delete(id); this.botCommands.delete(id); continue; }
      let brain = this.botPilots.get(id);
      if (!brain) {
        const document = this.game.levelManager.currentLevel?.sourceDocument;
        if (!document) continue;
        brain = new BotPilot(document, this.botDifficulty, id); this.botPilots.set(id, brain);
      }
      let cached = this.botCommands.get(id), deciding = false;
      if (!cached || cached.remaining <= 0) {
        const opponents = [...this.players.keys()].filter(other => other !== id).map(other => this.game.gameState.pilot(other));
        // Spread bots across ticks after their first decision so all their line-of-sight
        // checks do not land on the same server frame.
        const steps = cached ? BOT_DECISION_STEPS : 1 + (Number(id.slice(1)) - 1) % BOT_DECISION_STEPS;
        cached = { command: brain.command(this.game, pilot, opponents, player.lastFireMs, steps), remaining: steps };
        this.botCommands.set(id, cached); deciding = true;
      }
      cached.remaining--;
      this.input(id, { t: 'input', seq: player.lastSeq + 1, ...cached.command, fire: deciding && cached.command.fire, interact: false });
    }
  }

  /** One fixed simulation step; also notes kills and respawns and runs the rematch. */
  step() {
    const game = this.game;
    if (game.session.phase === 'playing') {
      this.updateBots();
      const before = new Set(game.gameState.pilots.filter(/** @param {any} pilot */ pilot => !pilot.alive).map(/** @param {any} pilot */ pilot => pilot.id));
      game.updateSimulation(STEP);
      this.lagHistory.record(game.session.timeMs, game.gameState.pilots, game.enemyManager.enemies);
      const kill = this.match?.lastKill;
      if (kill && kill !== this.lastKill) { this.lastKill = kill; this.events.push({ t: 'kill', victim: kill.victimId, attacker: kill.attackerId }); }
      for (const id of before) if (game.gameState.pilot(id)?.alive) this.events.push({ t: 'respawn', id });
    }
    if (this.game.coop) this.noteCoop();
    // The end, however it came (a step, or damage applied between steps).
    if (this.overTick === null && ['completed', 'dead'].includes(game.session.phase)) {
      this.overTick = this.tick;
      this.events.push(this.mode === 'coop' ? { t: 'mission-over', result: game.session.phase === 'completed' ? 'extracted' : 'failed' }
        : { t: 'match-over', winner: this.match?.winnerId ?? null });
    } else if (this.overTick !== null && game.session.phase !== 'playing' && (this.tick - this.overTick) * STEP * 1000 >= REMATCH_DELAY_MS) {
      this.start(Math.floor(this.random() * 4294967296));
    }
    this.tick++;
  }

  /** A pilot's quick-chat or ping, to relay to the room; null when they signal too fast.
   * @param {string} id @param {import('../core/TeamSignals.js').TeamSignal} signal */
  signal(id, signal) {
    if (!this.players.has(id) || !this.signals.allow(id, this.tick * STEP * 1000)) return null;
    return { t: 'signal', from: id, ...signal };
  }

  /** Co-op bookkeeping after a step: new robot shots, pilots who went down, relays opened. */
  noteCoop() {
    const game = this.game;
    for (const shot of game.enemyManager.projectileManager.enemyProjectiles) {
      if (this.seenEnemyShots.has(shot)) continue;
      this.seenEnemyShots.add(shot);
      this.events.push({ t: 'eshot', kind: shot.type ?? 'standard', p: packVector(shot.mesh.position), v: packVector(shot.velocity) });
    }
    for (const pilot of game.gameState.pilots) {
      if (!this.players.has(pilot.id)) continue;
      if (pilot.alive) this.downIds.delete(pilot.id);
      else if (!this.downIds.has(pilot.id)) { this.downIds.add(pilot.id); this.events.push({ t: 'down', id: pilot.id }); }
    }
    this.noteRelays(null);
    for (const relay of game.levelManager.interaction?.expired ?? []) this.events.push({ t: 'disarmed', id: relay });
  }

  /** @param {string | null} by */
  noteRelays(by) {
    for (const id of this.game.levelManager.interaction?.activatedIds ?? []) {
      if (this.announcedRelays.has(id)) continue;
      this.announcedRelays.add(id); this.events.push({ t: 'relay', id, by });
    }
  }

  /** The co-op part of a snapshot: robots, mission progress, team lives and story.
   * @param {string} forId */
  coopState(forId) {
    const game = this.game, coop = game.coop, mission = game.mission, story = game.story;
    if (!coop) return null;
    const respawnAt = coop.respawns.get(forId);
    return {
      enemies: game.enemyManager.enemies.filter(/** @param {any} enemy */ enemy => enemy.mesh?.userData.spawnPointId).map(/** @param {any} enemy */ enemy => ({
        id: enemy.mesh.userData.spawnPointId, type: enemy.type.name, p: packVector(enemy.mesh.position), q: packQuaternion(enemy.mesh.quaternion),
        hp: Math.max(0, Math.round(enemy.health * 10) / 10), a: !!enemy.isActive })),
      defeated: [...game.enemyManager.destroyedPredefinedEnemies],
      relays: [...(game.levelManager.interaction?.activatedIds ?? [])],
      armed: game.levelManager.interaction?.armedState() ?? [],
      ready: !!mission?.ready, escapeMs: mission?.remainingEscapeMs(game.session.timeMs) ?? null,
      lives: coop.lives, respawnInMs: respawnAt === undefined ? null : Math.max(0, respawnAt - game.session.timeMs),
      checkpoint: coop.checkpointLabel, toughness: game.enemyManager.toughness,
      wrecks: [...coop.wrecks].map(([id, wreck]) => ({ id, p: packVector(wreck.position), progress: Math.round(wreck.progressMs / coop.rules.reviveMs * 100) / 100 })),
      logs: story ? [...story.foundLogs] : [], aboard: story ? [...story.aboard] : [],
      phase: game.session.phase,
    };
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
      taken: game.powerUpManager.takenIds(forId),
      coop: this.coopState(forId),
      match: match ? { over: match.over, winner: match.winnerId, fragLimit: match.rules.fragLimit, timeLeftMs: Math.max(0, match.rules.timeLimitMs - game.session.timeMs),
        standings: match.standings(), respawnInMs: match.respawns.has(forId) ? Math.max(0, /** @type {number} */ (match.respawns.get(forId)) - game.session.timeMs) : null,
        rematchInMs: this.overTick === null ? null : Math.max(0, REMATCH_DELAY_MS - (this.tick - this.overTick) * STEP * 1000) } : null,
      events,
    };
  }

  dispose() { disposeHeadlessGame(this.game); }
}
