import { test as base, expect } from '@playwright/test';
import { openClockedGame, advanceUntil } from '../helpers/browser-clock.mjs';
import { FlightController } from '../helpers/browser-flight.mjs';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});
const button = (page, name) => page.getByRole('button', { name, exact: true });

test('workbench: canvas-first layout, optional searchable scene and contextual keyboard actions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await expect(page.locator('#library-panel')).toBeHidden();
  const wide = await page.locator('#viewport canvas').boundingBox();
  await page.screenshot({ path: testInfo.outputPath('canvas-first-editor.png'), fullPage: true });
  await button(page, 'Build tools').click(); await button(page, 'Attach room').click();
  await button(page, 'Build tools').click(); await button(page, 'Scene browser').click();
  const narrow = await page.locator('#viewport canvas').boundingBox(); expect(wide.width).toBeGreaterThan(narrow.width);
  await page.getByLabel('Search scene', { exact: true }).fill('room-2');
  await expect(page.locator('#rooms button:visible')).toHaveCount(1);
  await expect(page.locator('#scene-results')).toHaveText('1 of 4 objects');
  await page.locator('#rooms').getByRole('button', { name: 'room-2 · room', exact: true }).click();
  await expect(page.locator('#inspector-selection')).toHaveText('room-2 · Room');
  await button(page, 'Scene browser').click(); await expect(page.locator('#library-panel')).toBeHidden();
  await page.locator('#viewport canvas').focus(); await page.keyboard.press('f'); await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menuitem', { name: 'Place relay here', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#viewport canvas')).toBeFocused();
  await expect(button(page, 'Undo')).toBeEnabled(); await button(page, 'Undo').click();
  await button(page, 'Scene browser').click(); await page.getByLabel('Search scene', { exact: true }).fill('');
  await expect(page.locator('#rooms button:visible')).toHaveCount(1);
});

test('production: new campaign is primary; camera, headlights and HUD persist and settings isolate shortcuts', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await openClockedGame(page, 'http://127.0.0.1:5184/');
  await page.locator('#select-level-btn').click();
  for (const title of ['Signal Breach', 'Vector Foundry', 'Nightfall Reactor']) await expect(button(page, title)).toBeVisible();
  await expect(button(page, 'Arena Escape')).toBeHidden(); await expect(page.getByRole('button', { name: /Legacy level/ })).toHaveCount(0);
  await expect(page.locator('.mission-library details button')).toHaveCount(5);
  await expect(button(page, 'ENDLESS MODE')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('new-mission-library.png'), fullPage: true });
  await button(page, 'Signal Breach').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#arena-guide')).toContainText('SIGNAL BREACH');
  await page.keyboard.press('c'); await page.clock.fastForward(100);
  await expect(page.locator('#ship-view-status')).toContainText('EXTERNAL VIEW');
  await page.screenshot({ path: testInfo.outputPath('external-ship-view.png'), fullPage: true });
  await page.keyboard.press('l'); await page.keyboard.press('h'); await page.clock.fastForward(100);
  await expect(page.locator('#ship-view-status')).toContainText('LIGHTS OFF');
  await expect(page.locator('#hud-container')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('#arena-guide')).toBeVisible();
  await page.keyboard.press('Escape'); await button(page, 'SETTINGS').press('Enter');
  const settings = page.getByRole('dialog', { name: 'GAME SETTINGS' });
  await expect(settings.getByLabel('Ship camera', { exact: true })).toHaveValue('external');
  await expect(settings.getByLabel('Ship headlights', { exact: true })).not.toBeChecked();
  await expect(settings.getByLabel('Show flight HUD', { exact: true })).not.toBeChecked();
  await page.keyboard.press('c'); await page.keyboard.press('l'); await page.keyboard.press('h');
  await expect(settings.getByLabel('Ship camera', { exact: true })).toHaveValue('external');
  await page.reload(); await button(page, 'SETTINGS').click();
  await expect(settings.getByLabel('Ship camera', { exact: true })).toHaveValue('external');
  await expect(settings.getByLabel('Ship headlights', { exact: true })).not.toBeChecked();
  await expect(settings.getByLabel('Show flight HUD', { exact: true })).not.toBeChecked();
  await settings.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('#start-game-btn').click(); await page.clock.fastForward(100);
  await expect(page.locator('#arena-guide')).toContainText('SIGNAL BREACH');
  await expect(page.locator('#ship-view-status')).toContainText('EXTERNAL VIEW');
});

