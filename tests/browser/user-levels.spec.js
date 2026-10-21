import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument } from '../../src/js/editor/EditorDocument.js';
import { openClockedGame, advanceUntil } from '../helpers/browser-clock.mjs';

const test = base.extend({ cleanBrowser: [async ({ page }, use) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(); expect(errors).toEqual([]);
}, { auto: true }] });
const button = (page, name) => page.getByRole('button', { name, exact: true });
const card = (page, name) => page.getByRole('region', { name, exact: true });
async function importLevel(page, name = 'Library Trial') {
  const document = createDocument(); document.name = name;
  document.playerSpawn.position = [0, 0, 3]; document.entities[0].position = [0, 0, -3];
  await page.locator('#user-level-file').setInputFiles({ name: 'shared-mine.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await expect(card(page, name).last()).toBeVisible();
  return document;
}

test('production: My Levels imports, persists, plays to completion, replays, renames, exports and deletes', async ({ page }, info) => {
  await openClockedGame(page, 'http://127.0.0.1:5184/'); await button(page, 'MY LEVELS').click();
  await expect(page.locator('#user-level-list')).toContainText('No saved levels yet');
  const document = await importLevel(page);
  await page.locator('#user-level-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"formatVersion":999}') });
  await expect(page.getByRole('status')).toContainText('formatVersion'); await expect(card(page, document.name)).toHaveCount(1);
  await page.reload(); await button(page, 'MY LEVELS').click();
  await button(card(page, document.name), 'Play level').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#arena-guide')).toContainText('LIBRARY TRIAL');
  await page.keyboard.down('w');
  try { await advanceUntil(page, () => page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 150 }); }
  finally { await page.keyboard.up('w'); }
  await expect(button(page, 'NEXT MISSION')).toHaveCount(0);
  await button(page, 'REPLAY MISSION').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#weapon-slot-1')).toContainText('60');
  await page.keyboard.press('Escape'); await button(page, 'RETURN TO BASE').press('Enter'); await button(page, 'MY LEVELS').click();
  await button(card(page, document.name), 'Rename').click();
  await card(page, document.name).getByLabel('Level name', { exact: true }).fill('My <b>mine</b>');
  await button(card(page, document.name), 'Save name').click();
  const renamed = card(page, 'My <b>mine</b>'); await expect(renamed).toBeVisible(); await expect(renamed.locator('b')).toHaveCount(0);
  const pending = page.waitForEvent('download'); await button(renamed, 'Export JSON').click();
  const path = info.outputPath('library-export.json'); await (await pending).saveAs(path);
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ ...document, name: 'My <b>mine</b>' });
  await page.setViewportSize({ width: 390, height: 740 });
  expect((await page.locator('.user-level-library').boundingBox()).width).toBe(390);
  await page.getByRole('heading', { name: 'MY LEVELS', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('my-levels-mobile.png') });
  page.once('dialog', dialog => dialog.dismiss()); await button(renamed, 'Delete').click(); await expect(renamed).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await button(renamed, 'Delete').click();
  await page.reload(); await button(page, 'MY LEVELS').click(); await expect(page.locator('#user-level-list')).toContainText('No saved levels yet');
  await button(page, 'RETURN TO MAIN MENU').click(); await page.locator('#select-level-btn').click();
  await expect(page.getByRole('button', { name: 'Asterion Deepworks', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: document.name, exact: true })).toHaveCount(0);
});

