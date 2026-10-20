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
const routes = [
  ['Signal Breach', [[2, -32], [0, 20], [2, 0], [0, 0], [2, -30], 'r', [2, -56]]],
  ['Vector Foundry', [[2, -9], [1, 2], [2, -14], [1, 4], [2, -18], [1, 6], [2, -22], [1, 8], [2, -33], 'r', [2, -36], [1, 38], 'r', [0, 24]]],
  ['Nightfall Reactor', [[2, -20], 'r', [2, -24], [0, 24], [2, 0], [1, 16], 'r', [0, 53]]],
];
for (const [name, route] of routes) test(`development: campaign ${name} route, relays, extraction and replay`, async ({ page }, testInfo) => {
  test.setTimeout(300000);
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#select-level-btn').click(); await button(page, name).press('Enter'); await page.clock.fastForward(100);
  // Existing labeled development action isolates geometry/progression from combat.
  // Production combat remains covered by the ordinary-fire victory/death suite.
  await advanceUntil(page, () => button(page, 'Neutralize drones (test)').isVisible(), { ticks: 10, message: 'Development mission controls must refresh before use' });
  await button(page, 'Neutralize drones (test)').press('Enter');
  for (const step of route) {
    if (step === 'r') { await page.keyboard.press('r'); await page.clock.fastForward(100); }
    else await fly(page, step[0], step[1]);
  }
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(' ', '-').toLowerCase()}-complete.png`), fullPage: true });
  await button(page, 'REPLAY MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  await expect(page.locator('#weapon-slot-1')).toContainText('80');
  await expect(page.locator('#arena-guide')).toContainText(name.toUpperCase());
  await expect(page.locator('#arena-guide')).toContainText('Relays 0/');
  const state = JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
  expect(state.position).toEqual([0, 0, 5]);
});
