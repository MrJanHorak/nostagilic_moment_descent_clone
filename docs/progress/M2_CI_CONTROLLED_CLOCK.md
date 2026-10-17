# Hosted CI follow-up: command latency and application time

October 16, 2026. The owner supplied both job logs for [run 38979088436](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38979088436). This run tested the earlier nine-case reliability checkpoint, before Deep Relay's two browser cases. It does not test the new mission. The owner separately completed and replayed Deep Relay, closing [M3 human acceptance](../M3_ACCEPTANCE.md).

## What failed

| Runner | Evidence in the supplied logs |
| --- | --- |
| Ubuntu | Eight passed, one relay-flight case failed; browser suite took 11.4 minutes. Pilot ended at `[22.99999, 4.99999, 6.99999]`, stationary against room boundaries. |
| Windows | One passed, three reported failures, five unrun. Job was stopped at twenty minutes; the browser segment had consumed 15.9 minutes after setup. |

Windows' JSON restart case expected `100%` health but observed `90%`: the assertion ran after simulation and enemy fire had continued. Its mine flight's last earlier observation was at simulation time 29.8s; the failure arrived at 42.783s with the ship at the far wall. The relay flight similarly jumped from 26.783s to 36.433s between recorded observations. The truncated ZIP/context teardown errors occurred during cancellation and do not establish an independent game crash.

The previous controller used simulation-time observations, but keyboard presses remained held while browser commands were delayed. It could therefore miss roughly ten seconds of movement before deciding to release a key. Fourfold JavaScript CPU throttling did not reproduce that combination of browser protocol/rendering latency. A previous local pass was insufficient evidence of hosted reliability.

## Repair

Flight/combat traversal and immediate reset assertions now install Playwright's clock before navigation and pause it at the menu. Native keyboard events, normal game simulation, collision, AI, projectiles and objective code still run. Between commands, application time is frozen. The helper advances one 100ms animation callback at a time; the existing stepper performs at most six normal 60Hz updates. No game handle, player transform, health value or velocity is injected.

This makes a delayed keyup harmless to elapsed flight time and makes post-restart assertions measure the newly restarted state. A deliberate fourteen-second wall delay while W is held verifies unchanged position/steps/time, followed by exactly six simulation steps and real movement on the next controlled tick. Observations still come from read-only diagnostics.

The restart-resource and four settings/audio cases continue using real time. The existing 4/10/30/60 FPS simulations retain variable-frame coverage. Controlled time is deterministic functional coverage, not a performance measurement or a substitute for owner playtesting.

Trace recording retains DOM snapshots, actions and source references but disables continuous screenshot screencasting. Explicit checkpoint/failure screenshots remain. Screencasting can add WebGL readbacks on software renderers; the logs alone do not prove how much of the hosted slowdown it caused.

The repair changes test timing and trace recording; application code and the production bundle remain identical to the committed Deep Relay implementation. Retries remain zero and the twenty-minute job guard remains.

## Final verification

Pinned Node 24.22.0 / npm 11.21.1 passes scoped lint, strict checks, all **260 runtime cases** and the build. Scope remains **38 runtime modules / 108 negative compiler examples**. The production bundle is still `/assets/index-DiRlekEi.js` (699.27 kB / 178.92 kB gzip).

The focused JSON-reset and relay-flight cases passed first. The initial full throttled run passed ten cases and exposed one missing frame advancement in the mine test's post-neutralization guide assertion; [initial evidence](ci-clock-initial-check.json) is preserved. That assertion now explicitly advances the application clock until the guide updates.

The final complete run passes **all eleven cases under fourfold Chromium CPU throttling**, with zero recorded browser errors, no retries, and a duration of **6.9 minutes**. [Final evidence](ci-clock-browser-check.json) preserves per-case clock modes/timings, all traversal observations, the command-delay probe, and twelve restart-resource samples. The delay probe shows unchanged time/steps/position across more than fourteen wall seconds with W held; the next tick adds six simulation steps and moves forward.

This is local Windows evidence. **Hosted acceptance remains open until these changes pass a fresh Ubuntu/Windows workflow run.** Hardware performance remains separate; neither controlled-clock timings nor SwiftShader are the Intel GPU acceptance benchmark.
