# Developer guide

Updated October 22, 2026. Use [the roadmap](docs/ROADMAP.md) for status and priorities, [the handoff](docs/progress/NEXT_SESSION.md) for verification boundaries, and [the toolchain guide](docs/TOOLCHAIN.md) for setup. Historical starter implementations and repair utilities live in [archive/](archive/README.md).

## Runtime and editor boundaries

The live entry is `index.html → main.js → src/js/main.js`. `editor.html` loads the designer; `playtest.html` hosts its runtime preview. `src/js/core/GameSession.js` owns session state and simulation-time callbacks. Input, movement, collision, combat and teardown must respect pause and session replacement.

| Change | Active source |
| --- | --- |
| Campaign order, documents and briefings | `src/js/core/levels/Campaign.js` |
| Portable level data and types | `src/js/core/levels/documents/`, `src/js/levelDocument.d.ts` |
| Validation, compilation and navigation | `src/js/core/levels/document/` |
| Enemy statistics and models | `src/js/entities/EnemyTypes.js`, `EnemyFactory.js`, `meshBuilders/` |
| Enemy behavior | `EnemyManager.js`, `FighterMovement.js`, `FighterAttack.js`, `ScoutAttack.js` in `src/js/entities/` |
| Authored aggression tuning | `src/js/entities/EnemyTactics.js`; [pressure rules](docs/ENEMY_PRESSURE.md) |
| Enemy salvage and special ammunition | `src/js/entities/EnemySalvage.js`; [weapon rules](docs/SALVAGE_AND_WEAPONS.md) |
| Projectile creation and swept hits | `src/js/entities/ProjectileManager.js` |
| Authored pickups / runtime effects | `src/js/core/levels/document/LevelContent.js`, `src/js/entities/PowerUpManager.js` |
| Editor commands and preview | `src/js/editor/` |
| HUD, cockpit, menus and library | `src/js/ui/` |

## Author a mission

1. Run `npm run dev` and open `/editor.html`, or select Level Designer. Build connected spaces and place spawn, enemies, supplies, controls and exit.
2. Resolve validation issues; use runtime Playtest, return to editing, and check undo/reload behavior.
3. Save to My Levels for browser-local use, or export JSON for a portable backup. The [library guide](docs/USER_LEVELS.md) covers updates, copies, imports and storage limits.
4. To bundle a campaign mission, add its validated document under `src/js/core/levels/documents/` and register it with its briefing in `Campaign.js`. Add route/progression/reset coverage appropriate to its mechanics.

The [document format](docs/LEVEL_DOCUMENT_FORMAT.md) supports versions 1–12. The validator, TypeScript interfaces and compiler are authoritative. Keep authored intent separate from runtime health, velocity, killed IDs and objective progress. Room centers use world coordinates; placements use room-local coordinates, +Y up and local -Z forward. Rendering and collision must agree for every passage and orientation.

