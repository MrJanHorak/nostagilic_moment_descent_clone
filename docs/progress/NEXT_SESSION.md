# Current handoff — October 22, 2026

Implementation baseline: `164bf41` (October 21). Start with the [current roadmap](../ROADMAP.md); the October 14 [assessment](../PROJECT_ASSESSMENT.md) and older checkpoint reports describe history.

## Accepted and delivered

M1, M3 and M4's functional workflow are owner-accepted. The owner reported hosted CI passing October 18; do not request those acceptances again. M2's broader hardware performance acceptance remains open. Earlier CI failures and pending editor-sign-off statements are historical, not current blockers.

The game has four authored campaign missions, ending with 48-space Asterion Deepworks; three camera views, cockpit/map/headlights and saved preferences; relays, sliding/shot/concealed doors, fields, lava, reactors and timed extraction. The shared editor/runtime supports formats 1–12, vertical/sloped/diagonal spaces, loops, multiple wall openings, resizing, content movement, validation navigation and playtest/return.

Latest implementation changes:

- [Mobile fighters](../FIGHTER_MOVEMENT.md): bounded strafe/elevation/spacing between stationary warning/fire/recovery phases, last-seen navigation and a two-fighter practice drill. Authored campaign and custom mines share the behavior.
- [My Levels](../USER_LEVELS.md): import/play/rename/export/delete, editor update/copy, local persistence, cross-tab protection and temporary operation when storage fails. Built-in campaign completion supports next-mission advancement. Saved campaign progression and user campaign bundles are not implemented.
- [Deepworks combat performance](../DEEPWORKS_COMBAT_PERFORMANCE.md): fixed campaign scene light count removes the reproduced shooting shader stalls. [Deepworks](../DEEPWORKS.md) adds destructible reactors, portal visibility, 48 spaces and nine loops.

## Next implementation task

Author and tune one mixed scout/fighter encounter using existing room/portal tools. Include safe arrival, cover, a vertical flank, a loop, optional supplies and a fallback corner. Exercise ordinary input/fire through extraction and replay. Record ammo used, minimum shields, route choices and completion time in human playtests. This encounter is proposed; the existing Fighter Proving Ground contains two fighters, not a mixed encounter.

Then finish one heavy-enemy role (bomber area denial first), broaden hardware/release regression verification, and add saved campaign progress/user campaigns. Rescue objectives are a later mission-system option. Details and completion criteria are in the [roadmap queue](../ROADMAP.md#next-work-queue).

Avoid treating legacy weapon flags or enemy names as completed mechanics. Authored heavy enemies share much of their movement; enemy projectiles currently use 10 damage. The player shot collision path consumes the first hit, without a complete splash/penetration contract.

## Verification available

- October 22 review: `npm run verify` passed 80 runtime modules plus two lint tooling files, strict types, all 485 unit/simulation cases and production build. The existing large-chunk advisory remains. Scope lives in `tsconfig.check.json`.
- October 21 [fighter browser evidence](mobile-fighter-browser-check.json): four targeted functional cases passed, including ordinary combat, drill completion/reset, Signal Breach and production victory/death/reboot. [My Levels evidence](my-levels-browser-check.json) records its completed six-case checkpoint. These are targeted reports, not a fresh full-suite pass on the latest revision.
- October 22 spot check of fighter/library browser cases was stopped during local server startup before execution. No browser pass or gameplay failure was established. Re-run the full suite for a release checkpoint and inspect the large production group's duration before claiming hosted success for this revision.
- October 21 [hardware evidence](deepworks-mobile-fighters.json): Intel UHD / ANGLE D3D11, headless Chromium, 1280×720 cockpit. Idle p95/worst 16.8/33.4 ms; firing 16.7/16.8 ms; encounter 16.8/33.4 ms; no frames above 100 ms and nine scene lights. This is the latest focused capture, not acceptance across traversal, sustained combat, browsers or GPUs. Older arena p95 near 18 ms remains historical evidence.

## Working commands and constraints

Use the pinned Node/npm versions in [TOOLCHAIN.md](../TOOLCHAIN.md). Run `npm run dev` for play/editor, `npm run smoke` for diagnostics, `npm run verify` for local contracts/tests/build, `npm run test:browser` for the full browser suite, and `npm run audit:deps` for a fresh dependency audit.

`npm run profile:arena` and `npm run profile:deepworks -- --renderer=hardware` own port 5185. Browser tests own ports 5183/5184. Keep runtime source/build stable while Playwright owns its servers. Software-rendered controlled-clock checks at 960×540 establish behavior; hardware profiling uses real time at 1280×720 and checks the renderer. Do not infer performance from debug HUD intervals under a mocked clock.

The October 22 review and documentation cleanup do not establish a fresh dependency audit, clean install, hardware capture, deployment or hosted run. Existing feature verification records and screenshots retain their original scope and dates.

## Historical investigations

Keep old evidence intact. CI timing and failure investigations live in [reliability](M2_CI_RELIABILITY.md), [controlled clock](M2_CI_CONTROLLED_CLOCK.md) and [job isolation](M2_CI_JOB_ISOLATION.md). Earlier editor and presentation checkpoints remain useful implementation records, but their pending acceptance language is superseded by the owner acceptances above.
