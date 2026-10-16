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

// A finite active-play window. Pauses, terminal phases and new sessions invalidate it.
export class ProfileCapture {
  constructor(durationMs = 10000, limit = 6000) {
    this.durationMs = durationMs;
    this.limit = limit;
    this.result = { status: 'idle' };
  }

  start(state, now, resources) {
    if (state.session.phase !== 'playing' || this.result.status === 'running') return false;
    this.metrics = new FrameMetrics(this.limit);
    this.startedAt = now;
    this.startedTimeMs = state.session.timeMs;
    this.result = { status: 'running', session: state.session.id, frames: 0, elapsedMs: 0,
      fromResources: resources };
    return true;
  }

  cancel(reason) {
    if (this.result.status !== 'running') return;
    this.result.status = 'aborted';
    this.result.reason = reason;
  }

  record(state, now, workMs, resources) {
    if (this.result.status !== 'running') return;
    if (state.session.phase !== 'playing' || state.session.id !== this.result.session) {
      this.cancel('Session or phase changed during capture');
      return;
    }
    this.metrics.record(now, workMs);
    this.result.frames++;
    this.result.elapsedMs = Number((now - this.startedAt).toFixed(2));
    if (now - this.startedAt >= this.durationMs) {
      this.result.status = 'complete';
      this.result.timing = this.metrics.snapshot();
      this.result.truncated = this.result.frames > this.limit;
      this.result.simulationDeltaMs = Number((state.session.timeMs - this.startedTimeMs).toFixed(2));
      this.result.toResources = resources();
    }
  }
}

export function collectResources(game) {
  const info = game?.renderer?.info;
  const materials = new Set();
  const geometries = new Set();
  let objects = 0, lights = 0;
  game?.scene?.traverse(object => {
    objects++;
    if (object.isLight) lights++;
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) materials.add(material);
    }
  });
  const effects = game?.enemyManager?.effectsManager;
  // WebGL uploads geometry lazily after frustum culling. Bound GPU allocations
  // by actual live scene resources plus explicitly manager-owned shot caches.
  const geometryBudget = new Set(geometries);
  for (const manager of [game?.projectileManager, game?.enemyManager?.projectileManager]) {
    for (const geometry of Object.values(manager?.projectileGeometries ?? {})) if (geometry) geometryBudget.add(geometry);
  }
  return {
    geometries: info?.memory.geometries ?? 0, textures: info?.memory.textures ?? 0,
    programs: info?.programs?.length ?? 0, calls: info?.render.calls ?? 0,
    triangles: info?.render.triangles ?? 0, points: info?.render.points ?? 0,
    objects, lights, materials: materials.size,
    sceneGeometries: geometries.size, geometryBudget: geometryBudget.size,
    effectLights: (effects?.activeHitLights.length ?? 0) + (effects?.activeExplosionLights.length ?? 0),
    pooledEffects: Object.values(effects?.objectPool.pools ?? {}).reduce((sum, pool) => sum + pool.length, 0),
  };
}
