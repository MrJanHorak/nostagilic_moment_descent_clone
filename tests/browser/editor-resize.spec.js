import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import { advanceUntil } from '../helpers/browser-clock.mjs';
import { createDocument } from '../../src/js/editor/EditorDocument.js';
import compileLevelDocument from '../../src/js/core/levels/document/compileLevelDocument.js';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});
async function save(page, info, name) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await pending, path = info.outputPath(name); await download.saveAs(path); return readFile(path, 'utf8');
}
async function resize(page, size) {
  const dialog = page.getByRole('dialog', { name: 'Resize room', exact: true });
  for (const [index, label] of ['Width (local X)', 'Height (local Y)', 'Length (local Z)'].entries()) await dialog.getByLabel(label, { exact: true }).fill(String(size[index]));
  await dialog.getByRole('button', { name: 'Resize and keep connections', exact: true }).click();
}

test('designer resize: wall menu, precise dimensions, native stretch, undo and draft recovery', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  const original = await save(page, testInfo, 'starter.json');
  const bounds = await page.locator('#viewport canvas').boundingBox(), camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.1, 3000);
  camera.position.copy(new Vector3(1, 0.85, 1).normalize().multiplyScalar(new Vector3(16, 12, 16).length() * 1.25)); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const point = new Vector3(0, 1, -7.5).project(camera);
  await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Resize room…', exact: true }).click();
  await resize(page, [32, 24, 16]);
  await expect(page.locator('#room-count')).toHaveText('1 / 256');
  const resized = JSON.parse(await save(page, testInfo, 'precise-resize.json')); expect(resized.rooms[0].size).toEqual([32, 24, 16]); expect(resized.playerSpawn).toEqual(JSON.parse(original).playerSpawn);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await save(page, testInfo, 'undo-precise.json')).toBe(original);
  await page.getByRole('tab', { name: 'Room', exact: true }).click();
  await page.getByRole('button', { name: 'Stretch', exact: true }).click();
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height * 0.4;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - bounds.height * 0.08, { steps: 10 }); await page.mouse.up();
  await expect(page.getByLabel('size Y', { exact: true })).not.toHaveValue('12');
  const stretched = await save(page, testInfo, 'native-stretch.json'); expect(JSON.parse(stretched).rooms[0].size[1]).toBeGreaterThan(12);
  await page.screenshot({ path: testInfo.outputPath('stretch-controls.png'), fullPage: true });
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await save(page, testInfo, 'undo-stretch.json')).toBe(original);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); expect(await save(page, testInfo, 'redo-stretch.json')).toBe(stretched);
  await page.reload(); await page.getByRole('button', { name: 'Restore draft', exact: true }).click(); expect(await save(page, testInfo, 'recovered-stretch.json')).toBe(stretched);
});

