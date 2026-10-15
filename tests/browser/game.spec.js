import { test as base, expect } from '@playwright/test';
import os from 'node:os';

// Observe failures from the real browser, including errors caught by Game's recovery UI.
const test = base.extend({
  browserErrors: [async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(`page: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`http: ${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', request => {
      if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`request: ${request.url()} ${request.failure()?.errorText}`);
    });
    await use(errors);
    await testInfo.attach('browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
    expect(errors, 'page, console and asset requests must stay clean').toEqual([]);
  }, { auto: true }],
});

const button = (page, name) => page.getByRole('button', { name, exact: true });
async function chooseMission(page) {
  await page.locator('#select-level-btn').click();
  await page.getByRole('button', { name: /arena escape/i }).click();
  await expect(page.locator('#arena-guide')).toContainText('Neutralize drones 0/2');
  await expect(page.locator('#weapon-slot-1')).toContainText('40');
}
async function holdUntil(page, key, assertion) {
  await page.keyboard.down(key);
  try { await assertion(); }
  finally { await page.keyboard.up(key); }
}

test('production: keyboard mission victory, replay, enemy-fire death, reboot and menu', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await page.goto('http://127.0.0.1:5184/?smoke=1');
  await expect(page.locator('#start-game-btn')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#runtime-diagnostics')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Session smoke controls' })).toHaveCount(0);
  await chooseMission(page);

  await page.keyboard.press('f');
  await expect(page.locator('#weapon-slot-1')).toContainText('39');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'PAUSED', exact: true })).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.locator('#weapon-slot-1')).toContainText('39');
  await button(page, 'CONTINUE').click();
  for (let shot = 0; shot < 4; shot++) await page.keyboard.press('f');
  await expect(page.locator('#score-display')).toHaveText('100');
  await expect(page.locator('#weapon-slot-1')).toContainText('35');

  // Fly toward the exit; the scout pursues and rams. No state injection or test controls.
  await holdUntil(page, 'w', () => expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 2/2', { timeout: 45000 }));
  const victory = page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true });
  if (!await victory.isVisible()) {
    // At the far wall the player can be beyond the trigger; backing up crosses it.
    await holdUntil(page, 's', () => expect(victory).toBeVisible({ timeout: 10000 }));
  }
  await expect(page.locator('#score-display')).toHaveText('1100');
  await testInfo.attach('production-victory', { body: await page.screenshot(), contentType: 'image/png' });
  await button(page, 'REPLAY MISSION').click();
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  await expect(page.locator('#weapon-slot-1')).toContainText('40');
  await expect(page.locator('#score-display')).toHaveText('0');
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
  await expect(page.getByRole('heading', { name: 'SYSTEM FAILURE', exact: true })).toBeVisible({ timeout: 90000 });
  await testInfo.attach('production-loss', { body: await page.screenshot(), contentType: 'image/png' });
  await button(page, 'REBOOT').click();
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  await expect(page.locator('#weapon-slot-1')).toContainText('40');
  await expect(page.locator('#score-display')).toHaveText('0');
  await page.keyboard.press('Escape');
  await button(page, 'RETURN TO BASE').click();
  await page.locator('#start-game-btn').click();
  await expect(page.locator('#arena-guide')).toContainText('FLIGHT TRAINING');
  await page.keyboard.press('f');
  await expect(page.locator('#weapon-slot-1')).toContainText('∞');
  await page.keyboard.press('Escape');
  await button(page, 'SELECT MISSION').click();
  await expect(page.getByRole('heading', { name: 'SELECT MISSION', exact: true })).toBeVisible();
  await expect(page.locator('#arena-guide')).toHaveCount(0);
});

async function snapshot(page) {
  const value = await page.locator('#runtime-diagnostics').getAttribute('data-snapshot');
  return value ? JSON.parse(value) : null;
}
async function waitForSnapshot(page, predicate) {
  let value;
  await expect.poll(async () => { value = await snapshot(page); return !!value && predicate(value); }).toBe(true);
  return value;
}

