import { test, expect } from '@playwright/test';
import { startGameServer } from '../../server/GameServer.mjs';

/** A raw second pilot on Node's WebSocket, so the page sees someone else in the room. */
async function joinRaw(port, room, name) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/play`);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  socket.send(JSON.stringify({ t: 'hello', protocol: 1, name, room, lobby: true }));
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
    await expect(page.locator('#online-players')).toContainText('Ana (host) (you)');
    const room = new URL(page.url()).searchParams.get('room');
    expect(room).toMatch(/^[A-Z]{4}$/);
    await expect(page.locator('#online-invite')).toHaveValue(new RegExp(`room=${room}`));
    const ben = await joinRaw(server.port, room, 'Ben');
    await expect(page.locator('#online-players')).toContainText('Ben');
    expect([...server.rooms.values()][0].room.game.session.timeMs).toBe(0);
    await page.locator('#online-start').click();
    await expect(page.locator('#online-lobby')).toHaveCount(0);
    await expect(page.locator('#arena-guide')).toContainText('ANARCHY · 0/10 frags');
    await expect(page.locator('#arena-guide')).toContainText('ONLINE · Room');
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
    await expect(page.locator('#online-players')).toContainText('Ana');
    const room = new URL(page.url()).searchParams.get('room');
    const ben = await joinRaw(server.port, room, 'Ben');
    await expect(page.locator('#online-players')).toContainText('Ben');
    await page.locator('#online-start').click();
    await expect(page.locator('#online-lobby')).toHaveCount(0);
    await expect(page.locator('#arena-guide')).toContainText('SIGNAL BREACH');
    await expect(page.locator('#arena-guide')).toContainText('CO-OP · Room');
    await expect(page.locator('#arena-guide')).toContainText('Team lives 4');
    ben.close();
    expect(errors).toEqual([]);
  } finally { await server.close(); }
});

test('development: invited player waits with the host until the host starts', async ({ browser }) => {
  const server = await startGameServer({ port: 0, host: '127.0.0.1', log: () => {} });
  const hostContext = await browser.newContext(), guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage(), guest = await guestContext.newPage();
    await host.goto('http://127.0.0.1:5183/?smoke=1');
    await host.locator('#play-online-btn').click();
    await host.locator('#online-name').fill('Host');
    await host.locator('#online-server').fill(`127.0.0.1:${server.port}`);
    await host.locator('#online-create').click();
    await expect(host.locator('#online-players')).toContainText('Host');
    const invite = await host.locator('#online-invite').inputValue();
    await guest.goto(invite);
    await expect(guest.locator('#online-lobby')).toBeVisible();
    await guest.locator('#online-name').fill('Guest');
    await guest.locator('#online-join').click();
    await expect(guest.locator('#online-players')).toContainText('Host (host)');
    await expect(host.locator('#online-players')).toContainText('Guest');
    await expect(guest.locator('#online-start')).toBeHidden();
    await expect(guest.locator('#online-bots')).toBeHidden();
    await expect(guest.locator('#online-waiting-status')).toContainText('Waiting for the host');
    expect([...server.rooms.values()][0].room.game.session.timeMs).toBe(0);
    await expect(host.locator('#online-bot-difficulty')).toBeHidden();
    await host.locator('#online-bots').selectOption('2');
    await host.locator('#online-bot-difficulty').selectOption('hard');
    await host.locator('#online-start').click();
    await expect(host.locator('#online-lobby')).toHaveCount(0);
    await expect(guest.locator('#online-lobby')).toHaveCount(0);
    await expect(guest.locator('#arena-guide')).toContainText('4 pilots');
    expect([...server.rooms.values()][0].room.botDifficulty).toBe('hard');
  } finally { await hostContext.close(); await guestContext.close(); await server.close(); }
});
