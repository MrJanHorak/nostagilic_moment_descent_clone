// Development diagnostics only; bounded samples, with no references retained to scene objects.
export class FrameMetrics {
  constructor(limit = 240) {
    this.limit = limit;
    this.intervals = [];
    this.work = [];
    this.previous = null;
  }

  record(now, workMs) {
    if (!Number.isFinite(now)) return;
    const interval = this.previous === null ? 0 : now - this.previous;
    if (interval > 0) this.intervals.push(interval);
    this.previous = now;
    if (Number.isFinite(workMs) && workMs >= 0) this.work.push(workMs);
    if (this.intervals.length > this.limit) this.intervals.shift();
    if (this.work.length > this.limit) this.work.shift();
  }

  snapshot() {
    const percentile = (values, fraction) => {
      if (!values.length) return null;
      const sorted = [...values].sort((a, b) => a - b);
      return Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(2));
    };
    return { samples: this.intervals.length, p50FrameMs: percentile(this.intervals, 0.5),
      p95FrameMs: percentile(this.intervals, 0.95), p95WorkMs: percentile(this.work, 0.95) };
  }
}

export function collectResources(game) {
  const info = game?.renderer?.info;
  const materials = new Set();
  let objects = 0, lights = 0;
  game?.scene?.traverse(object => {
    objects++;
    if (object.isLight) lights++;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material);
    }
  });
  const effects = game?.enemyManager?.effectsManager;
  return {
    geometries: info?.memory.geometries ?? 0, textures: info?.memory.textures ?? 0,
    programs: info?.programs?.length ?? 0, calls: info?.render.calls ?? 0,
    triangles: info?.render.triangles ?? 0, points: info?.render.points ?? 0,
    objects, lights, materials: materials.size,
    effectLights: (effects?.activeHitLights.length ?? 0) + (effects?.activeExplosionLights.length ?? 0),
    pooledEffects: Object.values(effects?.objectPool.pools ?? {}).reduce((sum, pool) => sum + pool.length, 0),
  };
}
