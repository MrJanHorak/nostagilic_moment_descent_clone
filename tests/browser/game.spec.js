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
async function chooseMine(page) {
  await page.locator('#select-level-btn').click();
  await button(page, 'Mine Link Prototype').click();
  await expect(page.locator('#arena-guide')).toContainText('MINE LINK PROTOTYPE');
  await expect(page.locator('#arena-guide')).toContainText('ceiling hatch');
  await expect(page.locator('#weapon-slot-1')).toContainText('60');
}
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

test('production: JSON mine is selectable and resets its initial encounter and inventory', async ({ page }, testInfo) => {
  await page.goto('http://127.0.0.1:5184/');
  await chooseMine(page);
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
  await expect(page.locator('#runtime-diagnostics')).toHaveCount(0);
  await testInfo.attach('mine-start', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('f'); await expect(page.locator('#weapon-slot-1')).toContainText('59');
  await page.keyboard.press('Escape'); await button(page, 'RESTART MISSION').click();
  await expect(page.locator('#weapon-slot-1')).toContainText('60');
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  await expect(page.locator('#score-display')).toHaveText('0');
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
});

// Read diagnostics to steer real keyboard input; never inject a player position.
async function flyMineAxis(page, axis, target) {
  const keys = [['a', 'd'], ['ShiftLeft', 'Space'], ['w', 's']][axis];
  let previous = await snapshot(page), estimatedVelocity = 0, held = null;
  try {
    await expect.poll(async () => {
      const value = await snapshot(page);
      if (value.phase !== 'playing') return true;
      if (value.timeMs > previous.timeMs) {
        estimatedVelocity = (value.position[axis] - previous.position[axis]) / ((value.timeMs - previous.timeMs) / 1000);
        previous = value;
      }
      const error = target - value.position[axis];
      if (Math.abs(error) < 0.3 && value.speed < 0.4) return true;
      // Limit cruise speed and counter-thrust before a turn. Diagnostic reads
      // are 250 ms apart, so use their simulation timestamps to estimate drift.
      const desiredVelocity = Math.max(-3, Math.min(3, error));
      const correction = desiredVelocity - estimatedVelocity;
      const deadband = Math.abs(error) < 1 ? 0.15 : 0.7;
      const next = correction > deadband ? keys[1] : correction < -deadband ? keys[0] : null;
      if (next !== held) {
        if (held) await page.keyboard.up(held);
        if (next) await page.keyboard.down(next);
        held = next;
      }
      return false;
    }, { timeout: 30000, intervals: [100] }).toBe(true);
  } finally { if (held) await page.keyboard.up(held); }
  // Drift persists while another thrust axis is held, so settle before turning.
  await expect.poll(async () => { const value = await snapshot(page); return value.phase !== 'playing' || value.speed < 0.03; },
    { timeout: 7000, intervals: [100] }).toBe(true);
}

test('development: JSON mine loop and vertical hatch fly both ways, complete and replay', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await page.goto('http://127.0.0.1:5183/?smoke=1'); await chooseMine(page);
  const initial = await waitForSnapshot(page, value => value.phase === 'playing' && value.enemies === 2);
  await button(page, 'Neutralize drones (test)').press('Enter');
  await expect(page.locator('#arena-guide')).toContainText('EXIT READY');
  const samples = [];
  for (const [axis, target] of [[2, 0], [2, -16], [0, 16], [2, 0], [0, 0], [0, 16], [1, 12], [1, 0], [1, 12], [2, -4]]) {
    await flyMineAxis(page, axis, target); const value = await snapshot(page);
    samples.push({ axis, target, position: value.position, phase: value.phase, errors: value.errors });
  }
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await expect(page.locator('#score-display')).toHaveText('1150');
  await testInfo.attach('mine-traversal', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  await testInfo.attach('mine-complete', { body: await page.screenshot(), contentType: 'image/png' });
  await button(page, 'REPLAY MISSION').click();
  const replay = await waitForSnapshot(page, value => value.phase === 'playing' && value.session !== initial.session && value.enemies === 2);
  expect(replay.position).toEqual([0, 0, 4]); expect(replay.errors).toBe(0);
  await expect(page.locator('#weapon-slot-1')).toContainText('60');
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
});

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
  const dialog = page.getByRole('dialog', { name: 'GAME SETTINGS' });
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
  const dialog = page.getByRole('dialog', { name: 'GAME SETTINGS' });
  const sensitivity = dialog.getByRole('slider', { name: /Mouse sensitivity/ });
  await sensitivity.press('End');
  await expect(sensitivity).toHaveValue('3');
  const music = dialog.getByRole('slider', { name: /Music volume/ });
  const mute = dialog.getByRole('checkbox', { name: 'Mute all audio' });
  await music.press('Home');
  await mute.check();
  await expect(dialog.getByRole('status', { name: 'Settings saving status' })).toContainText('could not be saved');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('#start-game-btn').click();
  await page.keyboard.press('Escape');
  await button(page, 'SETTINGS').click();
  await expect(sensitivity).toHaveValue('3');
  await expect(music).toHaveValue('0');
  await expect(mute).toBeChecked();
  await page.reload();
  await button(page, 'SETTINGS').click();
  await expect(sensitivity).toHaveValue('1');
  await expect(music).toHaveValue('40');
  await expect(mute).not.toBeChecked();
});