async function fly(page, axis, target) {
  const keys = [['a', 'd'], ['ShiftLeft', 'Space'], ['w', 's']][axis], controller = new FlightController(target);
  let held = null, last;
  try {
    await advanceUntil(page, async () => {
      last = JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
      if (last.phase === 'completed') return true;
      if (last.phase !== 'playing') throw new Error(`Route interrupted: ${JSON.stringify(last)}`);
      if (Math.abs(last.position[axis] - target) < 0.3 && last.speed < 0.12) return true;
      const command = controller.update(last.position[axis], last.velocity[axis], last.timeMs), next = command > 0 ? keys[1] : command < 0 ? keys[0] : null;
      if (next !== held) { if (held) await page.keyboard.up(held); if (next) await page.keyboard.down(next); held = next; }
      return false;
    }, { ticks: 420, message: `Axis ${axis} did not reach ${target}: ${JSON.stringify(last)}` });
    await advanceUntil(page, async () => {
      const state = JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
      return state.phase === 'completed' || state.speed < 0.02;
    }, { ticks: 30, message: 'Residual drift must settle before the next axis' });
  } finally { if (held) await page.keyboard.up(held); }
}

test('production: cockpit instruments, firing, map, view cycle and saved selection', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openClockedGame(page, 'http://127.0.0.1:5184/');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator('#start-game-btn').click(); await page.clock.fastForward(100);
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(200);
  await expect(page.locator('#ship-view-status')).toContainText('COCKPIT VIEW');
  await expect(page.locator('#hud-container')).toHaveCSS('display', 'none');
  await expect(page.locator('#cockpit-objective')).toHaveText('SIGNAL BREACH · RELAYS 0/1');
  expect((await page.locator('#arena-guide').boundingBox()).height).toBeLessThan(46);
  await expect(page.locator('#cockpit-instruments')).toContainText('Shield 100% · Selected pulse · 1 pulse: 80');
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-visited', '1');
  await page.clock.fastForward(2200); await page.clock.runFor(100); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('cockpit.png'), animations: 'disabled' });
  await page.keyboard.press('f'); await page.clock.fastForward(300);
  await expect(page.locator('#cockpit-instruments')).toContainText('1 pulse: 79');
  await page.keyboard.press('m'); await page.clock.fastForward(200);
  await expect(page.locator('#exploration-map')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(2);
  await expect(page.locator('#exploration-map')).toContainText('1 / 11 rooms');
  await page.clock.runFor(100); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('cockpit-map.png'), animations: 'disabled' });
  await page.keyboard.press('h'); await page.clock.fastForward(100);
  await expect(page.locator('#cockpit-instruments')).toBeHidden();
  await page.keyboard.press('h'); await page.keyboard.press('m'); await page.clock.fastForward(100);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.setViewportSize({ width: 960, height: 540 }); await page.clock.fastForward(200);
  await page.clock.fastForward(2200); await page.clock.runFor(100); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('cockpit-compact.png'), animations: 'disabled' });
  await page.keyboard.press('c'); await page.clock.fastForward(100);
  await expect(page.locator('#ship-view-status')).toContainText('HUD VIEW');
  await expect(page.locator('#hud-container')).toHaveCSS('display', 'flex');
  await expect(page.locator('#cockpit-objective')).toBeHidden();
  await expect(page.locator('#arena-guide')).toContainText('Location: Blue Arrival');
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(100);
  await page.keyboard.press('Escape'); await button(page, 'SETTINGS').press('Enter');
  const settings = page.getByRole('dialog', { name: 'GAME SETTINGS' });
  await expect(settings.getByLabel('Ship camera', { exact: true })).toHaveValue('cockpit');
  await page.keyboard.press('m'); await expect(page.locator('#exploration-map')).toBeHidden();
  await page.reload(); await button(page, 'SETTINGS').click();
  await expect(settings.getByLabel('Ship camera', { exact: true })).toHaveValue('cockpit');
});
test('production: cockpit follows enemy shield damage and resets on restart', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openClockedGame(page, 'http://127.0.0.1:5184/');
  await page.locator('#select-level-btn').click(); await page.locator('.mission-library summary').click();
  await button(page, 'Arena Escape').press('Enter'); await page.clock.fastForward(100);
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(200);
  await expect(page.locator('#cockpit-objective')).toHaveText('ARENA ESCAPE · DRONES 0/2');
  await advanceUntil(page, async () => {
    const shield = parseInt(await page.locator('#health-percentage').textContent(), 10);
    if (shield <= 0) throw new Error('Ship died before the critical-shield checkpoint');
    return shield <= 30;
  }, { ticks: 900, message: 'Enemy fire must lower the live cockpit shield readout' });
  const shield = await page.locator('#health-percentage').textContent();
  await expect(page.locator('#cockpit-instruments')).toContainText(`Shield ${shield}`);
  await page.clock.runFor(32); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('cockpit-shield-warning.png'), animations: 'disabled' });
  await page.keyboard.press('Escape'); await button(page, 'RESTART MISSION').press('Enter'); await page.clock.fastForward(200);
  await expect(page.locator('#cockpit-instruments')).toContainText('Shield 100% · Selected pulse · 1 pulse: 40');
  await expect(page.locator('#cockpit-objective')).toHaveText('ARENA ESCAPE · DRONES 0/2');
});

