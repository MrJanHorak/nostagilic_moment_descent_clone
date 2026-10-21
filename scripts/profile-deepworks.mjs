// Real-time combat regression capture: no mocked clock, tracing or game-state injection.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const options = { renderer: 'hardware', output: 'test-results/deepworks-profile.json' };
for (const arg of process.argv.slice(2)) {
  const match = /^--(renderer|output)=(.+)$/.exec(arg); if (!match) throw new Error(`Unknown argument: ${arg}`);
  options[match[1]] = match[2];
}
if (!['hardware', 'software'].includes(options.renderer)) throw new Error('Use --renderer=hardware|software');
const output = path.resolve(options.output); await mkdir(path.dirname(output), { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5185, strictPort: true, open: false } });
const report = { capturedAt: new Date().toISOString(), requestedRenderer: options.renderer, viewport: { width: 1280, height: 720 }, scenarios: [], errors: [] };
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, args: options.renderer === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11'] });
  for (const scenario of ['idle', 'fire', 'encounter']) {
    const page = await browser.newPage({ viewport: report.viewport });
    page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    let surface = page;
    if (scenario === 'encounter') {
      const doc = JSON.parse(await readFile('src/js/core/levels/documents/asterion-deepworks.v12.json', 'utf8'));
      const yaw = Math.atan2(3, 7);
      doc.playerSpawn = { roomId: 'coolant-pumps', position: [0, 0, 4], rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] };
      await page.goto('http://127.0.0.1:5185/editor.html?smoke=1');
      await page.locator('#file').setInputFiles({ name: 'deepworks-encounter.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
      await page.locator('#format-version').filter({ hasText: 'Format 12' }).waitFor({ state: 'attached' });
      await page.getByRole('button', { name: 'Playtest level', exact: true }).click();
      surface = page.frameLocator('iframe[title="Mission playtest"]');
      await surface.getByRole('button', { name: 'Start playtest', exact: true }).press('Enter');
    } else {
      await page.goto('http://127.0.0.1:5185/?smoke=1'); await page.locator('#start-game-btn').waitFor();
      await page.locator('#select-level-btn').click(); await page.getByRole('button', { name: 'Asterion Deepworks', exact: true }).press('Enter');
    }
    report.gpu = await surface.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);
    });
    if (options.renderer === 'hardware' && /swiftshader|software|warp|basic render/i.test(report.gpu)) throw new Error(`Hardware unavailable: ${report.gpu}`);
    await page.keyboard.press('c'); await page.keyboard.press('c'); await page.waitForTimeout(1000);
    const before = JSON.parse(await surface.locator('#runtime-diagnostics').getAttribute('data-snapshot'));
    await page.evaluate(() => {
      const capture = { active: true, last: performance.now(), frames: [] }; window.__combatProfile = capture;
      const frame = now => { if (!capture.active) return; capture.frames.push(now - capture.last); capture.last = now; if (capture.frames.length < 10000) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    });
    const started = Date.now();
    if (scenario === 'idle') await page.waitForTimeout(10000);
    else {
      if (scenario === 'encounter') await page.waitForTimeout(5000);
      for (let shot = 0; shot < 20; shot++) { await page.keyboard.press('f'); await page.waitForTimeout(400); }
    }
    await page.waitForTimeout(500);
    const frames = await page.evaluate(() => { window.__combatProfile.active = false; return window.__combatProfile.frames; });
    const after = JSON.parse(await surface.locator('#runtime-diagnostics').getAttribute('data-snapshot'));
    const sorted = frames.filter(n => n > 0).sort((a, b) => a - b), percentile = q => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
    const result = { scenario, elapsedMs: Date.now() - started, frames: frames.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: sorted.at(-1), over100ms: frames.filter(n => n > 100).length,
      before: { resources: before.resources, position: before.position, enemies: before.enemies, shots: before.shots, phase: before.phase }, after: { resources: after.resources, position: after.position, enemies: after.enemies, shots: after.shots, phase: after.phase } };
    report.scenarios.push(result); console.log(JSON.stringify(result)); await page.close();
    if (!sorted.length || before.phase !== 'playing' || after.phase !== 'playing') throw new Error(`${scenario}: no active gameplay capture`);
    if (scenario === 'encounter' && after.enemies >= before.enemies) throw new Error('Encounter did not defeat a guard');
  }
  report.status = report.errors.length ? 'failed' : 'complete';
  if (report.errors.length) process.exitCode = 1;
} catch (error) { report.status = 'failed'; report.failure = error.message; process.exitCode = 1; console.error(error.message); }
finally { await browser?.close(); await server.close(); await writeFile(output, JSON.stringify(report, null, 2) + '\n'); console.log(`Saved ${output}`); }
