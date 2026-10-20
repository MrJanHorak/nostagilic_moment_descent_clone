import { openAuthoringPanels } from '../helpers/editor-layout.mjs';
import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import EditorDocument, { createDocument } from '../../src/js/editor/EditorDocument.js';
import { toWorld, worldSize } from '../../src/js/core/levels/document/RoomMath.js';
import compileLevelDocument from '../../src/js/core/levels/document/compileLevelDocument.js';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});
async function save(page, info, name) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await pending, path = info.outputPath(name); await download.saveAs(path); return readFile(path, 'utf8');
}
async function load(page, doc) {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html'); await openAuthoringPanels(page);
  await page.locator('#file').setInputFiles({ name: 'content-move.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('#validation-title')).toContainText('Valid level');
}
async function projection(page, room = createDocument().rooms[0]) {
  const bounds = await page.locator('#viewport canvas').boundingBox(), center = new Vector3(...room.position), distance = Math.max(20, new Vector3(...worldSize(room)).length() * 1.25);
  const camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.1, 3000);
  camera.position.copy(center).add(new Vector3(1, 0.85, 1).normalize().multiplyScalar(distance)); camera.lookAt(center); camera.updateMatrixWorld();
  return {
    point: world => { const p = new Vector3(...world).project(camera); return { x: bounds.x + (p.x + 1) * bounds.width / 2, y: bounds.y + (1 - p.y) * bounds.height / 2 }; },
    factor: world => new Vector3(...world).distanceTo(camera.position) * 1.9 * Math.tan(Math.PI * 50 / 360) / 4,
  };
}
async function beginY(page, world, delta, room) {
  const p = await projection(page, room), handle = [...world]; handle[1] += p.factor(world) * 0.5;
  const from = p.point(handle); handle[1] += delta; const to = p.point(handle);
  await page.locator('#viewport canvas').focus(); await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 12 });
}

test('designer content: pickup drag moves only the selected item, rejects walls, cancels, undoes and recovers', async ({ page }, testInfo) => {
  const model = new EditorDocument(); model.addContent('room-1', 'pickup', 'health', [0, 0, 0]); await load(page, model.document);
  const before = await save(page, testInfo, 'before.json');
  await page.locator('#entities').getByRole('button', { name: 'pickup-1 · pickup · room-1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rotate XYZ', exact: true })).toBeDisabled(); await expect(page.getByRole('button', { name: 'Stretch', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Actions', exact: true }).click(); await page.getByRole('menuitem', { name: 'Move selected item', exact: true }).click();
  await beginY(page, [0, 0, 0], 1.7); await expect(page.locator('#tool-status')).toContainText('Moving pickup-1');
  await page.screenshot({ path: testInfo.outputPath('item-move-preview.png'), fullPage: true }); await page.mouse.up();
  const moved = await save(page, testInfo, 'moved.json'), doc = JSON.parse(moved), item = doc.entities.find(item => item.id === 'pickup-1');
  expect(item.position[1]).toBeGreaterThan(0); expect(item.position[1] * 2 % 1).toBe(0);
  const expected = JSON.parse(before); expected.entities.find(item => item.id === 'pickup-1').position = item.position; expect(doc).toEqual(expected);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await save(page, testInfo, 'undo.json')).toBe(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); expect(await save(page, testInfo, 'redo.json')).toBe(moved);
  await beginY(page, item.position, 8); await expect(page.locator('#tool-status')).toContainText('Cannot move pickup-1');
  await page.screenshot({ path: testInfo.outputPath('item-move-rejected.png'), fullPage: true }); await page.mouse.up();
  await expect(page.locator('#notice')).toContainText('does not fit'); await expect(page.locator('#validation-title')).toContainText('Valid level'); expect(await save(page, testInfo, 'rejected.json')).toBe(moved);
  await beginY(page, item.position, 1); await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.locator('#notice')).toContainText('Drag cancelled'); expect(await save(page, testInfo, 'cancelled.json')).toBe(moved);
  await page.reload(); await page.getByRole('button', { name: 'Restore draft', exact: true }).click(); expect(await save(page, testInfo, 'recovered.json')).toBe(moved);
});

