# Current handoff — October 22, 2026

Updated with Crossfire Relay, stronger tactics and durability/salvage/weapons after implementation baseline `164bf41` (October 21) and documentation commit `5a044ec`. Start with the [current roadmap](../ROADMAP.md); the October 14 [assessment](../PROJECT_ASSESSMENT.md) and older checkpoint reports describe history.

## Accepted and delivered

M1, M3 and M4's functional workflow are owner-accepted. The owner reported hosted CI passing October 18; do not request those acceptances again. M2's broader hardware performance acceptance remains open. Earlier CI failures and pending editor-sign-off statements are historical, not current blockers.

The game has four authored campaign missions, ending with 48-space Asterion Deepworks; three camera views, cockpit/map/headlights and saved preferences; relays, sliding/shot/concealed doors, fields, lava, reactors and timed extraction. The shared editor/runtime supports formats 1–12, vertical/sloped/diagonal spaces, loops, multiple wall openings, resizing, content movement, validation navigation and playtest/return.

Latest implementation changes:

- [Durability, salvage and weapons](../SALVAGE_AND_WEAPONS.md): following the owner's report that more aggressive enemies still died easily, authored scouts/fighters have 20/40 health. Shot kills leave guaranteed equipment-specific rewards: scout pulse, fighter laser, bomber missile, destroyer/boss plasma. Special salvage unlocks/refills bounded ammo without switching selection and persists until collected or session reset. Player lasers pierce each robot once; missile/plasma blasts have falloff and wall occlusion. Special damage scales from authored pulse damage. Formats remain 1–12; old authored levels inherit these runtime rules.
- [Enemy pressure](../ENEMY_PRESSURE.md): after the owner found enemies passive, authored fighters pursue at 4.8 units/s, warn/recover for 450/400 ms, fire every 1.45–1.75 s with 18-unit/s shots; scouts pursue at 5.4 and lunge at 14 units/s with shorter recovery. Nearby observers report a real sighting to at most four allies within 24 units through adjacent open rooms, at most once per 1.2 s per reporter. Health/damage remain unchanged. Shared data versions and non-document training behavior are preserved.
- [Crossfire Relay](../CROSSFIRE_RELAY.md): a separate nine-space practice mission combining scout/fighter combat, direct/overhead approaches, optional supplies, two loops and a relay-controlled return shortcut. Six new simulation cases and two native-input browser routes exercise its behavior. Longer encounter cases now have a dedicated Playwright/CI project; diagnostic scout positions are read-only and development-only.
- [Mobile fighters](../FIGHTER_MOVEMENT.md): bounded strafe/elevation/spacing between stationary warning/fire/recovery phases, last-seen navigation and a two-fighter practice drill. Authored campaign and custom mines share the behavior.
- [My Levels](../USER_LEVELS.md): import/play/rename/export/delete, editor update/copy, local persistence, cross-tab protection and temporary operation when storage fails. Built-in campaign completion supports next-mission advancement. Saved campaign progression and user campaign bundles are not implemented.
- [Deepworks combat performance](../DEEPWORKS_COMBAT_PERFORMANCE.md): fixed campaign scene light count removes the reproduced shooting shader stalls. [Deepworks](../DEEPWORKS.md) adds destructible reactors, portal visibility, 48 spaces and nine loops.

## Next implementation task

