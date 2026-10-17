# Current handoff — October 16, 2026

## Accepted milestones and next feature

**M1 and [M3](../M3_ACCEPTANCE.md) are accepted and complete.** The owner reports Deep Relay is playable and explicitly confirms activating both relays, reaching MISSION COMPLETE and replaying with enemies, ammo and gates reset. Do not request that sign-off again. Browser/GPU/version and detailed balance measurements were not provided for this M3 playthrough.

The next feature milestone is **M4: a minimal local designer** using the existing validated v1/v2 JSON and compiler. Begin with snapped room/corridor assembly, compatible port connections and a document save/reload round trip; then add entity/relay/door placement and playtest/return-to-edit. Prefer a working author/play/export loop over arbitrary geometry or a broad asset library. No editor UI exists yet. Primitive art and the development-only diagnostics/guide-footer overlap are optional follow-ups.

## Hosted CI is still open

The owner supplied both full logs for [run 38979088436](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38979088436). Ubuntu passed eight of nine but failed relay steering at room boundaries. Windows passed one, reported three failures and left five unrun when the twenty-minute job stopped. Its restart-health assertion observed 90% after live enemy fire; flight observations skipped roughly ten to thirteen simulation seconds while keys remained held. This run predates the two Deep Relay cases; it does not establish a bug in the new mission.

[Controlled-clock repairs](M2_CI_CONTROLLED_CLOCK.md) replace continuous wall-time flight with Playwright clock ticks for the first six combat/navigation/reset cases. They still exercise native keyboard events, real movement/collision/AI/projectiles and objectives. Between commands the application clock is frozen; each tick advances at most six normal 60 Hz steps. No game object or transform injection is introduced. The resource and four settings/audio cases remain in real time.

A fourteen-second wall-delay probe holds W, verifies unchanged position/time/steps, then verifies six updates and real movement on the next tick. Trace actions/DOM/source are retained; continuous screenshot screencasting is disabled, with explicit checkpoint/failure screenshots retained. Retries remain zero and the CI job limit remains twenty minutes. CPU throttling alone did not reproduce hosted command latency; do not treat a local pass as a hosted pass.

## Verification checkpoint

Pinned Node 24.22.0 / npm 11.21.1 passes lint, strict checks, all 260 runtime cases and build. Scope remains 38 runtime modules / 108 negative compiler examples. Game source, dependencies/lockfile and production bundle are unchanged: `/assets/index-DiRlekEi.js`, 699.27 kB / 178.92 kB gzip, 63 modules. The existing bundle warning remains.

The two previously failing browser cases passed a focused local run. The first full fourfold-throttled run passed ten cases and exposed a stale HUD assertion in the mine test: after neutralizing drones, no frame had been advanced to refresh the guide. [Initial evidence](ci-clock-initial-check.json) is preserved. The assertion now explicitly advances the controlled clock. The final complete run passes all eleven cases under fourfold CPU throttling in 6.9 minutes, with zero browser errors and no retries. [Final evidence](ci-clock-browser-check.json) preserves clock modes, traversal observations, the fourteen-second delay probe and twelve restart-resource samples. Hosted acceptance still requires a new run.

The earlier [Deep Relay browser report](deep-relay-browser-check.json) remains historical local evidence, not hosted confirmation. M2 hardware acceptance stays open (last Intel GPU p95 about 18ms versus provisional 16.7ms); no new hardware capture or audit was run for this harness/documentation change.

## Workspace and next action

The owner committed the Deep Relay implementation as `c16f92d` before this turn. This turn changes test timing/trace configuration and acceptance/progress documents. No commit or push was made. A fresh hosted Ubuntu/Windows workflow run is still required after these repair changes are pushed.

Do not edit runtime JS or rebuild while Playwright owns its servers. Browser functional resolution is 960x540 with ANGLE SwiftShader; hardware profiling stays at 1280x720. Controlled-clock timing is not performance evidence. The completed run released its owned servers; the temporary `.ci-cpu-stress.local` was removed. Preserve untouched bytes in older mixed-encoding docs.
