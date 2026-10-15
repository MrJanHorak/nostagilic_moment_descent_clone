import * as THREE from 'three';
import createFlightArena from './FlightArena.js';

// Small clear-and-extract mission using the proven training geometry.
export default function createCombatArena() {
  return Object.freeze({
    ...createFlightArena(),
    id: 'combat-arena', name: 'Arena Escape',
    combat: Object.freeze({ pulseDamage: 5, initialPulseAmmo: 40, maxPulseAmmo: 80 }),
    mission: Object.freeze({
      type: 'clear-and-exit',
      requiredEnemyIds: Object.freeze(['combat:fighter', 'combat:scout']),
      exit: Object.freeze({ id: 'arena:exit', position: Object.freeze([0, 0, -24]), radius: 1.5 }),
    }),
    enemySpawns: Object.freeze([
      Object.freeze({ id: 'combat:fighter', enemyType: 'fighter', position: Object.freeze(new THREE.Vector3(0, 0, -18)) }),
      Object.freeze({ id: 'combat:scout', enemyType: 'scout', position: Object.freeze(new THREE.Vector3(-6, 0, -18)) }),
    ]),
    powerupSpawns: Object.freeze([
      Object.freeze({ id: 'arena:ammo', powerupType: 'pulseAmmo', position: Object.freeze(new THREE.Vector3(-3, 0, 1)) }),
      Object.freeze({ id: 'arena:health', powerupType: 'health', position: Object.freeze(new THREE.Vector3(-4, -2, -20)) }),
    ]),
  });
}
