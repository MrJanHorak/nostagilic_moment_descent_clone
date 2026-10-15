# DESCENDED: feasible delivery roadmap

Date: October 14, 2026. Read [the assessment](PROJECT_ASSESSMENT.md) for verified defects and limits. This is a proposed plan, not a claim that the tasks are implemented.

**Implementation progress (October 15, 2026):** The startup, session lifecycle, flight and finite arena foundations are followed by the [wall-aware combat checkpoint](progress/M1_COMBAT.md). The selectable combat arena adds swept shot traces (including muzzle paths), one-hit damage ownership, visibility-gated enemies and solid-body movement. All 78 tests pass. First-work-queue items 1–6 are delivered for the new finite arenas; legacy geometry remains unrepaired. Kill-all combat completion is tested, but an explicit objective/exit, authored mission pickups and a normal-browser full playthrough are still required for M1. Item 7 is next.

## Scope and effort

Target a small, original single-player browser game: first-person six-degree-of-freedom flight, a compact connected mine, a few weapons/enemies, and a local prefab-based level designer. Keep the present repository and Three.js. Establish a stable game/data boundary before building editor UI.

The ranges below are **rough engineering estimates for one experienced developer's focused work**, informed by the audit but not implementation spikes. They assume simple geometric assets, no backend, no arbitrary terrain sculpting, and modest visual polish. Learning, substantial new art/audio, or changing the target experience increases them.

| Milestone | Focused effort | Dependency / outcome |
| --- | --- | --- |
| M1: functional test mission | 40–70 hours | Fix contracts and establish coherent flight/combat/session behavior |
| M2: update and stabilize | 40–80 hours | Make M1 reproducible, maintainable, measured, and deployable |
| M3: connected authored mine and shared data | 60–100 hours | Prove the level model on a real exploratory mission |
| M4: local level designer MVP | 60–100 hours | Create, save, reload, and play an authored mission without code edits |
| Total through editor MVP | **200–350 hours** | Small game + constrained editor, not a polished commercial release |

Reserve about **30% contingency**: roughly **260–455 focused hours**, or 7–12 weeks at 40 focused hours/week and 6–11 months at 10 hours/week. A repaired small playable slice can arrive much earlier than the editor. Re-estimate after M1 and after the M3 room/portal prototype. Quality gates determine completion; calendar dates should not override them.

Optional release polish/content after M4 is a separate budget. There is not enough evidence to honestly estimate a complete Descent-scale campaign from this repository.

## M1 — Get one mission functional

**Deliverable:** a short graybox mission, playable from menu to exit, with unrestricted orientation, solid boundaries, pulse fire, two enemy behaviors, health/ammo pickup, loss and win states, and reliable restart. Use a fixed finite environment; defer endless streaming.

1. **Capture the baseline and define the control contract (4–6 hours).** Preserve current output/evidence. Write down first-person camera choice, local axes, player radius, speed/acceleration/damping, quaternion orientation, input semantics, and pause behavior. Add a minimal browser smoke fixture and a developer-only error display. Initially use a supported test runner or Node assertions for pure modules; no large framework is required.
2. **Restore startup and coherent session transitions (8–14 hours).** Reconcile audio registration; make sound failure nonfatal. Fix the power-up update contract. Implement `startSession`, `pause`, `resume`, `complete`, `die`, and `endSession` with legal transitions. Wire all menu routes through those functions. Correct playing-source audio control. Clear keys on blur/unlock; catch pointer-lock refusal; avoid leaving a partially started game.
3. **Replace movement ownership (12–20 hours).** Add a world-space player root with position, quaternion, velocity, and collider. Camera/cockpit are children. Convert local thrust with the player quaternion; apply yaw/pitch/roll to that orientation. Remove the camera-follow overwrite and per-frame world offsets. Time-scale motion and damping; use simulation time for gameplay. Keep visual recoil/shake on a camera child.
4. **Make the arena physically and mechanically coherent (10–18 hours).** Fix floor/wall geometry and collider alignment. Load the whole small test level. Define collision against actual solid walls, including doors/openings when present; use a swept sphere or bounded substeps and sliding response. Reconcile projectile constructor/update ownership; collide shots against enemies and walls. Implement basic enemy pursuit with line of sight and wall avoidance. Treat special weapon effects as disabled until implemented.
5. **Close the complete-play loop (6–12 hours).** Use stable entity/spawn IDs, immutable definitions, clean removal versus combat kills, and idempotent objective completion. Reset velocity, entities, effects, timers, inventory, score/statistics, pause state, and audio as specified. Add a visible objective and exit. Playtest and tune basic readability and handling.

**Acceptance gate:**

