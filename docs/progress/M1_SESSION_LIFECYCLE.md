# M1 checkpoint: session lifecycle

**Follow-up:** The [flight checkpoint](M1_FLIGHT.md) now implements the player root, local controls, fixed-step timing, and shake isolation described below as pending. This document records the earlier session checkpoint.

October 14, 2026. Builds on startup checkpoint `b2824d9`. This completes the first work queue's session-lifecycle item; player movement, collision, and the full playable-mission gate remain open.

## Behavior now implemented

`GameSession` owns the phase, generation ID, simulation clock, and scheduled gameplay callbacks. `Game` coordinates world/UI/audio transitions through one `startSession()` / `endSession()` path. The old game-state booleans are read-only compatibility views of that phase, and menu handlers no longer toggle them independently.

Starting, restarting, switching missions, and rebooting after death all reset health, score/statistics, weapons/ammo, buffs, velocity/pitch, input, spawn tracking, projectiles, pickups, effects, and the simulation clock. Ending a run invalidates its callbacks before removing entities. Cleanup removes enemies without recording kills, awarding completion, producing explosions, or dropping items.

The supported phases are `menu`, `loading`, `playing`, `paused`, `dead`, `completed`, and `error`. Invalid normal transitions are rejected. Repeated death/completion notifications have no additional effect. An invalid mission index is rejected before discarding the active run; a required level-load failure cleans up and presents Retry/Main Menu controls.

Pause, real pointer-lock release, window blur, and document hiding stop the simulation and clear held input. Continue preserves the session and discards elapsed menu time. Paused audio is muted without changing the user's mute preference. A refused initial pointer-lock request still permits keyboard-only simulation with a retry message, preserving the previous unsupported-browser fallback; it is distinct from losing an acquired lock. Native captured-mouse behavior needs a normal-browser playtest.

## Timers, content, and cleanup

- Buff expiry, enemy spawn/fire cooldowns, boss bursts, player/enemy projectile lifetimes, pickup lifetime/animation, and effects use simulation time. They stop during pause. Gameplay code no longer starts its own `setTimeout` or pickup RAF loop.
- Recollecting a timed buff refreshes its expiry. Ending/restarting prevents the old expiry from modifying the next run.
- Placed pickups persist until collection; random/dropped pickups expire after 20 seconds of simulation. Spawned/collected tracking lives in the manager, rather than a `spawned` property written into a reusable blueprint.
- Enemy/pickup definitions receive stable IDs when created. Same-position enemy spawns remain distinct. Tests freeze definitions to catch runtime mutation.
- Predefined-enemy completion is latched. It awards a single 1,000-point bonus and opens explicit Next Mission / Replay / Select Mission controls. The old delayed automatic-load timers are removed. Next Mission updates the same selected mission used by restart. Each mission is a fresh session with fresh health and score; persistent campaign scoring is not implemented.
- Managers clear player shots, enemy shots, actors, pickups, active/pooled effects, and obstacles. Projectile cleanup preserves manager-owned shared geometry. Level startup now registers every initial endless segment in the tracking map; unloading and teardown prune owned resources and stale obstacle references.
- Death explosions use the managed effects system, and effect lights expire even without a corresponding mesh queue. Old audio source completion cannot clear a newer music handle. Presentation-only UI timers and elements are cancelled/removed on teardown.

This is a lifecycle repair, not a new level system. The existing maps still complete by destroying their predefined enemies. A real objective/exit and a demonstrably traversable finite mission are still required by M1.

## Verification and limits

`npm test`: **42 tests pass**. The suite covers both prior startup paths plus session transitions, callback invalidation during dispatch, ten restart cycles in both modes, frozen definitions, pause-frozen lifetimes/buffs, refresh/reset of buffs, distinct same-position spawns, menu cleanup, loading failure, focus/lock-loss handlers, stale pointer-lock rejection, exactly-once terminal behavior, next-mission restart selection, effect/resource cleanup, and late audio completion.

`npm run build`: passes. The existing large-bundle warning remains. No dependency versions were changed; the prior toolchain advisory work is still pending.

Browser checks exercised:

| Flow | Observed result |
| --- | --- |
| Pause and leave idle | Session time stayed at 6.22 seconds and 999 steps while rendered frames advanced from 1,476 to 6,888 |
| Restart from pause | A new generation started with clock/steps reset |
| Simulate death -> Reboot | Death screen, then fresh health and a new playing session |
| Complete -> Next Mission -> Restart | One 1,000-point bonus; the next mission's nine-enemy definition remained selected on restart |
| Select mission -> Main menu | Clock/steps/tasks zero; no live enemies, shots, or pickups; updates stayed stopped while rendering continued |
| Production start -> pause -> restart -> menu | Worked without reloading the page or capturing runtime errors |
| Production with `?smoke=1` | No diagnostics or simulation-test buttons present |

Evidence: [browser results](session-browser-check.json), [death screen](session-death.jpg), [completion screen](session-complete.jpg), [restart/pause screen](session-reset.jpg). No runtime errors were captured in the tested development and production flows.

Death and completion were triggered through clearly labeled **development-only test controls**, not through a complete combat playthrough. The embedded browser refused pointer lock. The controlled Node tests verify lock/focus loss and callback behavior, but mouse capture/aiming, full authored-level traversal, combat balance, and normal objective completion remain unverified. Repeated-session tests verify manager/scene cleanup; they are not a GPU memory benchmark.

The clock still uses the existing bounded variable frame delta. Fixed-step motion and frame-rate independence remain part of the movement checkpoint. Camera shake/follow, world offsets, local flight axes, roll, and real wall collision are not repaired by this change.

## Repeat the checks

```powershell
npm test
npm run build
npm run smoke
```

Open `http://127.0.0.1:5183/?smoke=1`. Watch the phase, generation, time, steps, pending tasks, and entity counts. Exercise pause/continue, restart, mission selection, return to menu, and a fresh start. On an authored mission, use **Simulate death (test)** and **Complete mission (test)** to check the terminal controls and restart selection. Those buttons are diagnostics only and cannot establish that the level is winnable.

For production, run `npm run preview` and follow the printed URL; neither `?smoke=1` nor normal navigation should reveal test controls. Stop servers when finished. Local build/servers needed the same approved outside-sandbox execution as the previous checkpoint; tests ran inside the sandbox.

## Next checkpoint

Replace the legacy movement contract with a world-space player root, first-person camera, local quaternion thrust/yaw/pitch/roll, and time-scaled movement/damping. Prove rotated/inverted flight and repeatability at 30/60/120 Hz in a small finite arena. Then repair wall/projectile collision and build the actual objective/exit mission before expanding content or starting the level editor.
