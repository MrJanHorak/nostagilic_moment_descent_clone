import { openAuthoringPanels } from '../helpers/editor-layout.mjs';
import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});
async function exportDocument(page, testInfo, name) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const path = testInfo.outputPath(name); await (await pending).saveAs(path); return await readFile(path, 'utf8');
}
async function chooseRoom(page, id) {
  await page.locator('#rooms').getByRole('button', { name: `${id} · room`, exact: true }).click();
}

test('designer validation: an issue selects the affected item or room despite an unrelated content selection', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html'); await openAuthoringPanels(page);
  await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('health');
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  const before = await exportDocument(page, testInfo, 'before-errors.json');
  await page.getByLabel('content-position X', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await page.locator('#entities').getByRole('button', { name: 'Spawn · room-1', exact: true }).click();
  await page.locator('#issues').getByRole('button', { name: /Entity pickup-1 does not fit/ }).press('Enter');
  await expect(page.locator('#inspector-selection')).toHaveText('pickup-1 · room-2');
  await expect(page.locator('#entities').getByRole('button', { name: 'pickup-1 · pickup · room-2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('tab', { name: 'Content', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('content-position X', { exact: true })).toBeFocused();
  await page.getByLabel('content-position X', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  expect(await exportDocument(page, testInfo, 'after-item-repair.json')).toBe(before);
  await chooseRoom(page, 'room-2');
  await page.getByLabel('position Z', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Apply properties', exact: true }).click();
  await page.locator('#entities').getByRole('button', { name: 'Spawn · room-1', exact: true }).click();
  await page.locator('#issues').getByRole('button', { name: /Rooms room-1 and room-2 overlap/ }).click();
  await expect(page.locator('#inspector-selection')).toHaveText('room-2 · Room');
  await expect(page.locator('#entities button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Room', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('position X', { exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('actionable-overlap.png'), fullPage: true });
  // Navigation must not add a history entry: one Undo repairs the moved room.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await exportDocument(page, testInfo, 'after-room-undo.json')).toBe(before);
  await expect(page.locator('#validation-help')).toBeHidden();
});

test('designer validation: spawn and misaligned passage errors open the precise properties and can be repaired', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html'); await openAuthoringPanels(page);
  await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  const before = await exportDocument(page, testInfo, 'before-spawn-and-passage.json');
  await page.locator('#entities').getByRole('button', { name: 'Spawn · room-1', exact: true }).click();
  await page.getByLabel('content-position X', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await chooseRoom(page, 'room-2');
  await page.locator('#issues').getByRole('button', { name: /Player spawn intersects/ }).click();
  await expect(page.locator('#inspector-selection')).toHaveText('Player spawn · room-1');
  await expect(page.getByLabel('content-position X', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await chooseRoom(page, 'room-2');
  await page.getByLabel('position Z', { exact: true }).fill('-17');
  await page.getByRole('button', { name: 'Apply properties', exact: true }).click();
  await page.locator('#entities').getByRole('button', { name: 'exit-1 · exit · room-1', exact: true }).click();
  await page.locator('#issues').getByRole('button', { name: /Connection connection-1: ports must meet/ }).click();
  await expect(page.getByRole('tab', { name: 'Wall', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('combobox', { name: 'Connection', exact: true })).toHaveValue('connection-1');
  await expect(page.getByLabel('Opening width', { exact: true })).toBeFocused();
  await expect(page.locator('#inspector-selection')).toContainText('room-1 · Forward wall');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await exportDocument(page, testInfo, 'after-passage-undo.json')).toBe(before);
});
