import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import compileLevelDocument from '../../src/js/core/levels/document/compileLevelDocument.js';
import { advanceUntil } from '../helpers/browser-clock.mjs';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});

async function saveJSON(page, testInfo, name) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await pending, path = testInfo.outputPath(name); await download.saveAs(path); return await readFile(path, 'utf8');
}
async function projectStarter(page, point) {
  const bounds = await page.locator('#viewport canvas').boundingBox(), camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.1, 3000);
  camera.position.copy(new Vector3(1, 0.85, 1).normalize().multiplyScalar(new Vector3(16, 12, 16).length() * 1.25));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const screen = new Vector3(...point).project(camera);
  return { x: bounds.x + (screen.x + 1) * bounds.width / 2, y: bounds.y + (1 - screen.y) * bounds.height / 2 };
}

test('designer vertical: attach a shaft from a floor menu, author a hatch and fly through two vertical passages', async ({ page }, testInfo) => {
  const start = Date.UTC(2026, 0, 1); await page.clock.install({ time: start });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await page.getByRole('button', { name: 'Playtest level', exact: true }).waitFor({ state: 'visible' }); await page.clock.pauseAt(start + 3600000);
  const floor = await projectStarter(page, [0, -5.5, 0]); await page.mouse.click(floor.x, floor.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Attach vertical shaft at this point', exact: true }).click();
  await page.getByRole('tab', { name: 'Room', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Pitch (X)', exact: true })).toHaveValue('90');
  await expect(page.locator('#orientation-status')).toContainText('Vertical shaft');
  await expect(page.locator('#attach-port option[value="positiveZ"]')).toHaveText('Floor (local +Z)');
  await page.getByRole('combobox', { name: 'Attachment port', exact: true }).selectOption('positiveZ');
  await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  await page.getByRole('button', { name: 'All properties', exact: true }).click();
  for (const [id, room] of [['@spawn', 'room-1'], ['exit-1', 'room-3']]) {
    await page.locator('#entities').getByRole('button', { name: id === '@spawn' ? 'Spawn · room-1' : 'exit-1 · exit · room-1', exact: true }).click();
    await page.getByRole('combobox', { name: 'Content room', exact: true }).selectOption(room);
    for (const axis of ['X', 'Y', 'Z']) await page.getByLabel(`content-position ${axis}`, { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  }
  await page.locator('#rooms').getByRole('button', { name: 'room-1 · room', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('relay');
  await page.getByLabel('place-position X', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Connection', exact: true }).selectOption('connection-1');
  await page.getByRole('combobox', { name: 'Unlock relay', exact: true }).selectOption('relay-1'); await page.getByRole('button', { name: 'Apply door', exact: true }).click();
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('vertical-three-spaces.png'), fullPage: true });
  const text = await saveJSON(page, testInfo, 'vertical-mine.json'), document = JSON.parse(text), level = compileLevelDocument(document);
  expect(document.formatVersion).toBe(4); expect(document.rooms[1].size).toEqual([8, 8, 16]); expect(document.rooms[1].pitch).toBe(90);
  expect(document.rooms[1].position).toEqual([0, -14, 0]); expect(level.mission.exit.position).toEqual([0, -28, 0]);
  await page.locator('#file').setInputFiles({ name: 'vertical-mine.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Mission playtest"]'); await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await page.keyboard.press('r'); await expect(frame.locator('#arena-guide')).toContainText('RELAYS 1/1', { ignoreCase: true });
  await page.keyboard.down('ControlLeft');
  try { await advanceUntil(page, () => frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 150, message: 'Native downward thrust did not cross both authored hatches and reach the exit' }); }
  finally { await page.keyboard.up('ControlLeft'); }
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click(); await expect(page.locator('#playtest-panel')).toBeHidden();
  expect(await saveJSON(page, testInfo, 'vertical-after-play.json')).toBe(text);
  await page.locator('#rooms').getByRole('button', { name: 'room-1 · room', exact: true }).click();
  await page.getByRole('combobox', { name: 'Attachment port', exact: true }).selectOption('positiveY');
  await page.getByRole('button', { name: 'Attach corridor', exact: true }).click();
  const upward = JSON.parse(await saveJSON(page, testInfo, 'up-and-down.json'));
  expect(upward.rooms[3].position).toEqual([0, 14, 0]); expect(upward.rooms[3].pitch).toBe(90);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await saveJSON(page, testInfo, 'vertical-after-undo.json')).toBe(text);
});

test('designer vertical: numeric pitch/roll, native rotation ring, undo and draft recovery retain authored orientation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  const original = await saveJSON(page, testInfo, 'unrotated.json');
  await page.getByRole('combobox', { name: 'Pitch (X)', exact: true }).selectOption('90'); await page.getByRole('combobox', { name: 'Roll (Z)', exact: true }).selectOption('270');
  await page.getByRole('button', { name: 'Apply properties', exact: true }).click();
  const rotated = await saveJSON(page, testInfo, 'rotated.json');
  expect(JSON.parse(rotated).rooms[0]).toMatchObject({ yaw: 0, pitch: 90, roll: 270 });
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await saveJSON(page, testInfo, 'undo-orientation.json')).toBe(original);
  await page.getByRole('button', { name: 'Rotate XYZ', exact: true }).click();
  const distance = new Vector3(16, 12, 16).length() * 1.25, radius = distance * 1.9 * Math.tan(50 * Math.PI / 360) / 8;
  const from = await projectStarter(page, [0, radius * 0.3, radius * Math.sqrt(1 - 0.3 ** 2)]);
  const to = await projectStarter(page, [0, -radius * 1.8, radius * 2]);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 15 }); await page.mouse.up();
  const gizmo = await saveJSON(page, testInfo, 'native-rotation.json'), room = JSON.parse(gizmo).rooms[0];
  expect((room.pitch ?? 0) !== 0 || (room.roll ?? 0) !== 0).toBe(true);
  await expect(page.locator('#validation-title')).toContainText('Valid level');
  await page.screenshot({ path: testInfo.outputPath('rotation-xyz.png'), fullPage: true });
  await page.reload(); await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  expect(await saveJSON(page, testInfo, 'orientation-recovered.json')).toBe(gizmo);
});
