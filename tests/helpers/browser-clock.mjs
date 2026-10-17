// Freeze application time while Playwright sends commands. Hosted runners can
// take seconds to observe a frame or deliver keyup; that must not add thrust.
const controlledPages = new WeakSet();
export const hasControlledClock = page => controlledPages.has(page);

export async function openClockedGame(page, url) {
  const start = Date.UTC(2026, 0, 1);
  await page.clock.install({ time: start });
  await page.goto(url);
  await page.locator('#start-game-btn').waitFor({ state: 'visible' });
  await page.clock.pauseAt(start + 3600000);
  controlledPages.add(page);
}

// Each jump fires one animation callback; the real stepper caps it at six
// 60 Hz simulation steps. Never write game state, transforms or velocity.
export async function advanceUntil(page, predicate, { ticks = 1500, message = 'Controlled browser clock did not reach the expected state' } = {}) {
  for (let tick = 0; tick < ticks; tick++) {
    if (await predicate()) return;
    await page.clock.fastForward(100);
  }
  throw new Error(message);
}
