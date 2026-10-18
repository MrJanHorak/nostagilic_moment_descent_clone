import { test as base, expect } from '@playwright/test';
import os from 'node:os';
import { FlightController } from '../helpers/browser-flight.mjs';
import { openClockedGame, advanceUntil, hasControlledClock } from '../helpers/browser-clock.mjs';

// Observe failures from the real browser, including errors caught by Game's recovery UI.
const test = base.extend({
  cpuStress: [async ({ page }, use, testInfo) => {
    const rate = Number(process.env.BROWSER_CPU_SLOWDOWN ?? 1);
    if (!Number.isFinite(rate) || rate < 1 || rate > 8) throw new Error('BROWSER_CPU_SLOWDOWN must be from 1 to 8');
    if (rate > 1) {
      const session = await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate });
    }
    await use();
    await testInfo.attach('browser-environment', { body: JSON.stringify({ viewport: page.viewportSize(), cpuSlowdown: rate,
      clock: hasControlledClock(page) ? 'controlled: 100ms per rendered tick' : 'real time' }), contentType: 'application/json' });
  }, { auto: true }],
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

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  // Capture read-only DOM evidence immediately, before another test or a job
  // cancellation can prevent the final HTML/JSON reporters from finishing.
  const state = await page.locator('body').evaluate(() => ({
    flight: document.querySelector('#runtime-diagnostics')?.getAttribute('data-flight'),
    diagnostics: document.querySelector('#runtime-diagnostics')?.getAttribute('data-snapshot'),
    headings: [...document.querySelectorAll('h1, h2, h3')].map(node => node.textContent),
    health: document.querySelector('#health-percentage')?.textContent,
    score: document.querySelector('#score-display')?.textContent,
    enemies: document.querySelector('#enemy-count-display')?.textContent,
    guide: document.querySelector('#arena-guide')?.textContent,
    aimInput: window.__missionAimInput ?? null,
  }), undefined, { timeout: 5000 }).catch(error => ({ unavailable: error.message }));
  const body = JSON.stringify(state, null, 2);
  console.error(`Failure state for ${testInfo.title}:\n${body}`);
  await testInfo.attach('failure-state', { body, contentType: 'application/json' });
});

const button = (page, name) => page.getByRole('button', { name, exact: true });
async function chooseMine(page) {
  await page.locator('#select-level-btn').click();
  await button(page, 'Mine Link Prototype').click();
  await expect(page.locator('#arena-guide')).toContainText('MINE LINK PROTOTYPE');
  await expect(page.locator('#arena-guide')).toContainText('ceiling hatch');
  await expect(page.locator('#weapon-slot-1')).toContainText('60');
}
async function chooseRelay(page) {
  await page.locator('#select-level-btn').click();
  await button(page, 'Relay Gate Prototype').click();
  await expect(page.locator('#arena-guide')).toContainText('RELAYS 0/1', { ignoreCase: true });
  await expect(page.locator('#arena-guide')).toContainText('R activates nearby');
}
async function chooseDeepRelay(page) {
  await page.locator('#select-level-btn').click();
  await button(page, 'Deep Relay').click();
  await expect(page.locator('#arena-guide')).toContainText('DEEP RELAY');
  await expect(page.locator('#arena-guide')).toContainText('Location: Blue Docking Bay');
  await expect(page.locator('#arena-guide')).toContainText('Relays 0/2');
  await expect(page.locator('#weapon-slot-1')).toContainText('70');
}
async function chooseMission(page, { keyboard = false } = {}) {
  // This main-menu control is a legacy div; click it before pointer capture.
  await page.locator('#select-level-btn').click();
  const mission = page.getByRole('button', { name: /arena escape/i });
  if (keyboard) await mission.press('Enter');
  else await mission.click();
  await expect(page.locator('#arena-guide')).toContainText('Neutralize drones 0/2');
  await expect(page.locator('#weapon-slot-1')).toContainText('40');
}
async function holdUntil(page, key, assertion) {
  await page.keyboard.down(key);
  try { await assertion(); }
  finally { await page.keyboard.up(key); }
}

