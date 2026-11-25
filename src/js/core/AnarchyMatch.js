/** Free-for-all match rules: frags, respawns and the end of the match. Owns no
 * rendering and no ships; the game asks it what to do and applies the answers. */

export const ANARCHY_RULES = Object.freeze({ fragLimit: 10, timeLimitMs: 10 * 60 * 1000, respawnMs: 3000, pickupRespawnMs: 20000 });

/** @typedef {{id: string, frags: number, deaths: number}} Standing */

export default class AnarchyMatch {
  /** @param {readonly import('three').Vector3[]} spawnPoints @param {Partial<typeof ANARCHY_RULES>} [rules] */
  constructor(spawnPoints, rules = {}) {
    if (!spawnPoints.length) throw new Error('An Anarchy arena needs spawn points');
    this.spawnPoints = spawnPoints;
    this.rules = { ...ANARCHY_RULES, ...rules };
    /** @type {Map<string, Standing>} */ this.scores = new Map();
    /** pilot id -> time they respawn @type {Map<string, number>} */ this.respawns = new Map();
    /** @type {string | null} */ this.winnerId = null;
    this.over = false;
    /** The most recent kill, for the feed. @type {{victimId: string, attackerId: string | null, timeMs: number} | null} */
    this.lastKill = null;
    /** Display names by pilot id (online play); the HUD falls back to ids. @type {Map<string, string> | null} */
    this.names = null;
    /** Online: time until the server's automatic rematch. @type {number | null} */
    this.rematchInMs = null;
  }

  /** @param {string} id */
  standing(id) {
    let entry = this.scores.get(id);
    if (!entry) { entry = { id, frags: 0, deaths: 0 }; this.scores.set(id, entry); }
    return entry;
  }

  /** A pilot went down. A kill by someone else is a frag for them; a self-inflicted
   * or environmental death (lava, own blast) costs the victim one frag.
   * @param {string} victimId @param {string | null | undefined} attackerId @param {number} now */
  recordDeath(victimId, attackerId, now) {
    if (this.over) return;
    const victim = this.standing(victimId); victim.deaths++;
    if (attackerId && attackerId !== victimId) this.standing(attackerId).frags++;
    else victim.frags--;
    this.lastKill = { victimId, attackerId: attackerId ?? null, timeMs: now };
    this.respawns.set(victimId, now + this.rules.respawnMs);
    const leader = attackerId ? this.scores.get(attackerId) : null;
    if (leader && leader.frags >= this.rules.fragLimit) { this.over = true; this.winnerId = leader.id; }
  }

  /** Spawn point farthest from every live pilot (largest nearest-distance).
   * @param {readonly import('three').Vector3[]} occupied */
  safestSpawn(occupied) {
    let best = this.spawnPoints[0], bestDistance = -1;
    for (const point of this.spawnPoints) {
      const nearest = occupied.reduce((min, position) => Math.min(min, point.distanceTo(position)), Infinity);
      if (nearest > bestDistance) { best = point; bestDistance = nearest; }
    }
    return best;
  }

  /** Pilots due to respawn now; each is removed from the queue.
   * @param {number} now @returns {string[]} */
  dueRespawns(now) {
    const due = [...this.respawns].filter(([, at]) => at <= now).map(([id]) => id);
    for (const id of due) this.respawns.delete(id);
    return due;
  }

  /** Ends the match on time; the most frags wins (ties: fewer deaths, then id).
   * @param {number} now */
  checkTime(now) {
    if (this.over || now < this.rules.timeLimitMs) return false;
    this.over = true; this.winnerId = this.standings()[0]?.id ?? null;
    return true;
  }

  /** @returns {Standing[]} */
  standings() {
    return [...this.scores.values()].sort((a, b) => b.frags - a.frags || a.deaths - b.deaths || a.id.localeCompare(b.id));
  }
}