const routes = [
  ['Signal Breach', [[2, -32], [0, 20], [2, 0], [0, 0], [2, -30], 'r', [2, -56]]],
  ['Vector Foundry', [[2, -9], [1, 2], [2, -14], [1, 4], [2, -18], [1, 6], [2, -22], [1, 8], [2, -33], 'r', [2, -36], [1, 38], 'r', [0, 24]]],
  ['Nightfall Reactor', [[2, -20], 'r', [2, -24], [0, 24], [2, 0], [1, 16], 'r', [1, 0], [0, 0], [2, 5], [0, -7]]],
];

test('development: scout warning and recovery, water contact, lava damage, pause and restart with native flight', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#select-level-btn').click(); await button(page, 'Nightfall Reactor').press('Enter'); await page.clock.fastForward(100);
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(100);
  const read = async () => JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
  await fly(page, 2, -18);
  await advanceUntil(page, async () => (await read()).scouts.some(enemy => enemy.phase === 'windup'), { ticks: 120, message: 'Visible scout must warn before striking' });
  const beforeStrike = parseInt(await page.locator('#health-percentage').textContent(), 10);
  await page.screenshot({ path: testInfo.outputPath('scout-windup.png'), animations: 'disabled' });
  await advanceUntil(page, async () => (await read()).scouts.some(enemy => enemy.phase === 'recover'), { ticks: 35, message: 'Committed scout strike must enter recovery' });
  await expect(page.locator('#health-percentage')).toHaveText(`${beforeStrike - 5}%`);
  await page.screenshot({ path: testInfo.outputPath('scout-recovery.png'), animations: 'disabled' });
  // Isolate surface/progression checks after exercising the real scout attack.
  await button(page, 'Neutralize drones (test)').press('Enter');
  await fly(page, 1, -7);
  expect((await read()).surfaceContact).toBe('water');
  const waterHealth = await page.locator('#health-percentage').textContent();
  for (let i = 0; i < 12; i++) await page.clock.fastForward(100);
  await expect(page.locator('#health-percentage')).toHaveText(waterHealth);
  await page.screenshot({ path: testInfo.outputPath('coolant-water.png'), animations: 'disabled' });
  await fly(page, 1, 0); await fly(page, 2, -20); await page.keyboard.press('r');
  await fly(page, 2, -24); await fly(page, 0, 24); await fly(page, 1, -4);
  await page.screenshot({ path: testInfo.outputPath('reactor-lava.png'), animations: 'disabled' });
  await page.keyboard.down('ShiftLeft');
  try {
    await advanceUntil(page, async () => (await read()).surfaceContact === 'lava', { ticks: 60, message: 'Descending onto the lava must reach physical contact' });
  } finally { await page.keyboard.up('ShiftLeft'); }
  expect(parseInt(await page.locator('#health-percentage').textContent(), 10)).toBeLessThan(parseInt(waterHealth, 10));
  await page.keyboard.press('Escape'); const paused = await page.locator('#health-percentage').textContent();
  for (let i = 0; i < 15; i++) await page.clock.fastForward(100);
  await expect(page.locator('#health-percentage')).toHaveText(paused);
  await button(page, 'CONTINUE').press('Enter'); await page.clock.fastForward(100); await fly(page, 1, 0);
  const safe = await page.locator('#health-percentage').textContent();
  for (let i = 0; i < 12; i++) await page.clock.fastForward(100);
  await expect(page.locator('#health-percentage')).toHaveText(safe);
  await page.keyboard.press('Escape'); await button(page, 'RESTART MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  expect((await read()).surfaceContact).toBe(null); expect((await read()).position).toEqual([0, 0, 5]);
  await testInfo.attach('environment-check', { body: JSON.stringify({ waterHealth, lavaHealth: paused, safeHealth: safe, restart: await read() }), contentType: 'application/json' });
});

