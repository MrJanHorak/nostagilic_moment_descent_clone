# M2 browser regression and resource checkpoint

> Later status update (October 15, 2026): **[M1 is accepted and complete](../M1_ACCEPTANCE.md)** following the owner's Chrome playthrough. M1-pending statements below describe this earlier checkpoint.

> Historical measurements below precede the [hardware profiling and lighting checkpoint](M2_PERFORMANCE.md), which reduces the arena to nine lights and adds a separate steady capture.

Implemented October 15, 2026, following the [runtime/dependency baseline](../TOOLCHAIN.md).

## Delivered

`npm run test:browser` builds the production game and runs two Playwright Chromium tests. The test runner owns separate localhost production-preview and development servers, refuses occupied ports, runs one browser worker, and stops its servers afterward. Tests do not depend on an existing browser session or a global game object.

The production test uses ordinary menu and keyboard controls to select Arena Escape, fire pulse shots, pause and reject firing while paused, resume, destroy the fighter, fly forward until the scout rams, enter the exit, replay, die from real enemy fire, reboot, return to base, start quiet practice, and return to mission selection. It checks ammo, health, score, objective counts, and the absence of development diagnostics even with `?smoke=1`. No test controls or injected game state are used in this production flow.

The development test allocates a pulse shot and combat effects, restarts, and compares paused fresh-session snapshots after one warm-up and ten measured cycles. Its existing, labeled **Neutralize drones (test)** control deliberately accelerates combat allocation; this is a resource/lifecycle fixture, not a normal-combat playthrough. It checks that pause freezes time/steps, every restart restores two drones/two pickups and clears shots/tasks/effect lights/pools, and renderer/scene counts do not grow.

Both tests fail on page exceptions, console errors (including errors caught and logged by Game), HTTP errors, or failed requests. Expected navigation cancellation is excluded. Browser failures retain traces/screenshots. HTML and JSON reports include error logs, win/loss screenshots and resource measurements; CI preserves these artifacts for seven days on each OS. CI now installs Chromium and its OS dependencies before running the tests. Hosted Windows/Linux CI execution remains pending the next push.

## Local use

```sh
npm ci --no-audit
npm run browser:install
npm run verify
npm run test:browser
```

The final command builds again so it cannot test stale production output. If the build has just passed, `npx playwright test` runs the browser checks directly. On Linux, use `npx playwright install --with-deps chromium` to install required system libraries, as CI does. Allow localhost ports **5183 and 5184** to be free. Browser binaries are cached outside the repository; test evidence under `test-results/` and `playwright-report/` is ignored by Git.

## Measured result

**A clean install, 92 simulation/metrics tests and both browser tests pass on Node 24.22.0/npm 11.21.1.** The final production browser flow took approximately 66 seconds and the ten-restart fixture approximately 48 seconds. Neither test recorded page, console or asset-request errors. The production build passes with the existing chunk-size warning (about 647 kB minified / 163 kB gzip). The [fresh dependency audit](browser-dependency-audit.json), including Playwright and all development dependencies, reports zero known vulnerabilities. `git diff --check` passes.

Environment: Windows, Node 24.22.0/npm 11.21.1, Chromium 156.0.8078.4, 1280 x 720, Intel i7-11800H. Chromium was explicitly configured to use ANGLE SwiftShader software rendering. An earlier local run also passed the 92 tests, build and both browser flows on the supported Node 22.14.0 compatibility runtime.

| Fresh-session measurement | Warm-up baseline | Across ten measured restarts |
| --- | --- | --- |
| Renderer geometries | 41 | 41 |
| Renderer textures | 0 | 0 |
| Shader programs | 6 | 5 |
| Scene objects | 77 | 77 |
| Unique scene materials | 34 | 34 |
| Scene lights | 14 | 14 |
| Draw calls / triangles | 42 / 4,182 | 42 / 4,182 |
| Active effect lights / pooled effects | 0 / 0 | 0 / 0 |

These counts returned to a stable baseline through this fixture. They do not establish that all game modes are leak-free or measure JavaScript heap/VRAM bytes. Retained projectile caches and renderer internals are allowed; the test checks growth after warming the same path, rather than requiring all renderer resources to reach zero.

Evidence: [test results and all resource samples](browser-smoke-check.json), [production victory](browser-production-victory.png), [production loss](browser-production-loss.png).

## Diagnostics and performance limits

The development `?smoke=1` panel now reports renderer geometry/texture/program counts, draw calls, scene materials/objects/lights, active/pooled effect counts, and rolling frame/work timings. Its `data-snapshot` attribute contains read-only JSON for test observation; it never exposes callable game methods or object references. Sampling is disabled in production. Frame and work histories are bounded to 240 samples.

Frame intervals are elapsed time between rendered frames. Work time covers simulation plus renderer submission on the JavaScript thread, excluding diagnostics refresh. It is not GPU execution time. The rolling window includes scene rebuilds, pauses, shader compilation, automation and trace overhead, so these samples are not a steady-state performance benchmark. This software-rendered run had frame p95 values around 500-843 ms across those mixed windows; it does **not** pass the proposed 16.7 ms frame-time target. That target still needs a dedicated steady combat run on a named hardware/browser configuration.

The small arena contains 14 lights, a useful candidate for the next profiling pass. Measure a steady hardware-rendered scene, separate startup/restart stalls from steady frames, and compare lower light counts before changing presentation. Do not infer a user-GPU frame rate from this smoke fixture.

## Milestone status and next work

M1 implementation remains delivered, with its [hands-on acceptance](../M1_ACCEPTANCE.md) open for captured mouse, inverted return flight and handling/readability. Automated keyboard production coverage is now repeatable; it does not replace those checks.

Next M2 work: establish a steady hardware performance baseline and evaluate light/resource costs; add focused lint/type contracts; provide sensitivity/invert-Y and saved settings; evaluate a newer Vite major separately. Shared validated level JSON and connected rooms remain M3 prerequisites for the designer.
