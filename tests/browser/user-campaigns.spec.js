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
const region = (page, name) => page.getByRole('region', { name, exact: true });
async function importLevel(page, name) {
  const document = createDocument(); document.name = name;
  document.playerSpawn.position = [0, 0, 3]; document.entities[0].position = [0, 0, -3];
  await page.locator('#user-level-file').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await expect(region(page, name)).toBeVisible();
}
async function flyToExit(page) {
  await page.keyboard.down('w');
  try { await advanceUntil(page, () => page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }).isVisible(), { ticks: 150 }); }
  finally { await page.keyboard.up('w'); }
}

test('production: build a campaign in My Levels, brief, play, chain, export, import and protect its levels', async ({ page }, info) => {
  await openClockedGame(page, 'http://127.0.0.1:5184/'); await button(page, 'MY LEVELS').click();
  await expect(page.locator('#user-campaign-list')).toContainText('No campaigns yet');
  await importLevel(page, 'Alpha'); await importLevel(page, 'Bravo');

  await button(page, 'New campaign').click();
  const details = page.locator('.campaign-details').first();
  await expect(details.getByLabel('Campaign name')).toBeFocused();
  await details.getByLabel('Campaign name').fill('Ridge Run');
  await details.getByLabel('Description').fill('Two short drops.');
  await button(details, 'Save details').click();
  let campaign = region(page, 'Campaign: Ridge Run');
  await expect(campaign).toContainText('Two short drops.');
  for (const level of ['Bravo', 'Alpha']) {
    await campaign.getByLabel('Level to add to Ridge Run').selectOption({ label: level });
    await button(campaign, 'Add mission to Ridge Run').click();
  }
  await button(campaign, 'Move Mission 02 of Ridge Run earlier').click();
  await expect(campaign.locator('.campaign-missions li').first()).toContainText('Mission 01 · Alpha');
  await button(campaign, 'Edit briefing for Mission 01 of Ridge Run').click();
  await campaign.getByLabel(/^Briefing/).first().fill('Restore the uplink.');
  await button(campaign, 'Save briefing').first().click();
  await expect(campaign.locator('.campaign-briefing').first()).toHaveText('Restore the uplink.');
  await page.screenshot({ path: info.outputPath('campaign-builder.png'), fullPage: true });

  await page.reload(); await button(page, 'MY LEVELS').click(); campaign = region(page, 'Campaign: Ridge Run');
  await expect(button(campaign, 'Play campaign Ridge Run')).toHaveText('Start campaign');
  await button(campaign, 'Play campaign Ridge Run').click();
  const briefing = page.getByRole('dialog', { name: 'MISSION 01 · Alpha', exact: true });
  await expect(briefing).toContainText('Ridge Run · Mission 1 of 2'); await expect(briefing).toContainText('Restore the uplink.');
  await page.screenshot({ path: info.outputPath('campaign-briefing.png') });
  await expect(button(page, 'LAUNCH MISSION')).toBeFocused();
  await button(page, 'LAUNCH MISSION').press('Enter'); await page.clock.fastForward(100);
  await flyToExit(page);
  await expect(page.getByRole('dialog', { name: 'MISSION COMPLETE', exact: true })).toContainText('Ridge Run: 1 of 2 missions');
  await button(page, 'NEXT MISSION').press('Enter');
  await expect(page.getByRole('dialog', { name: 'MISSION 02 · Bravo', exact: true })).toBeVisible();
  await button(page, 'BACK TO MY LEVELS').click();
  campaign = region(page, 'Campaign: Ridge Run');
  await expect(campaign).toContainText('Progress: 1 of 2 missions extracted · Next: Mission 02 · Bravo');
  await expect(button(campaign, 'Play campaign Ridge Run')).toHaveText('Continue · Mission 02');

  const pending = page.waitForEvent('download'); await button(campaign, 'Export campaign Ridge Run').click();
  const path = info.outputPath('ridge-run.campaign.json'); await (await pending).saveAs(path);
  const text = await readFile(path, 'utf8'), bundle = JSON.parse(text);
  expect(bundle).toMatchObject({ format: 'descended-campaign', version: 1, name: 'Ridge Run', description: 'Two short drops.' });
  expect(bundle.missions.map(mission => [mission.level.name, mission.briefing])).toEqual([['Alpha', 'Restore the uplink.'], ['Bravo', '']]);

  let message = '';
  page.once('dialog', dialog => { message = dialog.message(); dialog.dismiss(); });
  await button(region(page, 'Alpha'), 'Delete').click();
  expect(message).toContain('It is a mission in: Ridge Run');
  page.once('dialog', dialog => dialog.accept()); await button(campaign, 'Delete campaign Ridge Run').click();
  await expect(page.locator('#user-campaign-list')).toContainText('No campaigns yet');
  await page.locator('#user-campaign-file').setInputFiles({ name: 'ridge-run.campaign.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  campaign = region(page, 'Campaign: Ridge Run');
  await expect(campaign).toContainText('Progress: 0 of 2 missions extracted');
  await expect(page.getByRole('status')).toContainText('Imported campaign Ridge Run with 2 level(s)');
  await expect(region(page, 'Alpha')).toHaveCount(2);
  await page.locator('#user-campaign-file').setInputFiles({ name: 'level.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createDocument())) });
  await expect(page.getByRole('status')).toContainText('not a DESCENDED campaign');
});