test('development: Signal Breach concealed wall blocks flight, opens on a native shot and restores on restart', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#start-game-btn').click(); await page.clock.fastForward(100);
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(100);
  await fly(page, 2, 0);
  const read = async () => JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
  await page.keyboard.down('ArrowLeft');
  try {
    for (let tick = 0; tick < 70; tick++) {
      const state = await read(), yaw = 2 * Math.atan2(state.quaternion[1], state.quaternion[3]);
      if (yaw >= 1.55) break;
      if (yaw < 1.4) await page.clock.fastForward(100); else await page.clock.runFor(16);
    }
  } finally { await page.keyboard.up('ArrowLeft'); }
  const turned = await read(); expect(Math.abs(2 * Math.atan2(turned.quaternion[1], turned.quaternion[3]) - Math.PI / 2)).toBeLessThan(0.04);
  await page.clock.runFor(32); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('concealed-wall-closed.png'), animations: 'disabled' });
  await page.keyboard.down('w');
  for (let tick = 0; tick < 35; tick++) await page.clock.fastForward(100);
  await page.keyboard.up('w');
  const blocked = await read(); expect(blocked.position[0]).toBeGreaterThan(-9.05); expect(blocked.position[0]).toBeLessThan(-8.7);
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-room', 'arrival');
  await page.keyboard.press('f');
  for (let tick = 0; tick < 4; tick++) await page.clock.fastForward(100);
  await page.clock.runFor(32); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('concealed-wall-sliding.png'), animations: 'disabled' });
  for (let tick = 0; tick < 8; tick++) await page.clock.fastForward(100);
  await page.keyboard.down('w');
  try {
    await advanceUntil(page, async () => (await read()).position[0] < -13,
      { ticks: 70, message: 'Opened hidden panel must permit flight into the repair alcove' });
  } finally { await page.keyboard.up('w'); }
  for (let tick = 0; tick < 20; tick++) await page.clock.fastForward(100);
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-room', 'repair-alcove');
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-visited', '2');
  await expect(page.locator('#cockpit-instruments')).toContainText('Shield 100%');
  await page.clock.runFor(32); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('hidden-repair-alcove.png'), animations: 'disabled' });
  await page.keyboard.press('Escape'); await button(page, 'RESTART MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-visited', '1');
  await expect(page.locator('#cockpit-instruments')).toContainText('1 pulse: 80');
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-room', 'arrival');
});

test('development: Signal Breach ranged fight, overhead flank, extraction and clean restart with ordinary input', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#start-game-btn').click(); await page.clock.fastForward(100);
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(100);
  await page.keyboard.press('f');
  for (let tick = 0; tick < 15; tick++) await page.clock.fastForward(100);
  await fly(page, 2, -15);
  const attack = async () => {
    const state = JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
    return { time: state.timeMs, fighter: state.fighters.find(enemy => enemy.id === 'hall-fighter') };
  };
  await advanceUntil(page, async () => {
    const { time, fighter } = await attack();
    return fighter?.phase === 'windup' && time - fighter.since >= 300 && time - fighter.since < 550;
  }, { ticks: 100, message: 'The fighter must visibly warn before firing' });
  const charge = await attack(), shieldBeforeRelease = parseInt(await page.locator('#health-percentage').textContent(), 10);
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('fighter-windup.png'), animations: 'disabled' });
  await advanceUntil(page, async () => {
    const { time, fighter } = await attack();
    return fighter?.phase === 'recover' && fighter.firedAt >= charge.fighter.since + 650 && time - fighter.firedAt < 120;
  }, { ticks: 15, message: 'A full wind-up must release one shot with a firing flash' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('fighter-fire.png'), animations: 'disabled' });
  await advanceUntil(page, async () => {
    const { time, fighter } = await attack();
    return fighter?.phase === 'recover' && time - fighter.since >= 200 && time - fighter.since < 700;
  }, { ticks: 10, message: 'Firing must expose a visible recovery window' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('fighter-recovery.png'), animations: 'disabled' });
  await advanceUntil(page, async () => parseInt(await page.locator('#health-percentage').textContent(), 10) < shieldBeforeRelease,
    { ticks: 100, message: 'The fighter must land an ordinary projectile hit' });
  expect(parseInt(await page.locator('#health-percentage').textContent(), 10)).toBeGreaterThan(0);
  expect(parseInt(await page.locator('#health-percentage').textContent(), 10)).toBeLessThan(shieldBeforeRelease);
  await page.clock.runFor(32); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('signal-ranged-encounter.png'), animations: 'disabled' });
  for (let shot = 0; shot < 3; shot++) {
    await page.keyboard.press('f');
    for (let tick = 0; tick < 18; tick++) await page.clock.fastForward(100);
  }
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 1/2');
  await expect(page.locator('#score-display')).toHaveText('100');
  await expect(page.locator('#cockpit-instruments')).toContainText('1 pulse: 76');
  // Read flight diagnostics only; all movement, fire and interaction use normal keys.
  for (const [axis, target] of [[2, 0], [1, 21], [2, -16]]) await fly(page, axis, target);
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-room', 'overhead-gallery');
  await page.keyboard.press('m'); await page.clock.runFor(32); await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('signal-overhead-route.png'), animations: 'disabled' });
  await page.keyboard.press('m');
  for (const [axis, target] of [[2, -32], [1, 0], [2, -30]]) await fly(page, axis, target);
  await page.keyboard.press('r'); await page.clock.fastForward(100);
  await expect(page.locator('#cockpit-objective')).toHaveText('SIGNAL BREACH · EXIT READY');
  await fly(page, 2, -56);
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await button(page, 'REPLAY MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
  await expect(page.locator('#cockpit-instruments')).toContainText('Shield 100% · Selected pulse · 1 pulse: 80');
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-visited', '1');
  await expect(page.locator('#cockpit-objective')).toHaveText('SIGNAL BREACH · RELAYS 0/1');
});