test('designer resize: stretch a connected corridor, reject a bad shrink and fly its preserved door passages', async ({ page }, testInfo) => {
  const start = Date.UTC(2026, 0, 1); await page.clock.install({ time: start });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await page.getByRole('button', { name: 'Playtest level', exact: true }).waitFor({ state: 'visible' }); await page.clock.pauseAt(start + 3600000);
  await page.getByRole('button', { name: 'Attach corridor', exact: true }).click(); await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  await page.getByRole('button', { name: 'All properties', exact: true }).click();
  for (const [id, room] of [['@spawn', 'room-1'], ['exit-1', 'room-3']]) {
    await page.locator('#entities').getByRole('button', { name: id === '@spawn' ? 'Spawn · room-1' : 'exit-1 · exit · room-1', exact: true }).click();
    await page.getByRole('combobox', { name: 'Content room', exact: true }).selectOption(room);
    for (const axis of ['X', 'Y', 'Z']) await page.getByLabel(`content-position ${axis}`, { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  }
  await page.locator('#rooms').getByRole('button', { name: 'room-1 · room', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('relay'); await page.getByLabel('place-position X', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Connection', exact: true }).selectOption('connection-1'); await page.getByRole('combobox', { name: 'Unlock relay', exact: true }).selectOption('relay-1'); await page.getByRole('button', { name: 'Apply door', exact: true }).click();
  await page.locator('#rooms').getByRole('button', { name: 'room-2 · corridor', exact: true }).click();
  await page.getByRole('button', { name: 'Resize and keep connections…', exact: true }).click(); await resize(page, [12, 10, 32.5]);
  await expect(page.locator('#validation-title')).toContainText('Valid level');
  const text = await save(page, testInfo, 'connected-resize.json'), doc = JSON.parse(text); expect(doc.rooms[1].position).toEqual([0, 0, -24.25]); expect(doc.rooms[2].position).toEqual([0, 0, -48.5]); expect(doc.doors).toHaveLength(1);
  expect(compileLevelDocument(doc).mission.exit.position).toEqual([0, 0, -48.5]);
  await page.getByRole('button', { name: 'Resize and keep connections…', exact: true }).click(); await resize(page, [4, 4, 32.5]);
  await expect(page.getByRole('dialog', { name: 'Resize room', exact: true }).getByRole('alert')).toContainText('Opening must fit');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(await save(page, testInfo, 'after-rejected-shrink.json')).toBe(text);
  await page.getByRole('button', { name: 'Frame all', exact: true }).click(); await page.screenshot({ path: testInfo.outputPath('connected-stretch.png'), fullPage: true });
  await page.locator('#file').setInputFiles({ name: 'resized.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Mission playtest"]'); await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await page.keyboard.press('r'); await expect(frame.locator('#arena-guide')).toContainText('RELAYS 1/1', { ignoreCase: true });
  await page.keyboard.down('w');
  try { await advanceUntil(page, () => frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 200, message: 'Native forward flight did not cross both resized passages' }); }
  finally { await page.keyboard.up('w'); }
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click(); expect(await save(page, testInfo, 'resized-after-flight.json')).toBe(text);
});

test('designer resize: import, frame and export a full 256-room mine', async ({ page }, testInfo) => {
  const doc = createDocument(), starter = structuredClone(doc.rooms[0]);
  Object.assign(doc, { formatVersion: 6, devices: [], doors: [], mission: { ...doc.mission, type: 'relay-clear-and-exit', requiredDeviceIds: [] } });
  doc.rooms = Array.from({ length: 256 }, (_, i) => ({ ...starter, id: `room-${i + 1}`, position: [0, 0, -16 * i] }));
  doc.connections = Array.from({ length: 255 }, (_, i) => ({ id: `connection-${i + 1}`, a: { roomId: `room-${i + 1}`, port: 'negativeZ' }, b: { roomId: `room-${i + 2}`, port: 'positiveZ' }, openingSize: [6, 6] }));
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await page.locator('#file').setInputFiles({ name: 'large-mine.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('#room-count')).toHaveText('256 / 256'); await expect(page.locator('#validation-title')).toContainText('Valid level');
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('256-room-frame.png'), fullPage: true });
  expect(JSON.parse(await save(page, testInfo, 'large-mine-export.json')).rooms).toHaveLength(256);
  await page.getByRole('button', { name: 'Attach room', exact: true }).click(); await expect(page.locator('#notice')).toContainText('256'); await expect(page.locator('#room-count')).toHaveText('256 / 256');
});

test('designer resize: native hallway drag and numeric edits stay snapped; repair a displaced connection', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await page.getByRole('button', { name: 'Attach corridor', exact: true }).click(); await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  await page.locator('#rooms').getByRole('button', { name: 'room-2 · corridor', exact: true }).click();
  await page.getByRole('button', { name: 'Frame all', exact: true }).click(); await page.getByRole('button', { name: 'Stretch', exact: true }).click();
  const before = await save(page, testInfo, 'hallway-before-drag.json');
  const bounds = await page.locator('#viewport canvas').boundingBox(), camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.1, 3000);
  const distance = new Vector3(16, 12, 48).length() * 1.25, center = new Vector3(0, 0, -16);
  camera.position.copy(center).add(new Vector3(1, 0.85, 1).normalize().multiplyScalar(distance)); camera.lookAt(center); camera.updateMatrixWorld();
  const factor = distance * 1.9 * Math.tan(Math.PI * 50 / 360) / 4;
  const screen = z => { const p = new Vector3(0, 0, -16 + z * factor).project(camera); return { x: bounds.x + (p.x + 1) * bounds.width / 2, y: bounds.y + (1 - p.y) * bounds.height / 2 }; };
  const from = screen(0.5), to = screen(0.8);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 10 });
  await expect(page.locator('#stretch-status')).toContainText('Width 8 · Height 8 · Length');
  await expect(page.locator('#stretch-status')).not.toContainText('Cannot apply');
  await page.screenshot({ path: testInfo.outputPath('snapped-hallway-during-drag.png'), fullPage: true }); await page.mouse.up();
  const dragged = JSON.parse(await save(page, testInfo, 'hallway-after-drag.json')), length = dragged.rooms[1].size[2];
  expect(length).toBeGreaterThan(16); expect(dragged.rooms[0].position).toEqual([0, 0, 0]); expect(dragged.rooms[1].position[2] + length / 2).toBe(-8); expect(dragged.rooms[2].position[2] + 8).toBe(-8 - length);
  expect(compileLevelDocument(dragged).sourceDocument.connections).toHaveLength(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await save(page, testInfo, 'hallway-undone.json')).toBe(before);
  // Numeric resizing must use the identical anchor/branch behavior.
  await page.getByLabel('size Z', { exact: true }).fill('40.5'); await page.getByRole('button', { name: 'Apply properties', exact: true }).click();
  await expect(page.locator('#validation-title')).toContainText('Valid level'); const resized = JSON.parse(await save(page, testInfo, 'hallway-numeric.json'));
  expect(resized.rooms[1].position).toEqual([0, 0, -28.25]); expect(resized.rooms[2].position).toEqual([0, 0, -56.5]);
  await page.getByLabel('position X', { exact: true }).fill('0.5'); await page.getByRole('button', { name: 'Apply properties', exact: true }).click();
  await expect(page.locator('#validation-title')).toContainText('validation issue');
  await page.getByRole('button', { name: 'Snap connections', exact: true }).click(); await expect(page.locator('#validation-title')).toContainText('Valid level');
  const snapped = JSON.parse(await save(page, testInfo, 'hallway-repaired.json')); expect(snapped.rooms).toEqual(resized.rooms);
});