test('designer content: native picking and movement in a rotated ramp preserve spawn orientation and room geometry', async ({ page }, testInfo) => {
  const doc = createDocument(); Object.assign(doc, { formatVersion: 6, devices: [], doors: [], mission: { ...doc.mission, type: 'relay-clear-and-exit', requiredDeviceIds: [] } });
  Object.assign(doc.rooms[0], { prefab: 'offset-corridor', size: [16, 16, 32], endOffset: [8, 16], position: [20.25, 10, -12], yaw: 90, pitch: 90, roll: 270 });
  doc.playerSpawn.position = [0, 0, 0]; doc.playerSpawn.rotation = [0.5, 0.5, 0.5, 0.5];
  await load(page, doc); const before = JSON.parse(await save(page, testInfo, 'ramp-before.json'));
  await page.getByRole('button', { name: 'Rotate XYZ', exact: true }).click(); const p = await projection(page, doc.rooms[0]), hit = p.point(toWorld(doc.rooms[0], [0, 0, 0]));
  await page.mouse.click(hit.x, hit.y); await expect(page.locator('#inspector-selection')).toContainText('Player spawn');
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true'); await expect(page.getByRole('button', { name: 'Rotate XYZ', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Move selected item', exact: true }).click(); await beginY(page, toWorld(doc.rooms[0], [0, 0, 0]), 1.2, doc.rooms[0]); await page.mouse.up();
  const moved = JSON.parse(await save(page, testInfo, 'ramp-moved.json')); expect(moved.rooms).toEqual(before.rooms); expect(moved.playerSpawn.position).not.toEqual([0, 0, 0]);
  expect(moved.playerSpawn.position.every(value => Number.isInteger(value * 2))).toBe(true); expect(moved.playerSpawn.rotation).toEqual(before.playerSpawn.rotation); expect(moved.entities).toEqual(before.entities);
  compileLevelDocument(moved);
  await page.locator('#rooms').getByRole('button').first().click(); await expect(page.getByRole('button', { name: 'Rotate XYZ', exact: true })).toBeEnabled(); await expect(page.getByRole('button', { name: 'Stretch', exact: true })).toBeEnabled();
});

test('designer content: enemy, relay and exit drags retain objective and door links', async ({ page }, testInfo) => {
  const model = new EditorDocument(); model.addContent('room-1', 'enemy', 'scout', [3, 0, 3]); model.addContent('room-1', 'relay', '', [-4, 0, -3]);
  model.attachRoom('room-1', 'negativeZ', 'straight-corridor'); model.setDoor('connection-1', 'relay-1'); await load(page, model.document);
  // Import frames both rooms. Frame the root once, then selection stays stable.
  await page.locator('#viewport canvas').focus(); await page.keyboard.press('f');
  const before = JSON.parse(await save(page, testInfo, 'mission-before.json'));
  for (const [id, kind, position] of [['enemy-1', 'enemy', [3, 0, 3]], ['relay-1', 'relay', [-4, 0, -3]], ['exit-1', 'exit', [3, 0, -3]]]) {
    await page.locator('#entities').getByRole('button', { name: `${id} · ${kind} · room-1`, exact: true }).click();
    await page.getByRole('button', { name: 'Move selected item', exact: true }).click(); await beginY(page, position, 1.2); await page.mouse.up();
    await expect(page.locator('#validation-title')).toContainText('Valid level');
  }
  const moved = JSON.parse(await save(page, testInfo, 'mission-after.json'));
  expect(moved.rooms).toEqual(before.rooms); expect(moved.connections).toEqual(before.connections); expect(moved.doors).toEqual(before.doors); expect(moved.mission).toEqual(before.mission);
  expect(moved.entities.find(item => item.id === 'enemy-1').position[1]).toBeGreaterThan(0); expect(moved.entities.find(item => item.id === 'exit-1').position[1]).toBeGreaterThan(0); expect(moved.devices[0].position[1]).toBeGreaterThan(0);
  compileLevelDocument(moved);
});

test('designer content: Escape cancels room Move and Stretch without adding history', async ({ page }, testInfo) => {
  await load(page, createDocument()); const before = await save(page, testInfo, 'room-before.json');
  for (const tool of ['Move', 'Stretch']) {
    await page.getByRole('button', { name: tool, exact: true }).click(); await beginY(page, [0, 0, 0], 1.5); await page.keyboard.press('Escape'); await page.mouse.up();
    await expect(page.locator('#notice')).toContainText('Drag cancelled'); await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled(); expect(await save(page, testInfo, `${tool}-cancelled.json`)).toBe(before);
  }
});
