# Relay objective and locked hatch checkpoint

Implemented October 16, 2026, following [persistent enemy navigation](M3_ROOM_NAVIGATION.md). The pending navigation build first passed all eight browser regressions; [that evidence](room-navigation-browser-check.json) closes the overnight verification gap. [M1 remains accepted](../M1_ACCEPTANCE.md). This is another M3 checkpoint, not completion of the larger authored mission or designer.

## Playable result

Choose **Select Level → Relay Gate Prototype**. Clear the two drones, find the cyan relay in the lower blue return chamber, and press **R** within 2.5 units to activate it. The nearby HUD prompt names the relay. Its beacon turns green and the amber ceiling hatch opens. Ascend through it with Space and enter the exit ring in the upper green chamber. Drones and relay may be handled in either order; both are required before extraction. Q/E remain roll controls.

The prototype starts with 60 pulse rounds and retains the health/ammo placements from the five-room fixture. This is a separate menu entry. Mine Link Prototype and the accepted M1 arenas remain available with their existing objectives. The sample deliberately isolates the interaction before authoring the larger mission.

## Shared data and progression

[Version 2 of the level document](../LEVEL_DOCUMENT_FORMAT.md) adds explicit `devices` and `doors` lists and a `relay-clear-and-exit` mission with required device IDs. [The canonical JSON](../../src/js/core/levels/documents/relay-gate.v2.json) uses the same room geometry and loader as v1. The validator continues to accept v1 unchanged, rejects v2-only fields on a v1 document, and rejects unknown versions. Export preserves the selected version; no existing document is silently converted.

Devices have stable IDs, short display labels and room-local positions. Doors reference a connection and the device that opens them. Each connection supports at most one door. All devices must be required by the mission; optional relays and arbitrary scripting are outside this version. Global ID uniqueness, references, count limits, body/placement clearance and unknown-field checks apply. Device and door states never appear in exported data.

Validation solves progression from the player spawn with doors initially closed. It activates only devices in currently reachable rooms, opens their links and repeats. It rejects a relay behind its own door, mutually locked cycles and any room left inaccessible. A reachable two-relay chain is supported. This proves geometric unlock reachability in these empty room shells; combat fairness, survivability and ammo sufficiency still need a real mission and playtest.

## Runtime ownership

Each door compiles to an opaque box filling its portal, including the complete one-unit wall thickness shared by both rooms. Its visible geometry and collider use the same dimensions and center. Closed doors block the player, enemy bodies, projectiles and visibility in both directions. Horizontal doors, rotated room ports and ceiling/floor hatches share the same path.

R activates the nearest inactive, visible relay within 2.5 units. It works without mouse capture and is blocked during pause, terminal phases or an open settings dialog; repeated keydown events do not repeat activation. Walls and closed doors block interaction through them. Activation is one-way and instantaneous: it hides the door mesh, removes just that door's collider, updates the beacon and publishes one device objective event. Resources remain owned by the world until teardown. There are no animation timers, door closing or crushing rules.

The controller owns instantiated state for one session and becomes unusable after retirement or a session identity change. Pause preserves open doors; restart restores every door, beacon, device objective and combat state. Extraction still awards completion once, after all required defeats and relay activations. The relay itself awards no extra score.

Closed connection IDs filter enemy graph searches. A monotonic revision changes on activation, invalidating cached paths, including failed paths. Waiting enemies can then pursue remembered targets through the newly opened hatch. Current line of sight still controls shooting, and hidden player motion still does not refresh memory.

## Verification

Pinned Node 24.22.0 / npm 11.21.1 passes lint, strict checking, **244 runtime cases** and the production build. Scoped checking covers **36 runtime modules** and **108 negative compiler examples**. Lint/type checks and all 244 cases also pass on Node 22.14.0 / npm 11.2.0. Twenty-nine new cases cover malformed/versioned data, global IDs, placements, door references/occupancy, self-locks and cycles, a valid chained unlock, immutable round trips, staged-failure disposal, mesh/collider agreement in three orientations, movement/shots through the hatch both ways, interaction guards, objective idempotence, enemy replanning, actual game/input integration and ten completion/restart cycles.

All **nine browser checks pass in one complete final run**, with zero page, console or asset errors. Browser verification adds a keyboard relay playthrough to the existing suite and extends production JSON selection/reset coverage. The new playthrough checks the closed hatch physically stops ascent, R stays inert while paused, activation updates objective state, the opened passage admits flight, extraction completes, and replay resets the relay. Development traversal neutralizes drones to isolate the objective and flight; this is not human combat acceptance. Detailed pathfinding and unlock reachability are also covered by runtime simulations.

The first relay-build browser run passed the new interaction but the older mine steering test oscillated near a waypoint and timed out, with zero runtime errors. Its test controller now uses bounded key presses near waypoints and waits for fresh diagnostic samples; gameplay flight tuning is unchanged. The final browser report is [relay-objective-browser-check.json](relay-objective-browser-check.json), preserving four relay stages, ten mine waypoints, eleven arena restart samples and seven mixer samples. The accepted arena still returns to 41 geometries, 72 scene objects, 34 materials and nine lights, with no active/cached effects. A focused evidence refresh waits for the diagnostic snapshot to catch up after resume before capturing [the activated relay](relay-activated.png). Software rendering does not establish hardware performance acceptance. CI's overall timeout is increased from ten to fifteen minutes to leave room for the longer browser suite plus clean install and browser installation on Windows/Ubuntu. Hosted CI still needs a push and a successful run.

Dependencies and lockfile are unchanged. The production bundle is approximately **693.12 kB** minified / **177.44 kB** gzip, with the existing large-chunk warning. The earlier final navigation bundle was 683.33 / 174.97 kB. No new hardware profile or dependency audit was run for this source-only change.

## Next feasible step

Author a six-to-ten-room mission using these shared documents, with readable landmarks, a loop, vertical travel, manageable combat, a small relay sequence and enough pickups. Prove completion/restart and get a human playtest before calling M3 complete. Keep both prototypes as focused regression fixtures.

The local designer remains M4 work. It should edit, validate, export and play the same documents. More elaborate objectives, freeform geometry, closing/animated doors, keys, enemy separation and coordinated squads remain outside this checkpoint. M2's hardware p95 target and hosted CI confirmation are still open.
