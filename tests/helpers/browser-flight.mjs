// Test steering only. The ship coasts by 0.96 per 60 Hz step, so its remaining
// no-thrust displacement is v * (1/60) * .96/(1-.96) = v * .4.
export function flightCommand(position, velocity, target) {
  const coastError = target - position - velocity * 0.4;
  if (Math.abs(coastError) < 0.2) return 0;
  if (Math.abs(velocity) > 2 && Math.sign(velocity) === Math.sign(coastError)) return 0;
  return Math.sign(coastError);
}

export class FlightController {
  constructor(target) { this.target = target; this.mode = 'coast'; this.until = 0; }

  update(position, velocity, timeMs) {
    const error = this.target - position;
    if (Math.abs(error) >= 2) { this.mode = 'coast'; return flightCommand(position, velocity, this.target); }
    if (this.mode === 'pulse') {
      if (timeMs < this.until) return this.direction;
      this.mode = 'coast'; this.until = timeMs + 300;
      return 0;
    }
    // Near the target, let an observed impulse coast before another one. The
    // pulse lasts simulation time, so even a 4 FPS renderer receives input.
    if (timeMs < this.until || Math.abs(velocity) > 0.1 || Math.abs(error) < 0.2) return 0;
    this.mode = 'pulse'; this.until = timeMs + 50; this.direction = Math.sign(error);
    return this.direction;
  }
}