async function advanceAliveUntil(page, predicate, message) {
  await advanceUntil(page, async () => {
    const hud = await page.evaluate(() => ({
      health: document.querySelector('#health-percentage')?.textContent,
      score: document.querySelector('#score-display')?.textContent,
      enemies: document.querySelector('#enemy-count-display')?.textContent,
      weapon: document.querySelector('#weapon-slot-1')?.textContent,
      result: document.querySelector('[role="dialog"]')?.getAttribute('aria-label'),
    }));
    if (predicate(hud)) return true;
    if (hud.health === '0%') throw new Error(`${message}: ship destroyed before the expected state; ${JSON.stringify(hud)}`);
    return false;
  }, { message });
}

test('production: keyboard mission victory, replay, enemy-fire death, reboot and menu', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  // Observe the native input boundary: this keyboard scenario must not aim
  // through cursor repositioning while a menu action acquires pointer lock.
  await page.addInitScript(() => {
    window.__missionAimInput = [];
    document.addEventListener('mousemove', event => {
      if (document.pointerLockElement && (event.movementX || event.movementY) && window.__missionAimInput.length < 20) {
        window.__missionAimInput.push({ x: event.movementX, y: event.movementY });
      }
    });
  });
  await openClockedGame(page, 'http://127.0.0.1:5184/?smoke=1');
  await expect(page.locator('#start-game-btn')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#runtime-diagnostics')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Session smoke controls' })).toHaveCount(0);
  // Avoid cursor repositioning during pointer capture and recapture. The
  // legacy main-menu div is clicked before this mission captures the pointer.
  await chooseMission(page, { keyboard: true });

  await page.keyboard.press('f');
  await expect(page.locator('#weapon-slot-1')).toContainText('39');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'PAUSED', exact: true })).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.locator('#weapon-slot-1')).toContainText('39');
  await button(page, 'CONTINUE').press('Enter');
  const aimInput = await page.evaluate(() => window.__missionAimInput);
  await testInfo.attach('opening-aim-input', { body: JSON.stringify(aimInput), contentType: 'application/json' });
  for (let shot = 0; shot < 4; shot++) await page.keyboard.press('f');
  await advanceAliveUntil(page, hud => hud.score === '100',
    'The opening five keyboard shots must defeat the fighter and award 100 points');
  await expect(page.locator('#score-display')).toHaveText('100');
  await expect(page.locator('#weapon-slot-1')).toContainText('35');

  // Fly toward the exit; the scout pursues and rams. No state injection or test controls.
  await holdUntil(page, 'w', () => advanceAliveUntil(page, hud => hud.enemies === 'ENEMIES: 2/2',
    'Forward flight must let the pursuing scout ram and finish the encounter'));
  const victory = page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true });
  if (!await victory.isVisible()) {
    // At the far wall the player can be beyond the trigger; backing up crosses it.
    await holdUntil(page, 's', () => advanceAliveUntil(page, hud => hud.result === 'MISSION COMPLETE',
      'Backing through the cleared exit must complete the mission'));
  }
  await expect(page.locator('#score-display')).toHaveText('1100');
  await testInfo.attach('production-victory', { body: await page.screenshot(), contentType: 'image/png' });
  await button(page, 'REPLAY MISSION').press('Enter');
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  await expect(page.locator('#weapon-slot-1')).toContainText('40');
  await expect(page.locator('#score-display')).toHaveText('0');
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/2');
  await advanceUntil(page, () => page.getByRole('heading', { name: 'SYSTEM FAILURE', exact: true }).isVisible(),
    { message: 'Enemy fire must destroy the stationary ship after replay' });
  await testInfo.attach('production-loss', { body: await page.screenshot(), contentType: 'image/png' });
  await button(page, 'REBOOT').press('Enter');
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  await expect(page.locator('#weapon-slot-1')).toContainText('40');
  await expect(page.locator('#score-display')).toHaveText('0');
  await page.keyboard.press('Escape');
  await button(page, 'RETURN TO BASE').press('Enter');
  await page.locator('#start-game-btn').click();
  await expect(page.locator('#arena-guide')).toContainText('FLIGHT TRAINING');
  await page.keyboard.press('f');
  await expect(page.locator('#weapon-slot-1')).toContainText('∞');
  await page.keyboard.press('Escape');
  await button(page, 'SELECT MISSION').press('Enter');
  await expect(page.getByRole('heading', { name: 'SELECT MISSION', exact: true })).toBeVisible();
  await expect(page.locator('#arena-guide')).toHaveCount(0);
});

