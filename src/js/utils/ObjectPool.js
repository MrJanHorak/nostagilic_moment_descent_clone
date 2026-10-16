/** A bounded cache of detached objects. Active objects are owned by the caller.
 * @template {Record<string, import('three').Object3D>} T
 */
class ObjectPool {
  /** @param {{maxPerPool?: number, onDiscard: (object: T[keyof T]) => void}} options */
  constructor({ maxPerPool = 32, onDiscard }) {
    if (!Number.isSafeInteger(maxPerPool) || maxPerPool < 0) {
      throw new RangeError('Pool capacity must be a nonnegative safe integer');
    }
    this.maxPerPool = maxPerPool;
    this.onDiscard = onDiscard;
    /** @private @type {Partial<{[K in keyof T]: T[K][]}>} */
    this.storage = {};
    /** @private @type {Set<T[keyof T]>} */
    this.retained = new Set();
  }

  /** Readonly diagnostic view; callers must use return/get to transfer ownership.
   * @returns {Readonly<Partial<{[K in keyof T]: readonly T[K][]}>>} */
  get pools() { return this.storage; }

  /** @template {keyof T} K
   * @param {K} poolName
   * @returns {T[K] | null} */
  getFromPool(poolName) {
    const object = this.storage[poolName]?.pop();
    if (!object) return null;
    this.retained.delete(object);
    return object;
  }

  /** Duplicate returns are rejected without destroying the retained object.
   * Overflow transfers directly to onDiscard instead of retaining peak load.
   * @template {keyof T} K
   * @param {K} poolName
   * @param {T[K] | null} object
   * @returns {boolean} */
  returnToPool(poolName, object) {
    if (!object || this.retained.has(object)) return false;
    object.visible = false;
    const pool = this.storage[poolName] ?? (this.storage[poolName] = []);
    if (pool.length >= this.maxPerPool) {
      this.onDiscard(object);
      return false;
    }
    pool.push(object);
    this.retained.add(object);
    return true;
  }

  /** Detach all ownership before invoking disposal callbacks in the caller.
   * @returns {T[keyof T][]} */
  drainAll() {
    const objects = [...this.retained];
    this.storage = {};
    this.retained.clear();
    return objects;
  }

  /** @template {keyof T} K
   * @param {K} poolName */
  clearPool(poolName) {
    const objects = this.storage[poolName] ?? [];
    delete this.storage[poolName];
    for (const object of objects) this.retained.delete(object);
    for (const object of objects) this.onDiscard(object);
  }

  clearAllPools() {
    for (const object of this.drainAll()) this.onDiscard(object);
  }
}

export default ObjectPool;
