import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import compileLevelDocument from '../../src/js/core/levels/document/compileLevelDocument.js';
import { advanceUntil } from '../helpers/browser-clock.mjs';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});

// Project known authored points into the native canvas. Tests send real mouse
// events; they never inject a model, selected face, transform or runtime state.
async function starterPoint(page, point) {
  const bounds = await page.locator('#viewport canvas').boundingBox();
  const camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.1, 3000);
  camera.position.copy(new Vector3(1, 0.85, 1).normalize().multiplyScalar(new Vector3(16, 12, 16).length() * 1.25));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const screen = new Vector3(...point).project(camera);
  return { x: bounds.x + (screen.x + 1) * bounds.width / 2, y: bounds.y + (1 - screen.y) * bounds.height / 2 };
}
async function contextAt(page, point) {
  const screen = await starterPoint(page, point);
  await page.mouse.click(screen.x, screen.y, { button: 'right' });
  await expect(page.locator('#viewport-context-menu')).toBeVisible();
  return page.locator('#viewport-context-menu');
}
async function exportDocument(page, testInfo, name) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await pending, path = testInfo.outputPath(name); await download.saveAs(path); return await readFile(path, 'utf8');
}

test('designer UX: pick a wall, style it and place content from context menus without coordinate entry', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await expect(page.getByRole('tab', { name: 'Room', exact: true })).toHaveAttribute('aria-selected', 'true');
  const wallPoint = await starterPoint(page, [0, 1, -7.5]); await page.mouse.click(wallPoint.x, wallPoint.y);
  await expect(page.getByRole('tab', { name: 'Wall', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#inspector-selection')).toContainText('Forward wall');
  let menu = await contextAt(page, [0, 1, -7.5]);
  await page.screenshot({ path: testInfo.outputPath('wall-context-menu.png'), fullPage: true });
  await menu.getByRole('menuitem', { name: 'Wall color and pattern…', exact: true }).click();
  const appearance = page.getByRole('dialog', { name: 'Wall appearance', exact: true });
  await appearance.getByLabel('Wall color', { exact: true }).fill('#a46239');
  await appearance.getByRole('combobox', { name: 'Wall pattern', exact: true }).selectOption('panels');
  await appearance.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByLabel('Face color', { exact: true })).toHaveValue('#a46239');
  menu = await contextAt(page, [-3, -5.5, -1]);
  await menu.getByRole('menuitem', { name: 'Place health here', exact: true }).hover();
  await page.screenshot({ path: testInfo.outputPath('room-placement-menu.png'), fullPage: true });
  await menu.getByRole('menuitem', { name: 'Place health here', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Content', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('content-position Y', { exact: true })).toHaveValue('-5');
  await page.mouse.click(wallPoint.x, wallPoint.y);
  const healthPoint = await starterPoint(page, [-3, -5, -1]); await page.mouse.click(healthPoint.x, healthPoint.y);
  await expect(page.locator('#inspector-selection')).toContainText('pickup-1');
  await expect(page.getByRole('tab', { name: 'Content', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const [point, action] of [
    [[4, -5.5, 1], 'Move player spawn here'], [[0, -5.5, -4], 'Move exit here'], [[-3, -5.5, 4], 'Place relay here'],
  ]) { menu = await contextAt(page, point); await menu.getByRole('menuitem', { name: action, exact: true }).click(); }
  menu = await contextAt(page, [4, -5.5, -4]); await menu.getByRole('menuitem', { name: 'Place enemy…', exact: true }).click();
  await page.getByRole('dialog', { name: 'Place enemy', exact: true }).getByRole('button', { name: 'Place enemy', exact: true }).click();
  await expect(page.locator('#validation-title')).toContainText('Valid level');
  const text = await exportDocument(page, testInfo, 'direct-authoring.json'), document = JSON.parse(text);
  expect(document.rooms[0].surfaces.negativeZ).toEqual({ color: 0xa46239, pattern: 'panels' });
  expect(document.entities.some(entity => entity.kind === 'enemy')).toBe(true);
  expect(document.entities.some(entity => entity.kind === 'pickup')).toBe(true);
  expect(document.devices).toHaveLength(1); expect(document.playerSpawn.position).toEqual([4, -5, 1]);
  expect(document.entities.find(entity => entity.kind === 'exit').position).toEqual([0, -3, -4]);
  compileLevelDocument(document);
  await page.screenshot({ path: testInfo.outputPath('direct-authoring-inspector.png'), fullPage: true });
});

test('designer UX: attach at a wall point, edit its door, duplicate/delete/undo and recover the local draft', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  let menu = await contextAt(page, [4, 2, -7.5]); await menu.getByRole('menuitem', { name: 'Attach corridor at this point', exact: true }).click();
  await expect(page.locator('#room-count')).toHaveText('2 / 256');
  // A point on the remaining shared wall identifies its connection directly.
  menu = await contextAt(page, [-3, 1, -7.5]); await menu.getByRole('menuitem', { name: 'Opening and door…', exact: true }).click();
  const opening = page.getByRole('dialog', { name: 'Opening and door', exact: true });
  await opening.getByLabel('Passage width', { exact: true }).fill('4');
  await opening.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.locator('#rooms').getByRole('button', { name: 'room-2 · corridor', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate room', exact: true }).click();
  await expect(page.locator('#room-count')).toHaveText('3 / 256');
  await page.getByRole('button', { name: 'Delete room', exact: true }).click(); await expect(page.locator('#room-count')).toHaveText('2 / 256');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.locator('#room-count')).toHaveText('3 / 256');
  await expect(page.locator('#draft-status')).toContainText('Draft saved locally');
  const before = await exportDocument(page, testInfo, 'before-recovery.json');
  await page.reload(); await expect(page.getByRole('region', { name: 'Draft recovery', exact: true })).toBeVisible();
  await expect(page.locator('#room-count')).toHaveText('1 / 256');
  await page.screenshot({ path: testInfo.outputPath('draft-recovery.png'), fullPage: true });
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(page.locator('#room-count')).toHaveText('3 / 256'); await expect(page.locator('#save-state')).toContainText('Unsaved changes');
  expect(await exportDocument(page, testInfo, 'recovered.json')).toBe(before);
  await expect(page.getByRole('region', { name: 'Draft recovery', exact: true })).toBeHidden();
});

test('designer UX: keyboard actions, Escape, right-drag pan and viewport-bound menus remain usable', async ({ page }) => {
  await page.goto('http://127.0.0.1:5184/editor.html'); const canvas = page.locator('#viewport canvas');
  await canvas.focus(); await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu'); await expect(menu).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Place health here', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(canvas).toBeFocused();
  const box = await canvas.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down({ button: 'right' }); await page.mouse.move(x + 30, y + 20, { steps: 5 }); await page.mouse.up({ button: 'right' });
  await expect(page.locator('#viewport-context-menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Actions', exact: true }).click(); await expect(page.getByRole('menu')).toBeVisible();
  const bounds = await page.getByRole('menu').boundingBox(); expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(960); expect(bounds.y + bounds.height).toBeLessThanOrEqual(540);
  await page.keyboard.press('Escape');
});

test('designer UX: blocked draft storage keeps editing and portable export available', async ({ page }, testInfo) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); });
  await page.goto('http://127.0.0.1:5184/editor.html'); await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  await expect(page.locator('#draft-status')).toContainText('failed');
  const text = await exportDocument(page, testInfo, 'portable-despite-blocked-storage.json'); expect(JSON.parse(text).rooms).toHaveLength(2);
});

test('designer UX: three authored spaces export/reload, play to completion, return and undo with the layout intact', async ({ page }, testInfo) => {
  const start = Date.UTC(2026, 0, 1); await page.clock.install({ time: start });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await page.getByRole('button', { name: 'Playtest level', exact: true }).waitFor({ state: 'visible' });
  await page.clock.pauseAt(start + 3600000);
  await page.getByRole('button', { name: 'All properties', exact: true }).click();
  await page.getByRole('button', { name: 'Attach corridor', exact: true }).click(); await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  await page.locator('#entities').getByRole('button', { name: 'Spawn · room-1', exact: true }).click();
  for (const [axis, value] of [['X', '0'], ['Y', '0'], ['Z', '4']]) await page.getByLabel(`content-position ${axis}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await page.locator('#entities').getByRole('button', { name: 'exit-1 · exit · room-1', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content room', exact: true }).selectOption('room-3');
  for (const [axis, value] of [['X', '0'], ['Y', '0'], ['Z', '-4']]) await page.getByLabel(`content-position ${axis}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await page.locator('#rooms').getByRole('button', { name: 'room-1 · room', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('relay');
  await page.getByLabel('place-position Z', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('health');
  await page.getByLabel('place-position X', { exact: true }).fill('2'); await page.getByLabel('place-position Z', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.locator('#rooms').getByRole('button', { name: 'room-2 · corridor', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('enemy');
  await page.getByLabel('place-position X', { exact: true }).fill('1.5'); await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByLabel('Required for completion', { exact: true }).uncheck(); await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Connection', exact: true }).selectOption('connection-1');
  await page.getByRole('combobox', { name: 'Unlock relay', exact: true }).selectOption('relay-1'); await page.getByRole('button', { name: 'Apply door', exact: true }).click();
  const authored = await exportDocument(page, testInfo, 'three-space-authored.json');
  expect(JSON.parse(authored).rooms).toHaveLength(3); compileLevelDocument(JSON.parse(authored));
  // Fresh JSON import is the portable-backup path, independent of autosave.
  await page.locator('#file').setInputFiles({ name: 'three-space-authored.json', mimeType: 'application/json', buffer: Buffer.from(authored) });
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Mission playtest"]');
  await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await page.keyboard.press('r'); await expect(frame.locator('#arena-guide')).toContainText('RELAYS 1/1', { ignoreCase: true });
  await page.keyboard.down('w');
  try { await advanceUntil(page, () => frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 250, message: 'Authored three-space mission did not complete within 25 simulation seconds' }); }
  finally { await page.keyboard.up('w'); }
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click(); await expect(page.locator('#playtest-panel')).toBeHidden();
  expect(await exportDocument(page, testInfo, 'three-space-after-play.json')).toBe(authored);
  await page.getByRole('tab', { name: 'Wall', exact: true }).click();
  await page.getByLabel('Face color', { exact: true }).fill('#416f85'); await page.getByRole('button', { name: 'Apply face style', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await exportDocument(page, testInfo, 'three-space-after-undo.json')).toBe(authored);
});
