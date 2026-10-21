import { test as base, expect } from '@playwright/test';
import { openClockedGame, advanceUntil } from '../helpers/browser-clock.mjs';
import { FlightController } from '../helpers/browser-flight.mjs';
import { aimAt, faceForward, readFlight } from '../helpers/browser-aim.mjs';

const test = base.extend({ cleanBrowser: [async ({ page }, use) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(); expect(errors).toEqual([]);
}, { auto: true }] });
const button = (page, name) => page.getByRole('button', { name, exact: true });

async function fly(page, axis, target) {
  const keys = [['a', 'd'], ['ShiftLeft', 'Space'], ['w', 's']][axis], controller = new FlightController(target);
  let held = null;
  try {
    await advanceUntil(page, async () => {
      const state = await readFlight(page);
      if (state.phase === 'completed') return true;
      if (state.phase !== 'playing') throw new Error(`Flight interrupted: ${state.phase}`);
      if (Math.abs(state.position[axis] - target) < 0.35 && state.speed < 0.12) return true;
      const command = controller.update(state.position[axis], state.velocity[axis], state.timeMs), next = command > 0 ? keys[1] : command < 0 ? keys[0] : null;
      if (next !== held) { if (held) await page.keyboard.up(held); if (next) await page.keyboard.down(next); held = next; }
      return false;
    }, { ticks: 500, message: `Native flight did not reach axis ${axis} = ${target}` });
    if (held) { await page.keyboard.up(held); held = null; }
    await advanceUntil(page, async () => { const state = await readFlight(page); return state.phase === 'completed' || state.speed < 0.025; }, { ticks: 40 });
  } finally { if (held) await page.keyboard.up(held); }
}

async function defeat(page, id) {
  for (let burst = 0; burst < 4; burst++) {
    await advanceUntil(page, async () => {
      const fighter = (await readFlight(page)).fighters.find(enemy => enemy.id === id);
      return !fighter || fighter.phase === 'windup';
    }, { ticks: 100, message: `${id} must provide an attack warning` });
    if (!(await readFlight(page)).fighters.some(enemy => enemy.id === id)) return;
    await aimAt(page, state => state.fighters.find(enemy => enemy.id === id)?.position);
    for (let shot = 0; shot < 5; shot++) await page.keyboard.press('f');
    for (let tick = 0; tick < 12; tick++) await page.clock.fastForward(100);
    if (!(await readFlight(page)).fighters.some(enemy => enemy.id === id)) return;
  }
  throw new Error(`Native aimed pulse fire did not defeat ${id}`);
}

test('development: mobile fighter drill warns, damages, pauses, clears, flies the loop and replays with native input', async ({ page }, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 960, height: 540 }); await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#select-level-btn').click(); await page.locator('.mission-library summary').click();
  await button(page, 'Fighter Proving Ground').press('Enter'); await page.clock.fastForward(100);
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(100);
  const start = await readFlight(page), first = start.fighters.find(enemy => enemy.id === 'drill:floor-fighter');
  let moved;
  await advanceUntil(page, async () => {
    const state = await readFlight(page), fighter = state.fighters.find(enemy => enemy.id === first.id);
    if (fighter?.motion === 'strafe' && Math.abs(fighter.position[0] - first.position[0]) > 0.3 && Math.abs(fighter.position[1] - first.position[1]) > 0.1) { moved = fighter; return true; }
    return false;
  }, { ticks: 30, message: 'The fighter must move sideways and vertically before committing to fire' });
  expect(moved.decisions).toBeLessThan(5);
  await page.clock.runFor(32); await page.screenshot({ path: info.outputPath('fighter-strafe.png') });
  await page.keyboard.press('Escape'); const paused = await readFlight(page);
  for (let tick = 0; tick < 20; tick++) await page.clock.fastForward(100);
  const still = await readFlight(page); expect(still.fighters).toEqual(paused.fighters); expect(still.timeMs).toBe(paused.timeMs);
  await button(page, 'CONTINUE').press('Enter');
  await advanceUntil(page, async () => (await readFlight(page)).fighters.find(enemy => enemy.id === first.id)?.phase === 'recover', { ticks: 50 });
  await advanceUntil(page, async () => parseInt(await page.locator('#health-percentage').textContent(), 10) < 100, { ticks: 50 });
  await defeat(page, first.id); await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 1/2');
  await faceForward(page);
  await fly(page, 2, 0); await fly(page, 0, 18); await fly(page, 2, -18);
  await defeat(page, 'drill:bay-fighter'); await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 2/2');
  await faceForward(page); await fly(page, 0, 0); await fly(page, 2, 0); await fly(page, 0, -8); await fly(page, 2, 8);
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await expect(page.locator('#score-display')).toHaveText('1200');
  await page.screenshot({ path: info.outputPath('fighter-drill-cleared.png') });
  await button(page, 'REPLAY MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
  await expect(page.locator('#health-percentage')).toHaveText('100%'); await expect(page.locator('#weapon-slot-1')).toContainText('80');
  const restarted = await readFlight(page); expect(restarted.fighters.every(enemy => enemy.decisions <= 1)).toBe(true);
  await page.keyboard.press('Escape'); await button(page, 'RETURN TO BASE').press('Enter'); await page.locator('#select-level-btn').click();
  await button(page, 'Signal Breach').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#cockpit-objective')).toContainText('SIGNAL BREACH');
});
