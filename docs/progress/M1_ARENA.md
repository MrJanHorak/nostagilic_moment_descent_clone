# M1 finite arena and player collision checkpoint

Implemented October 15, 2026, following the [flight checkpoint](M1_FLIGHT.md).

## Delivered

The main menu's **Start Flight Arena** action now opens a quiet, finite training space. It also appears as **Flight Training Arena** in mission selection. The older authored levels are labeled **Legacy level**; endless mode remains selectable. These older modes retain their old geometry/collision path.

The arena contains two enclosed chambers, a cyan-marked doorway, and a pillar in the far chamber. It stays fully loaded during travel in either direction. There are no enemies, automatic completion, or score awards in this movement fixture. The HUD describes it as flight practice and shows a short instruction to cross the doorway and return.

`FlightArena.js` contains immutable internal definitions: spawn `(0,0,6)` and 11 axis-aligned structural boxes. `ArenaGeometry.js` generates each visible solid and its world-space `Box3` collider from the same center/size definition. Lighting, floor grid, and thin frame markings provide orientation cues. Those markings are decorative. This is a small fixture definition, not a general level import/editor format.

| Feature | World coordinates / size |
| --- | --- |
| Interior | X −10 to 10, Y −6 to 6, Z −26 to 10 |
| Divider | Z −8.5 to −7.5 |
| Doorway opening | X −2.5 to 2.5, Y −3 to 3 |
| Pillar | Center `(5,−1,−18)`, size `(2,10,2)` |
| Player radius | 0.5 |

The arena's player movement uses its actual solid colliders. It does not use the legacy global X/Y tunnel bounds. The sphere can slide along a surface, move around a rounded corner contact, leave a wall without sticking, and travel through the doorway upright or inverted. Contact removes inward normal velocity while preserving tangential motion; collisions do not damage the player at this stage.

The solver divides travel into steps of at most `radius / 4` (0.125 units at the current radius), resolves sphere/box overlap using the closest point, and iterates contacts for corners. A skin of `1e-5` units avoids persistent penetration. This is bounded discrete collision, not an exact continuous time-of-impact solver. It supports static axis-aligned boxes; rotated meshes, moving doors, and arbitrary mine geometry are outside its contract.

Work is bounded at 512 substeps and 12 contact passes per substep. Requests above 64 units of travel at the current radius discard excess travel and zero velocity. Normal capped 60 Hz flight uses one or two substeps. Conflicting contacts that cannot resolve stop movement and restore the previous substep position; invalid overlapping layouts still need future document validation. Restart rebuilds the arena, disposes old resources, clears colliders, and restores spawn/orientation/velocity.

## Verification

`npm test`: **64 passing tests**, including 12 arena checks:

- Every structural mesh's computed world bounds exactly match its collider, and spawn is clear.
- A fast sphere stops at a 0.01-unit wall while preserving tangential velocity.
- Sliding, simultaneous corner contacts, wall departure, rounded edge clearance, shallow overlap recovery, and numeric/work-budget guards.
- Actual Game/Input/Level/Enemy/Projectile/PowerUp pipeline traverses the doorway both ways, including an inverted return; X=9 is legal despite the former tunnel limit.
- Closed divider portions and the lintel/sill block off-center or too-high/low traversal; all six outside boundaries preserve radius clearance.
- Sustained wall-sliding input at 30/60/120 rendered FPS agrees within `1e-9` world units using the fixed 60 Hz simulation.
- The entire arena remains loaded; ten restarts dispose old geometry, preserve immutable definitions, and leave one player root plus one arena group. Leaving for the menu clears all arena colliders.
- Ten seconds in the quiet arena does not spawn enemies, award completion, or score; pause freezes simulation.

`npm run build`: passed. The existing bundle-size warning remains (approximately 636 kB minified / 159 kB gzip). Build/tests ran in the sandbox. Serving initially succeeded there but socket access was denied; browser verification used the approved local servers outside the sandbox.

Browser observations are saved in [arena-browser-check.json](arena-browser-check.json):

| Development flow through ordinary keyboard controls | Observed position |
| --- | --- |
| W from spawn through the doorway | `(0,0,−16.10)` |
| Continue forward into the far wall | `(0,0,−25.50)`, zero speed |
| Roll approximately 180° and reverse through the doorway | `(0,0,9.50)`, stopped at the starting end wall |
| Restart, thrust sideways into the east wall | `(9.50,0,6.00)` |
| Thrust forward along that wall into the divider | `(9.50,0,−7.00)`, zero speed |
| Restart again | `(0,0,6.00)`, zero speed; intentional roll input then changed orientation |

No game errors were captured in development or production. Production verified the arena entry, visible rendered roll, pause, restart, arena reselect, and return to the main menu. It showed one training guide during play, none after returning to the menu, and no diagnostic overlay despite `?smoke=1`. See [development screenshot](arena-development.jpg) and [production screenshot](arena-production.jpg).

The embedded browser refused pointer lock, so these checks used keyboard flight. Captured-mouse handling remains a normal-browser manual check. The browser tool also emitted unrelated telemetry-network errors; they are separate from the game's empty console-error captures. These tests are not a performance/GPU memory benchmark or a complete combat playthrough.

## Next work and boundary

This completes the finite movement/collision portion of M1, **not the playable mission acceptance gate**. The arena currently proves flight and physical boundaries. Projectiles still pass through walls; enemy wall avoidance/line of sight, combat tuning, special weapons, and a visible objective/exit remain unfinished. The old levels have not been repaired by this checkpoint.

Next, use these same solid colliders for pulse/enemy shot traces, resolving the earliest wall or target hit exactly once. Check the muzzle path too, so a shot cannot spawn beyond a nearby wall. Add simple enemy visibility and wall avoidance, then author a small encounter and objective/exit in this finite environment. Verify a normal menu-to-win and death/restart playthrough before expanding content or beginning the editor.

To try it: `npm run smoke`, open `http://127.0.0.1:5183/?smoke=1`, and choose **Start Flight Arena**. Use W/S, A/D, Space/left Shift, arrows, and Q/E. In a regular browser, click to capture the mouse. Cross the doorway, return inverted, push against a wall, move along it, pause, and restart. No hosted deployment has been changed.
