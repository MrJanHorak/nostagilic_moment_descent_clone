const transitions = {
  menu: ['loading'], loading: ['playing', 'error'],
  playing: ['paused', 'dead', 'completed', 'error'], paused: ['playing', 'error'],
  dead: [], completed: [], error: [],
};

// Owns phase, simulation time, and callbacks. end() invalidates every old token.
export default class GameSession {
  constructor() {
    this.phase = 'menu';
    this.id = 0;
    this.timeMs = 0;
    this.steps = 0;
    this.tasks = new Map();
    this.nextTaskId = 0;
  }

  transition(next) {
    if (next === this.phase) return false;
    if (!transitions[this.phase]?.includes(next)) throw new Error(`Invalid session transition: ${this.phase} -> ${next}`);
    this.phase = next;
    return true;
  }

  begin() {
    this.transition('loading');
    this.id++;
    this.timeMs = 0;
    this.steps = 0;
  }

  end() {
    this.id++;
    this.tasks.clear();
    this.timeMs = 0;
    this.steps = 0;
    this.phase = 'menu';
  }

  schedule(delayMs, callback) {
    if (!Number.isFinite(delayMs) || delayMs < 0 || typeof callback !== 'function') throw new TypeError('Session timer requires a nonnegative delay and callback');
    if (this.phase !== 'playing') throw new Error('Gameplay timers require an active session');
    const taskId = ++this.nextTaskId;
    this.tasks.set(taskId, { due: this.timeMs + delayMs, callback, generation: this.id });
    return taskId;
  }

  cancel(taskId) { this.tasks.delete(taskId); }

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
