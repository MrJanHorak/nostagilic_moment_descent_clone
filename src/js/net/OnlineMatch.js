/** Online Anarchy in the browser: connects to the game server, flies the local
 * ship with prediction and reconciliation, draws the other ships interpolated
 * about 100 ms behind, and shows the server's shots, kills, pickups and scores.
 *
 * The server is authoritative for everything that matters (damage, frags,
 * respawns, pickups, ammunition). This client only predicts its own flight and
 * draws its own shots straight away; their effect comes back in snapshots. */
import * as THREE from 'three';
import { MIN_FIRE_INTERVAL_MS, PROTOCOL_VERSION } from './Protocol.js';
import { InputHistory, ServerClock, SnapshotInterpolator, reconcileShip } from './ClientPrediction.js';

/** Ship colours by join order, so every pilot is easy to tell apart. */
export const PILOT_COLOURS = [0xe8554e, 0x4ea8e8, 0x6fdc5a, 0xf2c84b, 0xc46ef0, 0xf28c3c, 0x5ee6d8, 0xf0f0f0];
const CONNECT_TIMEOUT_MS = 8000;
const PING_EVERY_MS = 2000;
const NO_INPUT = Object.freeze({});
const WEAPON_ORDER = ['pulse', 'laser', 'missile', 'plasma'];

/** Explains a server error code to a player. @param {string} code */
export function describeNetError(code) {
  return ({
    'room-not-found': 'No room with that code. Check the code, or create a new room.',
    'room-full': 'That room is full (8 pilots).',
    'protocol-mismatch': 'The server runs a different version of the game. Reload the page.',
    'bad-room-code': 'Room codes are four letters.',
    'hello-timeout': 'The server did not hear from this game in time.',
    'connect-timeout': 'The server did not answer. Check the address and that the server is running.',
    'connect-failed': 'Could not reach the game server. Check the address (ws:// or wss://) and that the server is running.',
    'connection-lost': 'The connection to the game server was lost.',
  })[code] ?? `The server refused the connection (${code}).`;
}

export default class OnlineMatch {
  /** @param {any} game the Game (browser or headless)
   * @param {{url: string, name?: string, room?: string | null, WebSocketImpl?: typeof WebSocket, now?: () => number}} options */
  constructor(game, { url, name = 'Pilot', room = null, WebSocketImpl = globalThis.WebSocket, now = () => performance.now() }) {
    this.game = game; this.url = url; this.name = name; this.requestedRoom = room;
    this.WebSocketImpl = WebSocketImpl; this.now = now;
    /** @type {WebSocket | null} */ this.socket = null;
    /** @type {string | null} */ this.id = null;
    /** @type {string | null} */ this.room = null;
    this.mapId = ''; this.seed = 0; this.levelIndex = -1;
    /** @type {Map<string, string>} */ this.names = new Map();
    /** @type {Map<string, number>} */ this.colours = new Map();
    this.history = new InputHistory();
    this.clock = new ServerClock();
    this.interpolator = new SnapshotInterpolator();
    /** Mouse turn since the last input. @type {[number, number]} */ this.look = [0, 0];
    this.fireQueued = false; this.lastFireAt = -Infinity;
    /** @type {any} */ this.lastSnapshot = null;
    /** @type {Map<string, boolean>} */ this.aliveById = new Map();
    this.closedByUs = false; this.connected = false;
    this.lastPing = -Infinity; this.rttMs = null;
    this.stats = { snapshots: 0, reconciles: 0, snaps: 0, lastError: 0 };
    this.scratch = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  }