test('development: pause freezes simulation and ten combat restarts return resources to baseline', async ({ page, browser }, testInfo) => {
  test.setTimeout(180000);
  await page.goto('http://127.0.0.1:5183/?smoke=1');
  await chooseMission(page);
  const samples = [];
  // One warm-up plus ten measured cycles, including projectile and explosion allocation.
  for (let cycle = 0; cycle <= 10; cycle++) {
    const running = await waitForSnapshot(page, value => value.phase === 'playing' && value.enemies === 2);
    await page.keyboard.press('f');
    await button(page, 'Neutralize drones (test)').press('Enter');
    await expect(page.locator('#arena-guide')).toContainText('EXIT READY');
    await page.keyboard.press('Escape');
    await button(page, 'RESTART MISSION').click();
    await waitForSnapshot(page, value => value.session !== running.session && value.phase === 'playing' && value.enemies === 2);
    await page.keyboard.press('Escape');
    const paused = await waitForSnapshot(page, value => value.phase === 'paused');
    // A second diagnostic refresh must leave simulation time and steps unchanged.
    await expect.poll(async () => (await snapshot(page))?.frames).toBeGreaterThan(paused.frames);
    const stable = await snapshot(page);
    expect(stable.timeMs).toBe(paused.timeMs);
    expect(stable.steps).toBe(paused.steps);
    expect(stable.errors).toBe(0);
    expect(stable.shots).toBe(0);
    expect(stable.pickups).toBe(2);
    expect(stable.tasks).toBe(0);
    expect(stable.resources.effectLights).toBe(0);
    expect(stable.resources.pooledEffects).toBe(0);
    samples.push({ cycle, ...stable });
    if (cycle < 10) await button(page, 'CONTINUE').click();
  }
  const baseline = samples[0].resources;
  for (const sample of samples.slice(1)) {
    for (const key of ['geometries', 'textures', 'programs']) expect(sample.resources[key], key).toBeLessThanOrEqual(baseline[key]);
    for (const key of ['objects', 'materials', 'lights']) expect(sample.resources[key], key).toBe(baseline[key]);
  }
  const report = { date: new Date().toISOString(), node: process.version, browser: browser.version(),
    platform: os.platform(), cpu: os.cpus()[0]?.model, viewport: { width: 1280, height: 720 },
    renderer: 'Chromium ANGLE SwiftShader (software)', warmupCycles: 1, measuredCycles: 10, samples };
  await testInfo.attach('restart-resources', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
});

test('production: settings persist, reset, remain isolated while paused, and fit a small viewport', async ({ page }, testInfo) => {
  await page.goto('http://127.0.0.1:5184/');
  await button(page, 'SETTINGS').click();
  const dialog = page.getByRole('dialog', { name: 'CONTROL SETTINGS' });
  const sensitivity = dialog.getByRole('slider', { name: /Mouse sensitivity/ });
  const invert = dialog.getByRole('checkbox', { name: 'Invert mouse Y' });
  await expect(sensitivity).toHaveValue('1');
  await sensitivity.press('End');
  await invert.check();
  await expect(sensitivity).toHaveValue('3');
  await expect(dialog.getByRole('status', { name: 'Settings saving status' })).toContainText('Saved on this browser');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(button(page, 'SETTINGS')).toBeFocused();

  await page.reload();
  await button(page, 'SETTINGS').click();
  await expect(sensitivity).toHaveValue('3');
  await expect(invert).toBeChecked();
  await dialog.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
  await expect(sensitivity).toHaveValue('1');
  await expect(invert).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('#start-game-btn').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'PAUSED', exact: true })).toBeVisible();
  await button(page, 'SETTINGS').click();
  await sensitivity.press('Home');
  await invert.check();
  await page.keyboard.press('f');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'PAUSED', exact: true })).toBeVisible();
  await button(page, 'RESTART MISSION').click();
  await expect(page.locator('#arena-guide')).toContainText('FLIGHT TRAINING');
  await page.keyboard.press('Escape');
  await button(page, 'SETTINGS').click();
  await expect(sensitivity).toHaveValue('0.25');
  await expect(invert).toBeChecked();
  await testInfo.attach('settings-desktop', { body: await page.screenshot(), contentType: 'image/png' });

  await page.setViewportSize({ width: 390, height: 640 });
  await dialog.getByRole('button', { name: 'Done', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(sensitivity).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Done', exact: true })).toBeFocused();
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await testInfo.attach('settings-small-viewport', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(button(page, 'SETTINGS')).toBeFocused();
  await button(page, 'RETURN TO BASE').click();
  await button(page, 'SETTINGS').click();
  await expect(sensitivity).toHaveValue('0.25');
  await expect(invert).toBeChecked();
});

test('production: blocked saving keeps live settings usable and reports the persistence limit', async ({ page }) => {
  // Fault injection only at the browser storage boundary, before the real app starts.
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () { throw new DOMException('Test storage quota', 'QuotaExceededError'); };
  });
  await page.goto('http://127.0.0.1:5184/');
  await button(page, 'SETTINGS').click();
  const dialog = page.getByRole('dialog', { name: 'CONTROL SETTINGS' });
  const sensitivity = dialog.getByRole('slider', { name: /Mouse sensitivity/ });
  await sensitivity.press('End');
  await expect(sensitivity).toHaveValue('3');
  await expect(dialog.getByRole('status', { name: 'Settings saving status' })).toContainText('could not be saved');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('#start-game-btn').click();
  await page.keyboard.press('Escape');
  await button(page, 'SETTINGS').click();
  await expect(sensitivity).toHaveValue('3');
  await page.reload();
  await button(page, 'SETTINGS').click();
  await expect(sensitivity).toHaveValue('1');
});
