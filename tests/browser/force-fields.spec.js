import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import EditorDocument from '../../src/js/editor/EditorDocument.js';
import { openAuthoringPanels } from '../helpers/editor-layout.mjs';
import { advanceUntil } from '../helpers/browser-clock.mjs';

const test = base.extend({ cleanBrowser: [async ({ page }, use) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await use(); expect(errors).toEqual([]);
}, { auto: true }] });

test('production: author a force field, shoot and collide, pause, restart, disable its relay and extract', async ({ page }, info) => {
  test.setTimeout(180000); await page.setViewportSize({ width: 1280, height: 800 });
  const start = Date.UTC(2026, 0, 1); await page.clock.install({ time: start });
  const model = new EditorDocument(), room = model.attachRoom('room-1', 'negativeZ', 'box-room');
  model.updateContent('@spawn', 'room-1', [0, 0, 3], false); model.updateContent('exit-1', room, [0, 0, 0], false);
  const relay = model.addContent('room-1', 'relay', '', [2, 0, -6]);
  await page.goto('http://127.0.0.1:5184/editor.html'); await openAuthoringPanels(page);
  await page.locator('#file').setInputFiles({ name: 'field-training.json', mimeType: 'application/json', buffer: Buffer.from(model.export()) });
  await expect(page.locator('#format-version')).toContainText('Format 3'); await page.clock.pauseAt(start + 3600000);
  await page.getByRole('tab', { name: 'Wall', exact: true }).click();
  await page.getByRole('combobox', { name: 'Connection', exact: true }).selectOption('connection-1');
  const open = () => page.getByRole('button', { name: 'Add or edit door…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Door controls', exact: true });
  await open(); await dialog.getByRole('combobox', { name: 'Door control', exact: true }).selectOption(relay);
  await dialog.getByRole('combobox', { name: 'Door appearance', exact: true }).selectOption('field');
  await dialog.getByRole('button', { name: 'Apply door', exact: true }).click();
  await expect(page.locator('#format-version')).toContainText('Format 11');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.locator('#format-version')).toContainText('Format 3');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const path = info.outputPath('field-training.v11.json'); await (await pending).saveAs(path);
  const authored = JSON.parse(await readFile(path, 'utf8')); expect(authored.doors[0]).toMatchObject({ kind: 'force-field', deviceId: relay });
  await page.locator('#file').setInputFiles(path); await expect(page.locator('#format-version')).toContainText('Format 11');
  await open(); await expect(dialog.getByRole('combobox', { name: 'Door appearance', exact: true })).toHaveValue('field');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Mission playtest"]'); await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await page.clock.fastForward(100); await page.keyboard.press('c'); await page.keyboard.press('c'); await page.clock.fastForward(100);
  for (let i = 0; i < 32; i++) await page.clock.fastForward(100);
  await page.screenshot({ path: info.outputPath('force-field-cockpit.png'), animations: 'disabled' });
  await page.keyboard.press('m'); await page.clock.fastForward(100);
  await expect(frame.locator('#exploration-map')).toContainText('field/control');
  await page.screenshot({ path: info.outputPath('force-field-map.png'), animations: 'disabled' }); await page.keyboard.press('m');
  const blocked = async () => {
    await page.keyboard.press('f'); for (let i = 0; i < 15; i++) await page.clock.fastForward(100);
    await expect(frame.locator('#weapon-slot-1')).toContainText('59');
    await page.keyboard.down('w'); try { for (let i = 0; i < 60; i++) await page.clock.fastForward(100); } finally { await page.keyboard.up('w'); }
    await expect(frame.locator('#cockpit-instruments')).toHaveAttribute('data-room', 'room-1');
    await expect(frame.locator('#cockpit-objective')).toContainText('RELAYS 0/1'); await expect(frame.locator('#health-percentage')).toHaveText('100%');
    await expect(frame.locator('#game-over-display')).toBeHidden();
  };
  await blocked();
  await page.keyboard.press('Escape'); await page.keyboard.press('r'); for (let i = 0; i < 10; i++) await page.clock.fastForward(100);
  await expect(frame.locator('#cockpit-objective')).toContainText('RELAYS 0/1');
  await frame.getByRole('button', { name: 'RESTART MISSION', exact: true }).press('Enter'); await page.clock.fastForward(100);
  await expect(frame.locator('#weapon-slot-1')).toContainText('60'); await blocked();
  await page.keyboard.press('r'); await page.clock.fastForward(100); await expect(frame.locator('#cockpit-objective')).toContainText('EXIT READY');
  await page.screenshot({ path: info.outputPath('force-field-disabled.png'), animations: 'disabled' });
  await page.keyboard.down('w');
  try { await advanceUntil(page, () => frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 90 }); }
  finally { await page.keyboard.up('w'); }
  await expect(frame.locator('#score-display')).toHaveText('1000');
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click(); await expect(page.locator('#playtest-panel')).toBeHidden();
  await open(); await expect(dialog.getByRole('combobox', { name: 'Door appearance', exact: true })).toHaveValue('field');
});
