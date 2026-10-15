// Local measurement, separate from traced/software-rendered CI smoke tests.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const options = { renderer: 'hardware', runs: '3', output: 'test-results/arena-profile.json', scenario: 'combat' };
for (const arg of process.argv.slice(2)) {
  const match = /^--(renderer|runs|output|scenario)=(.+)$/.exec(arg);
  if (!match) throw new Error(`Unknown option: ${arg}. Use --renderer=hardware|software --runs=1..5 --scenario=combat|flight --output=path.json`);
  options[match[1]] = match[2];
}
const runs = Number(options.runs);
if (!['hardware', 'software'].includes(options.renderer) || !['combat', 'flight'].includes(options.scenario) ||
  !Number.isInteger(runs) || runs < 1 || runs > 5) throw new Error('Invalid benchmark options');
const output = path.resolve(options.output);
await mkdir(path.dirname(output), { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5185, strictPort: true, open: false } });
let browser;
const report = { date: new Date().toISOString(), node: process.version, platform: os.platform(),
  cpu: os.cpus()[0]?.model, viewport: { width: 1280, height: 720 }, requestedRenderer: options.renderer,
  scenario: options.scenario, warmupMs: 8000, captureMs: 10000, samples: [], errors: [] };
try {
  await server.listen();
  report.browserArgs = options.renderer === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : process.platform === 'win32' ? ['--use-angle=d3d11'] : [];
  browser = await chromium.launch({ headless: true, args: report.browserArgs });
  report.browser = browser.version();
  for (let run = 1; run <= runs; run++) {
    const page = await browser.newPage({ viewport: report.viewport });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') report.errors.push(`${request.url()}: ${request.failure()?.errorText}`); });
    await page.goto('http://127.0.0.1:5185/?smoke=1');
    await page.locator('#start-game-btn').waitFor();
    report.gpu = await page.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      const extension = gl?.getExtension('WEBGL_debug_renderer_info');
      return { renderer: gl?.getParameter(extension?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
        vendor: gl?.getParameter(extension?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR), version: gl?.getParameter(gl.VERSION) };
    });
    const software = /swiftshader|llvmpipe|software|lavapipe|warp|microsoft basic render/i.test(report.gpu.renderer ?? '');
    if (!report.gpu.renderer || (options.renderer === 'hardware' && software)) {
      throw new Error(`Hardware renderer unavailable: ${report.gpu.renderer}. Use --renderer=software to record an explicitly software baseline.`);
    }
    console.log(`Run ${run}/${runs}: ${report.gpu.renderer}`);
    if (options.scenario === 'combat') {
      await page.locator('#select-level-btn').click();
      await page.getByRole('button', { name: /arena escape/i }).click();
    } else await page.locator('#start-game-btn').click();
    // No state injection, tracing, screenshots, navigation or input during the warm/capture windows.
    await page.waitForTimeout(report.warmupMs);
    await page.getByRole('button', { name: 'Profile 10 seconds (test)', exact: true }).press('Enter');
    await page.waitForFunction(() => {
      const data = document.querySelector('#runtime-diagnostics')?.getAttribute('data-snapshot');
      return data && ['complete', 'aborted'].includes(JSON.parse(data).profile?.status);
    }, { }, { timeout: 45000 });
    const snapshot = JSON.parse(await page.locator('#runtime-diagnostics').getAttribute('data-snapshot'));
    if (snapshot.profile.status !== 'complete' || snapshot.profile.truncated || snapshot.errors) {
      throw new Error(`Invalid capture: ${JSON.stringify(snapshot.profile)}`);
    }
    report.samples.push({ run, ...snapshot.profile });
    console.log(JSON.stringify({ run, timing: snapshot.profile.timing, resources: snapshot.profile.toResources }));
    if (run === 1) await page.screenshot({ path: output.replace(/\.json$/i, '') + '.png',
      style: '#runtime-diagnostics, aside[aria-label="Session smoke controls"], body > div[style*="z-index: 900;"] { visibility: hidden !important; }' });
    await page.close();
  }
  if (report.errors.length) throw new Error('Browser errors were recorded');
  report.status = 'complete';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Profile ${report.status}: ${output}`);
}