test('production: designer saves and opens library levels, protects another tab and saves an independent copy', async ({ page }, info) => {
  await page.goto('http://127.0.0.1:5184/editor.html');
  await page.locator('#name').fill('Designer Saved'); await page.locator('#name').press('Tab');
  await button(page, 'Save to My Levels').click(); await expect(page.locator('#notice')).toContainText('Saved to My Levels');
  const key = new URL(page.url()).searchParams.get('level'); expect(key).toBeTruthy();
  await page.getByRole('link', { name: 'Back to game', exact: true }).click(); await button(page, 'MY LEVELS').click();
  await card(page, 'Designer Saved').getByRole('link', { name: 'Open in editor', exact: true }).click();
  await expect(page.locator('#name')).toHaveValue('Designer Saved');
  const other = await page.context().newPage();
  try {
    await other.goto('http://127.0.0.1:5184/'); await button(other, 'MY LEVELS').click();
    await button(card(other, 'Designer Saved'), 'Rename').click();
    await card(other, 'Designer Saved').getByLabel('Level name', { exact: true }).fill('Other Tab');
    await button(card(other, 'Designer Saved'), 'Save name').click();
    await page.bringToFront(); await page.locator('#name').fill('My Edited Copy'); await page.locator('#name').press('Tab');
    await button(page, 'Save to My Levels').click(); await expect(page.locator('#notice')).toContainText('changed in another tab');
    await expect(page.locator('#save-state')).toContainText('Unsaved changes');
    await button(page, 'Save a copy').click(); await expect(page.locator('#notice')).toContainText('Saved to My Levels');
    expect(new URL(page.url()).searchParams.get('level')).not.toBe(key);
    await page.screenshot({ path: info.outputPath('my-levels-editor-save.png') });
    await page.getByRole('link', { name: 'Back to game', exact: true }).click(); await button(page, 'MY LEVELS').click();
    await expect(card(page, 'Other Tab')).toBeVisible(); await expect(card(page, 'My Edited Copy')).toBeVisible();
    // Importing another file with the same internal document ID is a new copy.
    await importLevel(page, 'Imported Copy'); await expect(page.locator('#user-level-list section')).toHaveCount(3);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.getByRole('heading', { name: 'MY LEVELS', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('my-levels-library.png') });
    await card(page, 'My Edited Copy').getByRole('link', { name: 'Open in editor', exact: true }).click();
    await page.locator('#name').fill('Updated Copy'); await page.locator('#name').press('Tab');
    await button(page, 'Save to My Levels').click(); await expect(page.locator('#notice')).toContainText('Saved to My Levels');
    await page.getByRole('link', { name: 'Back to game', exact: true }).click(); await button(page, 'MY LEVELS').click();
    await expect(page.locator('#user-level-list section')).toHaveCount(3); await expect(card(page, 'Updated Copy')).toBeVisible();
  } finally { await other.close(); }
});

test('production: blocked saving leaves custom levels playable and exportable with an explicit temporary warning', async ({ page }, info) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  await openClockedGame(page, 'http://127.0.0.1:5184/'); await button(page, 'MY LEVELS').click(); await importLevel(page);
  await expect(page.getByRole('status')).toContainText('Temporary library');
  await expect(page.getByRole('status')).toContainText('lost on reload');
  await expect(card(page, 'Library Trial').getByRole('link', { name: 'Open in editor', exact: true })).toHaveCount(0);
  const pending = page.waitForEvent('download'); await button(card(page, 'Library Trial'), 'Export JSON').click();
  await (await pending).saveAs(info.outputPath('temporary-level.json'));
  await button(card(page, 'Library Trial'), 'Play level').press('Enter'); await page.clock.fastForward(100);
  await expect(page.locator('#arena-guide')).toContainText('LIBRARY TRIAL');
  await page.keyboard.press('Escape'); await button(page, 'RETURN TO BASE').press('Enter'); await button(page, 'MY LEVELS').click();
  await expect(card(page, 'Library Trial')).toBeVisible(); await expect(page.getByRole('status')).toContainText('Temporary library');
  await page.reload(); await button(page, 'MY LEVELS').click(); await expect(page.locator('#user-level-list')).toContainText('No saved levels yet');
  await page.goto('http://127.0.0.1:5184/editor.html'); await page.locator('#name').fill('Temporary Editor'); await page.locator('#name').press('Tab');
  await button(page, 'Save to My Levels').click(); await expect(page.locator('#notice')).toContainText('Temporary library');
  await expect(page.locator('#save-state')).toContainText('Unsaved changes');
});
