# Control and session contract for M1

Implementation direction for the first playable mission, October 14, 2026. Startup, session ownership, the player-root migration, and fixed-step flight are implemented; **the finite arena, solid-wall collision, and objective/exit remain pending.** See [current progress](progress/M1_FLIGHT.md).

## Player and world ownership

Use a right-handed world: +X right, +Y up, and local -Z forward. Distances are world units; velocity is units/second, acceleration is units/second squared, and angular rates are radians/second.

The implemented player scene graph is (solid arena colliders remain pending):

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
| Yaw alternative | Left / Right arrows | Local yaw; A/D retain strafe |
| Pitch alternative | Up / Down arrows | Local pitch; same player orientation as mouse input |
| Primary fire | Left click | Fire only during active play with mouse capture |
| Weapon selection | 1–4 | Only select unlocked weapons during active play |
| Pause | Escape | One transition per key press; key repeat must not toggle repeatedly |
| Restart after death | Reboot UI initially | Start a fresh session; a keyboard shortcut can follow |

Use quaternion increments for yaw/pitch/roll in a documented consistent order (yaw, pitch, roll). Mouse motion is an angular displacement, not a velocity multiplied by frame time. Keyboard rotation rates and thrust are time-scaled. Do not apply arrow-key pitch only to the cosmetic ship mesh.

Clear held keys when a session starts, focus is lost, or pointer lock is released. Paused/menu/dead states do not fire, switch weapons, or update flight. A click used to acquire pointer lock does not also fire an accidental shot.

Pointer-lock acquisition happens from a user gesture and may return a promise, throw, reject, or be unsupported. Refused initial capture reports a retry message and leaves keyboard simulation available. Releasing an acquired lock, window blur, or document hiding pauses once; Continue requests capture again without erasing session state. A stale rejected request cannot notify a newer session.

## Session ownership and transitions

`Game` coordinates a `GameSession` owned by `GameState`. UI callbacks request transitions and never independently change simulation flags. The old boolean flags are read-only compatibility views of the session phase.

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

`startSession({ endless, levelIndex })` resets health, player world position/quaternion/velocity and visual camera pose, inventory, buffs, score/statistics, spawn tracking, projectiles, enemies, pickups, effects, cooldowns, phase, and simulation time. Restart routes use this same operation. `endSession()` removes entities without awarding kills, invalidates callbacks, stops session audio, clears input, and releases pointer lock. Death/completion freeze the scene until an explicit Reboot/Replay/Next/Selection action ends it. Restart restores the root to `(0,0,5)` with identity orientation, zero velocity, and zero view displacement.

Keep level definitions immutable. Per-session sets track stable spawned/killed/collected IDs. A monotonically increasing session token invalidates asynchronous work belonging to an old session. A next-level transition updates the same authoritative selected-level identity used by restart.

Cooldowns, projectile lifetimes, buffs, and managed effects advance on session simulation time and freeze during pause. Independent pickup RAF loops and gameplay `setTimeout` calls have been removed; presentation-only UI/audio timers are cleaned up on teardown. A bounded accumulator now runs the active simulation at 60 Hz, with at most 100 ms/six steps per rendered frame. Excess wall time is discarded after a stall; pause/teardown discard partial time. There is no render interpolation yet.

## Startup and failure contract implemented in the first checkpoint

- `AudioManager.init()` returns a success boolean; unsupported/failed devices do not prevent starting play. Partial initialization is cleaned up and can be retried.
- Default sounds use the existing synthesized buffers. There are no speculative fetches to missing `/sounds/placeholders` files. Optional recorded assets can still use `loadSound()` explicitly.
- `createSound(id, factory)` registers a custom buffer when audio is initialized; without audio it returns null. Replacing a registered sound stops old instances first.
- Startup enters active play only after synchronous sound setup has finished or been skipped. There is no delayed startup-audio timer. Repeated starts do not stack the engine/music loops.
- Every new start screen wires its own start action. `Game.init()` no longer owns a one-time-only listener that is lost after returning from mission selection.
- Required initialization failures reject the `init()` promise; the entry point cannot report a false success. The development smoke overlay displays caught initialization/update/animation errors.

## Verification boundary

`npm test` covers startup/audio failure contracts, pickup behavior, both mode pipelines, session transitions/reset, pause-frozen timers, callback cancellation, cleanup, terminal latches, and mission selection. The Node fixtures use real Three.js/game managers; they do not validate WebGL, flight feel, native mouse capture, or a level's actual winnability.

`npm run smoke` serves `http://127.0.0.1:5183/?smoke=1` without opening a browser. The development-only overlay shows frames, updates, phase, session identity/time/steps/tasks, entity counts, player position/speed/quaternion, and caught errors. Labeled simulated-death/completion controls exercise lifecycle/UI wiring. A rising frame count alone is insufficient: simulation must freeze during pause and menus. All these controls are absent from production, including when its URL contains the smoke query.

The 52 tests now cover rotated/inverted thrust, roll, equivalent 30/60/120 FPS simulations, view-shake isolation, repeated restarts, pause-frozen timers, and terminal latches. Solid-wall sliding, doorway traversal, wall-aware combat, and normal objective/exit completion remain the next acceptance work. See the flight checkpoint for numeric tolerances and browser limitations.