test('production: saved mixer preferences apply at startup, unmute without replacing loops, and preserve pause silence', async ({ page }, testInfo) => {
  // Observe only the native audio boundary. No game state or production diagnostics are injected.
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    const contexts = [];
    window.AudioContext = class extends NativeContext {
      constructor(...args) {
        super(...args);
        const gains = [], sources = [];
        contexts.push({ gains, sources });
        const createGain = this.createGain.bind(this);
        this.createGain = () => { const gain = createGain(); gains.push(gain); return gain; };
        const createSource = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = createSource(), record = { source, started: false, ended: false };
          sources.push(record);
          source.addEventListener('ended', () => { record.ended = true; });
          const start = source.start.bind(source);
          source.start = (...parameters) => { start(...parameters); record.started = true; };
          return source;
        };
      }
    };
    window.__audioProbe = () => contexts.map(({ gains, sources }) => ({
      master: gains[0]?.gain.value, effects: gains[1]?.gain.value, music: gains[2]?.gain.value,
      startedLoops: sources.filter(record => record.started && record.source.loop).length,
      activeLoops: sources.filter(record => record.started && record.source.loop && !record.ended).length,
    }));
  });
  const samples = [];
  const probe = () => page.evaluate(() => window.__audioProbe());
  const expectMixer = async (label, expected) => {
    await expect.poll(probe).toEqual([expected]);
    samples.push({ label, ...(await probe())[0] });
  };
  await page.goto('http://127.0.0.1:5184/');
  await button(page, 'SETTINGS').click();
  const dialog = page.getByRole('dialog', { name: 'GAME SETTINGS' });
  const music = dialog.getByRole('slider', { name: /Music volume/ });
  const effects = dialog.getByRole('slider', { name: /Effects volume/ });
  const mute = dialog.getByRole('checkbox', { name: 'Mute all audio' });
  await expect(music).toHaveValue('40'); await expect(effects).toHaveValue('60');
  await music.press('Home'); await effects.press('End'); await mute.check();
  expect(await probe()).toEqual([]);
  await page.reload();
  await button(page, 'SETTINGS').click();
  await expect(music).toHaveValue('0'); await expect(effects).toHaveValue('100'); await expect(mute).toBeChecked();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('#start-game-btn').click();
  await expectMixer('muted startup', { master: 0, effects: 1, music: 0, startedLoops: 2, activeLoops: 2 });
  await page.keyboard.press('Escape');
  await button(page, 'SETTINGS').click();
  await music.press('End'); await effects.press('Home'); await mute.uncheck();
  await expectMixer('unmute while paused', { master: 0, effects: 0, music: 1, startedLoops: 2, activeLoops: 2 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'PAUSED', exact: true })).toBeVisible();
  await button(page, 'CONTINUE').click();
  await expectMixer('resume audible', { master: 1, effects: 0, music: 1, startedLoops: 2, activeLoops: 2 });
  await page.keyboard.press('Escape'); await button(page, 'SETTINGS').click();
  await mute.check(); await page.keyboard.press('Escape');
  await button(page, 'CONTINUE').click();
  await expectMixer('resume muted', { master: 0, effects: 0, music: 1, startedLoops: 2, activeLoops: 2 });
  await page.keyboard.press('Escape'); await button(page, 'RESTART MISSION').click();
  await expectMixer('restart muted', { master: 0, effects: 0, music: 1, startedLoops: 4, activeLoops: 2 });
  await page.keyboard.press('Escape'); await button(page, 'SETTINGS').click();
  await dialog.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
  await expect(music).toHaveValue('40'); await expect(effects).toHaveValue('60'); await expect(mute).not.toBeChecked();
  await expectMixer('reset while paused', { master: 0, effects: expect.closeTo(0.6, 5), music: expect.closeTo(0.4, 5), startedLoops: 4, activeLoops: 2 });
  await page.setViewportSize({ width: 390, height: 640 });
  await mute.focus(); await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Reset to defaults', exact: true })).toBeFocused();
  await testInfo.attach('audio-settings-small-viewport', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Escape'); await button(page, 'RETURN TO BASE').click();
  await expectMixer('return to menu', { master: 1, effects: expect.closeTo(0.6, 5), music: expect.closeTo(0.4, 5), startedLoops: 4, activeLoops: 0 });
  await testInfo.attach('audio-mixer-samples', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

test('production: audio controls remain saved and playable without Web Audio support', async ({ page }) => {
  await page.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await page.goto('http://127.0.0.1:5184/');
  await button(page, 'SETTINGS').click();
  const dialog = page.getByRole('dialog', { name: 'GAME SETTINGS' });
  const effects = dialog.getByRole('slider', { name: /Effects volume/ });
  const mute = dialog.getByRole('checkbox', { name: 'Mute all audio' });
  await effects.press('Home'); await effects.press('ArrowRight'); await mute.check();
  await expect(dialog.getByRole('status', { name: 'Settings saving status' })).toContainText('Saved on this browser');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('#start-game-btn').click();
  await expect(page.locator('#arena-guide')).toContainText('FLIGHT TRAINING');
  await page.keyboard.press('Escape'); await button(page, 'SETTINGS').click();
  await expect(effects).toHaveValue('1'); await expect(mute).toBeChecked();
  await page.reload(); await button(page, 'SETTINGS').click();
  await expect(effects).toHaveValue('1'); await expect(mute).toBeChecked();
});