async function snapshot(page) {
  const value = await page.locator('#runtime-diagnostics').getAttribute('data-snapshot');
  return value ? JSON.parse(value) : null;
}
async function waitForSnapshot(page, predicate) {
  let value;
  if (hasControlledClock(page)) {
    await advanceUntil(page, async () => { value = await snapshot(page); return !!value && predicate(value); });
    return value;
  }
  await expect.poll(async () => { value = await snapshot(page); return !!value && predicate(value); }).toBe(true);
  return value;
}

async function settledPausedSnapshot(page, session) {
  let previous = null, matches = 0, value;
  const keys = ['geometries', 'textures', 'programs', 'objects', 'materials', 'lights', 'sceneGeometries', 'geometryBudget'];
  await expect.poll(async () => {
    value = await snapshot(page);
    if (!value || value.session !== session || value.phase !== 'paused' || value.sessionFrames < 3) return false;
    if (previous?.frames === value.frames) return false;
    matches = previous && keys.every(key => previous.resources[key] === value.resources[key]) ? matches + 1 : 0;
    previous = value;
    return matches >= 2;
  }, { timeout: 30000, intervals: [100], message: 'Paused resource counts should settle across three rendered snapshots' }).toBe(true);
  return value;
}

test('production: JSON missions are selectable and reset their encounter, inventory and relay objective', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await openClockedGame(page, 'http://127.0.0.1:5184/');
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
  await page.keyboard.press('Escape'); await button(page, 'RETURN TO BASE').click();
  await chooseRelay(page); await page.keyboard.press('r');
  await expect(page.locator('#arena-guide')).toContainText('Relays 0/1');
  await page.keyboard.press('Escape'); await button(page, 'RESTART MISSION').click();
  await expect(page.locator('#arena-guide')).toContainText('Relays 0/1');
  await expect(page.locator('#weapon-slot-1')).toContainText('60');
});

