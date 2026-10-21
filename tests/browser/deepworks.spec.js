import { test as base, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import EditorDocument from '../../src/js/editor/EditorDocument.js';
import { openAuthoringPanels } from '../helpers/editor-layout.mjs';
import { openClockedGame, advanceUntil } from '../helpers/browser-clock.mjs';
import { FlightController } from '../helpers/browser-flight.mjs';

const test = base.extend({ cleanBrowser: [async ({ page }, use) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(); expect(errors).toEqual([]);
}, { auto: true }] });
const button = (page, name) => page.getByRole('button', { name, exact: true });

test('production: editor reactor integrity, destruction-triggered countdown, pause, restart and escape', async ({ page }, info) => {
  test.setTimeout(180000); await page.setViewportSize({ width: 1280, height: 800 });
  const start = Date.UTC(2026, 0, 1); await page.clock.install({ time: start });
  const model = new EditorDocument(); model.updateContent('@spawn', 'room-1', [0, 0, 3], false); model.updateContent('exit-1', 'room-1', [4, 0, 0], false);
  await page.goto('http://127.0.0.1:5184/editor.html'); await openAuthoringPanels(page);
  await page.locator('#file').setInputFiles({ name: 'reactor-room.json', mimeType: 'application/json', buffer: Buffer.from(model.export()) });
  await expect(page.locator('#validation-title')).toContainText('Valid level'); await page.clock.pauseAt(start + 3600000);
  await page.locator('#place-kind').selectOption('reactor');
  for (const [axis, value] of [['X', '0'], ['Y', '0'], ['Z', '-3']]) await page.locator(`#place-position-${axis}`).fill(value);
  await button(page, 'Add content').click(); await expect(page.locator('#format-version')).toContainText('Format 12');
  await page.getByRole('tab', { name: 'Content', exact: true }).click();
  await page.getByLabel('Reactor integrity', { exact: true }).fill('20'); await button(page, 'Apply content').click();
  await button(page, 'Reactor escape…').click(); const dialog = page.getByRole('dialog', { name: 'Reactor escape countdown', exact: true });
  await dialog.getByRole('combobox').selectOption('reactor-1'); await dialog.getByLabel('Escape time (seconds)', { exact: true }).fill('10');
  await button(dialog, 'Apply countdown').click();
  const pending = page.waitForEvent('download'); await button(page, 'Export JSON').click(); const path = info.outputPath('reactor.v12.json'); await (await pending).saveAs(path);
  const authored = JSON.parse(await readFile(path, 'utf8')); expect(authored.devices[0]).toMatchObject({ kind: 'reactor', health: 20 }); expect(authored.mission.escape.triggerDeviceId).toBe('reactor-1');
  await button(page, 'Undo').click(); await button(page, 'Redo').click(); await page.locator('#file').setInputFiles(path);
  await button(page, 'Playtest level').click(); const frame = page.frameLocator('iframe[title="Mission playtest"]');
  await button(frame, 'Start playtest').press('Enter'); await page.clock.fastForward(100); await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(100);
  await page.keyboard.press('r'); await expect(frame.locator('#escape-countdown')).toBeHidden();
  const fire = async () => { await page.keyboard.press('f'); for (let i = 0; i < 8; i++) await page.clock.fastForward(100); };
  for (let i = 0; i < 3; i++) await fire();
  await expect(frame.locator('#escape-countdown')).toBeHidden(); await expect(frame.locator('#cockpit-objective')).toContainText('CORE 5/20');
  await page.screenshot({ path: info.outputPath('destructible-reactor-cockpit.png'), animations: 'disabled' });
  await fire(); await expect(frame.locator('#escape-countdown')).toBeVisible(); await expect(frame.locator('#cockpit-objective')).toContainText('EXIT READY');
  await page.keyboard.press('Escape'); const frozen = await frame.locator('#escape-countdown').textContent();
  for (let i = 0; i < 25; i++) await page.clock.fastForward(100); await expect(frame.locator('#escape-countdown')).toHaveText(frozen);
  await button(frame, 'RESTART MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(frame.locator('#escape-countdown')).toBeHidden(); await expect(frame.locator('#cockpit-objective')).toContainText('CORE 20/20');
  for (let i = 0; i < 4; i++) await fire(); await page.keyboard.down('w'); await page.keyboard.down('d');
  try { await advanceUntil(page, () => frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 80 }); }
  finally { await page.keyboard.up('w'); await page.keyboard.up('d'); }
  await expect(frame.locator('#score-display')).toHaveText('1000');
});

test('production: Attach corridor creates two usable same-wall doorways and Deepworks opens in the editor', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html'); await openAuthoringPanels(page);
  const model = new EditorDocument(); model.resizeRoom('room-1', [48, 16, 32]);
  await page.locator('#file').setInputFiles({ name: 'large-room.json', mimeType: 'application/json', buffer: Buffer.from(model.export()) });
  await expect(page.locator('#format-version')).toContainText('Format 6'); await page.locator('#attach-port').selectOption('negativeZ'); await button(page, 'Attach corridor').click();
  await page.locator('#rooms').getByRole('button', { name: 'room-1 · room', exact: true }).click();
  await page.locator('#attach-port').selectOption('negativeZ'); await button(page, 'Attach corridor').click();
  await expect(page.locator('#validation-title')).toContainText('Valid level');
  const pending = page.waitForEvent('download'); await button(page, 'Export JSON').click(); const path = info.outputPath('two-lanes.json'); await (await pending).saveAs(path);
  const doc = JSON.parse(await readFile(path, 'utf8')); expect(doc.connections).toHaveLength(2); expect(doc.connections[0].a.port).toBe(doc.connections[1].a.port); expect(doc.connections[0].a.offset ?? [0, 0]).not.toEqual(doc.connections[1].a.offset);
  page.on('dialog', d => d.accept()); await button(page, 'Open Deepworks').click(); await expect(page.locator('#format-version')).toContainText('Format 12');
  await expect(page.getByLabel('Mine name', { exact: true })).toHaveValue('Asterion Deepworks');
  await page.screenshot({ path: info.outputPath('deepworks-editor.png'), fullPage: true });
});

