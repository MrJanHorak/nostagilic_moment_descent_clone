# Current handoff — October 18, 2026

## Current checkpoint: M4 authoring, offset openings and preview

The owner reports hosted CI now passes, closing that M2 gate. No run URL was provided. M3 remains accepted; do not request repeat sign-off. **M2 remains open for hardware performance acceptance** (last recorded Intel GPU p95 approximately 18 ms against the provisional 16.7 ms target).

[The current M4 checkpoint](M4_DESIGNER_AUTHORING.md) adds prominent red overlap warnings, corner/custom-offset openings, per-face colors and four local repeating patterns, opaque cutaway/exterior preview, enemy/pickup/relay placement, spawn/exit/content properties, required enemy IDs and relay doors. A first-person playtest runs the real Game from a snapshot in a separate frame and returns to unchanged editing state/history. `/editor.html` and the game-menu link remain the entry points. Format v3 owns the new data; v1/v2 import and unchanged round trips remain supported. Export/playtest stay blocked for invalid drafts.

**Next feature work:** room deletion/duplication, autosave/recovery and the complete three-space M4 acceptance scenario. Custom image uploads and freeform/intersecting-room unions remain deferred. Content properties are numeric room-local coordinates; room gizmos remain available. Do not mark M4 accepted without the remaining persistence/command work and human authoring playthrough.

**Verification:** lint/strict types pass for 43 source modules; all 322 unit/runtime cases and the three-entry production build pass. All 16 browser cases pass in 5.7 minutes with no skips, retries or unexpected results: five designer cases and eleven existing game cases. [Evidence](m4-authoring-browser-check.json) records every result and the local Node 22.14.0 / npm 11.2.0 / Windows / SwiftShader environment. Screenshot review covered red overlap warnings, patterned opaque cutaways and actual first-person surfaces at 1280x800; existing designer cases also cover 960x540. A simple authored relay mission completes with native keyboard input and returns to byte-identical editing JSON/history. The existing large-chunk build warning remains. No dependencies changed and no fresh audit/hardware capture was run. This new change has not run on hosted CI; no commit, push or deployment was made. Browser servers have exited; the temporary verification log was removed. The prior shell's [14-case evidence](m4-designer-browser-check.json) remains historical.

The sections below retain historical CI diagnostics from October 17; their pending hosted-run statements are superseded by the owner's October 18 confirmation.

## Accepted milestones and next feature

**M1 and [M3](../M3_ACCEPTANCE.md) are accepted and complete.** The owner reports Deep Relay is playable and explicitly confirms activating both relays, reaching MISSION COMPLETE and replaying with enemies, ammo and gates reset. Do not request that sign-off again. Browser/GPU/version and detailed balance measurements were not provided for this M3 playthrough.

The next feature milestone is **M4: a minimal local designer** using the existing validated v1/v2 JSON and compiler. Begin with snapped room/corridor assembly, compatible port connections and a document save/reload round trip; then add entity/relay/door placement and playtest/return-to-edit. Prefer a working author/play/export loop over arbitrary geometry or a broad asset library. No editor UI exists yet. Primitive art and the development-only diagnostics/guide-footer overlap are optional follow-ups.

## Hosted CI is still open

**Latest evidence:** the owner's [run 38993829244](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38993829244) tested `5bb8004`. Windows passed in 13m19s. Ubuntu passed the original three problem cases, but failed production combat and the Deep Relay route before the twenty-minute job limit stopped the suite. Its log omits both assertion errors. See [the job-isolation follow-up](M2_CI_JOB_ISOLATION.md) for current changes, verification and the authenticated artifact needed for diagnosis. The older run and local evidence below remain historical context.

The owner then supplied both error contexts. Deep Relay explicitly reports the 480,000ms test timeout during active keyboard flight, with speed 1.679, one relay activated and zero reported runtime errors. Production shows death before the opening fighter defeat: health 0%, score 0, ammo 35, enemies 0/2, followed by a generic exhausted clock wait. The production test now avoids mouse activation around pointer capture and reports premature death immediately; native mouse interference is a hypothesis, not a proven original cause. See the follow-up for focused verification.