Recheck durability/salvage in human playtests. The owner found the first Crossfire version easy/passive, then reported that the more aggressive enemies still died easily. Scouts/fighters now have 20/40 health; Crossfire needs four/eight normal pulse hits. Use its [checklist](../CROSSFIRE_RELAY.md#balance-playtest-checklist) to compare approach routes, with and without collecting the fighter's cyan laser salvage. Sight reports can draw scouts in before personal visual contact; the drill's second guard can respond early. Automated routes establish behavior, not human difficulty.

Then finish one heavy-enemy role (bomber area denial first), broaden hardware/release regression verification, and add saved campaign progress/user campaigns. Rescue objectives are a later mission-system option. Details and completion criteria are in the [roadmap queue](../ROADMAP.md#next-work-queue).

Authored heavy enemies still share much of their movement; enemy projectiles currently use 10 damage. Player piercing/blast behavior is now implemented. Bomber area denial, directional destroyer armor, boss phases and sniper/support robots remain future work. Salvage is session-local; saved campaign inventory/progress and portable editor placement of special weapons are not implemented.

## Verification available

- October 22 salvage/weapon pass: `npm run verify` passed 83 runtime modules plus two lint tooling files, strict types, all 507 unit/simulation cases and production build. Ten new cases cover durability, type-specific drops, collection/caps/reset, wall blocking, scaled special damage/ammo/fallback, piercing and blast falloff/occlusion/reentrant reset. Existing large-chunk advisory remains.
- Latest [salvage browser evidence](salvage-browser-check.json): five distinct targeted scenarios passed across completed runs, with zero retries: Signal Breach fight/extraction/replay, Crossfire direct, Crossfire overhead with ordinary laser collection/selection/fire, fighter drill and production victory/death/reboot/menu. Initial overhead assertion was corrected because descent had already collected the item; final recheck passes through extraction and replay, with the laser locked again. Final overhead observation: sixteen pulse shots, one laser shot, minimum sampled shields 65%, 152.63 simulation seconds. These are functional observations, not human balance/hardware evidence. Full 62-case and hosted runs remain open.
- October 22 pressure pass: `npm run verify` passed 82 runtime modules plus two lint tooling files, strict types, all 497 unit/simulation cases and production build. The existing large-chunk advisory remains. Scope lives in `tsconfig.check.json`.
- October 21 [fighter browser evidence](mobile-fighter-browser-check.json): four targeted functional cases passed, including ordinary combat, drill completion/reset, Signal Breach and production victory/death/reboot. [My Levels evidence](my-levels-browser-check.json) records its completed six-case checkpoint. These are targeted reports, not a fresh full-suite pass on the latest revision.
- Earlier [pressure browser evidence](enemy-pressure-browser-check.json), before durability/salvage: five distinct targeted scenarios passed across completed runs, with zero retries: Signal Breach fight/overhead/extraction/replay, both Crossfire approaches, the mobile-fighter drill and production victory/death/reboot/menu. Controllers were corrected to answer pursuing allies, prioritize the ranged guard from doorway cover, and enter the hall if a scout starts outside the local report radius. These use ordinary input and read-only diagnostics. Full 62-case browser and latest-revision hosted acceptance remain open.
- Initial [Crossfire evidence](crossfire-browser-check.json), before stronger tactics: six targeted scenarios passed, including My Levels and mission/settings compatibility. Seven shots per route, minimum shields 40% direct / 75% overhead and simulation completion 124.5 / 153.2 s describe that older behavior, not current human balance. Those dated observations and screenshots are preserved.
- October 21 [hardware evidence](deepworks-mobile-fighters.json): Intel UHD / ANGLE D3D11, headless Chromium, 1280×720 cockpit. Idle p95/worst 16.8/33.4 ms; firing 16.7/16.8 ms; encounter 16.8/33.4 ms; no frames above 100 ms and nine scene lights. This is the latest focused capture, not acceptance across traversal, sustained combat, browsers or GPUs. Older arena p95 near 18 ms remains historical evidence.

## Working commands and constraints

Use the pinned Node/npm versions in [TOOLCHAIN.md](../TOOLCHAIN.md). Run `npm run dev` for play/editor, `npm run smoke` for diagnostics, `npm run verify` for local contracts/tests/build, `npm run test:browser` for the full browser suite, and `npm run audit:deps` for a fresh dependency audit.

`npm run profile:arena` and `npm run profile:deepworks -- --renderer=hardware` own port 5185. Browser tests own ports 5183/5184. Keep runtime source/build stable while Playwright owns its servers. Software-rendered controlled-clock checks at 960×540 establish behavior; hardware profiling uses real time at 1280×720 and checks the renderer. Do not infer performance from debug HUD intervals under a mocked clock.

The October 22 review and documentation cleanup do not establish a fresh dependency audit, clean install, hardware capture, deployment or hosted run. Existing feature verification records and screenshots retain their original scope and dates.

## Historical investigations

Keep old evidence intact. CI timing and failure investigations live in [reliability](M2_CI_RELIABILITY.md), [controlled clock](M2_CI_CONTROLLED_CLOCK.md) and [job isolation](M2_CI_JOB_ISOLATION.md). Earlier editor and presentation checkpoints remain useful implementation records, but their pending acceptance language is superseded by the owner acceptances above.
