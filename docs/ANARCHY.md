# Anarchy (Phase 3)

Free-for-all deathmatch: every pilot for themselves. Phase 3 builds it in five steps; steps 1–2 are done and run without a network.

| Step | What | Status |
| --- | --- | --- |
| 1 | Anarchy rules in the simulation | Done (November 24) |
| 2 | Foundry Ring arena | Done (November 24) |
| 3 | Authoritative Node game server (WebSocket rooms, room codes) | Next |
| 4 | Client networking: sequenced inputs, 20–30 Hz snapshots, prediction and reconciliation, interpolated remote ships | Planned |
| 5 | Lobby with room codes and a server address | Planned |

## Rules

`src/js/core/AnarchyMatch.js` holds the rules and scores; the game applies its answers.

- `ANARCHY_RULES`: frag limit 10, time limit 10 minutes, respawn after 3 s, placed pickups return after 20 s.
- **Damage:** player shots and blast splash hit other pilots. A shot never hits its own pilot; a pilot's own blast does.
- **Scoring:** a kill is a frag for the attacker. A self-inflicted or environmental death (own blast, lava) costs the victim one frag. Deaths are counted.
- **Respawn:** a downed pilot cannot fly or fire. After 3 s they return with full shields and the arena loadout (60 pulse, capacity 150) at the spawn point farthest from every live pilot. Spawn points are the centres of the arena's box rooms, except lava rooms.
- **End:** the first pilot to the frag limit wins. At the time limit the most frags wins; ties go to fewer deaths, then pilot id. The result screen lists the standings, with Rematch.
- Difficulty is neutral (Pilot) for everyone. There is no mission objective, story, exit or robots.
- **HUD:** the guide bar shows your frags against the limit, deaths, the leader, the clock, and a respawn countdown.

**Hooks:**
- `GameState.takeDamage(amount, pilot, attackerId)` asks `game.pilotDown(pilot, attackerId)` before ending anything.
- `CombatWorld.getPilotTargets(ownerId)` and `onPilotHit(pilot, power, attackerId, point)` route player shots to pilots; they exist only in Anarchy.
- `PowerUpManager.respawnMs` brings placed pickups back.

## Foundry Ring

Built by `scripts/build-foundry-ring.mjs`, which writes `src/js/core/levels/documents/foundry-ring.v14.json`. Weapon salvage is placed in `src/js/core/levels/Anarchy.js`. It appears under *Practice & prototypes* as "Anarchy · Foundry Ring".

- **Size:** 31 spaces, 36 passages and 6 independent loops; no dead ends on the main ring.
- **Ground level:** a central furnace atrium with four 10-wide spokes to four bays. An outer ring runs through four corner rooms. The east and west bays have water floors.
- **Upper level:** two vertical shafts lead to the north and south gantries, which are joined by narrower walkways over the crane deck. The crane deck also drops straight into the atrium.
- **Lower level:** a hatch from the atrium leads to the slag pit, which has a lava floor and the best supplies.
- **Pickups:** repairs in the four corners and on the crane deck; pulse ammunition in the bays. Laser salvage is on the crane deck and in the east and west bays, missiles in the slag pit and on the north gantry, and plasma on the south gantry. Exposed places hold the best items.

## Tests

- `tests/anarchy.test.mjs` (6 tests):
  - scoring, penalties and respawn timing;
  - safest spawn and the time limit;
  - arena validity, size, spawns and salvage;
  - a live two-pilot fight where the rival destroys the local ship, the session continues and the local ship respawns away from the rival;
  - frag-limit end with standings;
  - pickup return after 20 s.
- `tests/browser/anarchy.spec.js` opens the arena from the menu and checks the scoreline.
- `tests/helpers/headlessGame.mjs` is the shared headless game, used by the multiplayer and Anarchy tests.

## Known gaps

- Lava and water damage only the local ship; a remote pilot crossing the slag pit is unhurt until the server applies the environment to every pilot (step 3).
- Remote ships have no name tag or colour, and the kill feed is a message line.
- Until step 3, the only other pilots are the ones added in tests with `game.addPilot`. Flying the arena alone is a scouting run.