  /** Connect and join; resolves with the welcome once the match is running here.
   * @returns {Promise<any>} */
  connect() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (/** @type {Error | null} */ error, /** @type {any} */ value = undefined) => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => { finish(Object.assign(new Error(describeNetError('connect-timeout')), { code: 'connect-timeout' })); this.close(); }, CONNECT_TIMEOUT_MS);
      let socket;
      try { socket = new this.WebSocketImpl(this.url); } catch { finish(Object.assign(new Error(describeNetError('connect-failed')), { code: 'connect-failed' })); return; }
      this.socket = socket;
      socket.addEventListener('open', () => {
        this.connected = true;
        this.send({ t: 'hello', protocol: PROTOCOL_VERSION, name: this.name, room: this.requestedRoom || null });
      });
      socket.addEventListener('message', event => {
        /** @type {any} */ let message;
        try { message = JSON.parse(String(event.data)); } catch { return; }
        if (message.t === 'error' && !this.id) { finish(Object.assign(new Error(describeNetError(message.error)), { code: message.error })); return; }
        if (message.t === 'welcome') {
          try { this.onWelcome(message); finish(null, message); } catch (error) { finish(/** @type {Error} */ (error)); this.close(); }
          return;
        }
        this.handle(message);
      });
      socket.addEventListener('error', () => { if (!this.id) finish(Object.assign(new Error(describeNetError('connect-failed')), { code: 'connect-failed' })); });
      socket.addEventListener('close', () => {
        this.connected = false;
        if (!this.id) finish(Object.assign(new Error(describeNetError('connect-failed')), { code: 'connect-failed' }));
        else if (!this.closedByUs) this.game.onlineConnectionLost?.(this);
      });
    });
  }

  /** @param {object} message */
  send(message) {
    if (this.socket && this.socket.readyState === 1) this.socket.send(JSON.stringify(message));
  }

  /** @param {any} message */
  onWelcome(message) {
    const game = this.game;
    this.id = message.id; this.room = message.room; this.mapId = message.map; this.seed = message.seed;
    this.names.set(message.id, message.name);
    this.levelIndex = game.levelManager.levels.findIndex(/** @param {any} level */ level => level.id === message.map && level.mode === 'anarchy');
    if (this.levelIndex < 0) throw new Error(`This game has no Anarchy map "${message.map}"`);
    game.gameState.localPilot.id = message.id;
    game.online = this;
    if (!game.startSession({ endless: false, levelIndex: this.levelIndex, seed: message.seed })) throw new Error('Unable to start the online match');
    game.uiManager?.showMessage?.(`ONLINE · Room ${message.room} · Share the code to bring friends in`, 4000, '#9ce5ed');
  }

  /** @param {any} message */
  handle(message) {
    if (message.t === 'snapshot') this.onSnapshot(message);
    else if (message.t === 'roster') this.onRoster(message.players);
    else if (message.t === 'pong') this.rttMs = Math.max(0, this.now() - message.time);
    else if (message.t === 'error') console.warn('Game server:', message.error);
  }

  /** Keeps a ship in this game for every other player in the room.
   * @param {{id: string, name: string}[]} players */
  onRoster(players) {
    const game = this.game, present = new Set(players.map(player => player.id));
    for (const [index, player] of players.entries()) {
      this.names.set(player.id, player.name);
      if (!this.colours.has(player.id)) this.colours.set(player.id, PILOT_COLOURS[(Number(player.id.slice(1)) - 1 + PILOT_COLOURS.length) % PILOT_COLOURS.length] ?? PILOT_COLOURS[index % PILOT_COLOURS.length]);
      if (player.id === this.id || game.gameState.pilot(player.id)) continue;
      const pilot = game.addPilot(player.id);
      this.dressShip(pilot, player.name);
      if (this.lastSnapshot) game.uiManager?.showMessage?.(`${player.name} joined`, 1800, '#9ce5ed', 70);
    }
    for (const pilot of [...game.gameState.pilots]) {
      if (pilot.local || present.has(pilot.id)) continue;
      game.uiManager?.showMessage?.(`${this.nameOf(pilot.id)} left`, 1800, '#9ce5ed', 70);
      game.removePilot(pilot.id); this.interpolator.forget(pilot.id); this.aliveById.delete(pilot.id);
    }
    if (game.anarchy) game.anarchy.names = this.names;
  }

  /** A visible, coloured ship with a name tag above it. @param {any} pilot @param {string} name */
  dressShip(pilot, name) {
    const ship = pilot.ship; if (!ship) return;
    ship.model.visible = true;
    const colour = this.colours.get(pilot.id) ?? PILOT_COLOURS[0];
    const body = ship.model.children[0];
    if (body?.material?.color) body.material.color.setHex(colour);
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const context = canvas.getContext?.('2d'); if (!context) return;
    context.font = 'bold 34px Arial, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.lineWidth = 6; context.strokeStyle = 'rgba(0, 0, 0, 0.8)'; context.strokeText(name, 128, 32);
    context.fillStyle = `#${colour.toString(16).padStart(6, '0')}`; context.fillText(name, 128, 32);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: true, transparent: true }));
    sprite.scale.set(2, 0.5, 1); sprite.position.set(0, 0.9, 0); sprite.name = 'nameTag';
    ship.group.add(sprite);
  }

  /** @param {string | null | undefined} id */
  nameOf(id) { return id ? this.names.get(id) ?? id : 'the arena'; }

  /** The local mouse turned the ship; the same turn goes with the next input.
   * @param {number} yaw @param {number} pitch */
  addLook(yaw, pitch) { this.look[0] += yaw; this.look[1] += pitch; }

  /** Shots are limited to the server's rate, so every shot drawn here is a real one. */
  canFire() { return this.now() - this.lastFireAt >= MIN_FIRE_INTERVAL_MS; }
  queueFire() { this.fireQueued = true; this.lastFireAt = this.now(); }

  /** One client step: number this input, keep it for replay, and send it.
   * @param {import('../contracts.js').FlightInput | null} input @param {number} dt */
  step(input, dt) {
    if (!this.id) return;
    const entry = this.history.push(input ?? NO_INPUT, this.look, dt);
    this.look[0] = 0; this.look[1] = 0;
    this.send({ t: 'input', seq: entry.seq, input: entry.input, look: entry.look, fire: this.fireQueued, weapon: this.game.gameState.localPilot.currentWeapon });
    this.fireQueued = false;
  }

  /** Stop the ship's thrust on the server (pause, menus, match end): it holds the last input. */
  holdStill() {
    if (!this.id) return;
    const entry = this.history.push(NO_INPUT, [0, 0], 0);
    this.history.acknowledge(entry.seq); // A zero-length step changes nothing to replay.
    this.send({ t: 'input', seq: entry.seq, input: {}, look: [0, 0], fire: false, weapon: null });
  }

  /** @param {any} snapshot */
  onSnapshot(snapshot) {
    const game = this.game, gameState = game.gameState, now = this.now();
    this.stats.snapshots++;
    this.clock.sample(snapshot.timeMs, now);
    for (const event of snapshot.events ?? []) if (event.t === 'match-start' && event.seed !== this.seed) this.restart(event.seed);
    this.lastSnapshot = snapshot;
    if (!game.session || !['playing', 'paused', 'completed'].includes(game.session.phase)) return;
    for (const state of snapshot.pilots) {
      const was = this.aliveById.get(state.id);
      this.aliveById.set(state.id, state.alive);
      if (state.id === this.id) { this.applyOwnState(state, snapshot, was); continue; }
      this.interpolator.push(state.id, snapshot.timeMs, state);
      const pilot = gameState.pilot(state.id);
      if (pilot) {
        pilot.health = state.hp; pilot.currentWeapon = state.weapon;
        if (was === true && !state.alive && pilot.ship) game.enemyManager?.effectsManager?.createExplosion?.(pilot.ship.group.position.clone(), 0xffaa33, true, 3);
      }
    }
    game.powerUpManager?.setRemoteTaken?.(new Set(snapshot.taken ?? []));
    this.applyMatch(snapshot.match);
    for (const event of snapshot.events ?? []) this.onEvent(event);
    if (now - this.lastPing > PING_EVERY_MS) { this.lastPing = now; this.send({ t: 'ping', time: now }); }
  }

  /** Shields, ammunition, life and position of this screen's ship, from the server.
   * @param {any} state @param {any} snapshot @param {boolean | undefined} wasAlive */
  applyOwnState(state, snapshot, wasAlive) {
    const game = this.game, gameState = game.gameState, pilot = gameState.localPilot, ui = game.uiManager;
    const pending = this.history.acknowledge(snapshot.ack);
    if (state.hp < pilot.health && state.alive) {
      ui?.flash?.('rgba(255, 0, 0, 0.3)');
      game.audioManager?.playSound?.('playerDamage', { volume: 0.6 });
    }
    pilot.health = state.hp;
    // Ammunition and unlocked weapons are the server's.
    let changed = false;
    for (const type of WEAPON_ORDER) {
      const weapon = pilot.weaponInventory[type], amount = snapshot.ammo?.[type];
      const unlocked = amount !== undefined, ammo = amount === -1 ? Infinity : (amount ?? 0);
      if (weapon.unlocked !== unlocked || weapon.ammo !== ammo) { weapon.unlocked = unlocked || type === 'pulse'; weapon.ammo = ammo; changed = true; }
    }
    if (!pilot.weaponInventory[pilot.currentWeapon]?.unlocked) { pilot.currentWeapon = 'pulse'; changed = true; }
    if (changed) ui?.updateWeaponUI?.();
    const ship = game.spaceship;
    if (!state.alive) {
      if (pilot.alive) {
        pilot.alive = false;
        game.enemyManager?.effectsManager?.createExplosion?.(ship.group.position.clone(), 0xffaa33, true, 3);
        ship.velocity.set(0, 0, 0);
      }
      ui?.updateHUD?.();
      return;
    }
    if (!pilot.alive || wasAlive === false) {
      // Back from a respawn: take the server's pose outright.
      pilot.alive = true; this.history.clear();
      ship.group.position.fromArray(state.p); ship.group.quaternion.fromArray(state.q); ship.velocity.fromArray(state.v);
      gameState.playerVelocity = ship.velocity;
      ui?.updateHUD?.();
      return;
    }
    const result = reconcileShip(ship, state, pending, {
      colliders: game.levelManager?.currentLevel?.kind === 'arena' ? game.levelManager.solidColliders : null,
      speedMultiplier: gameState.speedMultiplier, unsentLook: this.look });
    this.stats.reconciles++; this.stats.lastError = result.error; if (result.snapped) this.stats.snaps++;
    ui?.updateHUD?.();
  }

  /** The server's scores, clock and respawn timer, in the match the HUD reads.
   * @param {any} remote */
  applyMatch(remote) {
    const game = this.game, match = game.anarchy;
    if (!match || !remote) return;
    const now = game.session.timeMs;
    match.names = this.names;
    match.scores = new Map(remote.standings.map(/** @param {any} entry */ entry => [entry.id, { ...entry }]));
    match.rules = { ...match.rules, fragLimit: remote.fragLimit, timeLimitMs: now + remote.timeLeftMs };
    match.respawns = new Map(remote.respawnInMs === null ? [] : [[this.id, now + remote.respawnInMs]]);
    match.rematchInMs = remote.rematchInMs;
    if (remote.over && !match.over) {
      match.over = true; match.winnerId = remote.winner;
      if (game.session.phase === 'paused') game.resumeGame?.();
      this.holdStill();
      game.endAnarchy();
    }
  }

  /** @param {any} event */
  onEvent(event) {
    const game = this.game, ui = game.uiManager;
    if (event.t === 'shot' && event.owner !== this.id) this.drawShot(event);
    else if (event.t === 'kill') {
      const { victim, attacker } = event;
      if (victim === this.id) ui?.showMessage?.(attacker && attacker !== victim ? `DESTROYED BY ${this.nameOf(attacker).toUpperCase()} · Respawning in 3s` : 'SHIP LOST · −1 frag · Respawning in 3s', 2800, '#ff7755');
      else if (attacker === this.id) ui?.showMessage?.(`FRAG · ${this.nameOf(victim)} destroyed · ${game.anarchy?.standing(this.id).frags ?? ''} frags`, 1800, '#45ff96');
      else ui?.showMessage?.(attacker && attacker !== victim ? `${this.nameOf(attacker)} destroyed ${this.nameOf(victim)}` : `${this.nameOf(victim)} was lost`, 1600, '#cafaff');
    }
  }

  /** Another pilot's shot, drawn where the server fired it. It does no damage here:
   * hits come back from the server. @param {any} event */
  drawShot(event) {
    const game = this.game, pilot = game.gameState.pilot(event.owner);
    if (!pilot?.ship || game.session.phase !== 'playing') return;
    const group = pilot.ship.group;
    const savedPosition = group.position.clone(), savedQuaternion = group.quaternion.clone(), savedVelocity = pilot.ship.velocity.clone();
    const weapon = pilot.weaponInventory[event.weapon] ? event.weapon : 'pulse';
    pilot.currentWeapon = weapon; pilot.weaponInventory[weapon].unlocked = true; pilot.weaponInventory[weapon].ammo = Infinity;
    // The server's p is the muzzle (2 units ahead of the ship); fire from the ship pose behind it.
    group.quaternion.fromArray(event.q);
    group.position.fromArray(event.p).add(new THREE.Vector3(0, 0, 2).applyQuaternion(group.quaternion));
    pilot.ship.velocity.set(0, 0, 0);
    try { game.projectileManager.fireProjectile(game.gameState, { pilot }); } finally {
      group.position.copy(savedPosition); group.quaternion.copy(savedQuaternion); pilot.ship.velocity.copy(savedVelocity);
    }
  }

  /** The server started the rematch. @param {number} seed */
  restart(seed) {
    this.seed = seed; this.history.clear(); this.interpolator.clear(); this.clock.reset(); this.aliveById.clear();
    if (this.lastSnapshot) this.game.startSession({ endless: false, levelIndex: this.levelIndex, seed });
    this.game.uiManager?.showMessage?.('REMATCH · Same pilots, fresh scores', 2500, '#9ce5ed');
  }

  /** Once per rendered frame: pose the other ships from the interpolation buffer. */
  frame() {
    if (!this.id || !this.lastSnapshot) return;
    const serverNow = this.clock.now(this.now()), out = this.scratch;
    for (const pilot of this.game.gameState.pilots) {
      if (pilot.local || !pilot.ship) continue;
      const pose = this.interpolator.sample(pilot.id, serverNow, out);
      if (!pose) continue;
      pilot.alive = pose.alive;
      pilot.ship.group.visible = pose.alive;
      pilot.ship.group.position.copy(out.position); pilot.ship.group.quaternion.copy(out.quaternion);
    }
  }

  /** Text for the HUD: room code and round trip. */
  status() {
    return `Room ${this.room ?? '----'}${this.rttMs === null ? '' : ` · ${Math.round(this.rttMs)} ms`}`;
  }

  close() {
    this.closedByUs = true;
    try { this.socket?.close(1000, 'left'); } catch { /* already closed */ }
    this.socket = null;
  }
}
