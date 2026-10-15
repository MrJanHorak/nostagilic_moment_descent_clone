// Bounded 60 Hz simulation. Excess wall time is discarded after a stall.
export default class SimulationStepper {
  constructor() { this.step = 1 / 60; this.maxFrame = 0.1; this.accumulator = 0; }
  reset() { this.accumulator = 0; }
  /** @param {number} delta @param {(step: number) => boolean | void} update */
  advance(delta, update) {
    if (!Number.isFinite(delta) || delta < 0) return;
    this.accumulator += Math.min(delta, this.maxFrame);
    let count = 0;
    while (this.accumulator + 1e-10 >= this.step && count < 6) {
      this.accumulator = Math.max(0, this.accumulator - this.step);
      count++;
      if (update(this.step) === false) { this.reset(); break; }
    }
  }
}
