/** A small seeded random generator (mulberry32). The same seed always yields the
 * same sequence, so two simulations given the same seed and inputs agree. */
export default class SessionRandom {
  /** @param {number} [seed] */
  constructor(seed = 1) { this.seed = 0; this.state = 0; this.reseed(seed); }
  /** @param {number} seed */
  reseed(seed) {
    if (!Number.isFinite(seed)) throw new TypeError('Random seed must be a finite number');
    this.seed = seed >>> 0; this.state = this.seed;
  }
  /** Uniform in [0, 1), like Math.random. */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
