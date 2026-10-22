# DESCENDED: implementation status and next steps

Updated October 22, 2026, against implementation commit `164bf41`. This is the current work queue. The [October 14 assessment](PROJECT_ASSESSMENT.md) describes the historical baseline; its defects and original delivery estimates are not a list of remaining work.

## Milestone status

| Milestone | Status | Evidence and remaining work |
| --- | --- | --- |
| M1: functional mission | Accepted | [Owner acceptance](M1_ACCEPTANCE.md); flight, combat, extraction and session reset are implemented |
| M2: reproducibility and stability | Hardware acceptance open | Toolchain, scoped contracts, tests and CI are implemented; owner reported hosted CI passing October 18. Broader hardware performance acceptance remains open |
| M3: connected authored mine | Accepted | [Owner acceptance](M3_ACCEPTANCE.md); shared validated documents, physical portals, navigation and relay progression |
| M4: local level designer | Functional workflow accepted | [Owner acceptance](M4_ACCEPTANCE.md); author, validate, playtest, return, undo, export and reload |

These acceptances remain valid. Subsequent features have their own regression evidence; the earlier hosted CI confirmation does not establish a hosted pass for every later revision.

## Delivered beyond the original MVP

- **Campaign:** Signal Breach, Vector Foundry, Nightfall Reactor and Asterion Deepworks. Deepworks has 48 spaces, 56 passages and nine independent loops. Built-in missions advance through the completion screen.
- **Editor and data:** shared format versions 1–12; rooms, ramps, diagonal corridors, vertical shafts, multiple openings per wall, connected resizing, face styles, content movement, validation navigation, undo/redo and draft recovery.
- **Mission mechanics:** relays, sliding and shot-open doors, concealed access, force fields, lava contact damage, safe animated water surfaces, destructible reactors and simulation-time escape countdowns.
- **Player presentation:** three camera views, cockpit instruments, headlights, explored-area map, original procedural music and saved controls/audio/view preferences.
- **Custom levels:** browser-local My Levels library, import/export, rename/delete, editor update/copy, storage failure handling and cross-tab conflict detection. See [My Levels](USER_LEVELS.md).
- **Combat:** scout warning/lunge/recovery; fighter warning/fire/recovery plus bounded strafing, elevation and distance control in authored mines. [Fighter Proving Ground](FIGHTER_MOVEMENT.md) is a separate four-room practice mission.
- **Rendering:** conservative portal visibility and stable campaign light counts during combat. See [Deepworks](DEEPWORKS.md) and [combat performance](DEEPWORKS_COMBAT_PERFORMANCE.md).

## Next work queue

Keep each change small enough to review and play independently. These are proposals, not delivered features.

| Priority | Work | Completion evidence |
| --- | --- | --- |
| 1 | Tune one mixed scout/fighter encounter around a loop and vertical approach | Safe arrival, cover, retreat route, optional supplies, ordinary-input combat/extraction/replay; record shots, minimum shields, route use and completion time during human playtests |
| 2 | Finish one distinct heavy-enemy role, starting with bomber area denial | Warning, committed explosive attack and recovery; explicit damage/blast/occlusion rules; collision, pause/reset and ordinary-fire browser coverage |
| 3 | Close broader performance and release regression gates | Repeated real-time hardware captures of traversal, multiple enemies, reactor escape and restart resources; full browser suite on the same revision; inspect CI group duration and split the large production group if needed |
| 4 | Add campaign persistence and user campaigns | Saved built-in progress/resume, custom mission ordering and briefings, validated campaign bundle import/export, isolated campaign and standalone replay behavior |

The first encounter should use existing authoring and enemy systems. Establish balance from route choices, readable attack windows and pacing before changing health or enemy counts throughout the campaign. See [the encounter review](ENEMY_AND_ENCOUNTER_REVIEW.md).

For heavier enemies, distinguish current visuals/projectile variants from finished tactical roles. Authored-mine bombers, destroyers and bosses share much of their movement; hostile projectiles currently use 10 damage. Player projectile explosion/penetration flags do not establish complete splash/penetration behavior. Check `EnemyManager.js` and `ProjectileManager.js` before extending them.

## Verification and performance boundary

The October 22 repository review ran `npm run verify`: lint passed for 80 runtime modules and two lint tooling files, strict type checks passed, all 485 unit/simulation tests passed, and the production build passed. Scope is declared in `tsconfig.check.json`; this is not full-source lint/type coverage. The existing large-chunk build advisory remains.

Latest completed targeted browser evidence is the [October 21 fighter checkpoint](progress/mobile-fighter-browser-check.json), alongside [My Levels](progress/my-levels-browser-check.json) and earlier feature reports. The October 22 fighter/library spot check was stopped during local server startup before tests executed. It establishes neither a browser pass nor a gameplay failure. Full browser verification for the current revision remains a next action.

The [October 21 hardware capture](progress/deepworks-mobile-fighters.json) records Intel UHD / ANGLE D3D11 at 1280×720: idle p95/worst 16.8/33.4 ms, firing 16.7/16.8 ms, encounter 16.8/33.4 ms, with no frames over 100 ms. These focused results supersede the old 18 ms figure as the latest capture, but do not close M2. Retain the provisional 16.7 ms p95 target until representative measurements and an explicit acceptance decision support a change. Controlled-clock software-rendered browser checks are functional evidence only.

## Later work and scope limits

Rescue objectives are the next proposed distinct mission mechanic after encounter tuning; recharge stations require a weapon-energy decision. Flooded volumes/currents and finite triggered reinforcements need separate validation, runtime, editor and lifecycle work. See [environment and mission options](ENVIRONMENT_AND_MISSION_ROADMAP.md).

Map pan/rotate/zoom/markers, input remapping/gamepad support, further art/accessibility work and editor camera/isolation/multi-selection tools remain useful follow-ups. Water is currently a solid surface treatment. Arbitrary vertex editing, streaming, online level hosting, multiplayer, VR, mobile controls and classic Descent file compatibility require separate scope. The internal endless generator remains for diagnostics/regressions, not the primary mission library.

Original M1–M4 engineering estimates described the October 14 recovery plan, not remaining implementation effort. Re-estimate each new feature from its actual scope and playtest results.
