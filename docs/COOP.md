# Co-op (Phase 4)

Fly the campaign as a team of up to four pilots. Phase 4 builds it in five steps; steps 1–3 are done.

| Step | What | Status |
| --- | --- | --- |
| 1 | Co-op rules in the simulation: shared lives, relay respawns, team extraction, per-pilot hazards and story, robot scaling | Done (November 25) |
| 2 | Co-op rooms on the game server: missions, robots and mission state in snapshots, relay key | Done (November 25) |
| 3 | Co-op in the browser: puppet robots, shared relays, robot fire, team HUD, lobby mission choice | Done (November 25) |
| 4 | Team-play polish: map pings and quick-chat, tow a disabled wingmate, per-player ammo pickups | Planned |
| 5 | 2–3 missions designed for teams (two-relay "hold together" objectives, split routes) | Planned |

## Rules (`src/js/core/CoopMatch.js`)

`COOP_RULES`: 2 lives per pilot in a shared team pool, respawn after 5 s, robots 60% tougher per extra pilot, at most 4 pilots.

- **Lives:** each pilot who joins adds 2 lives to the team pool (once, even after leaving and rejoining).
- **Going down:** a downed pilot cannot fly or fire. With a life in the pool they return after 5 s; without one they stay down while the team flies on.
- **Respawn point:** the mission's drop point, then the last relay the team activated (the checkpoint). Respawns get full shields and the mission's starting ammunition. A late joiner arrives at the checkpoint.
- **Failure:** the mission is lost when nobody is flying and nobody is due back.
- **Extraction:** every living pilot must be at the exit; downed pilots are not waited for. Pilots waiting at the exit see how many have arrived.
- **Robots:** the damage robots take is divided by their toughness: 1 solo, 1.6 for two, 2.2 for three, 2.8 for four (`enemyToughness`, `EnemyManager.toughness`).
- **Hazards:** lava and water touch every pilot, each with their own contact and damage cadence (`SurfaceEnvironment.update(..., key)`). This also applies in Anarchy on the server, where a lava death costs a frag.
- **Story:** any pilot can pick up data logs and miners for the team. Radio messages follow each screen's own pilot.
- **Relays:** any pilot can activate a relay (`Game.pilotInteract(id)`).
- **Menus:** `startSession({ coop: true })` starts co-op, and restarts keep it. Choosing a mission from the menu is solo again.

## Game server

A new room plays Anarchy by default; `hello` may ask for `mode: 'coop'` and a `map` (a mission id, default Asterion Deepworks). Joining a room takes its mode and map. Co-op rooms hold 4 pilots; an unknown mission is refused with `unknown-map`.

- Inputs carry `interact: true` for the relay key.
- After a failed or completed mission the server restarts it after 10 s with full lives (a `match-start` event with a new seed).
- **Snapshot `coop`:**
  - `enemies`: id, type, position, rotation, shields and active flag for each robot;
  - `defeated` robot ids and activated `relays`;
  - `ready`, `escapeMs`, team `lives`, your `respawnInMs`, the `checkpoint` label and robot `toughness`;
  - recovered `logs` and rescued miners (`aboard`), and the mission `phase`.
- **Events:** `eshot` (robot fire: kind, position, velocity), `down`, `relay` (with who opened it), `respawn`, `mission-over` (`extracted` or `failed`).
- `taken` now lists every named pickup placed this attempt that is gone, including robot salvage (named `salvage:<robot id>` on every machine).

## Browser

Choose **PLAY ONLINE · ANARCHY & CO-OP**, then pick a mission under *New room plays*.

- **Robots are puppets.** No robot AI runs on a client: robots are drawn from snapshots, interpolated 100 ms behind like other ships. Shields come from the server. A robot the server destroys explodes here and counts for the mission.
- **Robot fire** is drawn from `eshot` events and hurts nobody here (`ProjectileManager.harmless`); damage arrives in snapshots.
- **Your shots** are drawn at once but damage robots only on the server.
- **Relays** opened by anyone open here, with a message naming the pilot. Your relay key is sent to the server.
- **Mission end** comes from the server. The result screen offers LEAVE ROOM, since the mission restarts by itself.
- **HUD:** the mission guide shows `CO-OP · Room ABCD · <round trip> · Team lives N`. Teammates going down and coming back are announced.

## Tests

- `tests/coop.test.mjs` (4):
  - the rules on their own;
  - a two-pilot mission with tougher robots, a respawn at the drop point, a wingmate opening a relay that becomes the checkpoint, a wingmate recovering a data log, and extraction that waits for both;
  - failure only when everyone is down with no lives; restarts stay co-op, the menu is solo;
  - per-pilot lava, and a lava death costing an Anarchy frag.
- `tests/net-coop.test.mjs` (6):
  - hello mode and map, and the relay flag;
  - a co-op room's snapshot and the 4-pilot limit;
  - relay, down and failure events, and the automatic restart;
  - robot fire events;
  - the server creating co-op rooms and refusing unknown maps;
  - live: a headless client game joins a co-op room with a second pilot. Robots stay near the server's, a relay opened by the wingmate opens here, a robot destroyed on the server disappears here, drawn robot fire never hurts the ship, local shots never damage robots, and the server's failure and restart reach the client.
- `tests/browser/online-lobby.spec.js` adds a co-op room for Signal Breach with team lives in the HUD.

## Known gaps

- Shot-opened doors and the reactor are simulated on each screen from the shots drawn there; with heavy lag a door may open a moment apart on different screens.
- The exploration map on each screen shows only that pilot's discoveries.
- Story radio follows each screen's pilot; recovered logs are counted on the server but each screen shows the ones it saw collected.
- No lag compensation for hits (as in Anarchy).
