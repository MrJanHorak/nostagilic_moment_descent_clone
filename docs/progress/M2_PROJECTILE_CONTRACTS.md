# M2 projectile contracts and ownership checkpoint

> Follow-up: [enemy construction and effect ownership](M2_ENEMY_EFFECTS.md) extends checked coverage to 23 runtime modules and updates the ownership policy below. This file records the earlier projectile checkpoint.

Implemented October 15, 2026, following [player/input contracts](M2_PLAYER_CONTRACTS.md). The owner's [M1 acceptance](../M1_ACCEPTANCE.md) remains complete.

## Delivered

Scoped lint and strict JSDoc checking now cover **fourteen runtime modules**, up from eleven. The additions are `ProjectileManager`, `EnemyTypes` and `disposeObject`. Shared projectile/enemy interfaces live in `src/js/combatContracts.d.ts`; the existing player/session interfaces remain in `src/js/contracts.d.ts`.

Player and enemy projectiles have distinct, immutable-to-checked-callers faction tags and owner references, with their own lifetime fields. Creation options describe the existing supported geometry/trail names, vector/quaternion inputs and numeric/boolean fields. The actual projectile manager now satisfies the already checked input firing interface. Enemy definitions have known readonly names/fields, and the combat-world callback receives a complete enemy combat target, a player projectile and a world-space hit position.

`tests/types/combat-contracts.ts` adds **16 expected compiler rejections**, bringing the total to **51**. Examples reject misspelled projectile types, string damage, array muzzle positions, vector orientations, transplanted ownership, hostile shots passed to the player removal path, incompatible hit callbacks, mutable definition lists, incorrect disposal keep sets and external access to internal trail/cache operations. The public `getProjectiles()` view is readonly to checked callers; existing raw arrays remain an implementation detail used by older, unchecked diagnostics.

## Hit ownership and lifetime

A projectile is active only while it belongs to this manager, remains in the corresponding faction list and the manager has not been retired. Moving or sweeping a foreign/already removed projectile stops processing without changing its position or muzzle trace and without dispatching callbacks or damage. The boolean movement result means stop processing, including inactive work; it is not exclusively a collision report.

Removal now invalidates list membership before disposal events as well as damage callbacks. This prevents cleanup hooks and reentrant hit callbacks from treating a spent shot as active. Terminal retirement marks the manager disposed before clearing, so disposal hooks cannot allocate replacements during shutdown. Both cleanup-hook ordering failures were reproduced in focused tests before the fix and pass afterward. Player and hostile damage continue through the existing swept trace, with wall tie priority and muzzle/lifetime clipping preserved.

## Resource ownership

| Resource or operation | Owner / behavior |
| --- | --- |
| Projectile mesh material, trail geometry/material | Per projectile; removed with that projectile |
| Specialized projectile geometries | Manager cache shared by shots and retained across sessions |
| `clear()` | Removes both factions and per-shot resources; leaves the manager reusable |
| `dispose()` | Clears active shots, disposes each cached geometry once, drops combat callbacks/canvas, and permanently retires the manager |
| Creation/firing after retirement | Throws before allocation, sound playback or ammo consumption |
| Update after retirement | Does no work |

The shared-geometry keep set is created once per manager instead of once per shot removal. The type-checked disposal helper handles Three.js meshes, points and other renderables with buffer geometry/materials, deduplicates resources within one cleanup traversal, and respects readonly keep sets. It does not dispose textures automatically or establish an application-wide asset ownership policy.

Session restart continues to call `clear()`. The new `dispose()` is for permanent retirement; it is not wired to ordinary restarts or menu navigation. The application-wide final shutdown lifecycle and the other managers' terminal disposal remain future work. Readonly types are development contracts, not runtime freezing of existing objects.

## Verification

`npm run verify` passes on Windows under **Node 24.22.0 / npm 11.21.1**. It includes lint for fourteen runtime modules plus two tooling files, strict checks with 51 negative examples, **118 runtime regressions**, and the production build. Lint, type checking and all 118 runtime cases also pass on the existing **Node 22.14.0 / npm 11.2.0**. Compiler file enumeration confirms the fourteen-module application scope.

Four new runtime tests verify foreign/spent/reentrant player hits, repeated hostile damage, reusable cleanup versus terminal retirement (including unchanged ammo on rejected firing), and deduplicated mesh/points disposal with preserved resources. Existing combat, flight, pause, death/completion and restart cases pass. Production output is approximately **659.34 kB** minified / **166.72 kB** gzip, with the existing chunk-size warning.

All **six browser checks pass in one complete run after the final cleanup-ordering fix**, with zero page/console/asset-request errors; see [projectile browser evidence](projectile-contracts-browser-check.json). They cover production mission completion/loss/replay, ten measured combat restarts returning resources to baseline after warm-up, saved settings, blocked storage, mixer ownership and unavailable audio. Software rendering is used; no new hardware performance or native mouse acceptance claim is made.

Dependencies and lockfile are unchanged. The previous [audit snapshot](contracts-dependency-audit.json) remains the recorded result and was not rerun for this source change. Hosted CI remains unverified until a push.

## Limits and next work

The enemy definitions, target shape and hit callback boundary are checked here; **`EnemyManager`, `EnemyFactory`, mesh builders and animations are not yet fully checked**. Their implementation, effect pools, level data, main game orchestration, UI/audio and diagnostics remain broader M2 work. Existing legacy weapon flags remain represented for compatibility; this checkpoint does not implement guided targeting, penetration or explosion damage, or enable unfinished weapons in Arena Escape.

Next, establish checked enemy creation/removal and effect ownership before removing confirmed unused code. M3 still needs a versioned, validated shared level document and connected-room mission before the designer UI. M2 performance acceptance remains open: the last Intel GPU frame p95 was around 18 ms against the provisional 16.7 ms target. This checkpoint does not complete M2.
