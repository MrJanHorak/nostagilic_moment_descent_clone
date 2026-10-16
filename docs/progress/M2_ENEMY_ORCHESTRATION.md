# M2 enemy orchestration and source cleanup checkpoint

> Follow-up: [shared level data and connected prototype](M2_LEVEL_DOCUMENTS.md) implements the next data boundary and initial M3 geometry. This file records the earlier cleanup checkpoint.

Implemented October 15, 2026, following [enemy construction/effect ownership](M2_ENEMY_EFFECTS.md). [M1 remains accepted](../M1_ACCEPTANCE.md).

## Delivered

The complete `EnemyManager` and `EnemyAnimations` implementations now join the strict JSDoc/lint scope: **25 runtime modules** in total. Enemy orchestration consumes explicit level/spawn, drop and objective-callback interfaces, uses the real checked `GameState`, and distinguishes scene transforms from vectors. These are runtime collaborator contracts, not a serialized level schema. Fourteen additional expected compiler failures bring the compile-only examples to **80**.

Enemy-count feedback is optional, consistent with other player feedback ports. Constructor state now explicitly initializes the drop collaborator, defeat callback and completion latch. Legacy tunnel spawn inspection narrows actual mesh/geometry types before reading dimensions. Existing speed, damage, cooldown, range, finite arena layout and pulse-only rules are retained.

## Lifecycle fixes

- A reset/session replacement during the scene's enemy-publication event cancels that pending spawn. The completed body is disposed before returning a cancellation error, rather than being registered into a replacement run.
- Enemy updates stop when effect processing or ram damage replaces their owning generation/session. Ramming removes the original enemy by identity, avoiding an index that may now identify a new enemy.
- A defeat callback that resets the level cannot write the old counters into the replacement run.
- Existing boss bursts remain on the session clock: they freeze during pause and cannot fire from a removed enemy.

These cases use real Three.js scene events and real manager/session instances in the regression suite. They cover the specified callback boundaries; they are not a promise to recover from arbitrary exceptions thrown by application hooks.

## Animation fix

The boss shield previously calculated each wave from vertices already modified by the preceding frame. Repeating the same simulation time therefore continued changing its geometry. It now keeps original positions in a weak cache keyed by the position attribute and calculates each frame from that rest surface. The wave stays within the existing 0.05-unit displacement, repeated timestamps produce identical positions, and an origin vertex does not divide by zero. The cache does not keep disposed attributes alive through a strong ownership list.

Material access supports arrays and checks emissive-capable materials. Numeric animation metadata and component suffixes are narrowed before use; malformed values and invalid axes cannot introduce NaNs into transforms. Invalid animation times are ignored. Normal shipped animation rates and formulas are retained; legacy smoothing/jitter remains designed around the existing 60 Hz simulation rather than becoming a new variable-step animation system.

## Source archive

**24 unused historical files** moved to [the archive](../../archive/README.md): alternate entries/audio/debug/repair scripts, the Vite starter, logging/demo tests and an empty backup, the unused projectile table, unloaded ship JSON and unintegrated helper implementations. [The manifest](../../archive/manifest.json) records original paths, byte sizes and SHA-256 hashes; every archived file matches its original bytes.

Reference checks covered the live entry, static and literal dynamic imports, HTML, scripts, tests and repository text. All **43 live application modules** still resolve outside the archive. The actual game managers, current diagnostics, supported legacy levels and public assets remain in place. The old commented debug import was removed from the entry HTML, and README/developer notes now point at current sources. The archive is reference material; its old repair scripts are not supported tools for the current tree.

## Verification

`npm run verify` passes on **Node 24.22.0 / npm 11.21.1**: scoped lint, strict checking with 80 negative examples, **147 runtime regressions**, and production build. Lint/type checks and all 147 runtime cases also pass on the existing **Node 22.14.0 / npm 11.2.0**. Compiler enumeration confirms the 25-module scope.

Ten added runtime cases cover all five animation rigs, repeatable/bounded shield deformation, degenerate vertices and malformed metadata/material arrays, invalid times, reset during publication/effects/ram damage/defeat notification, boss burst pause/removal and optional feedback. Existing accepted-mission behavior remains covered by the broader suite.

Production output is approximately **661.23 kB** minified / **167.42 kB** gzip, with the existing chunk-size warning. Dependencies and lockfile are unchanged; the earlier [audit snapshot](contracts-dependency-audit.json) remains historical evidence, not a new audit.

All **six Chromium browser cases pass in one complete run**, with zero page, console or asset-request errors; see [orchestration browser evidence](enemy-orchestration-browser-check.json). They cover production victory/loss/replay, pause, ten measured combat restarts, settings persistence/reset/layout, blocked saving, mixer ownership and unavailable audio. All restart samples return to 41 geometries, 72 objects, 34 materials and nine lights, with no active effect lights or cached effects. Software rendering verifies behavior and restart resources, not native mouse feel or hardware frame-time acceptance. Hosted CI is still unverified until a push.

## Next: shared level data

This closes the planned enemy contract and confirmed-unused-source checkpoint. Broader UI/audio/level orchestration and diagnostics are still partly unchecked; typing every presentation detail is not a prerequisite for the level format. M2 remains open, including its data boundary, hosted CI and hardware performance gate. The last Intel GPU p95 remains around 18 ms against the provisional 16.7 ms target.

The next implementation should establish the versioned level format needed by M3 and the designer:

1. Define a JSON-only version-1 document with stable IDs, bounded room/corridor prefabs, explicit connections, spawn, enemies, pickups, objective and exit. Keep Three.js objects and per-session state outside it.
2. Validate structure and references before allocating scene resources. Add deterministic round-trip fixtures and useful diagnostics for duplicate IDs, invalid dimensions/content, broken connections and unreachable required objectives.
3. Load a canonical finite fixture through the same runtime path used by the game, then prove a connected loop and vertical traversal before building editor UI. Generate visible surfaces and collision boundaries from the same data.

M3's connected mine and M4's designer still depend on that loader and validation work. This checkpoint does not complete either milestone or repair the legacy level geometry.
