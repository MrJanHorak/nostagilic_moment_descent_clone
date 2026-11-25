/** One pilot in a session: their ship and everything that belongs to them alone
 * (shields, weapons, ammunition, timed boosts). Shared progress such as score,
 * kills and difficulty stays on GameState. Field names match the loadout fields
 * that firing and pickups already read, so a Pilot can stand in for GameState there. */

/** @returns {import('../contracts.js').WeaponInventory} */
export function createWeaponInventory() {
  return {
    pulse: { unlocked: true, ammo: Infinity },
    laser: { unlocked: false, ammo: 0 },
    missile: { unlocked: false, ammo: 0 },
    plasma: { unlocked: false, ammo: 0 },
  };
}

export default class Pilot {
  /** @param {{id: string, local?: boolean, ship?: import('../entities/Spaceship.js').default | null, maxHealth?: number}} options */
  constructor({ id, local = false, ship = null, maxHealth = 100 }) {
    if (typeof id !== 'string' || !id) throw new TypeError('A pilot needs an id');
    this.id = id;
    /** Only the local pilot drives this screen's HUD, audio and camera effects. */
    this.local = local;
    /** @type {import('../entities/Spaceship.js').default | null} */
    this.ship = ship;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.alive = true;
    /** Robots this pilot destroyed this session (kill credit for scoring and later modes). */
    this.kills = 0;
    /** @type {import('../contracts.js').WeaponType} */
    this.currentWeapon = 'pulse';
    /** @type {import('../contracts.js').WeaponInventory} */
    this.weaponInventory = createWeaponInventory();
    this.pulseAmmoCapacity = Infinity;
    this.speedMultiplier = 1;
    this.weaponPower = 1;
    /** @type {Map<import('../contracts.js').TimedModifier, number>} */
    this.modifierTimers = new Map();
    /** The flight command this pilot is holding; replaced whenever a new one arrives.
     * The local pilot is flown by InputManager instead. @type {import('../contracts.js').FlightInput} */
    this.input = {};
  }

  /** World position of the ship's authoritative root (not its camera shake). */
  get position() { return this.ship?.group.position ?? null; }
  get radius() { return this.ship?.radius ?? 0.5; }
  get velocity() { return this.ship?.velocity ?? null; }

  resetWeapons() {
    this.pulseAmmoCapacity = Infinity;
    this.currentWeapon = 'pulse';
    this.weaponInventory = createWeaponInventory();
  }

  /** @param {import('./GameSession.js').default} session */
  resetForSession(session) {
    this.health = this.maxHealth;
    this.alive = true;
    this.kills = 0;
    this.input = {};
    this.speedMultiplier = 1;
    this.weaponPower = 1;
    for (const timer of this.modifierTimers.values()) session.cancel(timer);
    this.modifierTimers.clear();
    this.resetWeapons();
  }
}
