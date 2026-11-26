/** Kestrel's hangar: credits earned by finishing missions, spent on permanent ship
 * upgrades. Upgrades apply in single player only. The daily challenge and online
 * matches always fly the stock ship, so their leaderboards stay fair. */

/** @typedef {'plating' | 'capacitor' | 'racks' | 'thrusters'} UpgradeId */
/** @typedef {{id: UpgradeId, label: string, summary: string, costs: readonly number[], perLevel: string}} Upgrade */

/** @type {readonly Upgrade[]} */
export const UPGRADES = Object.freeze([
  { id: 'plating', label: 'Shield plating', summary: 'More shields before you go down', perLevel: '+10 shields', costs: Object.freeze([150, 300, 500]) },
  { id: 'capacitor', label: 'Weapon capacitor', summary: 'Every weapon hits harder', perLevel: '+10% damage', costs: Object.freeze([200, 400, 650]) },
  { id: 'racks', label: 'Ammo racks', summary: 'Start with more pulse ammunition and carry more', perLevel: '+15% pulse ammo', costs: Object.freeze([120, 250, 400]) },
  { id: 'thrusters', label: 'Thrusters', summary: 'Faster top speed and acceleration', perLevel: '+5% speed', costs: Object.freeze([180, 350, 550]) },
]);
export const MAX_LEVEL = 3;
const HANGAR_KEY = 'descended.hangar.v1';

/** What a set of upgrade levels does to the ship.
 * @param {Partial<Record<UpgradeId, number>>} levels */
export function upgradeEffects(levels) {
  const level = /** @param {UpgradeId} id */ id => Math.max(0, Math.min(MAX_LEVEL, Math.floor(levels[id] ?? 0)));
  return {
    maxHealth: 100 + 10 * level('plating'),
    power: 1 + 0.1 * level('capacitor'),
    ammo: 1 + 0.15 * level('racks'),
    speed: 1 + 0.05 * level('thrusters'),
  };
}

/** Credits for one finished mission.
 * @param {{kills?: number, rescued?: number, logs?: number, medal?: string | null, kind?: 'first' | 'replay' | 'other'}} run */
export function creditsForRun({ kills = 0, rescued = 0, logs = 0, medal = null, kind = 'first' }) {
  const medalBonus = medal === 'gold' ? 120 : medal === 'silver' ? 50 : 0;
  const total = 50 + 10 * kills + 40 * rescued + 20 * logs + medalBonus;
  // Replays pay half and player-made levels a quarter, so nothing is worth farming.
  return Math.round(total * (kind === 'first' ? 1 : kind === 'replay' ? 0.5 : 0.25));
}

export default class Hangar {
  /** @param {() => Storage | undefined} [storageProvider] */
  constructor(storageProvider = () => globalThis.localStorage) {
    this.credits = 0; this.earned = 0;
    /** @type {Partial<Record<UpgradeId, number>>} */ this.levels = {};
    /** Missions that have paid their first-clear credits. @type {Set<string>} */ this.cleared = new Set();
    try {
      this.storage = storageProvider();
      const saved = JSON.parse(this.storage?.getItem(HANGAR_KEY) ?? 'null');
      if (saved?.version === 1) {
        this.credits = Math.max(0, Math.floor(Number(saved.credits) || 0));
        this.earned = Math.max(this.credits, Math.floor(Number(saved.earned) || 0));
        if (Array.isArray(saved.cleared)) for (const id of saved.cleared.slice(0, 200)) if (typeof id === 'string') this.cleared.add(id.slice(0, 64));
        for (const upgrade of UPGRADES) {
          const value = Math.floor(Number(saved.levels?.[upgrade.id]) || 0);
          if (value > 0) this.levels[upgrade.id] = Math.min(MAX_LEVEL, value);
        }
      }
    } catch { this.storage = undefined; }
  }

  get effects() { return upgradeEffects(this.levels); }

  /** @param {UpgradeId} id */
  level(id) { return this.levels[id] ?? 0; }

  /** The next level's price, or null at the top. @param {UpgradeId} id */
  price(id) {
    const upgrade = UPGRADES.find(value => value.id === id);
    return upgrade && this.level(id) < MAX_LEVEL ? upgrade.costs[this.level(id)] : null;
  }

  /** Note a cleared mission; true the first time (it pays full credits). @param {string} id */
  markCleared(id) {
    if (this.cleared.has(id)) return false;
    this.cleared.add(id); this.save();
    return true;
  }

  /** @param {number} amount */
  earn(amount) {
    const credits = Math.max(0, Math.round(amount));
    this.credits += credits; this.earned += credits; this.save();
    return credits;
  }

  /** Buy the next level of an upgrade. @param {UpgradeId} id */
  buy(id) {
    const price = this.price(id);
    if (price === null) throw new Error('That upgrade is already at its top level.');
    if (price > this.credits) throw new Error(`Not enough credits: ${price} needed.`);
    this.credits -= price; this.levels[id] = this.level(id) + 1; this.save();
    return this.levels[id];
  }

  /** Sell everything back at full price (for players who want the stock ship again). */
  refund() {
    for (const upgrade of UPGRADES) for (let i = 0; i < this.level(upgrade.id); i++) this.credits += upgrade.costs[i];
    this.levels = {}; this.save();
  }

  save() {
    try { this.storage?.setItem(HANGAR_KEY, JSON.stringify({ version: 1, credits: this.credits, earned: this.earned, levels: this.levels, cleared: [...this.cleared] })); return true; }
    catch { return false; }
  }
}
