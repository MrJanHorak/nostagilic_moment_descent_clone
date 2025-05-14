// Object pool for reusing objects to improve performance
class ObjectPool {
  constructor() {
    this.pools = {};
  }

  // Get an item from the pool or return null if none available
  getFromPool(poolName) {
    // Check if pool exists
    if (!this.pools[poolName] || this.pools[poolName].length === 0) {
      return null;
    }

    const object = this.pools[poolName].pop();
    return object;
  }

  // Return an object to the pool
  returnToPool(poolName, object) {
    // Defensive check for null objects
    if (!object) return;

    // Create pool if it doesn't exist
    if (!this.pools[poolName]) {
      this.pools[poolName] = [];
    }

    // Reset object to inactive state
    if (object) {
      object.visible = false;
    }

    // Add to the pool
    this.pools[poolName].push(object);
  }

  // Get or create a new pool
  getOrCreatePool(poolName) {
    if (!this.pools[poolName]) {
      this.pools[poolName] = [];
    }
    return this.pools[poolName];
  }

  // Clear a specific pool
  clearPool(poolName) {
    if (this.pools[poolName]) {
      this.pools[poolName] = [];
    }
  }

  // Clear all pools
  clearAllPools() {
    this.pools = {};
  }
}

export default ObjectPool;
