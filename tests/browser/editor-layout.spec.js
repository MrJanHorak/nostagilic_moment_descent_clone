import { test, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';

// Project a starter-room point into the canvas, as the other designer tests do.
async function starterPoint(page, point) {
  const bounds = await page.locator('#viewport canvas').boundingBox();
  const camera = new PerspectiveCamera(50, bounds.width / bounds.height, 0.1, 3000);
  camera.position.copy(new Vector3(1, 0.85, 1).normalize().multiplyScalar(new Vector3(16, 12, 16).length() * 1.25));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const screen = new Vector3(...point).project(camera);
  return { x: bounds.x + (screen.x + 1) * bounds.width / 2, y: bounds.y + (1 - screen.y) * bounds.height / 2 };
}

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

test('designer polish: shortcuts, named undo, multi-select, room names, first-run hint and playtest from a room', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('http://127.0.0.1:5184/editor.html');
  const hint = page.getByRole('note');
  await expect(hint).toContainText('Right-click a wall'); await page.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(hint).toBeHidden(); await page.reload(); await expect(page.getByRole('note')).toBeHidden();

  await page.getByRole('button', { name: 'Open example', exact: true }).click();
  await page.locator('#room-label').fill('Repair alcove'); await page.locator('#room-label').press('Enter');
  await expect(page.locator('#inspector-selection')).toHaveText('Repair alcove (repair-alcove) · Room');
  await expect(page.locator('#format-version')).toContainText('Format 14');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveAttribute('title', 'Undo: Rename repair-alcove (Ctrl+Z)');

  await page.getByRole('button', { name: 'Scene browser', exact: true }).click();
  const items = page.locator('#entities button');
  await items.filter({ hasText: 'secret-ammo' }).click();
  await items.filter({ hasText: 'secret-health' }).click({ modifiers: ['Shift'] });
  await expect(page.locator('#inspector-selection')).toHaveText('2 items selected · editing secret-ammo');
  await expect(page.getByRole('button', { name: 'Rotate XYZ', exact: true })).toBeDisabled();
  await page.locator('#viewport canvas').focus(); await page.keyboard.press('w');
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Delete');
  await expect(items.filter({ hasText: 'secret-' })).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#notice')).toHaveText('Undid: Delete 2 items');
  await expect(items.filter({ hasText: 'secret-' })).toHaveCount(2);
  await page.keyboard.press('q');
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#rooms').getByRole('button', { name: 'supply-bay · room', exact: true }).click();
  await page.getByRole('button', { name: 'Playtest from this room', exact: true }).click();
  await expect(page.locator('#playtest-panel')).toBeVisible();
  const frame = page.frameLocator('iframe[title="Mission playtest"]');
  await frame.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
  await expect(frame.locator('#arena-guide')).toContainText('Location: Green Supply Bay', { timeout: 15000 });
  await page.getByRole('button', { name: 'Return to editor', exact: true }).click();
  await expect(page.locator('#playtest-panel')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('#entities button').first()).toHaveText(/Spawn · arrival/);
});

test('designer: the browser menu never covers ours, and the tutorial ticks off a real step', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('http://127.0.0.1:5184/editor.html');
  // Windows fires contextmenu after the right button is released, over our menu.
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  const menu = page.locator('#viewport-context-menu'); await expect(menu).toBeVisible();
  const blocked = await menu.evaluate(node => { const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); node.querySelector('button')?.dispatchEvent(event); return event.defaultPrevented; });
  expect(blocked).toBe(true);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Start the tutorial', exact: true }).click();
  const guide = page.getByRole('complementary', { name: 'Level editor tutorial', exact: true });
  await expect(guide).toContainText('step 1 of 10'); await expect(guide).toContainText('Look around');
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide).toContainText('Add a second room'); await expect(guide).toContainText('Waiting for you');
  const wall = await starterPoint(page, [0, 1, -7.5]);
  await page.mouse.click(wall.x, wall.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Attach room at this point', exact: true }).click();
  await expect(guide).toContainText('✓ Done');
  await guide.getByRole('button', { name: 'Next', exact: true }).click(); await expect(guide).toContainText('Name a room');
  // Naming works from the right-click menu even when a wall or floor is selected.
  const floor = await starterPoint(page, [-3, -5.5, 3]);
  await page.mouse.click(floor.x, floor.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Name this room…', exact: true }).click();
  await page.getByRole('dialog', { name: 'Name this room', exact: true }).getByLabel('Room name').fill('Arrival');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(guide).toContainText('✓ Done'); await expect(page.locator('#room-label')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Level editor tutorial', exact: true })).toContainText('step 3 of 10');
  await page.keyboard.press('Escape'); await expect(page.getByRole('complementary', { name: 'Level editor tutorial' })).toBeHidden();
});