Reuse existing [door](docs/LEVEL_DOCUMENT_FORMAT.md#version-8-sliding-doors-and-concealed-access), [reactor](docs/REACTOR_ESCAPE.md), [field](docs/FORCE_FIELDS.md) and [Deepworks](docs/DEEPWORKS.md) workflows. Format v6+ permits up to 256 rooms and 512 connections; v7+ supports multiple openings per face. Preserve old document contracts; add a versioned extension when new data would otherwise change old semantics.

`LevelBlueprint.js` and `SegmentTypes.js` serve the internal endless generator and regressions. Removed Level1/Level2/Level3/ExampleLevel modules are not campaign authoring entry points.

## Extend combat

Scouts have a warning, committed lunge and withdrawal/recovery. Fighters have warning/fire/recovery phases plus bounded movement in authored mines. [Fighter Proving Ground](docs/FIGHTER_MOVEMENT.md) exercises spacing; [Crossfire Relay](docs/CROSSFIRE_RELAY.md) combines both threats with direct/overhead approaches. Bomber/destroyer/boss models and projectile variants exist, but their authored-mine tactics are less developed. Enemy definition `damage` is not the current ranged shot power: hostile projectiles are created with power 10.

For a new enemy type, update enemy unions/contracts, statistics, a concrete mesh builder and factory mapping; then add explicit perception/movement/attack rules in the manager or a dedicated behavior module. Update authoring validation, editor choices and diagnostics as needed. `EnemyAnimations.js` owns visual animation. Preserve body clearance, line of sight, last-seen memory, bounded planning and disposal ownership.

Campaign/custom combat now supports equipment-specific salvage and special weapons alongside authored pulse budgets. Authored scouts have 20 health and fighters 40; the older non-document training values remain 10/25. Lasers pierce robots once each and stop at walls; missile/plasma blasts have falloff and physical occlusion. Damage scales from the mission pulse value. See [salvage and weapon rules](docs/SALVAGE_AND_WEAPONS.md) for capacities, direct-hit/objective rules and session ownership.

Combat checks should cover actual shot hits, wall/door occlusion, damage/kill credit, cues, evasion, pause, death and replay. Compare 30/60/120 Hz movement where relevant. Browser combat should use ordinary input/fire; diagnostic neutralization isolates route geometry and does not establish balance.

## Extend pickups and mission systems

Authored documents expose `health` and `pulseAmmo` through `AUTHORED_PICKUPS` in `LevelContent.js`. Health restores up to 25% of maximum shields; pulse ammo adds up to 20 rounds within capacity. `EnemySalvage.js` maps authored shot kills to guaranteed pulse/laser/missile/plasma rewards, instantiated by `PowerUpManager.js`. These runtime rewards and legacy speed/weapon buffs are not portable editor pickup kinds.

For a new pickup or objective, extend types, structural/semantic validation, compilation, runtime behavior and editor authoring together. Cover old-version compatibility, import/export, atomic undo, placement clearance and restart. Store collected items, carried rescues and armed countdowns in session state, not the document.

Use simulation time for gameplay effects. Existing buffs use `GameState.applyTimedModifier`; scheduled attacks use `GameSession.schedule`. Avoid wall-clock `setTimeout` for gameplay expiration: pause and restart must own the lifetime. Keep cosmetic animation on the managed update path and release owned resources at teardown.

## Presentation and rendering

Use relative module imports as existing source does. Add UI beside the relevant menu, library, settings, cockpit or navigation component, with keyboard/focus behavior and text-safe imported names.

Finite campaign lighting stays stable during shots, effects, pickups and robot deaths. Preserve emissive cues without per-entity lights that recreate shader stalls. Portal visibility culls static rendering conservatively; collision, AI and discovery remain resident. Water is a solid face treatment, not a submerged volume. See [combat performance](docs/DEEPWORKS_COMBAT_PERFORMANCE.md).

## Verify a change

- `npm run verify`: scoped lint, strict types, unit/simulation tests and production build. Scope lives in `tsconfig.check.json` and `scripts/lint.mjs`; add newly checked modules there as appropriate.
- `npm run test:browser`: build and full functional browser suite. Run `npm run browser:install` once first. After building, use `npx playwright test --project=encounters` for Crossfire/mobile fighters, or the appropriate project/file filter from `playwright.config.js` for another focused run.
- `npm run smoke`: development diagnostics. Normal play uses `npm run dev`; production inspection uses `npm run build` then `npm run preview`.
- `npm run profile:arena` / `npm run profile:deepworks -- --renderer=hardware`: real-time hardware measurement, separate from controlled-clock software browser checks.
- `npm run audit:deps`: fresh advisory check; prior zero-vulnerability snapshots are dated evidence.

Keep runtime/build stable while browser tests own ports 5183/5184; profilers own 5185. Distinguish local/hosted checks, targeted/full suites, functional/hardware evidence and automated/human balance feedback when reporting results.
