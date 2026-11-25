# Co-op (Phase 4)

Fly the campaign as a team of up to four pilots. Phase 4 built it in five steps; all five are done.

| Step | What | Status |
| --- | --- | --- |
| 1 | Co-op rules in the simulation: shared lives, relay respawns, team extraction, per-pilot hazards and story, robot scaling | Done (November 25) |
| 2 | Co-op rooms on the game server: missions, robots and mission state in snapshots, relay key | Done (November 25) |
| 3 | Co-op in the browser: puppet robots, shared relays, robot fire, team HUD, lobby mission choice | Done (November 25) |
| 4 | Team-play polish: quick-chat, map pings, revive a downed wingmate, per-player ammo pickups | Done (November 25) |
| 5 | Missions designed for teams: linked relays (format v15), Twin Valves and Deep Freight | Done (November 25) |

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

## Team play (step 4)

- **Quick-chat** (T, then 1–8): eight fixed phrases: *Follow me, Wait for me, Need repairs, Robot here!, Relay here, On my way, Heading to extraction, Thanks!* (`src/js/core/TeamSignals.js`).
  - While the strip is open, number keys send a phrase instead of switching weapons. T closes it, and pausing closes it too.
  - Fixed phrases mean there is no free text to moderate.
- **Pings** (G): mark the point you aim at, the first wall along your nose or 80 units ahead.
  - Everyone sees a ring and a beam in your colour, drawn through walls, for 8 s. A new ping replaces your old one (`src/js/ui/TeamMarkers.js`).
- **Rate limit:** one signal per pilot every 750 ms, on the server and offline.
- **Revive:** a downed pilot leaves a wreck marker. A living teammate within 4 units for 3 s brings them back where they fell, with half shields and the weapons they had.
  - Progress drains at half speed when the teammate moves away, and the ring shrinks as the revive fills.
  - A revive costs no life. If the pilot was waiting to respawn, the respawn is cancelled and its life refunded.
  - With no lives left, a revive is the only way back.
- **Ammunition for everyone:** in co-op, pulse ammunition, ammo pickups and weapon salvage (`PER_PILOT_PICKUPS`) can be collected once by every pilot.
  - The pickup stays in the world for the others and disappears from your screen once you take it. Repairs and boosts still go to whoever reaches them first.
  - Online, the server lists your taken shares in your own `taken`.
- **Keys:** `quickChat` (T) and `markTarget` (G) are remappable in Settings → Controls.

## Team missions (step 5)

**Linked relays** (format v15, see [LEVEL_DOCUMENT_FORMAT.md](LEVEL_DOCUMENT_FORMAT.md#version-15-linked-relays-team-missions)) are pairs that switch on only when both are activated within a window.

- The first relay arms (amber light, message naming its partner and the time left) and disarms if the partner is not reached in time.
- A team gets the authored window; a solo pilot gets four times as long.
- Online, the server sends `armed` (`id`, `by`, `partner`, `ms`) and `disarmed` events, and snapshots list `coop.armed`.

**Missions** (built by `scripts/build-team-missions.mjs`, registered in `src/js/core/levels/TeamMissions.js`):

| Mission | Spaces | Linked pairs | Robots | Escape |
| --- | --- | --- | --- | --- |
| **Twin Valves** | 13 | West + East valve, 10 s (40 s solo) | 6, warden destroyer required | 60 s |
| **Deep Freight** | 14 on two levels | North + South crane, 12 s; West + East rail switch, 8 s | 8, two fighters and a destroyer required | 90 s |

- **Twin Valves:** the pump station's valves sit at the ends of the west and east wings and open both core lines together.
  - Clear the warden, pull Pressure release, and return to the drop through the core return line.
  - Solo, the 40-second window covers the long way round through the drop.
- **Deep Freight:** the freight line Asset Protection used.
  - The cranes at either end of the dock lower the freight shaft. The rail switches either side of the cargo hold open the freight lock; the switch room has a slag floor.
  - The line release seals the tunnel and opens the maintenance lift straight up to the north crane.
  - Its logs tie into The Seal: the freight manifest for Closure Order AC-77.
- Both missions have radio, data logs and miners.
- **Where they appear:** in the mission picker as *TEAM MISSION* cards after the campaign (solo play allowed), and first in the online co-op mission list, marked "(team)".
- Team missions chain to each other with "next mission"; practice missions never run on into them.

## Game server

A new room plays Anarchy by default; `hello` may ask for `mode: 'coop'` and a `map` (a mission id, default Asterion Deepworks). Joining a room takes its mode and map. Co-op rooms hold 4 pilots; an unknown mission is refused with `unknown-map`.

- Inputs carry `interact: true` for the relay key.
- After a failed or completed mission the server restarts it after 10 s with full lives (a `match-start` event with a new seed).
- **Snapshot `coop`:**
  - `enemies`: id, type, position, rotation, shields and active flag for each robot;
  - `defeated` robot ids and activated `relays`;
  - `ready`, `escapeMs`, team `lives`, your `respawnInMs`, the `checkpoint` label and robot `toughness`;
  - recovered `logs` and rescued miners (`aboard`), and the mission `phase`.
- **Signals:** a client sends `{t:'signal', kind:'quick', phrase}` or `{t:'signal', kind:'mark', p}`; the server relays `{t:'signal', from, ...}` to everyone in the room at once (outside snapshots), or drops it when the pilot signals too fast. Bad signals get `bad-signal`.
- Snapshot `coop.wrecks` lists `{id, p, progress}` for wrecks a teammate can revive.
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
- `tests/team-play.test.mjs` (4): signal cleaning, aim points stopping at walls and the rate limit; revive progress, draining, refunds and revives with no lives; in a mission: reviving a wingmate at their wreck, per-pilot ammunition and first-come repairs, quick-chat keys not switching weapons, and pings that fade; the server relaying signals with a rate limit and listing wrecks.
- `tests/team-missions.test.mjs` (5): v15 validation and its errors; solo arming, disarming after 40 s and opening the pair (core gates open); a two-pilot pair inside the 10 s team window; both team missions played through in the simulation (pairs, relays, escape clock, extraction) and listed first for co-op; the server's armed and disarmed events and `coop.armed`.
- `tests/browser/online-lobby.spec.js` adds a co-op room for Signal Breach with team lives in the HUD.

## Known gaps

- Shot-opened doors and the reactor are simulated on each screen from the shots drawn there; with heavy lag a door may open a moment apart on different screens.
- The exploration map on each screen shows only that pilot's discoveries.
- Story radio follows each screen's pilot; recovered logs are counted on the server but each screen shows the ones it saw collected.
- No lag compensation for hits (as in Anarchy).
