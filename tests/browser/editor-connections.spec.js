import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import EditorDocument from '../../src/js/editor/EditorDocument.js';
import { worldSize } from '../../src/js/core/levels/document/RoomMath.js';
import compileLevelDocument from '../../src/js/core/levels/document/compileLevelDocument.js';
import { advanceUntil } from '../helpers/browser-clock.mjs';

const test = base.extend({ cleanBrowser: [async ({ page }, use) => { const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); await use(); expect(errors).toEqual([]); }, { auto: true }] });
function fixture() {
  const model = new EditorDocument(); model.resizeRoom('room-1', [32, 16, 16]); const hall = model.attachAt('room-1', 'negativeZ', [-8, 0, -8], 'straight-corridor');
  const side = model.attachRoom(hall, 'positiveX', 'box-room'); model.updateContent('@spawn', 'room-1', [4, 0, 0], false); model.updateContent('exit-1', side, [0, 0, 0], false); return model;
}
async function load(page, doc) {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await page.locator('#file').setInputFiles({ name: 'join.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) }); await expect(page.locator('#validation-title')).toContainText('Valid level');
}
async function save(page, info, name) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click(); const download = await pending, path = info.outputPath(name); await download.saveAs(path); return readFile(path, 'utf8');
}
async function contextAt(page, doc, world) {
  const bounds = await page.locator('#viewport canvas').boundingBox(), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const room of doc.rooms) { const size = worldSize(room); for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], room.position[axis] - size[axis] / 2); max[axis] = Math.max(max[axis], room.position[axis] + size[axis] / 2); } }
  const center = new Vector3(...min.map((value, axis) => (value + max[axis]) / 2)), size = new Vector3(...min.map((value, axis) => max[axis] - value)).length();
  const camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.1, 3000); camera.position.copy(center).add(new Vector3(1, 0.85, 1).normalize().multiplyScalar(Math.max(20, size * 1.25))); camera.lookAt(center); camera.updateMatrixWorld();
  const point = new Vector3(...world).project(camera); await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2, { button: 'right' });
  await expect(page.locator('#viewport-context-menu')).toBeVisible();
}

test('designer joins: close an off-center loop, add a relay door from its frame and fly the full shared opening', async ({ page }, info) => {
  const start = Date.UTC(2026, 0, 1); await page.clock.install({ time: start }); const model = fixture(); await load(page, model.document); await page.clock.pauseAt(start + 3600000);
  await contextAt(page, model.document, [4, 4, -7.5]); await page.getByRole('menuitem', { name: 'Connect to existing room…', exact: true }).click();
  const join = page.getByRole('dialog', { name: 'Connect existing rooms', exact: true });
  await join.getByRole('combobox', { name: 'Target wall', exact: true }).selectOption({ label: 'room-3 · Rear wall · touching' }); await join.getByRole('combobox', { name: 'Opening style', exact: true }).selectOption('full'); await join.getByRole('button', { name: 'Connect rooms', exact: true }).click();
  const loop = await save(page, info, 'loop.json'), doc = JSON.parse(loop); expect(doc.formatVersion).toBe(7); expect(doc.connections).toHaveLength(3); expect(doc.connections[2].openingSize).toEqual([15, 11]);
  await contextAt(page, doc, [11.5, 0, -8]); await page.getByRole('menuitem', { name: 'Add or edit relay door…', exact: true }).click();
  const door = page.getByRole('dialog', { name: 'Relay-controlled door', exact: true }); await expect(door).toContainText('room-3'); await expect(door.getByRole('combobox', { name: 'Door control', exact: true })).toHaveValue('@new');
  await page.screenshot({ path: info.outputPath('relay-door-dialog.png'), fullPage: true }); await door.getByRole('button', { name: 'Apply door', exact: true }).click();
  const text = await save(page, info, 'loop-door.json'), authored = JSON.parse(text); expect(authored.devices).toHaveLength(1); expect(authored.doors[0].connectionId).toBe('connection-3'); expect(authored.mission.requiredDeviceIds).toEqual([authored.devices[0].id]);
  // This corner of the large door is closer to the other portal's center.
  // Picking the door must keep its own identity rather than choose by distance.
  await contextAt(page, authored, [-3, 0, -7.5]); await page.getByRole('menuitem', { name: 'Add or edit relay door…', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Relay-controlled door', exact: true })).toContainText('room-3'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.screenshot({ path: info.outputPath('loop-shared-openings.png'), fullPage: true }); compileLevelDocument(authored);
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click(); const frame = page.frameLocator('iframe[title="Mission playtest"]'); await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await page.keyboard.press('r'); await expect(frame.locator('#arena-guide')).toContainText('RELAYS 1/1', { ignoreCase: true }); await page.keyboard.down('w');
  try { await advanceUntil(page, () => frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 130, message: 'The full shared opening did not allow native flight through its unlocked relay door' }); } finally { await page.keyboard.up('w'); }
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click(); expect(await save(page, info, 'after-flight.json')).toBe(text);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await save(page, info, 'undo-door.json')).toBe(loop); await page.getByRole('button', { name: 'Redo', exact: true }).click(); expect(await save(page, info, 'redo-door.json')).toBe(text);
  await page.locator('#file').setInputFiles({ name: 'loop-door.json', mimeType: 'application/json', buffer: Buffer.from(text) }); expect(await save(page, info, 'reload-loop.json')).toBe(text);
});

