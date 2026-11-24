import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import compileLevelDocument from '../../src/js/core/levels/document/compileLevelDocument.js';

const test = base.extend({
  cleanBrowser: [async ({ page }, use) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});

// Real mouse events at projected points of the starter room; no injected state.
async function contextAt(page, point) {
  const bounds = await page.locator('#viewport canvas').boundingBox();
  const camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.1, 3000);
  camera.position.copy(new Vector3(1, 0.85, 1).normalize().multiplyScalar(new Vector3(16, 12, 16).length() * 1.25));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const screen = new Vector3(...point).project(camera);
  await page.mouse.click(bounds.x + (screen.x + 1) * bounds.width / 2, bounds.y + (1 - screen.y) * bounds.height / 2, { button: 'right' });
  await expect(page.locator('#viewport-context-menu')).toBeVisible();
  return page.locator('#viewport-context-menu');
}

test('designer story: write radio messages, place a data log and a miner, export a v13 mission', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto('http://127.0.0.1:5184/editor.html');
  await page.getByRole('button', { name: 'Story & radio…', exact: true }).click();
  let story = page.getByRole('dialog', { name: 'Story and radio', exact: true });
  await expect(story).toContainText('No radio messages yet');
  await expect(story).toContainText('upgrades this level to format 13');

  for (const [trigger, speaker, text] of [['start', 'Vey', 'Find the miners.'], ['enter:room-1', 'FOREMAN', 'Seal breach detected.']]) {
    await story.getByRole('button', { name: 'Add radio message', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'New radio message', exact: true });
    await form.getByRole('combobox', { name: 'Plays when' }).selectOption(trigger);
    await form.getByLabel('Speaker', { exact: true }).fill(speaker);
    await form.getByLabel(/^Message/).fill(text);
    await form.getByRole('button', { name: 'Add message', exact: true }).click();
    story = page.getByRole('dialog', { name: 'Story and radio', exact: true });
    await expect(story).toContainText(`${speaker}: ${text}`);
  }
  await expect(story.locator('.story-row').first()).toContainText('Mission start');
  await story.getByRole('button', { name: 'Move msg-2 earlier', exact: true }).click();
  story = page.getByRole('dialog', { name: 'Story and radio', exact: true });
  await expect(story.locator('.story-row').first()).toContainText('FOREMAN: Seal breach detected.');
  await expect(story.getByRole('button', { name: 'Edit msg-2', exact: true })).toBeFocused();
  // Cancel from the editor returns to the list without changes.
  await story.getByRole('button', { name: 'Edit msg-1', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit msg-1', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
  story = page.getByRole('dialog', { name: 'Story and radio', exact: true });
  await expect(story.locator('.story-row')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('story-dialog.png'), fullPage: true });
  await story.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#format-version')).toContainText('Format 13');

  let menu = await contextAt(page, [-3, -5.5, -3]);
  await menu.getByRole('menuitem', { name: 'Place data log here…', exact: true }).click();
  const logForm = page.getByRole('dialog', { name: 'Place data log', exact: true });
  await logForm.getByLabel('Log title', { exact: true }).fill('Shift 4');
  await logForm.getByLabel(/^Log text/).fill('The seal held until 0300.');
  await logForm.getByRole('button', { name: 'Place log', exact: true }).click();
  await expect(page.locator('#inspector-selection')).toContainText('log-1');
  await expect(page.locator('#story-title')).toHaveValue('Shift 4');
  await expect(page.locator('#story-name')).toBeHidden();

  menu = await contextAt(page, [3, -5.5, 3]);
  await menu.getByRole('menuitem', { name: 'Place trapped miner here…', exact: true }).click();
  const minerForm = page.getByRole('dialog', { name: 'Place trapped miner', exact: true });
  await minerForm.getByLabel('Miner name', { exact: true }).fill('Ana');
  await minerForm.getByRole('button', { name: 'Place miner', exact: true }).click();
  await expect(page.locator('#inspector-selection')).toContainText('miner-1');
  await page.locator('#story-name').fill('Ana Ruiz');
  await page.getByRole('button', { name: 'Apply content', exact: true }).click();
  await expect(page.locator('#validation-title')).toContainText('Valid level');
  await page.screenshot({ path: testInfo.outputPath('story-inspector.png'), fullPage: true });

  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const path = testInfo.outputPath('story.json'); await (await pending).saveAs(path);
  const document = JSON.parse(await readFile(path, 'utf8'));
  expect(document.formatVersion).toBe(13);
  expect(document.story.messages.map(message => message.speaker)).toEqual(['FOREMAN', 'Vey']);
  expect(document.story.logs).toEqual([expect.objectContaining({ id: 'log-1', roomId: 'room-1', title: 'Shift 4', text: 'The seal held until 0300.' })]);
  expect(document.story.survivors).toEqual([expect.objectContaining({ id: 'miner-1', name: 'Ana Ruiz' })]);
  expect(compileLevelDocument(document).story.survivors).toHaveLength(1);
});
