// Guaranteed equipment salvage in authored mines. Mission progress never relies
// on a random roll, and special ammunition matches the defeated robot's equipment.
/** @type {Readonly<Record<import('../contracts.js').EnemyType, import('../combatContracts.js').EnemyDropType>>} */
export const MINE_SALVAGE = Object.freeze({
  scout: 'pulseAmmo', fighter: 'laserSalvage', bomber: 'missileSalvage',
  destroyer: 'plasmaSalvage', boss: 'plasmaSalvage',
});

export const SALVAGE_WEAPONS = Object.freeze({
  laser: Object.freeze({ pickup: 'laserSalvage', ammo: 12, capacity: 60, color: 0x00ffff, key: 2 }),
  missile: Object.freeze({ pickup: 'missileSalvage', ammo: 4, capacity: 20, color: 0xff8800, key: 3 }),
  plasma: Object.freeze({ pickup: 'plasmaSalvage', ammo: 8, capacity: 40, color: 0xff00ff, key: 4 }),
});