The current job/diagnostic changes pass all eleven local browser cases under fourfold CPU throttling in 6.0 minutes, with zero browser errors, skips or retries; [fresh evidence](ci-job-isolation-browser-check.json) is preserved. Runtime verification still passes all 260 cases plus lint, strict types and build. No fresh hosted run has been triggered.

Following the production context, its native mission/resume/result buttons now use Enter, and combat waits fail immediately if the ship dies before the expected kill/exit. Three consecutive focused fourfold-throttled runs pass in 1.5 minutes, with zero browser errors and no observed opening mouse-aim motion; [focused evidence](ci-keyboard-combat-browser-check.json) is preserved. The previous eleven-case run predates this final production test follow-up. No runtime source or other test behavior changed.

The owner supplied both full logs for [run 38979088436](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38979088436). Ubuntu passed eight of nine but failed relay steering at room boundaries. Windows passed one, reported three failures and left five unrun when the twenty-minute job stopped. Its restart-health assertion observed 90% after live enemy fire; flight observations skipped roughly ten to thirteen simulation seconds while keys remained held. This run predates the two Deep Relay cases; it does not establish a bug in the new mission.

[Controlled-clock repairs](M2_CI_CONTROLLED_CLOCK.md) replace continuous wall-time flight with Playwright clock ticks for the first six combat/navigation/reset cases. They still exercise native keyboard events, real movement/collision/AI/projectiles and objectives. Between commands the application clock is frozen; each tick advances at most six normal 60 Hz steps. No game object or transform injection is introduced. The resource and four settings/audio cases remain in real time.

A fourteen-second wall-delay probe holds W, verifies unchanged position/time/steps, then verifies six updates and real movement on the next tick. Trace actions/DOM/source are retained; continuous screenshot screencasting is disabled, with explicit checkpoint/failure screenshots retained. Retries remain zero and the CI job limit remains twenty minutes. CPU throttling alone did not reproduce hosted command latency; do not treat a local pass as a hosted pass.

## Verification checkpoint

Pinned Node 24.22.0 / npm 11.21.1 passes lint, strict checks, all 260 runtime cases and build. Scope remains 38 runtime modules / 108 negative compiler examples. Game source, dependencies/lockfile and production bundle are unchanged: `/assets/index-DiRlekEi.js`, 699.27 kB / 178.92 kB gzip, 63 modules. The existing bundle warning remains.

The two previously failing browser cases passed a focused local run. The first full fourfold-throttled run passed ten cases and exposed a stale HUD assertion in the mine test: after neutralizing drones, no frame had been advanced to refresh the guide. [Initial evidence](ci-clock-initial-check.json) is preserved. The assertion now explicitly advances the controlled clock. The final complete run passes all eleven cases under fourfold CPU throttling in 6.9 minutes, with zero browser errors and no retries. [Final evidence](ci-clock-browser-check.json) preserves clock modes, traversal observations, the fourteen-second delay probe and twelve restart-resource samples. Hosted acceptance still requires a new run.

The earlier [Deep Relay browser report](deep-relay-browser-check.json) remains historical local evidence, not hosted confirmation. M2 hardware acceptance stays open (last Intel GPU p95 about 18ms versus provisional 16.7ms); no new hardware capture or audit was run for this harness/documentation change.

## Workspace and next action

The current follow-up separates contracts/audit from three independent browser groups per OS, prints errors and read-only state immediately, names flight steps, and gives Deep Relay twelve minutes within a fifteen-minute Playwright suite deadline. The job guard stays twenty minutes, with report upload time reserved. The production route uses keyboard activation around pointer capture and aborts combat waits on an unexpected death. No gameplay, dependency or mission changes are made. Both original failure stages are identified; fresh Ubuntu verification is still required before claiming hosted success.

The earlier controlled-clock repairs were committed as `5bb8004` and tested in the latest hosted run. This follow-up changes only browser tests, CI configuration and progress documents. No commit or push was made. A fresh hosted workflow run is still required after these changes are pushed.

Do not edit runtime JS or rebuild while Playwright owns its servers. Browser functional resolution is 960x540 with ANGLE SwiftShader; hardware profiling stays at 1280x720. Controlled-clock timing is not performance evidence. The completed run released its owned servers; the temporary `.ci-cpu-stress.local` was removed. Preserve untouched bytes in older mixed-encoding docs.
