import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/browser-results.json' }]],
  use: {
    // Functional software-rendered checks. Hardware profiling keeps its own
    // explicit 1280x720 reference resolution.
    browserName: 'chromium', viewport: { width: 960, height: 540 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    // WebGL screencasting adds GPU readbacks during every polling operation.
    // Keep DOM/action traces and explicit checkpoint/failure screenshots.
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true }, screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5184 --strictPort',
      url: 'http://127.0.0.1:5184', reuseExistingServer: false },
    { command: 'node scripts/smoke-server.mjs', url: 'http://127.0.0.1:5183', reuseExistingServer: false },
  ],
});