test('production: Deep Relay starts with cover, room guidance and clean inventory on restart', async ({ page }, testInfo) => {
  await openClockedGame(page, 'http://127.0.0.1:5184/'); await chooseDeepRelay(page);
  await expect(page.locator('#runtime-diagnostics')).toHaveCount(0);
  await expect(page.locator('#enemy-count-display')).toHaveText('ENEMIES: 0/5');
  await expect(page.locator('#arena-guide')).toContainText('Lift power relay in Blue Lift Junction');
  await testInfo.attach('deep-relay-start', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('f'); await expect(page.locator('#weapon-slot-1')).toContainText('69');
  await page.keyboard.press('Escape'); await button(page, 'RESTART MISSION').click();
  await expect(page.locator('#weapon-slot-1')).toContainText('70');
  await expect(page.locator('#health-percentage')).toHaveText('100%');
  await expect(page.locator('#score-display')).toHaveText('0');
  await expect(page.locator('#arena-guide')).toContainText('Relays 0/2');
});

// Read diagnostics to steer real keyboard input; never inject a player position.
async function flyMineAxis(page, axis, target) {
  await test.step(`Fly ${['X', 'Y', 'Z'][axis]} to ${target}`, () => steerMineAxis(page, axis, target));
}

async function steerMineAxis(page, axis, target) {
  const keys = [['a', 'd'], ['ShiftLeft', 'Space'], ['w', 's']][axis];
  const readFlight = async () => JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
  let previous = await readFlight(), held = null;
  const controller = new FlightController(target);
  const session = previous.session, started = previous.timeMs;
  try {
    await advanceUntil(page, async () => {
      const value = await readFlight();
      if (value.phase === 'completed') return true;
      if (value.phase !== 'playing' || value.session !== session) throw new Error(`Flight interrupted: ${JSON.stringify(value)}`);
      const error = target - value.position[axis];
      if (Math.abs(error) < 0.3 && value.speed < 0.15) return true;
      if (value.timeMs - started > 30000) throw new Error(`Keyboard flight did not converge within 30 simulation seconds: ${JSON.stringify(value)}`);
      previous = value;
      const command = controller.update(value.position[axis], value.velocity[axis], value.timeMs);
      const next = command > 0 ? keys[1] : command < 0 ? keys[0] : null;
      if (next !== held) {
        if (held) await page.keyboard.up(held);
        if (next) await page.keyboard.down(next);
        held = next;
      }
      return false;
    }, { ticks: 350, message: `Keyboard axis ${axis} should settle at ${target}` });
  } catch (error) {
    throw new Error(`${error.message}\nLast flight observation: ${JSON.stringify(previous)}`, { cause: error });
  } finally { if (held) await page.keyboard.up(held); }
  // Drift persists while another thrust axis is held, so settle before turning.
  await waitForSnapshot(page, value => value.phase !== 'playing' || value.speed < 0.03);
}

test('development: JSON mine loop and vertical hatch fly both ways, complete and replay', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1'); await chooseMine(page);
  const initial = await waitForSnapshot(page, value => value.phase === 'playing' && value.enemies === 2);
  await button(page, 'Neutralize drones (test)').press('Enter');
  await advanceUntil(page, async () => (await page.locator('#arena-guide').textContent()).includes('EXIT READY'),
    { ticks: 20, message: 'The mission guide must reflect both neutralized drones after rendering' });
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

test('development: relay unlocks a solid hatch, completes the objective and resets on replay', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1'); await chooseRelay(page);
  const initial = await waitForSnapshot(page, value => value.phase === 'playing' && value.enemies === 2);
  // Reproduce a hosted command/observation stall longer than the supplied
  // Windows trace's ~13 simulation-second observation gap. Real held input
  // must advance only when the test explicitly renders the next clock tick.
  const readFlight = async () => JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
  const before = await readFlight(), wallStart = Date.now();
  let delayed, advanced;
  await page.keyboard.down('w');
  try {
    await page.waitForTimeout(14000); // Intentional protocol-latency regression, not an application readiness wait.
    delayed = await readFlight();
    expect(delayed.steps).toBe(before.steps); expect(delayed.timeMs).toBe(before.timeMs);
    expect(delayed.position).toEqual(before.position);
    await page.clock.fastForward(100); advanced = await readFlight();
    expect(advanced.steps - delayed.steps).toBe(6);
    expect(advanced.position[2]).toBeLessThan(delayed.position[2]);
  } finally { await page.keyboard.up('w'); }
  await testInfo.attach('command-latency-probe', { body: JSON.stringify({ wallDelayMs: Date.now() - wallStart, before, delayed, advanced }), contentType: 'application/json' });
  await button(page, 'Neutralize drones (test)').press('Enter');
  await expect(page.locator('#arena-guide')).toContainText('Exit locked');
  const samples = [];
  const record = async label => { const value = await snapshot(page); samples.push({ label, position: value.position, phase: value.phase, errors: value.errors, guide: await page.locator('#arena-guide').textContent() }); };
  await flyMineAxis(page, 2, 0); await flyMineAxis(page, 0, 16);
  await holdUntil(page, 'Space', async () => {
    await waitForSnapshot(page, value => value.position[1] > 4.8);
    await waitForSnapshot(page, value => value.speed < 0.03);
    expect((await snapshot(page)).position[1]).toBeLessThan(5.01);
  });
  await record('blocked-hatch');
  await flyMineAxis(page, 1, 0); await flyMineAxis(page, 0, 19); await flyMineAxis(page, 2, 5);
  await expect(page.locator('#arena-guide')).toContainText('R: activate Ceiling hatch relay');
  await page.keyboard.press('Escape'); await page.keyboard.press('r');
  await expect(page.locator('#arena-guide')).toContainText('Relays 0/1');
  await button(page, 'CONTINUE').click();
  const resumed = await waitForSnapshot(page, value => value.phase === 'playing');
  await page.keyboard.press('r');
  await expect(page.locator('#arena-guide')).toContainText('Relays 1/1');
  await expect(page.locator('#arena-guide')).toContainText('EXIT READY');
  await waitForSnapshot(page, value => value.frames > resumed.frames);
  await record('activated'); await testInfo.attach('relay-activated', { body: await page.screenshot(), contentType: 'image/png' });
  await flyMineAxis(page, 2, 0); await flyMineAxis(page, 0, 16); await flyMineAxis(page, 1, 12); await flyMineAxis(page, 2, -4);
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await expect(page.locator('#score-display')).toHaveText('1150'); await record('completed');
  await button(page, 'REPLAY MISSION').click();
  const replay = await waitForSnapshot(page, value => value.phase === 'playing' && value.session !== initial.session && value.enemies === 2);
  expect(replay.position).toEqual([0, 0, 4]); await expect(page.locator('#arena-guide')).toContainText('Relays 0/1');
  await record('replay');
  await testInfo.attach('relay-traversal', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

test('development: Deep Relay lower loop, cache, chained hatches, exit and replay use real keyboard flight', async ({ page }, testInfo) => {
  // Ubuntu's software-rendered route reached the previous eight-minute limit.
  // Its own CI job and a 15-minute suite deadline now leave report-upload time.
  test.setTimeout(720000);
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1'); await chooseDeepRelay(page);
  const initial = await waitForSnapshot(page, value => value.phase === 'playing' && value.enemies === 5);
  await button(page, 'Neutralize drones (test)').press('Enter');
  const samples = [];
  const record = async label => {
    const value = await snapshot(page);
    samples.push({ label, position: value.position, phase: value.phase, errors: value.errors, guide: await page.locator('#arena-guide').textContent() });
  };
  const fly = async points => { for (const [axis, target] of points) await flyMineAxis(page, axis, target); };
  // Complete the lower loop, visit the narrow rotated cache, then approach the first relay.
  await fly([[0, 0], [2, -16], [0, 16], [2, 0], [0, 0], [0, 16], [0, 32]]);
  await expect(page.locator('#arena-guide')).toContainText('Location: Amber Supply Cache'); await record('supply-cache');
  await fly([[0, 16], [0, 13], [2, 3]]);
  await expect(page.locator('#arena-guide')).toContainText('R: activate Lift power relay');
  await page.keyboard.press('r');
  await expect(page.locator('#arena-guide')).toContainText('Relays 1/2');
  await expect(page.locator('#arena-guide')).toContainText('ceiling hatch to Green Upper Lift'); await record('lift-open');
  await fly([[2, 0], [0, 16], [1, 16]]);
  await expect(page.locator('#arena-guide')).toContainText('Location: Green Upper Lift');
  await testInfo.attach('deep-relay-upper-lift', { body: await page.screenshot(), contentType: 'image/png' });
  await fly([[2, -16], [0, 12], [2, -13]]);
  await expect(page.locator('#arena-guide')).toContainText('R: activate Extraction relay');
  await page.keyboard.press('r');
  await expect(page.locator('#arena-guide')).toContainText('Relays 2/2');
  await expect(page.locator('#arena-guide')).toContainText('EXIT READY'); await record('extraction-open');
  await fly([[2, -16], [0, 32], [2, -20]]);
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await expect(page.locator('#score-display')).toHaveText('1400'); await record('completed');
  await button(page, 'REPLAY MISSION').click();
  const replay = await waitForSnapshot(page, value => value.phase === 'playing' && value.session !== initial.session && value.enemies === 5);
  expect(replay.position).toEqual([4, 0, 4]); expect(replay.errors).toBe(0);
  await expect(page.locator('#arena-guide')).toContainText('Relays 0/2');
  await expect(page.locator('#weapon-slot-1')).toContainText('70'); await record('replay');
  await testInfo.attach('deep-relay-traversal', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

test('development: pause freezes simulation and ten combat restarts return resources to baseline', async ({ page, browser }, testInfo) => {
  test.setTimeout(180000);
  await page.goto('http://127.0.0.1:5183/?smoke=1');
  await chooseMission(page);
  const samples = [];
  // Two rendered warm-ups plus ten measured cycles, including combat allocation.
  for (let cycle = 0; cycle < 12; cycle++) {
    const running = await waitForSnapshot(page, value => value.phase === 'playing' && value.enemies === 2);
    await page.keyboard.press('f');
    await button(page, 'Neutralize drones (test)').press('Enter');
    await expect(page.locator('#arena-guide')).toContainText('EXIT READY');
    await page.keyboard.press('Escape');
    await button(page, 'RESTART MISSION').click();
    const restarted = await waitForSnapshot(page, value => value.session !== running.session && value.phase === 'playing' && value.enemies === 2 && value.sessionFrames >= 3);
    await page.keyboard.press('Escape');
    const paused = await waitForSnapshot(page, value => value.phase === 'paused');
    // A second diagnostic refresh must leave simulation time and steps unchanged.
    await expect.poll(async () => (await snapshot(page))?.frames).toBeGreaterThan(paused.frames);
    const stable = await settledPausedSnapshot(page, restarted.session);
    expect(stable.timeMs).toBe(paused.timeMs);
    expect(stable.steps).toBe(paused.steps);
    expect(stable.errors).toBe(0);
    expect(stable.shots).toBe(0);
    expect(stable.pickups).toBe(2);
    expect(stable.tasks).toBe(0);
    expect(stable.resources.effectLights).toBe(0);
    expect(stable.resources.pooledEffects).toBe(0);
    samples.push({ cycle, ...stable });
    if (cycle < 11) await button(page, 'CONTINUE').click();
  }
  const report = { date: new Date().toISOString(), node: process.version, browser: browser.version(),
    platform: os.platform(), cpu: os.cpus()[0]?.model, viewport: page.viewportSize(),
    renderer: 'Chromium ANGLE SwiftShader (software)', warmupCycles: 2, measuredCycles: 10, samples };
  // Preserve measurements even when an assertion fails on a hosted runner.
  await testInfo.attach('restart-resources', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  const baseline = samples[1].resources;
  for (const sample of samples.slice(2)) {
    expect(sample.resources.geometries, 'GPU allocations must be owned by the live scene or shot caches').toBeLessThanOrEqual(sample.resources.geometryBudget);
    expect(sample.resources.textures, 'textures').toBeLessThanOrEqual(Math.max(...samples.slice(0, 2).map(sample => sample.resources.textures)));
    // This fixed arena has five steady programs and one legitimate transient
    // variant (also seen in the original acceptance reports). Five is not a cap.
    expect(sample.resources.programs, 'fixed arena shader program bound').toBeLessThanOrEqual(6);
    for (const key of ['objects', 'materials', 'lights', 'sceneGeometries', 'geometryBudget']) expect(sample.resources[key], key).toBe(baseline[key]);
  }
  const earlyPeak = Math.max(...samples.slice(0, 7).map(sample => sample.resources.geometries));
  const latePeak = Math.max(...samples.slice(7).map(sample => sample.resources.geometries));
  // Permit one view-dependent upload; reject a continuing allocation trend.
  expect(latePeak, 'GPU geometry count must plateau after warm-up').toBeLessThanOrEqual(earlyPeak + 1);
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
