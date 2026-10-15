# M1 flight checkpoint

**Follow-up:** The [finite arena checkpoint](M1_ARENA.md) now delivers matching visible solids/colliders, sliding movement, and two-way doorway traversal. The limitations below describe the earlier flight checkpoint.

Implemented October 14, 2026, following the [session checkpoint](M1_SESSION_LIFECYCLE.md).

## Delivered

- A scene-level `playerRoot` owns world position, normalized quaternion, world velocity, and the radius-0.5 player collision origin. Its `viewEffects` child owns shake; the first-person camera has an identity local transform. The external ship model is hidden.
- Thrust uses the player's local axes, including while inverted. Combined thrust is normalized. Acceleration is provisionally 8 units/s², maximum speed 6 units/s, and idle damping is `0.96 ** (60 * dt)`. Speed pickups now multiply acceleration and maximum speed.
- Mouse displacement applies intrinsic yaw then pitch without a world-up lock or pitch clamp. Arrow keys provide yaw/pitch at 1.5 radians/s; Q/E apply local roll. Left/right arrows now turn; A/D still strafe. Menu help reflects the keyboard alternative.
- The game commits player movement after the existing collision check. It no longer offsets level geometry, enemies, projectiles, pickups, or cave particles to simulate flight. Rendering no longer overwrites aim with `lookAt`.
- Level streaming, enemy targeting, pickups, and projectile managers receive the authoritative `playerTransform`. Firing inherits player velocity and ignores cosmetic view shake. Enemy firing checks the enemy's facing instead of the player's viewing direction.
- `SimulationStepper` advances the whole active simulation at 60 Hz. It accepts at most 100 ms/six steps per rendered frame and discards excess wall time after stalls. At sustained rates below 10 FPS simulation therefore slows down rather than accumulating unbounded work. Pauses, teardown, and terminal transitions discard partial/backlogged steps. Rendering has no interpolation yet.
- Overlapping damage shakes return to a fixed resting pose. Restart restores root position `(0, 0, 5)`, identity orientation, zero velocity, and zero view displacement.
- Development diagnostics show player position, speed, and quaternion. Test controls and diagnostics remain absent from production.

## Verification

`npm test`: **52 passing tests**, including 10 new flight checks. Tests cover camera parenting/render preservation, yawed forward thrust, inverted vertical thrust, normalized/opposing input, speed boosts, unrestricted rotation, damping, mouse capture/state guards, frame-stall bounds, paused partial steps, terminal callbacks, shot direction/inherited velocity, pickup collection, and overlapping shake isolation.

The combined flight test runs two seconds of thrust/yaw/roll followed by one second of coasting at **30, 60, and 120 rendered FPS**. Each produces 180 simulation steps and 3,000 ms of simulation time. Position and velocity agree within `1e-9` world units; quaternion angular difference is below `1e-7` radians. This tests deterministic player motion in an isolated open-space fixture; it does not claim deterministic random enemy AI or validate tunnel collision.

`npm run build`: passed, with the existing warning for a minified bundle above 500 kB (approximately 630 kB, 157 kB gzip). Local Vite execution required the approved outside-sandbox build/server commands; Node tests ran inside the sandbox.

Browser checks used the embedded browser against both development and the production preview:

| Flow | Observed result |
| --- | --- |
| Authored mission, hold W | Position moved from Z=5 to Z=1.50; speed reached 6 |
| Roll, pause, resume, then keyboard yaw | Orientation persisted through pause; yaw applied in the rolled local frame |
| Thrust after combined turns | Player moved along the new heading; first-person view rendered the changed orientation |
| Final development build: endless start, roll/thrust, pause, restart | Zero diagnostic errors; restart returned to `(0,0,5)`, identity quaternion, zero speed/time/steps |
| Production: start, roll/thrust, pause, restart, return to menu | Controls worked; no captured console errors; diagnostics/test controls absent even with `?smoke=1` |

Evidence: [browser observations](flight-browser-check.json), [development view](flight-rolled.jpg), [production view](flight-production.jpg). The authored-flight captures precede the final overlapping-shake refinement; the final development and production checks follow it. The embedded browser refused pointer lock, so captured mouse feel and browser firing remain manual checks. Controlled Node tests cover the input and firing math under simulated capture.

## Remaining boundary and next work

This is a movement checkpoint, **not completion of M1**. The legacy level visuals and collision rules remain the largest blockers. Player collision still uses obstacle boxes and fixed global X/Y tunnel bounds, stops the whole velocity instead of sliding, and has no reliable closed-end/wall sweep. Projectiles and enemies still lack reliable wall blocking/line of sight. Existing authored levels still stream along Z and are not proven traversable in both directions. Special weapons and an actual objective/exit are unfinished. The screenshots expose the old geometry's gaps and darkness; they are not evidence of a finished arena.

Next checkpoint:

1. Build one compact finite graybox arena, loaded in full, with visible walls and solid colliders generated from the same definitions. Include a doorway and enough room to turn around and fly inverted.
2. Add swept/bounded sphere movement with sliding; test wall, corner, doorway, high-speed, and return traversal. Remove global tunnel-bounds collision for this arena.
3. Make pulse/enemy shots stop at walls and hit the correct target once; add basic enemy line of sight and wall avoidance.
4. Add a visible objective and exit, then verify a normal menu-to-win and death/restart playthrough. Keep the level designer behind this playable gate and the shared level-data work.

Repeat checks with `npm test`, `npm run build`, and `npm run smoke`. In the development view, use arrows/Q/E/WASD/Space/Shift, pause and resume, then restart and inspect the transform diagnostics. In a normal browser with working pointer lock, also verify mouse yaw/pitch past vertical, local roll, firing alignment, capture loss, and handling feel. No hosted deployment has been changed.
