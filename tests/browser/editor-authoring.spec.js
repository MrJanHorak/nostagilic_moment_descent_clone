import { openAuthoringPanels } from '../helpers/editor-layout.mjs';
import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import compileLevelDocument from '../../src/js/core/levels/document/compileLevelDocument.js';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});

async function saveJSON(page, testInfo, name) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await pending, path = testInfo.outputPath(name);
  await download.saveAs(path); return await readFile(path, 'utf8');
}

test('designer: overlap warnings, corner openings, relay doors and patterned solid preview survive export', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5184/editor.html'); await openAuthoringPanels(page);
  await page.getByRole('button', { name: 'All properties', exact: true }).click();
  await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  await page.getByLabel('position Z', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Apply properties' }).click();
  await expect(page.locator('#geometry-status')).toContainText('OVERLAP: room-1, room-2');
  await expect(page.getByRole('button', { name: 'Playtest level', exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('overlap-warning.png'), fullPage: true });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByLabel('Opening width', { exact: true }).fill('4');
  await page.getByLabel('Opening height/depth', { exact: true }).fill('4');
  await page.getByRole('combobox', { name: 'Opening position', exact: true }).selectOption('top-right');
  await page.getByRole('button', { name: 'Apply opening', exact: true }).click();
  await expect(page.getByLabel('U offset', { exact: true })).toHaveValue('5');
  await expect(page.getByLabel('V offset', { exact: true })).toHaveValue('3');
  await page.getByLabel('Face color', { exact: true }).fill('#b55330');
  await page.getByRole('combobox', { name: 'Repeating pattern', exact: true }).selectOption('panels');
  await page.getByRole('button', { name: 'Apply face style', exact: true }).click();
  await page.locator('#rooms').getByRole('button', { name: 'room-1 · room', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('relay');
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Unlock relay', exact: true }).selectOption('relay-1');
  await page.getByRole('button', { name: 'Apply door', exact: true }).click();
  await expect(page.locator('#connections')).toContainText('CLOSED until relay-1');
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.getByRole('combobox', { name: 'View', exact: true }).selectOption('cutaway');
  await page.screenshot({ path: testInfo.outputPath('patterned-cutaway.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'View', exact: true }).selectOption('solid');
  await page.screenshot({ path: testInfo.outputPath('solid-exterior.png'), fullPage: true });
  const text = await saveJSON(page, testInfo, 'corner-mine.json'), document = JSON.parse(text);
  expect(document.formatVersion).toBe(3); expect(document.connections[0].a.offset).toEqual([5, 3]);
  expect(document.rooms[1].surfaces.negativeZ).toEqual({ color: 0xb55330, pattern: 'panels' });
  expect(compileLevelDocument(document).doors).toHaveLength(1);
  await page.locator('#file').setInputFiles({ name: 'corner-mine.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#validation-title')).toContainText('Valid level');
  expect(await saveJSON(page, testInfo, 'corner-reloaded.json')).toBe(text);
});

test('designer: authored content plays to completion and returns to an unchanged document and history', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:5184/editor.html'); await openAuthoringPanels(page);
  await page.getByRole('button', { name: 'All properties', exact: true }).click();
  for (const [axis, value] of [['X', '0'], ['Y', '0'], ['Z', '4']]) await page.getByLabel(`content-position ${axis}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await page.locator('#entities').getByRole('button', { name: 'exit-1 · exit · room-1', exact: true }).click();
  for (const [axis, value] of [['X', '0'], ['Y', '0'], ['Z', '-4']]) await page.getByLabel(`content-position ${axis}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('health');
  await page.getByLabel('place-position X', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('relay');
  await page.getByLabel('place-position X', { exact: true }).fill('0');
  await page.getByLabel('place-position Z', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('enemy');
  await page.getByRole('combobox', { name: 'Enemy type', exact: true }).selectOption('scout');
  await page.getByLabel('place-position X', { exact: true }).fill('-4');
  await page.getByLabel('place-position Z', { exact: true }).fill('-2');
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await expect(page.locator('#validation-title')).toContainText('Valid level');
  await page.getByRole('button', { name: 'Delete content', exact: true }).click();
  await page.getByLabel('Face color', { exact: true }).fill('#387c83');
  await page.getByRole('combobox', { name: 'Repeating pattern', exact: true }).selectOption('grid');
  await page.getByRole('button', { name: 'Apply face style', exact: true }).click();
  const before = await saveJSON(page, testInfo, 'before-playtest.json');
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Mission playtest"]');
  await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await expect(frame.locator('#arena-guide')).toContainText('RELAYS 0/1', { ignoreCase: true });
  await page.screenshot({ path: testInfo.outputPath('first-person-preview.png'), fullPage: true });
  await page.keyboard.press('r');
  await expect(frame.locator('#arena-guide')).toContainText('RELAYS 1/1', { ignoreCase: true });
  await page.keyboard.down('w');
  try { await expect(frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible({ timeout: 15000 }); }
  finally { await page.keyboard.up('w'); }
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click();
  await expect(page.locator('#playtest-panel')).toBeHidden(); await expect(page.locator('iframe')).toHaveCount(0);
  expect(await saveJSON(page, testInfo, 'after-playtest.json')).toBe(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#save-state')).toContainText('Unsaved changes');
  // Launch/return again from an unexported draft: no editor input/state is lost.
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click();
  await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click();
  await expect(page.locator('#playtest-panel')).toBeHidden(); await expect(page.locator('#save-state')).toContainText('Unsaved changes');
});