test('designer joins: fit a corridor free end to close a gapped loop without moving its target', async ({ page }, info) => {
  const model = new EditorDocument(), east = model.attachRoom('room-1', 'positiveX', 'box-room'), north = model.attachRoom(east, 'negativeZ', 'straight-corridor'); model.resizeRoom(north, [8, 8, 32]);
  const corner = model.attachRoom(north, 'negativeZ', 'box-room'), west = model.attachRoom(corner, 'negativeX', 'box-room'), hall = model.attachRoom(west, 'positiveZ', 'straight-corridor'); await load(page, model.document);
  const before = await save(page, info, 'before-fit.json'); await page.locator('#rooms').getByRole('button', { name: `${hall} · corridor`, exact: true }).click(); await page.getByRole('tab', { name: 'Connections', exact: true }).click();
  await page.getByRole('combobox', { name: 'Selected room port', exact: true }).selectOption('positiveZ'); await page.getByRole('button', { name: 'Connect / snap existing rooms…', exact: true }).click();
  const join = page.getByRole('dialog', { name: 'Connect existing rooms', exact: true }); await expect(join.getByRole('combobox', { name: 'Alignment', exact: true })).toHaveValue('fit');
  await join.getByRole('combobox', { name: 'Alignment', exact: true }).selectOption('snap'); await join.getByRole('button', { name: 'Connect rooms', exact: true }).click(); await expect(join.getByRole('alert')).toContainText('already share a route');
  await join.getByRole('combobox', { name: 'Alignment', exact: true }).selectOption('fit'); await join.getByRole('combobox', { name: 'Opening style', exact: true }).selectOption('full'); await join.getByRole('button', { name: 'Connect rooms', exact: true }).click();
  const fitted = await save(page, info, 'fitted-loop.json'), doc = JSON.parse(fitted); expect(doc.rooms.find(room => room.id === hall).size).toEqual([8, 8, 32]); expect(doc.connections).toHaveLength(6);
  for (const room of model.document.rooms) if (room.id !== hall) expect(doc.rooms.find(other => other.id === room.id).position).toEqual(room.position);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await save(page, info, 'undo-fit.json')).toBe(before); await page.getByRole('button', { name: 'Redo', exact: true }).click(); expect(await save(page, info, 'redo-fit.json')).toBe(fitted);
});

test('designer joins: attach another room on a large wall, open the shared face and link a manually placed relay', async ({ page }, info) => {
  const model = new EditorDocument(); model.resizeRoom('room-1', [32, 16, 16]); model.attachAt('room-1', 'negativeZ', [-8, 0, -8], 'straight-corridor'); await load(page, model.document);
  await contextAt(page, model.document, [8, 0, -7.5]); await page.getByRole('menuitem', { name: 'Attach room at this point', exact: true }).click();
  const attached = JSON.parse(await save(page, info, 'second-wall-room.json')); expect(attached.rooms[2].position).toEqual([8, 0, -16]); expect(attached.connections).toHaveLength(2);
  // Camera retains the previous framing after attachment. Frame all explicitly.
  await page.getByRole('button', { name: 'Frame all', exact: true }).click(); await contextAt(page, attached, [11, 0, -8]); await page.getByRole('menuitem', { name: 'Use full shared opening', exact: true }).click();
  const full = JSON.parse(await save(page, info, 'full-second-room.json')); expect(full.connections[1].openingSize).toEqual([15, 11]);
  await page.locator('#rooms').getByRole('button', { name: 'room-1 · room', exact: true }).click(); await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('relay'); await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('tab', { name: 'Wall', exact: true }).click(); await page.getByRole('combobox', { name: 'Connection', exact: true }).selectOption('connection-2'); await page.getByRole('button', { name: 'Add or edit relay door…', exact: true }).click();
  const door = page.getByRole('dialog', { name: 'Relay-controlled door', exact: true }); await door.getByRole('combobox', { name: 'Door control', exact: true }).selectOption('relay-1'); await door.getByRole('button', { name: 'Apply door', exact: true }).click();
  const doc = JSON.parse(await save(page, info, 'manually-linked-door.json')); expect(doc.devices).toHaveLength(1); expect(doc.doors[0].deviceId).toBe('relay-1'); expect(doc.doors[0].connectionId).toBe('connection-2'); compileLevelDocument(doc);
});
