import * as THREE from 'three';
import createFlightArena from './FlightArena.js';

// Deliberately small encounter using the proven training geometry.
export default function createCombatArena() {
  return Object.freeze({
    ...createFlightArena(),
    id: 'combat-arena', name: 'Combat Training Arena',
    combat: Object.freeze({ pulseDamage: 5 }),
    enemySpawns: Object.freeze([
      Object.freeze({ id: 'combat:fighter', enemyType: 'fighter', position: Object.freeze(new THREE.Vector3(0, 0, -18)) }),
      Object.freeze({ id: 'combat:scout', enemyType: 'scout', position: Object.freeze(new THREE.Vector3(-6, 0, -18)) }),
    ]),
  });
}