async function fly(page, axis, target) {
  const keys = [['a', 'd'], ['ShiftLeft', 'Space'], ['w', 's']][axis], steering = new FlightController(target); let held = null, last;
  try { await advanceUntil(page, async () => {
    last = JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-flight'));
    if (last.phase === 'completed') return true; if (last.phase !== 'playing') throw new Error(JSON.stringify(last));
    if (Math.abs(last.position[axis] - target) < 0.3 && last.speed < 0.12) return true;
    const error = target - last.position[axis] - last.velocity[axis] * 0.4;
    const command = Math.abs(target - last.position[axis]) > 8 ? Math.abs(last.velocity[axis]) > 8 && Math.sign(last.velocity[axis]) === Math.sign(error) ? 0 : Math.sign(error) : steering.update(last.position[axis], last.velocity[axis], last.timeMs), next = command > 0 ? keys[1] : command < 0 ? keys[0] : null;
    if (next !== held) { if (held) await page.keyboard.up(held); if (next) await page.keyboard.down(next); held = next; } return false;
  }, { ticks: 600, message: `Axis ${axis} target ${target}: ${JSON.stringify(last)}` }); }
  finally { if (held) await page.keyboard.up(held); }
}

test('development: Deepworks portal visibility, loop route, native reactor destruction and timed return', async ({ page }, info) => {
  test.setTimeout(600000); await page.setViewportSize({ width: 1280, height: 800 }); await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#select-level-btn').click(); await button(page, 'Asterion Deepworks').press('Enter'); await page.clock.fastForward(100);
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(100);
  const snapshot = () => page.locator('#runtime-diagnostics').getAttribute('data-snapshot').then(JSON.parse);
  await advanceUntil(page, async () => !!(await snapshot()).visibility, { ticks: 15 });
  const initial = await snapshot(); expect(initial.visibility.totalRooms).toBe(48); expect(initial.visibility.visibleRooms).toBeLessThan(48); expect(initial.visibility.culledMeshes).toBeGreaterThan(0);
  for (let i = 0; i < 32; i++) await page.clock.fastForward(100);
  await page.screenshot({ path: info.outputPath('deepworks-concourse.png'), animations: 'disabled' });
  await button(page, 'Neutralize drones (test)').press('Enter');
  // Keep the long native walkthrough inexpensive under SwiftShader. Capture
  // visual checkpoints at the review resolution, then fly at the smaller size.
  await page.setViewportSize({ width: 640, height: 400 });
  for (const step of [[2, 0], [0, -46], 'r', [0, -48], [2, -50], [0, -46], 'r', [2, -48], [0, 12], [0, 48], [2, 50], 'r', [2, -48], [0, 12], [2, -90], [0, 0]]) {
    if (step === 'r') { await page.keyboard.press('r'); await page.clock.fastForward(100); }
    else await fly(page, step[0], step[1]);
  }
  await expect(page.locator('#cockpit-objective')).toContainText('SYSTEMS 3/4'); await expect(page.locator('#escape-countdown')).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 }); await page.clock.fastForward(100);
  await page.screenshot({ path: info.outputPath('deepworks-reactor-vault.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 640, height: 400 });
  for (let i = 0; i < 15; i++) { await page.keyboard.press('f'); for (let tick = 0; tick < 8; tick++) await page.clock.fastForward(100); }
  await expect(page.locator('#escape-countdown')).toBeVisible(); await expect(page.locator('#cockpit-objective')).toContainText('EXIT READY');
  await page.setViewportSize({ width: 1280, height: 800 }); await page.keyboard.press('m'); await page.clock.fastForward(100); await page.screenshot({ path: info.outputPath('deepworks-escape-map.png'), animations: 'disabled' }); await page.keyboard.press('m');
  await page.setViewportSize({ width: 640, height: 400 });
  for (const [axis, target] of [[0, 12], [2, 0], [0, 0], [2, 52]]) await fly(page, axis, target);
  await expect(page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  const finished = await snapshot(); await writeFile(info.outputPath('deepworks-render-stats.json'), JSON.stringify({ initial: initial.visibility, finished: finished.visibility }, null, 2));
  await page.setViewportSize({ width: 1280, height: 800 }); await page.clock.fastForward(100);
  await page.screenshot({ path: info.outputPath('deepworks-extracted.png'), animations: 'disabled' });
  await button(page, 'REPLAY MISSION').press('Enter'); await page.clock.fastForward(100); await expect(page.locator('#escape-countdown')).toBeHidden();
  await expect(page.locator('#cockpit-objective')).toContainText('CORE 150/150');
});
