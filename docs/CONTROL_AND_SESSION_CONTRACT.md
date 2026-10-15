# Control and session contract for M1

Agreed implementation direction for the first playable mission, October 14, 2026. The startup checkpoint implements the audio, pointer-lock error handling, and startup checks below. **The player-root migration and session state machine described here are the next work, not completed features.** See [current progress](progress/M1_STARTUP.md).

## Player and world ownership

Use a right-handed world: +X right, +Y up, and local -Z forward. Distances are world units; velocity is units/second, acceleration is units/second squared, and angular rates are radians/second.

The intended scene graph is:

```text
scene
  level geometry / solid colliders / enemies / pickups / projectiles
  playerRoot                 authoritative world position and quaternion
    viewEffects              visual recoil/shake only
      camera                 first-person, identity local orientation
    externalShipModel         hidden in first-person view
```

The player root owns linear velocity and a radius-0.5 sphere collider. The camera follows this root through parenting; no per-frame `lookAt` is allowed to overwrite aim. Thrust uses the root's quaternion, and the world stays stationary. The camera, ship mesh, and arbitrary environment offsets must not each become separate sources of player position. Visible camera shake does not move the collider.

Use the current acceleration 8 and maximum speed 6 as provisional tuning values. Normalize combined thrust so diagonal input does not increase acceleration. Initially retain the feel of 0.96-per-frame damping at 60 Hz by converting it to exponential time-scaled damping, `exp(log(0.96) * 60 * dt)`. Tune against actual flight, not just numeric tests. Apply the speed multiplier through this controller; do not maintain a disconnected pickup-only setting.

Collision operates on solid world geometry with bounded substeps or a swept sphere and sliding response. The finite mission must not use fixed global tunnel-width bounds as its long-term collision implementation. Keep the whole small test environment loaded; streaming is not required for the first mission.

## Input semantics

| Action | Default input | Intended behavior |
| --- | --- | --- |
| Forward / back | W / S | Local -Z / +Z thrust |
| Strafe | A / D | Local -X / +X thrust |
| Vertical thrust | Space / left Shift or left Ctrl | Local +Y / -Y thrust, including while inverted |
| Yaw / pitch | Mouse | Local rotation; no world-up lock or pitch clamp |
| Roll | Q / E | Local +Z / -Z rotation |
| Pitch alternative | Up / Down arrows | Local pitch; same player orientation as mouse input |
| Primary fire | Left click | Fire only during active play with mouse capture |
| Weapon selection | 1–4 | Only select unlocked weapons during active play |
| Pause | Escape | One transition per key press; key repeat must not toggle repeatedly |
| Restart after death | Reboot UI initially | Start a fresh session; a keyboard shortcut can follow |

Use quaternion increments for yaw/pitch/roll in a documented consistent order (yaw, pitch, roll). Mouse motion is an angular displacement, not a velocity multiplied by frame time. Keyboard rotation rates and thrust are time-scaled. Do not apply arrow-key pitch only to the cosmetic ship mesh.

Clear held keys when a session starts, focus is lost, or pointer lock is released. Paused/menu/dead states do not fire, switch weapons, or update flight. A click used to acquire pointer lock does not also fire an accidental shot.

Pointer-lock acquisition must happen from a user gesture and may return a promise, throw, reject, or be unsupported. These cases must not produce an uncaught exception or hide a required recovery action. The startup checkpoint reports a retry message and leaves the simulation available. The next lifecycle change should pause on lock/focus loss and resume through an explicit gesture without erasing session state.

## Session ownership and transitions

The target owner is `Game` coordinating a session controller. UI callbacks request transitions; they do not independently change simulation flags. Keep the current boolean flags only as a temporary compatibility boundary while callers are migrated.

| From | To | Trigger / invariant |
| --- | --- | --- |
| menu | loading | New mission/endless start; create a fresh session identity |
| loading | playing | Required scene/level/player setup succeeds; audio is optional |
| loading | error | Required setup fails; show recoverable error and retain its cause |
| playing | paused | Escape, focus loss, or pointer-lock loss; clear held input |
| paused | playing | Continue from a user gesture; preserve mission state |
| playing | dead | Health reaches zero once; release mouse capture |
| playing | completed | Explicit objective/exit succeeds once; stop further awards/transitions |
| playing / paused / dead / completed / error | menu | End the current session before showing menu/selection |
| playing / paused / dead / completed | loading | Restart or switch mission only after teardown |
| loading | menu | Cancel loading and invalidate its callbacks |

`startSession(levelId)` must reset health, velocity/orientation, inventory, buffs, score/statistics, spawn tracking, projectiles, enemies, pickups, effects, cooldowns, pause flags, and the simulation accumulator. Restart routes use this same operation. `endSession(reason)` removes entities without awarding kills, cancels or invalidates callbacks, stops session audio, clears input, and releases pointer lock.

Keep level definitions immutable. Per-session sets track stable spawned/killed/collected IDs. A monotonically increasing session token invalidates asynchronous work belonging to an old session. A next-level transition updates the same authoritative selected-level identity used by restart.

Use a bounded fixed-step accumulator for gameplay. Cooldowns, projectile lifetimes, buffs, and objective timers advance on simulation time and freeze during pause. Rendering and menu decoration can use wall time. Legacy independent pickup RAF loops and gameplay `setTimeout` calls are migration work, not accepted session-clock behavior.

## Startup and failure contract implemented in the first checkpoint

- `AudioManager.init()` returns a success boolean; unsupported/failed devices do not prevent starting play. Partial initialization is cleaned up and can be retried.
- Default sounds use the existing synthesized buffers. There are no speculative fetches to missing `/sounds/placeholders` files. Optional recorded assets can still use `loadSound()` explicitly.
- `createSound(id, factory)` registers a custom buffer when audio is initialized; without audio it returns null. Replacing a registered sound stops old instances first.
- Startup enters active play only after synchronous sound setup has finished or been skipped. There is no delayed startup-audio timer. Repeated starts do not stack the engine/music loops.
- Every new start screen wires its own start action. `Game.init()` no longer owns a one-time-only listener that is lost after returning from mission selection.
- Required initialization failures reject the `init()` promise; the entry point cannot report a false success. The development smoke overlay displays caught initialization/update/animation errors.

## Verification boundary

`npm test` covers startup/audio failure contracts, pickup translation/type/collection, input rejection/pause guards, game-over source fading, and both mode update pipelines. The Node fixtures use real Three.js/game managers with deterministic presentation callbacks; they do not validate WebGL, flight feel, native mouse capture, or mission completion.

`npm run smoke` serves `http://127.0.0.1:5183/?smoke=1` without opening a browser. The development-only overlay shows frames, completed simulation updates, phase, and caught-error count. A rising frame count alone is insufficient: updates must rise during play, stop while paused, and resume after Continue. This diagnostic overlay is absent from production.

The next controller/session implementation should convert these target contracts into behavior tests: rotated/inverted thrust, roll, equivalent 30/60/120 Hz simulations, wall sliding, clean repeated restarts, pause-frozen timers, and one completion event.
