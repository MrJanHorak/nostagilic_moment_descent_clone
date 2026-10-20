import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import EditorDocument from '../../src/js/editor/EditorDocument.js';
import { advanceUntil } from '../helpers/browser-clock.mjs';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});

test('production: editor reactor countdown authoring, timeout, reboot and native timed escape', async ({ page }, testInfo) => {
  test.setTimeout(180000); await page.setViewportSize({ width: 1280, height: 800 });
  const time = Date.UTC(2026, 0, 1); await page.clock.install({ time });
  await page.goto('http://127.0.0.1:5184/editor.html');
  await page.getByRole('button', { name: 'Playtest level', exact: true }).waitFor({ state: 'visible' }); await page.clock.pauseAt(time + 3600000);
  const model = new EditorDocument(), relay = model.addContent('room-1', 'relay', '', [-1, 0, 3]);
  await page.locator('#file').setInputFiles({ name: 'reactor-training.json', mimeType: 'application/json', buffer: Buffer.from(model.export()) });
  await expect(page.locator('#format-version')).toContainText('Format 3');
  const open = () => page.getByRole('button', { name: 'Reactor escape…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reactor escape countdown', exact: true });
  await open(); await dialog.getByRole('combobox').selectOption(relay, { timeout: 10000 });
  await dialog.getByLabel('Escape time (seconds)', { exact: true }).fill('10'); await dialog.getByRole('button', { name: 'Apply countdown', exact: true }).click();
  await expect(page.locator('#format-version')).toContainText('Format 10');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.locator('#format-version')).toContainText('Format 3');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const path = testInfo.outputPath('reactor-training.v10.json'); await (await downloadEvent).saveAs(path);
  const exported = JSON.parse(await readFile(path, 'utf8')); expect(exported.mission.escape).toEqual({ triggerDeviceId: relay, durationSeconds: 10 });
  await page.locator('#file').setInputFiles(path);
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click(); const frame = page.frameLocator('iframe[title="Mission playtest"]');
  await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter'); await page.clock.fastForward(100);
  await expect(frame.locator('#escape-countdown')).toBeHidden();
  await page.keyboard.press('r'); await page.clock.fastForward(100); await expect(frame.locator('#escape-countdown')).toContainText('ESCAPE 00:10');
  await page.keyboard.press('c'); await page.keyboard.press('c'); await page.keyboard.press('h'); await page.clock.fastForward(100);
  await expect(frame.locator('#escape-countdown')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('reactor-countdown-cockpit.png'), animations: 'disabled' });
  await page.keyboard.press('Escape'); const frozen = await frame.locator('#escape-countdown').textContent();
  for (let i = 0; i < 20; i++) await page.clock.fastForward(100);
  await expect(frame.locator('#escape-countdown')).toHaveText(frozen);
  await frame.getByRole('button', { name: 'CONTINUE', exact: true }).press('Enter'); await page.clock.fastForward(100);
  await advanceUntil(page, () => frame.getByRole('heading', { name: 'REACTOR MELTDOWN', exact: true }).isVisible(), { ticks: 150, message: 'Expired escape must show reactor failure' });
  await expect(frame.locator('#health-percentage')).toHaveText('0%'); await expect(frame.locator('#score-display')).toHaveText('0');
  await page.screenshot({ path: testInfo.outputPath('reactor-meltdown.png'), animations: 'disabled' });
  await frame.getByRole('button', { name: 'REBOOT', exact: true }).press('Enter'); await page.clock.fastForward(100);
  await expect(frame.locator('#health-percentage')).toHaveText('100%'); await expect(frame.locator('#escape-countdown')).toBeHidden();
  // A fresh run has no stale countdown, then reaches the exit through native
  // diagonal flight before its newly armed 10-second allowance expires.
  for (let i = 0; i < 110; i++) await page.clock.fastForward(100);
  await expect(frame.locator('#game-over-display')).toBeHidden();
  await page.keyboard.press('r'); await page.clock.fastForward(100);
  await page.keyboard.down('w'); await page.keyboard.down('d');
  try { await advanceUntil(page, () => frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 70, message: 'Native diagonal flight must extract before zero' }); }
  finally { await page.keyboard.up('w'); await page.keyboard.up('d'); }
  await expect(frame.locator('#score-display')).toHaveText('1000');
  const finished = await frame.locator('#escape-countdown').textContent();
  for (let i = 0; i < 120; i++) await page.clock.fastForward(100);
  await expect(frame.locator('#escape-countdown')).toHaveText(finished); await expect(frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click(); await expect(page.locator('#playtest-panel')).toBeHidden();
  await open(); await dialog.getByRole('combobox').selectOption('', { timeout: 10000 }); await dialog.getByRole('button', { name: 'Apply countdown', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await open();
  await expect(dialog.getByRole('combobox')).toHaveValue(relay); await expect(dialog.getByLabel('Escape time (seconds)', { exact: true })).toHaveValue('10');
});
