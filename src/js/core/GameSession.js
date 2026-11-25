/** @type {Record<import('../contracts.js').SessionPhase, readonly import('../contracts.js').SessionPhase[]>} */
const transitions = {
  menu: ['loading'], loading: ['playing', 'error'],
  playing: ['paused', 'dead', 'completed', 'error'], paused: ['playing', 'error'],
  dead: [], completed: [], error: [],
};

import SessionRandom from './SessionRandom.js';

// Owns phase, simulation time, callbacks and gameplay randomness. end() invalidates every old token.
export default class GameSession {
  constructor() {
    /** @type {import('../contracts.js').SessionPhase} */
    this.phase = 'menu';
    this.id = 0;
    this.timeMs = 0;
    this.steps = 0;
    /** @type {Map<number, import('../contracts.js').SessionTask>} */
    this.tasks = new Map();
    this.nextTaskId = 0;
    /** Seeded gameplay randomness, reseeded by begin(). */
    this.rng = new SessionRandom();
  }

  /** The seed of the current session; replays and network matches reuse it. */
  get seed() { return this.rng.seed; }

  /** Gameplay random number in [0, 1), from this session's seed. Cosmetic effects may use Math.random. */
  random() { return this.rng.next(); }

  /** @param {import('../contracts.js').SessionPhase} next */
  transition(next) {
    if (next === this.phase) return false;
    if (!transitions[this.phase]?.includes(next)) throw new Error(`Invalid session transition: ${this.phase} -> ${next}`);
    this.phase = next;
    return true;
  }

  /** @param {number} [seed] Reuse a seed for replays or a shared match; otherwise a fresh one is drawn. */
  begin(seed) {
    this.transition('loading');
    this.id++;
    this.timeMs = 0;
    this.steps = 0;
    this.rng.reseed(seed ?? Math.floor(Math.random() * 4294967296));
  }

  end() {
    this.id++;
    this.tasks.clear();
    this.timeMs = 0;
    this.steps = 0;
    this.phase = 'menu';
  }

  /** @param {number} delayMs @param {() => void} callback */
  schedule(delayMs, callback) {
    if (!Number.isFinite(delayMs) || delayMs < 0 || typeof callback !== 'function') throw new TypeError('Session timer requires a nonnegative delay and callback');
    if (this.phase !== 'playing') throw new Error('Gameplay timers require an active session');
    const taskId = ++this.nextTaskId;
    this.tasks.set(taskId, { due: this.timeMs + delayMs, callback, generation: this.id });
    return taskId;
  }

  /** @param {number} taskId */
  cancel(taskId) { this.tasks.delete(taskId); }

  /** @param {number} deltaSeconds */
  advance(deltaSeconds) {
    if (this.phase !== 'playing') return;
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new TypeError('Invalid simulation delta');
    this.timeMs += deltaSeconds * 1000;
    this.steps++;
    const generation = this.id;
    const due = [...this.tasks.entries()].filter(([, task]) => task.due <= this.timeMs)
      .sort((a, b) => a[1].due - b[1].due || a[0] - b[0]);
    for (const [taskId, task] of due) {
      if (this.id !== generation || this.phase !== 'playing') break;
      if (!this.tasks.delete(taskId) || task.generation !== generation) continue;
      task.callback();
    }
  }
}
