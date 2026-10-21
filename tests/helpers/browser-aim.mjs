import { Quaternion, Vector3 } from 'three';

export const readFlight = async page => JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));

// Test controller: read-only diagnostics feed ordinary arrow/Q/E keys. No game
// transform writes, pointer injection, enemy damage calls or application hooks.
async function steer(page, error, tolerance) {
  let held = new Set();
  try {
    for (let tick = 0; tick < 250; tick++) {
      const state = await readFlight(page);
      if (state.phase !== 'playing') throw new Error(`Aim interrupted: ${state.phase}`);
      const angles = error(state);
      if (!angles || angles.every(value => Math.abs(value) < tolerance)) return;
      const keys = [['ArrowDown', 'ArrowUp'], ['ArrowRight', 'ArrowLeft'], ['e', 'q']];
      const next = new Set(angles.flatMap((value, axis) => Math.abs(value) < tolerance ? [] : [keys[axis][value > 0 ? 1 : 0]]));
      for (const key of held) if (!next.has(key)) await page.keyboard.up(key);
      for (const key of next) if (!held.has(key)) await page.keyboard.down(key);
      held = next; await page.clock.fastForward(20);
    }
    throw new Error('Native keyboard aim failed to settle');
  } finally { for (const key of held) await page.keyboard.up(key); }
}

export async function aimAt(page, point, tolerance = 0.025) {
  await steer(page, state => {
    const target = typeof point === 'function' ? point(state) : point;
    if (!target) return null;
    const local = new Vector3(...target).sub(new Vector3(...state.position)).applyQuaternion(new Quaternion(...state.quaternion).invert());
    return [Math.atan2(local.y, Math.hypot(local.x, local.z)), Math.atan2(-local.x, -local.z), 0];
  }, tolerance);
}

export async function faceForward(page) {
  await steer(page, state => {
    const error = new Quaternion(...state.quaternion).invert(), sign = error.w < 0 ? -1 : 1;
    return [error.x * sign * 2, error.y * sign * 2, error.z * sign * 2];
  }, 0.018);
}
