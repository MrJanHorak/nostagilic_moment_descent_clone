import disposeObject from '../utils/disposeObject.js';

/** Remove ownership before disposal can invoke application callbacks.
 * @param {import('../combatContracts.js').EnemyInstance[]} enemies
 * @param {number} index
 * @returns {import('../combatContracts.js').EnemyInstance | null}
 */
export function removeEnemyAt(enemies, index) {
  if (!Number.isInteger(index) || index < 0 || index >= enemies.length) return null;
  const [enemy] = enemies.splice(index, 1);
  enemy.isActive = false;
  disposeObject(enemy.mesh);
  return enemy;
}

/** A session reset invalidates the entire batch before disposing any one enemy.
 * @param {import('../combatContracts.js').EnemyInstance[]} enemies
 */
export function clearEnemies(enemies) {
  const retired = enemies.splice(0);
  for (const enemy of retired) enemy.isActive = false;
  for (const enemy of retired) disposeObject(enemy.mesh);
}
