# M1 wall-aware combat checkpoint

> Historical checkpoint. [Arena Escape](M1_MISSION.md) supersedes the encounter name, unlimited-ammo rule and kill-all completion described below with an explicit objective/exit and authored pickups.

Implemented October 15, 2026, following the [finite arena checkpoint](M1_ARENA.md).

## Delivered and how to try it

Choose **Select Level → Combat Training Arena**. The main **Start Flight Arena** action still opens the quiet movement fixture. Combat training reuses the same two chambers, doorway, pillar and 11 structural colliders, with a visible fighter at `(0,0,-18)` and a scout initially behind the divider at `(-6,0,-18)`. Both spawn definitions have stable IDs and remain immutable across restarts.

Pulse is the only supported player weapon in this encounter. It has unlimited ammo, deals 5 damage per hit, and fires once per captured left click. The scout has 10 health and pursues while visible; the fighter has 25 health, approaches when visible, brakes around 8 units away, and fires 10-damage shots on a simulation-time cooldown. These are provisional encounter settings, not a finished balance pass. Special weapon firing and random weapon drops are disabled in this encounter.

Clearing both enemies currently uses the existing kill-all completion screen: 150 enemy points plus the existing 1,000 completion bonus. Ramming still counts as an enemy destruction under the old rule. There is no exit trigger or independent mission objective yet. The encounter is a combat fixture, not the full M1 mission.

Run `npm run smoke`, open `http://127.0.0.1:5183/?smoke=1`, and select the combat arena. Click the game view to capture the mouse; subsequent left clicks fire. Use the doorway and divider for cover, clear the fighter, then enter the second chamber to find the scout. Pause/restart uses the existing menu. Check actual firing in a regular browser that supports pointer lock.

## Collision and damage ownership

`combatTrace.js` traces finite projectile travel, including zero-length travel and a start inside a collider. It selects the earliest wall, enemy, or player hit; walls win ties. Wall and enemy hit boxes are expanded by a logical projectile radius of 0.05 units. This is a conservative expanded-AABB trace, so box corners are slightly more restrictive than an exact swept sphere. Enemy targets use their current world-space bounding boxes; the player uses a radius-0.5 sphere. Collision is continuous along each shot segment against that step's target snapshot, not a relative-motion sweep of moving targets.

Both player and enemy shots check the path from the shooter's root to the muzzle before their first movement segment. The two-unit player muzzle offset therefore cannot place an effective shot beyond a nearby wall or skip a close enemy. Traces are clipped to remaining projectile lifetime. Walls and targets each consume the shot; penetration, splash and homing are outside this slice. Trails start at their projectile instead of drawing a temporary line from the world origin.

Projectile managers own tracing, removal and resource cleanup. A player shot dispatches one hit to `EnemyManager.hitEnemy`; an enemy shot dispatches one player-damage event. The old endpoint-only damage loops are removed. The shot is removed before the callback, so a lethal hit can complete or end the session without duplicate damage/disposal. Iteration stops after a terminal transition. Cached projectile geometries remain manager-owned and reusable.

The Game step updates enemies/colliders and enemy shots, then player shots. Enemy damage wins if both sides would die in that same simulation step; there is no simultaneous-impact ordering system. Callback-driven completion remains latched.

## Enemy visibility and physical boundaries

Arena enemies only pursue while a point sight line to the player is clear. Hidden enemies stop instead of following the player through walls. Firing rechecks sight, including delayed boss bursts in the shared firing code. Player contact damage also requires visibility.

Arena movement uses the same sliding sphere solver as the player, with a conservative envelope derived from each enemy model's local bounds plus 10% animation allowance. A sight ray through a narrow opening does not let the body pass through a wall. This provides local pursuit, stopping and collision sliding. Enemies can get stuck behind cover or a narrow opening: there is no search behavior, remembered destination, navigation mesh or room-graph routing yet. Legacy modes retain their old movement and lack matching structural wall colliders; their projectile/target damage does use the shared trace path.

## Verification

**78 tests pass**, including 14 new combat checks. They cover:

- Segment/box and segment/sphere edge cases; nearest hit independent of target ordering; wall tie priority; inactive-target filtering.
- Real arena doorway clearance and divider/lintel/pillar occlusion.
- High-speed shots crossing a target or player between endpoints, one damage event, and one projectile material disposal.
- A wall before a target blocks damage, while a target before a wall receives it.
- Player and enemy muzzle obstruction, and a target between the player root and muzzle.
- Lifetime-clipped movement, pause-frozen shots/damage, visibility-gated pursuit/firing, and body clearance at a narrowed doorway.
- Real pulse firing from the initial player pose kills the fighter after five hits; unfinished weapons cannot consume ammo or fire in this encounter.
- Ten real trace/damage/completion/restart cycles restore two enemies, immutable definitions, zero score and empty shot collections; completion awards once. Multiple lethal enemy shots dispatch death once and freeze remaining shots until teardown.

The production build passes. The existing >500 kB bundle warning remains (about 640 kB minified / 161 kB gzip); no toolchain upgrade is included here. `git diff --check` passes.

[Production browser evidence](combat-browser-check.json) confirms mission selection, `ENEMIES: 0/2`, the combat instruction, rendered enemy/doorway, keyboard movement, pause and restart. After restart, eight seconds exposed at spawn while rolling reduced shield from 100% to 90%, confirming live enemy fire/player damage. Game console error captures were empty. The production build correctly omits development diagnostics. See [the screenshot](combat-production.jpg).

The embedded browser refused mouse capture. Player firing and completion are verified by simulation tests, not an automated captured-mouse browser victory. A normal-browser menu-to-win/death/restart playtest and tuning remain necessary before claiming the M1 acceptance gate. The browser tool emitted unrelated telemetry network errors; these are separate from the empty game-error log. No hosted deployment was changed.

## Next checkpoint

Turn this encounter into a small mission: add an explicit objective and a visible exit that only completes when unlocked; distinguish kills, ramming and cleanup events; place authored health/ammo content with stable reset behavior; then verify both normal win and loss/restart flows. Revisit enemy routing when the room/portal model exists in M3. M2 toolchain/security/CI work follows a reproducible playable slice.