for (const [name, route] of routes) test(`development: campaign ${name} route, relays, extraction and replay`, async ({ page }, testInfo) => {
  test.setTimeout(300000);
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#select-level-btn').click(); await button(page, name).press('Enter'); await page.clock.fastForward(100);
  // Existing labeled development action isolates geometry/progression from combat.
  // Production combat remains covered by the ordinary-fire victory/death suite.
  await advanceUntil(page, () => button(page, 'Neutralize drones (test)').isVisible(), { ticks: 10, message: 'Development mission controls must refresh before use' });
  await button(page, 'Neutralize drones (test)').press('Enter');
  if (name === 'Signal Breach') {
    await page.keyboard.press('f');
    for (let tick = 0; tick < 15; tick++) await page.clock.fastForward(100);
  }
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(200);
  for (const step of route) {
    if (step === 'r') {
      await page.keyboard.press('r'); await page.clock.fastForward(100);
      if (name === 'Nightfall Reactor' && await page.locator('#escape-countdown').isVisible()) {
        await expect(page.locator('#escape-countdown')).toContainText('ESCAPE 01:00');
        await page.keyboard.press('h'); await expect(page.locator('#escape-countdown')).toBeVisible();
        await page.keyboard.press('h'); await page.keyboard.press('m'); await page.clock.runFor(32);
        for (let i = 0; i < 30; i++) await page.clock.fastForward(100); // Let transient activation/view notices clear for visual review.
        await page.screenshot({ path: testInfo.outputPath('reactor-escape-map.png'), animations: 'disabled' });
        await page.keyboard.press('m');
        await page.keyboard.press('Escape'); const frozen = await page.locator('#escape-countdown').textContent();
        for (let i = 0; i < 15; i++) await page.clock.fastForward(100);
        await expect(page.locator('#escape-countdown')).toHaveText(frozen);
        await button(page, 'CONTINUE').press('Enter'); await page.clock.fastForward(100);
      }
    }
    else await fly(page, step[0], step[1]);
  }
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  expect(Number(await page.locator('#cockpit-instruments').getAttribute('data-visited'))).toBeGreaterThan(1);
  await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(' ', '-').toLowerCase()}-complete.png`), fullPage: true });
  await button(page, 'REPLAY MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  if (name === 'Nightfall Reactor') await expect(page.locator('#escape-countdown')).toBeHidden();
  await expect(page.locator('#weapon-slot-1')).toContainText('80');
  await expect(page.locator('#arena-guide')).toContainText(name.toUpperCase());
  await expect(page.locator('#arena-guide')).toContainText('Relays 0/');
  const state = JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
  expect(state.position).toEqual([0, 0, 5]);
  await expect(page.locator('#cockpit-instruments')).toHaveAttribute('data-visited', '1');
});