- A fresh load reaches menu, starts, pauses/resumes, dies/restarts, and completes with no uncaught errors or repeated update errors.
- Yaw, pitch, roll, and thrust operate in the ship's local frame. A player can turn around, return through a doorway, and fly while inverted.
- Walls block movement and shots; sliding does not permanently stick the ship. No fixed global tunnel-bounds shortcut remains in the finite mission.
- One pulse shot produces one hit; enemy fire damages the correct target; death/exit triggers exactly once. A shot behind a wall cannot hit through it.
- Restart/reselect repeated ten times gives equivalent initial state; returning to the menu does not advance old session callbacks.
- Equivalent 30/60/120 Hz movement simulations agree within a documented tolerance; pause freezes cooldowns, buffs, and projectile lifetimes.

**Boundary:** do not attempt to finish all four old levels here. They are reference content; rebuilding one small reliable space exposes the architecture problems more efficiently.

## M2 — Update the project and make regression visible

M2 can begin with an isolated dependency security patch during M1. Broader upgrades should follow a working smoke test so regressions can be identified.

1. **Dependency and runtime baseline (6–12 hours).** Choose/pin a supported Node LTS and npm policy; verify a clean `npm ci`. Patch Vite/transitive advisories, inspect the lockfile, then evaluate a supported Vite major separately. Upgrade Three.js in a separate change using its migration notes and visual checks. Re-run build, smoke test, and advisory checks. Document residual advisories and applicability instead of relying on a count alone.
2. **Contracts and source cleanup (10–20 hours).** Add JSDoc plus type checking or incrementally adopt TypeScript for `PlayerState`, `SessionState`, `Projectile`, `EnemyDefinition`, and level data. Consolidate active projectile/effect responsibility; move weapon/enemy settings into the actual source of truth. Remove global prototype patches from production. Archive unused starters, backup implementations, repair scripts, and unintegrated stubs after confirming references. Extract UI styles from the 1,000+ line UI builder gradually; do not turn cleanup into a product rewrite.
3. **Verification and CI (10–18 hours).** Add lint, type check, pure simulation tests, schema/fixture checks, production build, and one browser smoke flow to CI. Test session teardown, collision, damage, completion, and resets. Keep GPU/pointer-lock behavior as explicit manual checks where headless automation is not representative. Include browser console errors in smoke failure criteria.
4. **Resource lifecycle and profiling (10–20 hours).** Establish shared asset caches versus entity-owned resources, one effects update loop, bounded pool sizes, and a disposal policy. Fix stranded explosion effects/lights and stale obstacle references. Build a seeded combat fixture; record CPU/frame time, draw calls, lights, and renderer resource counts through repeated sessions. Reduce point lights and allocations based on those measurements.
5. **Usability and delivery baseline (4–10 hours).** Provide sensitivity/invert-Y, volume/mute, input help, focus/pointer-lock recovery, and saved local settings. Correct README instructions and label supported features. Verify production assets under the actual deploy path and missing-asset behavior; preview before updating the existing hosted build.

**Acceptance gate:** clean install + CI pass; dependency findings resolved or specifically documented; one production preview completes the M1 flow; resource counts settle near a steady baseline after repeated restarts. On a named reference machine/browser/resolution, define a frame-time target, provisionally p95 at or below 16.7 ms for the agreed test scene with no growing memory trend. Adjust quality settings or scope if measurement shows that target is unrealistic; no universal hardware guarantee is implied.

## M3 — Make a connected mine, with data the editor can use

**Deliverable:** one compact exploratory mission using the future editor's document format, loaded by the game without executable level scripts.

1. **Versioned level document and loader (12–20 hours).** Define JSON primitives, stable IDs, coordinate conventions, units, references, allowed content types, and limits. Validate structure and semantics before scene creation. Supply clear errors, one canonical sample, import/export round-trip tests, and a conversion strategy for the useful old content. Keep session state outside the document.
2. **Room/prefab connections and collision (20–34 hours).** Prototype box rooms and straight/turning corridor prefabs with matching ports. Produce both visible surfaces and solid colliders from the same definition; create real openings at connected ports. Prove local-to-world transforms, traversal in both directions, vertical travel, and a loop before adding more geometry types. Use the room graph for reachability, not an assumption that rooms form a straight list.
3. **Objectives and navigation (12–20 hours).** Add one objective chain such as activate a device then reach exit, and a small door/key system if needed by the chosen mission. Validate mandatory routes. Use room/portal graph routing for enemies, combined with local steering and visibility. Introduce runtime objective events without requiring a general scripting language.
4. **Author and test a real mission (16–26 hours).** Build approximately 6–10 modest spaces with a loop, vertical connection, readable landmarks, manageable encounters, and pickups placed by ID. Verify playability and fairness. Add a simple map/debug overlay if navigation requires it. Prefer loading the entire compact mission; implement room activation/culling only when profiling demonstrates a need.

**Acceptance gate:** import JSON, navigate every intended connection in both directions, reach every mandatory objective from spawn, complete exactly once, restart correctly, export/reload without changing authored intent. An invalid ID, broken portal, overlapping room, or out-of-bounds entity produces a useful validation error rather than a partial broken level.

