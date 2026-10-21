# Environments and mission variety

## Playable now

The scout has a 550 ms amber-eyed warning, then commits to a straight 10-unit/s lunge for at most 650 ms. Sidestepping after commitment can evade it. Walls and closing doors stop it. A strike deals its existing 5 damage once, leaves the robot alive, and starts 1.1 seconds of recovery: brief backward movement followed by a stationary opportunity to return fire. Health stays 10; a campaign pulse still kills it in one hit. Touching it no longer suicides it or satisfies a required kill. The cue uses existing eyes and wings, without extra lights. Pause, death and restart own all timing through the simulation.

| Feature | Current behavior | Where to try it |
| --- | --- | --- |
| Lava | Procedural glowing cracks, slow flow and glow variation; contact deals 6 shield damage every 500 ms | Vector Foundry upper works; Nightfall Reactor reactor room |
| Water / coolant | Procedural moving ripples; safe surface contact | Nightfall Reactor coolant works |
| Editor styles | Select a room face, choose lava or water under Surface pattern, Apply face style; Undo/Redo and JSON export/import work | All properties → Face appearance |

Both are **solid face treatments**. Water is not yet a volume to dive into. Neither adds gravity, buoyancy, drag, refraction, underwater audio or changes to enemy/projectile physics. The lava treatment is deliberately a first environmental hazard rather than a fluid simulation. Fly above it; mandatory relays, exits and pickups remain clear of lava. Mission briefings explain the surface rules, and contact produces a HUD message and the usual shield feedback. Distinct ripple/crack patterns supplement their blue/orange colors.

Version 9 opts authored documents into these surface rules and retains sliding doors. Version 1–8 cannot silently acquire damage from a new pattern; their old hazard stripes remain decoration. Contact uses actual rendered solid panels and convex sloped hulls, not an entire room bounding box. Door and hatch openings stay empty. Panel seams cannot multiply damage, re-entry cannot bypass the cadence, and long frames do not replay a damage backlog. Materials/textures belong to each world and are disposed at teardown. No external assets, dependencies or additional render passes are used.

## Suggested next work

1. **Reactor escape countdown and destructible cores implemented.** Nightfall now starts a 60-second clock at shutdown and sends the player back through the lift/lower loop to arrival. Required objectives must be cleared first. See [the reactor guide](REACTOR_ESCAPE.md) for editor authoring, validation and lifecycle rules.
2. **Panel-controlled force fields implemented.** Vector Foundry has a cyan lift field disabled by its nearby relay. Fields absorb shots, block bodies without contact damage, and appear with their controls on the visited-area map. See [force-field rules and authoring](FORCE_FIELDS.md).
3. **Rescue objectives.** Put optional survivors in a side room, show the carried count in the cockpit, and award the rescue only on successful extraction. This gives exploration a purpose beyond ammunition.
4. **Recharge stations.** Add recognizable safe alcoves with bounded shield/energy restoration. Decide how weapon energy works first; avoid turning a mandatory fight into unlimited refilling at its doorway.
5. **Flooded passages and currents.** Author a separate fluid volume, with a clear boundary, submerged visibility/audio and consistent ship/enemy/projectile rules. A gentle current could create a route choice without introducing gravity into six-axis flight. This is a larger feature than a face texture and needs volume validation, editor tools and transition tests.
6. **Triggered reinforcements.** A noisy, visibly active generator with a finite wave budget could make restoring a relay change an encounter. Cap active robots, provide a warning and fallback route, and make its state reset cleanly.

Continue bounded fighter repositioning and one mixed scout/fighter encounter alongside these mission mechanics. Avoid increasing enemy counts everywhere: quiet travel, recognizable landmarks, an optional supply branch and a retreat corner are what give a dangerous room context.

## Reference

The original [Descent II manual](https://cdn.akamai.steamstatic.com/steam/apps/273580/manuals/manual.pdf?t=1447360122) describes control panels that change doors/fields and release robots (p.33), reactor destruction opening an exit with limited escape time (p.34), rescuing hostages and escaping alive (pp.34–35), energy centers (p.37), force fields (p.38), robot generators (p.39), and map markers (pp.40–41). These support the mission ideas above. Our surface pass is an original, deliberately limited implementation; it does not claim to reproduce all original Descent fluid behavior or later source-port enhancements.

## Verification

The environment/scout pass verified 71 linted runtime modules, strict types, all 429 unit/simulation cases and the production build. Cases cover strike timing, evasion, single-hit recovery, sight cancellation, wall/door collision, reentrant reset, physical doorway/hatch navigation, old-version rejection, editor round-trips, all six oriented/sloped surfaces, empty portals, damage cadence, pause, safe campaign placements and texture disposal. The later [reactor pass](REACTOR_ESCAPE.md#verification) brings the suite to 440 cases and 72 linted modules.

Five targeted browser scenarios pass across completed runs: native scout warning/strike/recovery and flight onto water/lava with pause/resume, climbing clear and restart; both updated campaign routes; editor export/import; and production weapon kills, extraction, replay, death/reboot and menu. See the [verification record](progress/environment-browser-check.json), reviewed [coolant water](progress/coolant-water.png) and [reactor lava](progress/reactor-lava.png). Earlier harness assumptions and their corrections are recorded there. These are functional checks; water volume physics and hardware frame-time acceptance remain separate work.

The [Deepworks showcase](DEEPWORKS.md) adds physical destructible reactors, 48 spaces, nine loops, three secrets, an editor same-wall connection repair, procedural surface detail and conservative portal visibility. Rescue objectives remain the next distinct mission system.
