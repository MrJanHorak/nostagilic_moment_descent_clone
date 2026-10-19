import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { roomVertices, toWorld } from '../../src/js/core/levels/document/RoomMath.js';
import compileLevelDocument from '../../src/js/core/levels/document/compileLevelDocument.js';
import { FlightController } from '../helpers/browser-flight.mjs';
import { advanceUntil } from '../helpers/browser-clock.mjs';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});
async function saveJSON(page, testInfo, name) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await pending, path = testInfo.outputPath(name); await download.saveAs(path); return await readFile(path, 'utf8');
}
async function projectedPoint(page, rooms, point) {
  const bounds = new Box3().setFromPoints(rooms.flatMap(room => roomVertices(room).map(point => new Vector3(...point))));
  const center = bounds.getCenter(new Vector3()), distance = Math.max(20, bounds.getSize(new Vector3()).length() * 1.25);
  const canvas = await page.locator('#viewport canvas').boundingBox(), camera = new PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 3000);
  camera.position.copy(center).add(new Vector3(1, 0.85, 1).normalize().multiplyScalar(distance)); camera.lookAt(center); camera.updateMatrixWorld();
  const screen = new Vector3(...point).project(camera);
  return { x: canvas.x + (screen.x + 1) * canvas.width / 2, y: canvas.y + (1 - screen.y) * canvas.height / 2 };
}
async function setContent(page, name, room, position) {
  await page.locator('#entities').getByRole('button', { name, exact: true }).click();
  await page.getByRole('combobox', { name: 'Content room', exact: true }).selectOption(room);
  for (const [axis, value] of ['X', 'Y', 'Z'].map((axis, i) => [axis, String(position[i])])) await page.getByLabel(`content-position ${axis}`, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
}

test('designer shapes: attach from a wall menu, pick/style the sloped floor, undo a reshape and recover v5 JSON', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  const starter = { position: [0, 0, 0], size: [16, 12, 16], yaw: 0 };
  const wall = await projectedPoint(page, [starter], [0, 1, -7.5]); await page.mouse.click(wall.x, wall.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Attach ramp or diagonal corridor…', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Ramp or diagonal corridor', exact: true });
  await form.getByLabel('Sideways offset', { exact: true }).fill('4'); await form.getByRole('button', { name: 'Attach corridor', exact: true }).click();
  await page.getByRole('tab', { name: 'Room', exact: true }).click();
  await expect(page.locator('#orientation-status')).toContainText('far end 4 sideways, 8 rise');
  await expect(page.locator('#attach-port option[value="positiveX"]')).toHaveJSProperty('disabled', true);
  await page.getByRole('combobox', { name: 'Attachment port', exact: true }).selectOption('negativeZ'); await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  const baseline = JSON.parse(await saveJSON(page, testInfo, 'sloped-baseline.json'));
  expect(baseline.rooms[1]).toMatchObject({ prefab: 'offset-corridor', endOffset: [4, 8] }); expect(baseline.formatVersion).toBe(5);
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  const floorPoint = await projectedPoint(page, baseline.rooms, toWorld(baseline.rooms[1], [0, -3.5, -4]));
  await page.mouse.click(floorPoint.x, floorPoint.y, { button: 'right' });
  await expect(page.locator('#inspector-selection')).toContainText('Sloped Floor');
  await expect(page.getByRole('menuitem', { name: 'Opening and door…', exact: true })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Attach room at this point', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('sloped-floor-menu.png'), fullPage: true });
  await page.getByRole('menuitem', { name: 'Wall color and pattern…', exact: true }).click();
  const appearance = page.getByRole('dialog', { name: 'Wall appearance', exact: true });
  await appearance.getByLabel('Wall color', { exact: true }).fill('#ad8040'); await appearance.getByRole('combobox', { name: 'Wall pattern', exact: true }).selectOption('hazard');
  await appearance.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('tab', { name: 'Room', exact: true }).click();
  await page.getByLabel('Far end rise', { exact: true }).fill('10'); await page.getByRole('button', { name: 'Apply properties', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const styled = await saveJSON(page, testInfo, 'sloped-styled.json'), document = JSON.parse(styled);
  expect(document.rooms[1].surfaces.negativeY).toEqual({ color: 0xad8040, pattern: 'hazard' }); compileLevelDocument(document);
  await page.screenshot({ path: testInfo.outputPath('sloped-three-spaces.png'), fullPage: true });
  await page.reload(); await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  expect(await saveJSON(page, testInfo, 'sloped-recovered.json')).toBe(styled);
  await page.locator('#file').setInputFiles({ name: 'sloped.json', mimeType: 'application/json', buffer: Buffer.from(styled) });
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Mission playtest"]'); await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await expect(frame.locator('#arena-guide')).toContainText('Location: Blue Room 1'); await expect(frame.locator('#runtime-diagnostics')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click(); await expect(page.locator('#playtest-panel')).toBeHidden();
  expect(await saveJSON(page, testInfo, 'sloped-after-preview.json')).toBe(styled);
});

// Observe the development diagnostics while delivering native keyboard input.
// No writes to the game, document, transforms, velocity or clock stepper.
async function flyAxis(page, frame, axis, target) {
  const keys = [['a', 'd'], ['ControlLeft', 'Space'], ['w', 's']][axis], controller = new FlightController(target);
  let held = null, last;
  const read = async () => JSON.parse(await frame.locator('#runtime-diagnostics').getAttribute('data-flight'));
  try {
    await advanceUntil(page, async () => {
      last = await read();
      if (last.phase === 'completed') return true;
      if (last.phase !== 'playing') throw new Error(`Flight interrupted: ${JSON.stringify(last)}`);
      if (Math.abs(last.position[axis] - target) < 0.3 && last.speed < 0.15) return true;
      const command = controller.update(last.position[axis], last.velocity[axis], last.timeMs), next = command > 0 ? keys[1] : command < 0 ? keys[0] : null;
      if (held !== next) { if (held) await page.keyboard.up(held); if (next) await page.keyboard.down(next); held = next; }
      return false;
    }, { ticks: 350, message: `Sloped flight did not reach ${'XYZ'[axis]}=${target}` });
  } catch (error) { throw new Error(`${error.message}; last flight ${JSON.stringify(last)}`, { cause: error }); }
  finally { if (held) await page.keyboard.up(held); }
  await advanceUntil(page, async () => { const value = await read(); return value.phase !== 'playing' || value.speed < 0.03; }, { ticks: 60 });
}

test('development: designer shaped corridor authors and flies a combined ramp/diagonal mission with relay, export and return', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const time = Date.UTC(2026, 0, 1); await page.clock.install({ time });
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5183/editor.html?smoke=1');
  await page.getByRole('button', { name: 'Playtest level', exact: true }).waitFor({ state: 'visible' }); await page.clock.pauseAt(time + 3600000);
  await page.getByRole('button', { name: 'Attach shaped corridor', exact: true }).click();
  await expect(page.getByLabel('Far end rise', { exact: true })).toHaveValue('8');
  // Preset attachment and its version upgrade are one undo command.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const starter = { position: [0, 0, 0], size: [16, 12, 16], yaw: 0 }, wall = await projectedPoint(page, [starter], [0, 0, -7.5]);
  await page.mouse.click(wall.x, wall.y, { button: 'right' }); await page.getByRole('menuitem', { name: 'Attach ramp or diagonal corridor…', exact: true }).click();
  await page.getByRole('dialog', { name: 'Ramp or diagonal corridor', exact: true }).getByLabel('Sideways offset', { exact: true }).fill('8');
  await page.getByRole('dialog', { name: 'Ramp or diagonal corridor', exact: true }).getByRole('button', { name: 'Attach corridor', exact: true }).click();
  await page.getByRole('combobox', { name: 'Attachment port', exact: true }).selectOption('negativeZ'); await page.getByRole('button', { name: 'Attach room', exact: true }).click();
  await page.getByRole('button', { name: 'All properties', exact: true }).click();
  await setContent(page, 'Spawn · room-1', 'room-1', [0, 0, 0]); await setContent(page, 'exit-1 · exit · room-1', 'room-3', [0, 0, 0]);
  await page.locator('#rooms').getByRole('button', { name: 'room-1 · room', exact: true }).click();
  await page.getByRole('combobox', { name: 'Content kind', exact: true }).selectOption('relay'); await page.getByLabel('place-position X', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Add content', exact: true }).click();
  await page.getByRole('combobox', { name: 'Connection', exact: true }).selectOption('connection-1'); await page.getByRole('combobox', { name: 'Unlock relay', exact: true }).selectOption('relay-1');
  await page.getByRole('button', { name: 'Apply door', exact: true }).click();
  const text = await saveJSON(page, testInfo, 'combined-ramp-mission.json');
  await page.locator('#file').setInputFiles({ name: 'combined-ramp-mission.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByRole('button', { name: 'Playtest level', exact: true }).click(); const frame = page.frameLocator('iframe[title="Mission playtest"]');
  await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter'); await page.clock.fastForward(100);
  await page.keyboard.press('r'); await expect(frame.locator('#arena-guide')).toContainText('Relays 1/1');
  for (const [z, xy] of [[-12, 2], [-16, 4], [-20, 6], [-26, 8]]) {
    await test.step(`Fly to the sloped section at Z=${z}`, async () => { await flyAxis(page, frame, 2, z); await flyAxis(page, frame, 0, xy); await flyAxis(page, frame, 1, xy); });
  }
  await page.screenshot({ path: testInfo.outputPath('ramp-flight-far-room.png'), fullPage: true });
  await flyAxis(page, frame, 2, -32); await expect(frame.getByRole('heading', { name: 'MISSION COMPLETE', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click(); await expect(page.locator('#playtest-panel')).toBeHidden();
  expect(await saveJSON(page, testInfo, 'combined-ramp-after-play.json')).toBe(text);
});
