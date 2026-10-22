import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { openClockedGame, advanceUntil } from '../helpers/browser-clock.mjs';
import { FlightController } from '../helpers/browser-flight.mjs';
import { aimAt, faceForward, readFlight } from '../helpers/browser-aim.mjs';

const test = base.extend({ cleanBrowser: [async ({ page }, use) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(); expect(errors).toEqual([]);
}, { auto: true }] });
const button = (page, name) => page.getByRole('button', { name, exact: true });

for (const approach of ['direct', 'overhead']) test(`development: Crossfire Relay ${approach} approach, mixed combat, supply loop, extraction and replay use ordinary input`, async ({ page }, info) => {
  test.setTimeout(240000);
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#select-level-btn').click(); await page.locator('.mission-library summary').click();
  await button(page, 'Crossfire Relay').press('Enter'); await page.clock.fastForward(100);
  const metrics = { approach, shots: 0, laserShots: 0, minimumShields: 100, rooms: new Set(), scoutPhases: new Set(), fighterPhases: new Set() };
  async function observe() {
    const state = await readFlight(page), shields = parseInt(await page.locator('#health-percentage').textContent(), 10);
    metrics.minimumShields = Math.min(metrics.minimumShields, shields);
    metrics.rooms.add(await page.locator('#cockpit-instruments').getAttribute('data-room'));
    for (const scout of state.scouts) metrics.scoutPhases.add(scout.phase);
    for (const fighter of state.fighters) metrics.fighterPhases.add(fighter.phase);
    if (!['playing', 'completed', 'paused'].includes(state.phase)) throw new Error(`Encounter interrupted: ${state.phase}, shields ${shields}`);
    return state;
  }
  async function fly(axis, target) {
    const keys = [['a', 'd'], ['ShiftLeft', 'Space'], ['w', 's']][axis], controller = new FlightController(target);
    let held = null;
    try {
      await advanceUntil(page, async () => {
        const state = await observe();
        if (state.phase === 'completed') return true;
        if (Math.abs(state.position[axis] - target) < 0.35 && state.speed < 0.12) return true;
        const command = controller.update(state.position[axis], state.velocity[axis], state.timeMs), next = command > 0 ? keys[1] : command < 0 ? keys[0] : null;
        if (next !== held) { if (held) await page.keyboard.up(held); if (next) await page.keyboard.down(next); held = next; }
        return false;
      }, { ticks: 500, message: `Crossfire ${approach}: axis ${axis} did not reach ${target}` });
      if (held) { await page.keyboard.up(held); held = null; }
      await advanceUntil(page, async () => { const state = await observe(); return state.phase === 'completed' || state.speed < 0.025; }, { ticks: 40 });
    } finally { if (held) await page.keyboard.up(held); }
  }
  async function defeat(type) {
    const key = type === 'scout' ? 'scouts' : 'fighters';
    for (let burst = 0; burst < 5; burst++) {
      if (!(await observe())[key].length) return;
      await advanceUntil(page, async () => {
        const enemy = (await observe())[key][0];
        return !enemy || enemy.phase === 'windup' || enemy.phase === 'recover';
      }, { ticks: 80, message: `${type} must expose its authored attack window` });
      if (!(await observe())[key].length) return;
      await aimAt(page, state => state[key][0]?.position);
      for (let shot = 0; shot < (type === 'scout' ? 4 : 8); shot++) { await page.keyboard.press('f'); metrics.shots++; }
      for (let tick = 0; tick < 12; tick++) { await page.clock.fastForward(100); await observe(); }
    }
    throw new Error(`Ordinary aimed fire failed to defeat ${type}`);
  }

  for (let tick = 0; tick < 100; tick++) await page.clock.fastForward(100);
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
  await fly(2, 0); await fly(0, 0);
  if (approach === 'overhead') {
    await fly(1, 21); await fly(2, -32);
    await page.keyboard.press('m'); await page.clock.runFor(32);
    await page.screenshot({ path: info.outputPath('crossfire-overhead-map.png') }); await page.keyboard.press('m');
    // Use the upper firing angle before descending. Nearby scouts can now
    // pursue the fighter's sighting report even before they see the ship.
  } else await fly(2, -21); // Engage from doorway cover instead of flying onto a charging guard.
  await advanceUntil(page, async () => {
    const state = await observe();
    return state.fighters.some(enemy => enemy.phase !== 'idle');
  }, { ticks: 100, message: `The ${approach} route must engage its visible threats` });
  await page.keyboard.press('Escape'); const paused = await readFlight(page);
  for (let tick = 0; tick < 10; tick++) await page.clock.fastForward(100);
  const still = await readFlight(page); expect(still.timeMs).toBe(paused.timeMs);
  expect(still.scouts).toEqual(paused.scouts); expect(still.fighters).toEqual(paused.fighters);
  await button(page, 'CONTINUE').press('Enter');
  await page.clock.runFor(32); await page.screenshot({ path: info.outputPath(`crossfire-${approach}-combat.png`) });
  if (approach === 'overhead') {
    await defeat('fighter'); await defeat('scout'); await faceForward(page); await fly(1, 0);
  } else { await defeat('fighter'); await defeat('scout'); }
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 2/2');
  await expect(page.locator('#score-display')).toHaveText('150');
  await faceForward(page);
  if (approach === 'overhead') {
    const salvage = (await readFlight(page)).salvage.find(item => item.type === 'laserSalvage');
    // The descent may already have collected it. Otherwise fly into the real
    // drop; both paths use ordinary movement, followed by 2 to select and F.
    if (salvage) { await fly(2, salvage.position[2]); await fly(0, salvage.position[0]); await fly(1, salvage.position[1]); }
    await expect(page.locator('#weapon-slot-2')).toContainText('12');
    await page.keyboard.press('2'); await page.keyboard.press('f'); await page.clock.fastForward(100);
    metrics.laserShots++;
    await expect(page.locator('#weapon-slot-2')).toContainText('11');
    await expect(page.locator('#cockpit-instruments')).toContainText('Selected laser');
    await page.clock.runFor(32); await page.screenshot({ path: info.outputPath('crossfire-laser-salvage.png') });
    await page.keyboard.press('1'); await fly(1, 0); await fly(0, 0);
  }
  await fly(2, -29); await fly(0, -6);
  await page.keyboard.press('r'); await page.clock.fastForward(100);
  await expect(page.locator('#cockpit-objective')).toHaveText('CROSSFIRE RELAY · EXIT READY');
  await fly(0, 0); await fly(2, -32); await fly(0, 22); await fly(2, -4); await fly(2, 0); await fly(0, 0);
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-room', 'arrival');
  await fly(0, -6); await fly(2, 6);
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await expect(page.locator('#score-display')).toHaveText('1150'); expect(await button(page, 'NEXT MISSION').count()).toBe(0);
  const complete = await observe();
  expect(metrics.shots).toBeLessThan(40); expect(metrics.minimumShields).toBeGreaterThan(0);
  expect(metrics.rooms.has('supply-bay')).toBe(true);
  if (approach === 'overhead') expect(metrics.rooms.has('overhead-gallery')).toBe(true);
  const record = { approach, pulseShots: metrics.shots, laserShots: metrics.laserShots, minimumShields: metrics.minimumShields,
    completionSeconds: complete.timeMs / 1000, rooms: [...metrics.rooms], scoutPhases: [...metrics.scoutPhases], fighterPhases: [...metrics.fighterPhases],
    evidence: 'software renderer, controlled application clock, ordinary keyboard input with read-only diagnostics; not human balance or hardware performance' };
  await writeFile(info.outputPath('crossfire-playthrough.json'), JSON.stringify(record, null, 2));
  await info.attach('crossfire-playthrough', { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath(`crossfire-${approach}-complete.png`) });
  await button(page, 'REPLAY MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
  await expect(page.locator('#health-percentage')).toHaveText('100%'); await expect(page.locator('#weapon-slot-1')).toContainText('40');
  await expect(page.locator('#cockpit-objective')).toHaveText('CROSSFIRE RELAY · RELAYS 0/1');
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-visited', '1');
  await expect(page.locator('#score-display')).toHaveText('0');
  await expect(page.locator('#cockpit-instruments')).toContainText('2 laser: locked');
  expect((await readFlight(page)).salvage).toEqual([]);
});
