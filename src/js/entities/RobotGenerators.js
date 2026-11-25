/** Robot generators (level format v16): each wakes when a pilot enters its room and
 * releases a limited number of robots, at most `maxAlive` of its own at a time.
 * Generated robots never count toward mission objectives and drop no salvage. */

/** @typedef {{id: string, roomId: string, position: import('three').Vector3, enemyType: import('../contracts.js').EnemyType,
 *   count: number, intervalMs: number, maxAlive: number}} GeneratorDefinition */

export default class RobotGenerators {
  /** @param {readonly GeneratorDefinition[]} definitions */
  constructor(definitions) {
    /** @type {{definition: GeneratorDefinition, awake: boolean, spawned: number, nextAt: number}[]} */
    this.generators = definitions.map(definition => ({ definition, awake: false, spawned: 0, nextAt: 0 }));
  }

  /** Robots a generator has left to release. @param {string} id */
  remaining(id) {
    const entry = this.generators.find(value => value.definition.id === id);
    return entry ? entry.definition.count - entry.spawned : 0;
  }

  /** One step. `occupied` holds the rooms with a living pilot; `alive(id)` counts a
   * generator's robots still active; `spawn` creates one robot and names it.
   * @param {number} now @param {ReadonlySet<string>} occupied @param {(id: string) => number} alive
   * @param {(definition: GeneratorDefinition, name: string) => void} spawn
   * @returns {string[]} generators that woke this step */
  update(now, occupied, alive, spawn) {
    const woke = [];
    for (const entry of this.generators) {
      const { definition } = entry;
      if (!entry.awake) {
        if (!occupied.has(definition.roomId)) continue;
        entry.awake = true; entry.nextAt = now; woke.push(definition.id);
      }
      if (entry.spawned >= definition.count || now < entry.nextAt || alive(definition.id) >= definition.maxAlive) continue;
      entry.spawned++; entry.nextAt = now + definition.intervalMs;
      spawn(definition, `${definition.id}#${entry.spawned}`);
    }
    return woke;
  }
}
