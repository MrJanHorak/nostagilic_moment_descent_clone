/** Co-op rules for a mission flown by a team: a shared pool of lives, respawns at
 * the last relay the team activated, extraction that waits for every living pilot,
 * and tougher robots for bigger teams. Owns no ships or rendering; the game asks
 * it what to do and applies the answers (like AnarchyMatch). */

export const COOP_RULES = Object.freeze({
  /** Lives added to the team pool for each pilot who joins. */
  livesPerPilot: 2,
  /** A downed pilot comes back after this long, if the pool has a life. */
  respawnMs: 5000,
  /** Each pilot beyond the first makes robots this much tougher (damage they take is divided). */
  toughnessPerExtraPilot: 0.6,
  /** Most pilots in one co-op mission. */
  maxPilots: 4,
  /** A teammate this close to a wreck brings its pilot back... */
  reviveRadius: 4,
  /** ...after staying this long (it costs no life). */
  reviveMs: 3000,
  /** Shields after a revive (a respawn gives full shields). */
  reviveHealth: 50,
});

/** Pickups each pilot can collect once in co-op (ammunition); others (repairs) go to whoever is first. */
export const PER_PILOT_PICKUPS = Object.freeze(new Set(['pulseAmmo', 'ammoPickup', 'laserSalvage', 'missileSalvage', 'plasmaSalvage']));

/** Robots' toughness for a team of `pilots`: 1 solo, 1.6 for two, 2.2 for three, 2.8 for four.
 * @param {number} pilots @param {number} [perExtra] */
export function enemyToughness(pilots, perExtra = COOP_RULES.toughnessPerExtraPilot) {
  return 1 + Math.max(0, Math.min(COOP_RULES.maxPilots, Math.floor(pilots)) - 1) * perExtra;
}

export default class CoopMatch {
  /** @param {import('three').Vector3} spawn where the team starts (and respawns before any relay)
   * @param {Partial<typeof COOP_RULES>} [rules] */
  constructor(spawn, rules = {}) {
    this.rules = { ...COOP_RULES, ...rules };
    this.spawn = spawn.clone();
    /** The respawn point: the spawn, then each relay the team activates. */
    this.checkpoint = spawn.clone();
    /** @type {string | null} */ this.checkpointLabel = null;
    this.lives = 0;
    /** Pilot ids that ever joined (each adds lives once, even after leaving and rejoining). @type {Set<string>} */
    this.joined = new Set();
    /** pilot id -> time they respawn @type {Map<string, number>} */ this.respawns = new Map();
    /** pilot id -> times downed @type {Map<string, number>} */ this.downs = new Map();
    /** Where downed pilots' wrecks are, and how far a teammate has got with a revive.
     * @type {Map<string, {position: import('three').Vector3, progressMs: number}>} */
    this.wrecks = new Map();
    this.failed = false;
  }

  /** A pilot joins the team; the pool grows the first time. @param {string} id */
  join(id) {
    if (this.joined.has(id)) return false;
    this.joined.add(id); this.lives += this.rules.livesPerPilot;
    return true;
  }

  /** @param {string} id */
  leave(id) { this.respawns.delete(id); this.wrecks.delete(id); }

  /** A relay was activated: it becomes the respawn point.
   * @param {import('three').Vector3} position @param {string} [label] */
  setCheckpoint(position, label) { this.checkpoint.copy(position); this.checkpointLabel = label ?? null; }

  /** A pilot went down. With a life in the pool they are queued to respawn;
   * without one they stay down. Either way their wreck can be revived by a teammate.
   * Returns whether a respawn was queued.
   * @param {string} id @param {number} now @param {import('three').Vector3} [position] where the wreck is */
  recordDown(id, now, position) {
    this.downs.set(id, (this.downs.get(id) ?? 0) + 1);
    if (position) this.wrecks.set(id, { position: position.clone(), progressMs: 0 });
    if (this.failed || this.lives <= 0) return false;
    this.lives--; this.respawns.set(id, now + this.rules.respawnMs);
    return true;
  }

  /** Pilots due back now; each leaves the queue. @param {number} now @returns {string[]} */
  dueRespawns(now) {
    const due = [...this.respawns].filter(([, at]) => at <= now).map(([id]) => id);
    for (const id of due) { this.respawns.delete(id); this.wrecks.delete(id); }
    return due;
  }

  /** Revives: a living teammate within reach of a wreck fills its progress; away, it
   * drains at half speed. A finished revive cancels any queued respawn and refunds
   * its life. Returns the revived pilots and where their wrecks were.
   * @param {readonly {id: string, alive: boolean, position: import('three').Vector3 | null}[]} pilots
   * @param {number} deltaMs @returns {{id: string, position: import('three').Vector3, by: string}[]} */
  updateRevives(pilots, deltaMs) {
    const revived = [];
    for (const [id, wreck] of this.wrecks) {
      const reviver = pilots.find(pilot => pilot.id !== id && pilot.alive && pilot.position && pilot.position.distanceTo(wreck.position) <= this.rules.reviveRadius);
      wreck.progressMs = reviver ? wreck.progressMs + deltaMs : Math.max(0, wreck.progressMs - deltaMs / 2);
      if (!reviver || wreck.progressMs < this.rules.reviveMs) continue;
      this.wrecks.delete(id);
      if (this.respawns.delete(id)) this.lives++;
      revived.push({ id, position: wreck.position, by: reviver.id });
    }
    return revived;
  }

  /** The mission is lost when nobody is flying and nobody is waiting to respawn.
   * @param {readonly {id: string, alive: boolean}[]} pilots the team (not a dedicated host) */
  checkWipe(pilots) {
    if (this.failed || !pilots.length) return this.failed;
    if (pilots.some(pilot => pilot.alive) || pilots.some(pilot => this.respawns.has(pilot.id))) return false;
    this.failed = true;
    return true;
  }

  /** Extraction needs every living pilot at the exit (and at least one alive).
   * @param {readonly {alive: boolean}[]} pilots @param {(pilot: any) => boolean} atExit */
  everyoneOut(pilots, atExit) {
    const living = pilots.filter(pilot => pilot.alive);
    return living.length > 0 && living.every(atExit);
  }
}
