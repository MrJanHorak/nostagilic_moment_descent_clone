# Hosted browser failures and timing/readiness fixes

October 16, 2026. This addresses the owner's Ubuntu and Windows log excerpts for [GitHub run 38932266372](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38932266372). The previous relay checkpoint established a local pass, not a hosted pass. **M2 hosted-CI acceptance remains open until these fixes pass a new GitHub run.** M1's human acceptance is unchanged.

## What the supplied logs establish

| Runner | Result in the supplied excerpt | Main failures |
| --- | --- | --- |
| Ubuntu | Six passed, three failed; browser step about 7.2 minutes | Both mine routes timed out on their first axis; resource baseline expected at most 10 GPU geometries but later saw 42 |
| Windows | Four reported failures, five unrun; browser step about 11.1 minutes, then cancellation | Timed out waiting for production death, selecting the relay level, and steering; browser-context teardown also failed during cancellation |

These are failed checks, not merely informational slow-test notices. The excerpt does not identify whether Windows was canceled by its job timeout, a superseding run or another action. Its final context-close error is not evidence of an independent game crash. It also does not expose the production game's state at the failed death wait; inspect that trace if it recurs.

Two assumptions in the browser tests are demonstrably unsuitable for slow software rendering. A 75 ms wall-clock key press can begin and end between rendered frames, so the simulation never sees held thrust. The game deliberately caps simulation work after a slow frame rather than advancing all lost wall time; a wall-clock duration is not a reliable measure of gameplay progress. Separately, WebGL geometry allocation is lazy and view-dependent. Comparing later uploads against one cold count of 10 does not by itself prove a resource leak. The logs lack the settled/live-resource measurements needed to distinguish those cases.

## Changes

- Development diagnostics publish a small read-only flight snapshot after every rendered frame: session/phase, simulation time/steps, position and actual velocity. The larger resource panel remains throttled. Production still exposes neither diagnostics nor test controls.
- Keyboard steering holds real keys until observed simulation progress. It predicts coasting distance, then uses simulation-time impulses and coasting close to a waypoint. It no longer relies on a short wall-clock pulse or velocity estimated from sparse positions. Unexpected pause/session replacement fails explicitly. Wall and simulation deadlines remain bounded.
- Eight new simulations exercise the actual ship/stepper at 4/10/30/60 FPS with zero or two frames of observation delay. They traverse successive targets, release thrust and check final coasting clearance.
- Resource sampling waits for rendered session frames and three matching paused snapshots. Two warm-up cycles precede ten measured cycles. Live scene geometry and the explicit scene/shot-cache ownership budget are counted separately from lazy GPU uploads. Exact live object/material/light/geometry counts, GPU ownership bounds and post-warm-up resource growth checks remain enforced.
- Resource measurements are attached **before** final assertions so a failed hosted resource check retains its evidence. The optional CPU stress fixture records environment metadata; retries remain disabled.
- Functional browser tests now use 960×540 consistently locally and on CI, reducing software-raster work. The separate hardware profiler keeps its explicit 1280×720 reference resolution. Production mission/JSON-selection and traversal test budgets leave room for slower runners; changing timeouts alone is not the fix.

Flight acceleration, damping, collision, enemy timing, pause semantics and renderer quality in the game are unchanged. Dependencies and lockfile are unchanged. The overall CI ceiling increases from fifteen to twenty minutes: the supplied Windows browser step alone used about eleven minutes before the remaining five cases, on top of setup/installation. This adds bounded headroom; it does not establish why that run was canceled, and test failures still fail the job without retries.

## Verification and remaining gate

Pinned Node 24.22.0 / npm 11.21.1 passes lint, strict checks, **254 runtime tests** and the production build. Lint/type checks and all 254 cases also pass on Node 22.14.0 / npm 11.2.0. Static-check scope remains 36 modules / 108 negative compiler examples; diagnostics and metrics remain outside that complete static scope, but both edited modules also pass ESLint separately. Two additional metrics tests cover per-render observations and deduplicated geometry ownership. The new build is approximately 693.97 kB minified / 177.63 kB gzip and retains the existing chunk-size warning.

The first revised local run passed eight cases and exposed another invalid cold-baseline assertion: shader programs went from five to the previously observed legitimate sixth variant, then back to five, while scene ownership stayed constant. [Those measurements](ci-reliability-initial-check.json) are retained. The final fixed-arena shader bound is six, with exact live geometry/material/light counts and a post-warm-up GPU geometry plateau check allowing one view-dependent upload. All **nine browser cases passed in one complete final run with fourfold CPU throttling**, with zero page/console/asset errors. The twelve restart samples retained 72 scene objects, 34 materials, nine lights and 46 unique live geometries. GPU uploads stayed bounded and plateaued; see the report for actual ranges. The run took about 5.2 minutes locally. Final results belong in [ci-reliability-browser-check.json](ci-reliability-browser-check.json); local stress evidence must not be presented as an Ubuntu/Windows hosted pass. The older navigation and relay reports remain historical records at their stated resolutions/builds.

To reproduce CPU stress after building, in PowerShell:

```powershell
$env:BROWSER_CPU_SLOWDOWN = '4'
npx playwright test --grep '^development:'
Remove-Item Env:BROWSER_CPU_SLOWDOWN
```

This uses Chromium's CPU-throttling emulation; the unit simulations separately cover very slow frame rates. Neither substitutes for the actual GitHub machines or the named hardware performance acceptance. Push the fixes and rerun the workflow before closing hosted-CI acceptance. If a hosted failure remains, inspect its uploaded trace/error context and the now-preserved measurements instead of adding retries or removing coverage.

The authored M3 mission is the next content step after this reliability checkpoint. The M2 hardware p95 target remains a separate open item; these software-rendered functional checks do not establish it.


## Follow-up after the next hosted run

The owner supplied [run 38979088436](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38979088436): Ubuntu passed eight of nine, while Windows was stopped at the twenty-minute job limit. Simulation-time observations alone still allowed keys to remain held during long browser-command delays. See [controlled-clock repairs](M2_CI_CONTROLLED_CLOCK.md) for the new diagnosis, timing strategy and verification. The local pass above remains historical evidence; hosted acceptance is still open. [M3 has since been accepted](../M3_ACCEPTANCE.md) by the owner after full mission completion and replay.
