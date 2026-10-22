import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  // Print the error when its test ends, even if a later test/job is cancelled.
  reporter: [['list', { printFailuresInline: true }], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/browser-results.json' }]],
  // CI runs these groups in separate jobs; local runs still cover every case.
  projects: [
    // Catch everything outside the longer flight/encounter groups, including future tests.
    { name: 'production', grepInvert: /development: (JSON mine loop|relay unlocks|Deep Relay lower loop|mobile fighter drill|Crossfire Relay)/ },
    { name: 'prototypes', grep: /development: (JSON mine loop|relay unlocks)/ },
    { name: 'deep-relay', grep: /development: Deep Relay lower loop/ },
    { name: 'encounters', grep: /development: (mobile fighter drill|Crossfire Relay)/ },
  ],
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
