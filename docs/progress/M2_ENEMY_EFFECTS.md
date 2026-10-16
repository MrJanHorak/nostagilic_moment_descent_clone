# M2 enemy construction and effect ownership checkpoint

> Follow-up: [enemy orchestration and source cleanup](M2_ENEMY_ORCHESTRATION.md) checks the remaining enemy implementation and archives confirmed unused sources. This file records the earlier ownership checkpoint.

Implemented October 15, 2026, following [projectile ownership](M2_PROJECTILE_CONTRACTS.md). The owner's [M1 acceptance](../M1_ACCEPTANCE.md) remains complete.

## Delivered

Scoped lint and strict JSDoc checks now cover **23 runtime modules**, up from fourteen. The nine additions are `EnemyFactory`, all five concrete mesh builders, `EnemyLifecycle`, `EffectsManager` and `ObjectPool`. The removal helpers are used by the actual enemy manager; they are not a second implementation maintained only for tests.

The checked enemy instance has a stable body reference, complete combat fields and mutable active state. A builder accepts a body group and a known enemy definition. Factory options describe the existing accent-light policy. The checked effect pool associates each of its four category names with the correct light, particle or mesh type; its diagnostic membership view is readonly to checked callers.

`tests/types/enemy-effects-contracts.ts` adds **15 expected compiler rejections**, bringing the total to **66**. They reject invalid enemy names/health/positions, incompatible builders, incomplete removal targets, replaced body identity, invalid effect options, unknown pool categories, objects returned to the wrong category, mutation through the diagnostic view and access to internal particle creation.

## Construction and enemy removal

Unknown enemy names and malformed numeric definitions or nonfinite positions produce a useful error before construction. Empty/nonfinite builder bounds are rejected. The factory finishes bounds, collider, materials and lights before adding the body to the scene. If construction fails, it disposes resources already attached to that partial body, deduplicating shared materials and geometry within the tree. Builders remain responsible for attaching what they allocate; unattached resources cannot be discovered by tree cleanup.

Material-array meshes are handled explicitly, and glow is applied to materials that support emissive shading. All five shipped builders retain their geometric output, existing collision-envelope calculation and lighting policy. The finite mission still uses one shared light per enemy. Definitions, movement speeds, damage and the accepted mission's layout are unchanged.

Individual removal now splices ownership and marks the enemy inactive before disposal events. Batch reset empties the list and deactivates the entire batch before disposing the first body. Removal alone gives no points or objective credit. Reset rejects replacement spawns while clearing and remains reusable afterward. Destruction removes the enemy before effects/audio callbacks, and a reset/session change during that work cancels the remaining old feedback and objective work. Lethal hit feedback cannot reenter damage to award a second kill; final removal looks up the enemy's current identity rather than reusing an index that callbacks could have shifted.

The unused `MeshBuilder` base class, including its uncalled material/texture disposal helper, is removed. Its five subclasses now implement the checked builder interface directly. The enemy manager's unused extra `ObjectPool` allocation and the pool's unused mutable-array accessor are also removed after reference checks. This is a small confirmed cleanup; old backup implementations, diagnostics and other source still need an inventory before archival.

## Effect ownership

| Operation/resource | Behavior |
| --- | --- |
| Active hit/explosion visuals | Owned by their effect records; active count is not capped by this change |
| Expired lights, particles and explosion meshes | Retained in four separate typed categories, at most **32 objects per category** |
| Return beyond retention capacity | Disposes the excess object instead of retaining the largest historical burst |
| Duplicate return | Rejected, including returning the same object under another category |
| Pool clear/drain | Drops ownership before callbacks; drain explicitly transfers disposal responsibility to the caller |
| Session `clear()` | Empties active lists and drains cached objects before disposing; rejects effect creation during cleanup; remains reusable |
| Terminal `dispose()` | Marks the manager retired before clearing; repeated calls are harmless; later creation throws and updates do no work |

Lights use a typed private deadline map instead of untyped `userData` lifecycle fields. Explosion size is part of its typed effect record. Existing hit/explosion durations, light intensity/dimming, particle count and mesh expansion/fade are preserved. Reuse resets color, opacity, transform and expiration. Session simulation time still owns expiry, so pause freezes effects.

Cleanup generations stop an update from continuing through stale lists if an overflow disposal or scene-removal callback clears the manager. The departing object remains accounted for rather than being returned to an already cleared pool. This is exercised with real Three.js events.

Ordinary restarts continue to call `clear()`. Effect retirement, like projectile retirement, is an explicit primitive for a future application shutdown path; this checkpoint does not wire a complete game shutdown API. The shared disposal helper still does not impose a texture-cache policy. Bounded retention limits cached resources after bursts, not peak active memory or frame time.

## Verification

`npm run verify` passes locally on the pinned **Node 24.22.0 / npm 11.21.1** baseline: lint for 23 runtime modules plus two tooling files, strict checking with 66 negative examples, **137 runtime regressions**, and the production build. Compiler enumeration confirms the application scope. Lint, strict checking and all 137 runtime cases also pass on the existing **Node 22.14.0 / npm 11.2.0**.

The 19 new runtime cases exercise all builders, invalid/failed/empty construction, material arrays, individual/batch cleanup events, reset and combat feedback reentry, invalid spawn names, duplicate/bounded pool retention, pause and reuse, clear versus retirement, overflow cleanup and scene-removal cleanup. A 40-hit/40-explosion burst retains all active visuals; afterward each category retains 32, overflow resources are released, and subsequent clear/retirement releases every observed geometry/material exactly once.

Production output is approximately **660.56 kB** minified / **167.11 kB** gzip, with the existing chunk-size warning. Dependencies and lockfile are unchanged. The previous [audit snapshot](contracts-dependency-audit.json) remains historical evidence; it was not rerun for this source-only change. Hosted CI remains unverified until a push.

All **six Chromium browser cases pass in one complete run**, with zero page, console or asset-request errors; see [enemy/effect browser evidence](enemy-effects-browser-check.json). They exercise production victory/loss/replay, pause, ten measured combat restarts, settings persistence/reset/layout, blocked saving, mixer ownership and unavailable audio. After warm-up every recorded restart returns to 41 geometries, 72 scene objects, 34 materials and nine lights, with no active effect lights or cached effects. The report uses software rendering and cannot establish hardware frame-time acceptance or native mouse feel.

## Remaining M2 work and next step

`EnemyFactory`, its concrete builders, effect implementation and the removal helpers are checked. **The complete `EnemyManager` orchestration and `EnemyAnimations` implementation are not yet checked.** Level data, other managers, main orchestration, broader UI/audio and diagnostics also retain unchecked code. Readonly contracts do not freeze objects at runtime, and ordinary numeric types do not replace runtime level-document validation.

Next, finish the remaining enemy orchestration/animation contracts and inventory confirmed unused production/backup code for archival. Then define and validate the shared level document before expanding the mine or starting the designer UI. Keep that work bounded: annotating every presentation detail is not a prerequisite for M3, but the runtime/data boundary must be clear.

M2 is not complete. Its remaining gates include hosted CI, the broader source/data boundary and cleanup, and performance acceptance. The last Intel GPU frame p95 remains around 18 ms against the provisional 16.7 ms target; this checkpoint makes no new performance claim. M3 still needs a versioned validated level document and connected mission, and M4 still depends on proving that format in the game first.
