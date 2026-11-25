import { test, expect } from '@playwright/test';
import { openClockedGame } from '../helpers/browser-clock.mjs';

test('development: Foundry Ring opens as an Anarchy match with a scoreline and no mission', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openClockedGame(page, 'http://127.0.0.1:5183/?smoke=1');
  await page.locator('#select-level-btn').click(); await page.locator('.mission-library summary').click();
  await page.getByRole('button', { name: 'Anarchy · Foundry Ring', exact: true }).press('Enter');
  await page.clock.fastForward(500);
  await expect(page.locator('#arena-guide')).toContainText('ANARCHY · 0/10 frags');
  await page.screenshot({ path: info.outputPath('foundry-ring.png') });
  expect(errors).toEqual([]);
});
