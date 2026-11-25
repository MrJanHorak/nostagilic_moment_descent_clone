import { test, expect } from '@playwright/test';
import { startGameServer } from '../../server/GameServer.mjs';

/** A raw second pilot on Node's WebSocket, so the page sees someone else in the room. */
async function joinRaw(port, room, name) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/play`);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  socket.send(JSON.stringify({ t: 'hello', protocol: 1, name, room }));
  return socket;
}

test('development: the online lobby creates a room, shows the room code and another pilot, and leaves cleanly', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const server = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {} });
  try {
    await page.goto('http://127.0.0.1:5183/?smoke=1');
    await page.locator('#play-online-btn').click();
    await expect(page.locator('#online-lobby')).toBeVisible();

    // A bad code is caught before connecting; a missing room is explained by the server.
    await page.locator('#online-name').fill('Ana');
    await page.locator('#online-server').fill(`127.0.0.1:${server.port}`);
    await page.locator('#online-room').fill('AB');
    await page.locator('#online-join').click();
    await expect(page.locator('#online-status')).toContainText('four letters');
    await page.locator('#online-room').fill('ZZZZ');
    await page.locator('#online-join').click();
    await expect(page.locator('#online-status')).toContainText('No room with that code');

    await page.locator('#online-create').click();
    await expect(page.locator('#online-lobby')).toHaveCount(0);
    await expect(page.locator('#arena-guide')).toContainText('ANARCHY · 0/10 frags');
    await expect(page.locator('#arena-guide')).toContainText('ONLINE · Room');
    const room = new URL(page.url()).searchParams.get('room');
    expect(room).toMatch(/^[A-Z]{4}$/);

    const ben = await joinRaw(server.port, room, 'Ben');
    await expect(page.locator('#arena-guide')).toContainText('2 pilots');
    await page.screenshot({ path: info.outputPath('online-anarchy.png') });
    ben.close();
    await expect(page.locator('#arena-guide')).toContainText('1 pilot ·');

    // Return to base from the pause menu: the server sees the pilot leave.
    await page.keyboard.press('Escape');
    await expect(page.locator('#online-pause-info')).toContainText(`Room ${room}`);
    await page.getByRole('button', { name: 'RETURN TO BASE' }).click();
    await expect.poll(() => [...server.rooms.values()][0]?.sockets.size ?? 0).toBe(0);
    expect(errors).toEqual([]);
  } finally { await server.close(); }
});

test('development: the lobby creates a co-op room for a mission and shows team status', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const server = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {} });
  try {
    await page.goto('http://127.0.0.1:5183/?smoke=1');
    await page.locator('#play-online-btn').click();
    await page.locator('#online-name').fill('Ana');
    await page.locator('#online-server').fill(`127.0.0.1:${server.port}`);
    await page.locator('#online-mode').selectOption('coop:signal-breach');
    await page.locator('#online-create').click();
    await expect(page.locator('#online-lobby')).toHaveCount(0);
    await expect(page.locator('#arena-guide')).toContainText('SIGNAL BREACH');
    await expect(page.locator('#arena-guide')).toContainText('CO-OP · Room');
    await expect(page.locator('#arena-guide')).toContainText('Team lives 2');
    const room = new URL(page.url()).searchParams.get('room');
    const ben = await joinRaw(server.port, room, 'Ben');
    await expect(page.locator('#arena-guide')).toContainText('Team lives 4');
    ben.close();
    expect(errors).toEqual([]);
  } finally { await server.close(); }
});