**Checkpoint:** if the room/portal collision spike reveals disproportionate work, narrow the geometry to axis-aligned snapped rooms and explicit corridor pieces. Do not broaden to arbitrary mine geometry to solve an MVP scheduling problem.

## M4 — Reach the level designer icebox feature

**Deliverable:** a local browser editor that creates the same M3 documents the game already loads. Its primary success test is an end-to-end authoring workflow, not the number of editing tools.

1. **Editor shell and placement (18–30 hours).** Use a separate entry/route with lazy-loaded editor code. Provide an orbit/fly viewport, grid, room/corridor palette, scene/entity list, selection, translate/rotate gizmos, snapping, and a properties panel. Bound sizes and allowed rotations to the validated prefab system.
2. **Connections, content, and validation (14–24 hours).** Connect compatible ports, preview open/closed walls, place player spawn, enemies, pickups, objective, and exit. Expose validation errors in an actionable list. Reuse runtime definitions and prefab generation rather than writing a second geometry implementation.
3. **Document editing and persistence (14–24 hours).** Add add/delete/duplicate, undo/redo commands, explicit JSON import/export, unsaved-change handling, and autosave/recovery through browser storage. Keep exported files as portable backups; browser storage is not the user's only copy.
4. **Playtest and return (14–22 hours).** Launch a deep snapshot in the existing runtime and return to the untouched editing document. Release pointer lock and editor input correctly on transitions. Create a new valid level from an empty document, export, reload, play, and finish without editing JavaScript.

**Acceptance gate:** a user can create three connected spaces, place spawn/enemy/pickup/objective/exit, play to completion, return, undo an edit, export, reload, and play the same layout. Session entities never appear in the saved document. Bad input cannot execute script or crash a running session. See [LEVEL_EDITOR_DESIGN.md](LEVEL_EDITOR_DESIGN.md) for scope and constraints.

## First work queue

Take these as small reviewable changes, not one large refactor. Each should keep a known smoke fixture available.

| Order | Work item | Evidence / proof of completion |
| --- | --- | --- |
| 1 | Document axes, player root, first-person camera, session states | A minimal arena fixture uses a single player transform |
| 2 | Fix audio start contract and power-up exception | Both start routes advance simulation without F01/F02 |
| 3 | Centralize start/end/pause/reset and callback ownership | Start -> pause -> resume -> restart -> menu smoke flow |
| 4 | Replace world offsets and camera overwrite | Rotated thrust, roll, and inverted flight work; A03–A05/A08/A10 become intended-behavior tests |
| 5 | Repair straight geometry and wall collision | Geometry/colliders match; ship/shot cannot cross a closed wall |
| 6 | Reconcile projectile ownership and implement basic combat | Player/enemy shots collide correctly with walls and targets |
| 7 | Add one latched objective/exit; clean entity removal | One completion event, no cleanup-as-kill side effects |
| 8 | Fix pickup types, spawn/session IDs, buffs, and restart invariants | Same authored pickup after restart; no stale entities/timers |
| 9 | Patch toolchain and add CI against the working slice | Clean install, checks, build, audit, browser smoke |
| 10 | Prototype JSON rooms/ports with one vertical connection | Runtime loads and traverses the first future-editor document |

## Icebox, with prerequisites

| Feature | Earliest sensible point | Feasible first version / reason to defer |
| --- | --- | --- |
| Level designer | Shared M3 loader, geometry, and validation exist | Prefab assembly and entity placement; avoid arbitrary mesh editing |
| Additional weapons / bosses | M1 damage, ownership, and lifecycle work | Add one tested behavior at a time; existing flags are not finished features |
| Doors / keys / reactor escape | M3 objective events and room connectivity | Small explicit objective types and a simulation-time escape timer |
| Automap | Stable room graph and discovered-room state | Render graph/room outlines before attempting a detailed mine map |
| Gamepad / control remapping | Input actions are separated from key codes | Local saved bindings and sensitivity; flight feel needs playtesting |
| Better audio / art / accessibility options | Functional mission and measured budgets | Replace missing assets deliberately; test contrast and motion settings |
| Endless mode | Finite levels and resource ownership are stable | Seeded, connected chunks with reproducible traversal and bounded cleanup |
| Custom convex/deformed mine segments | Prefab editor proves useful | Separate geometry project: mesh editing, robust openings, collision, validation |
| Multiplayer | Stable simulation and a separate design/budget | Networking affects authority, timing, prediction, content, and testing |
| VR / mobile / classic Descent file compatibility | Explicit new project scope | These materially change constraints; they are not small final additions |

## Rules that keep the project finishable

Keep the playable slice working at each milestone. Finish one weapon and one mission before expanding the inventory or campaign. Store definitions as data and make the game/editor consume the same loader. Defer streaming until a measured need exists. Make every task demonstrate a user-visible behavior or reduce a verified maintenance risk. Reassess the plan from actual playtests rather than the completeness of class names or README feature lists.
