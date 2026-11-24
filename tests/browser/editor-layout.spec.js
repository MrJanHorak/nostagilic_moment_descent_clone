import { test, expect } from '@playwright/test';

test('designer layout: one-row toolbar, camera presets and a quiet grouped context menu', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('http://127.0.0.1:5184/editor.html');
  const header = await page.locator('header').boundingBox();
  expect(header.height).toBeLessThan(60);
  const canvas = page.locator('#viewport canvas');
  expect((await canvas.boundingBox()).height).toBeGreaterThan(420);
  await page.getByRole('button', { name: 'Open example', exact: true }).click();
  const iso = await canvas.screenshot();
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  const top = await canvas.screenshot(); expect(top.equals(iso)).toBe(false);
  await canvas.focus(); await page.keyboard.press('3'); const front = await canvas.screenshot(); expect(front.equals(top)).toBe(false);
  await page.keyboard.press('1'); expect((await canvas.screenshot()).equals(front)).toBe(false);
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.locator('.menu-section')).toHaveText(['Place here', 'Room']);
  await expect(menu.locator('.popover-error')).toBeEmpty();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
});
