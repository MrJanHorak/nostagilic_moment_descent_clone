# Anarchy (Phase 3)

Free-for-all deathmatch: every pilot for themselves. Phase 3 built it in five steps; all five are done, so friends can now play each other online.

| Step | What | Status |
| --- | --- | --- |
| 1 | Anarchy rules in the simulation | Done (November 24) |
| 2 | Foundry Ring arena | Done (November 24) |
| 3 | Authoritative Node game server (WebSocket rooms, room codes) | Done (November 24) |
| 4 | Client networking: sequenced inputs, prediction and reconciliation, interpolated remote ships | Done (November 25) |
| 5 | Lobby with room codes and a server address | Done (November 25) |

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

## Game server

Run it with `npm run server` (default port 8787). `PORT`, `HOST` and `ALLOW_ORIGINS` (comma-separated, for example `https://your-site.netlify.app`) come from the environment. It has no dependencies beyond the game itself.

- **Endpoints:** `GET /health` returns rooms, players and the protocol version. WebSocket play is at `/play`.
- **Rooms:**
  - Each room has a four-letter code from letters that don't read alike.
  - Up to 8 pilots per room.
  - An empty room is kept for 30 s, then closed.
- **Simulation:**
  - Each room runs the real game simulation headless (`src/js/net/MatchRoom.js` on `src/js/net/HeadlessGame.js`), so the rules are exactly the browser's.
  - The server's own ship sits out (`game.dedicated`).
  - All rooms share one fixed 60 Hz loop that catches up at most 10 steps after a stall.
- **Snapshots** go to each player 20 times a second (`SNAPSHOT_EVERY = 3`).
- **Rematch:** a finished match restarts by itself after 10 s with a new seed and the same pilots.
- **WebSocket layer:** `server/WebSocket.mjs`, a small RFC 6455 implementation (text and control frames; client frames must be masked; 4 KB message limit).

**Hosting:** Netlify serves static files only, so the server needs a Node host that allows WebSockets (Fly.io, Render, Railway, or any small VPS behind TLS, giving `wss://`). Bandwidth is small: a full 8-pilot snapshot is about 1–2 KB, 20 times a second per player.

## Playing online

1. Start a server: `npm run server` (port 8787), or deploy it to a Node host with WebSockets.
2. In the game, choose **PLAY ONLINE · ANARCHY** on the start screen.
3. Enter a pilot name and the server address. `localhost:8787`, `host:port`, `http(s)://` and `ws(s)://` all work; `/play` is added. A page served over https needs a `wss://` server.
   - The address defaults to the last one used, then to `VITE_GAME_SERVER` (set it at build time for the hosted site), then to `ws://<this host>:8787/play` when the page is local.
4. **CREATE ROOM** makes a room; **JOIN ROOM** joins one by its four-letter code.
5. Once in a room, the address bar becomes an invite link (`?room=ABCD&server=…`). The pause menu shows the room and has **COPY INVITE LINK**. Opening an invite link opens the lobby filled in.
6. **RETURN TO BASE** (pause menu) or **LEAVE ROOM** (result screen) leaves. A dropped connection shows *Connection lost*.

The HUD guide bar shows the room code, the round trip in milliseconds and the pilot count. Pausing does not stop the match: the server holds your ship still (thrust off) while the menu is open. After a match, the server starts the rematch by itself.

## Client networking (`src/js/net/ClientPrediction.js`, `src/js/net/OnlineMatch.js`)

The server stays authoritative for damage, frags, respawns, pickups and ammunition. The browser predicts only its own flight and draws its own shots at once.

- **Inputs:** every 60 Hz client step sends one numbered input: the held flight keys, the mouse turn since the last input (capped at 0.6 rad like the server), the fire flag and the selected weapon. Firing locally is limited to the server's 100 ms, so every shot drawn is a real one.
- **Prediction and reconciliation:** unacknowledged inputs are kept (`InputHistory`). On each snapshot the ship is put at the server's pose for the acknowledged input, the newer inputs are replayed with the same flight model and wall collision, and the live ship moves toward the result:
  - more than 3 units away (respawn, big lag): snap;
  - otherwise: close 35% of the gap per snapshot, so corrections never jerk;
  - aim within 0.03 rad of the server's is left alone (the client owns its aim); larger differences ease in, and more than 0.6 rad snaps;
  - mouse turn not yet sent is kept.
- **Other ships:** each snapshot's poses go into a buffer (`SnapshotInterpolator`). Every frame they are drawn 100 ms behind the estimated server time (`ServerClock`), blended between the two snapshots around that time. With no newer snapshot they coast on their velocity for up to 150 ms. A respawn is never blended (no sliding across the map).
- **Other pilots' shots:** `shot` events are drawn from the server's muzzle position. They do no damage here; hits come back in snapshots.
- **Server-owned state:** shields, ammunition and unlocked weapons are copied from each snapshot. Damage flashes the screen. Deaths and respawns come from the `alive` flags. The HUD's frags, clock and respawn countdown come from `match`. Placed pickups are hidden while the server lists them in `taken`; one that vanishes beside your ship plays the pickup sound.
- **Ships and names:** other ships are drawn in a colour by join order (red, blue, green, yellow, …) with a name tag. The HUD, kill messages and result screen use pilot names.

### Protocol (`src/js/net/Protocol.js`, version 1)

One JSON text frame per message, each with a type field `t`.

**Client to server:**
- `{t:'hello', protocol:1, name, room?}`: with no room, the server creates one; with a room code, it joins that room.
- `{t:'input', seq, input, look:[yaw, pitch], fire, weapon?}`:
  - `input` is a `FlightInput` (thrust and keyboard turns), held until the next input.
  - `look` is the mouse turn since the last input.
  - Send one input per client step.
- `{t:'ping', time}`.

**Server to client:**
- `welcome`: `{id, name, room, map, seed, tick, tickRate, snapshotEvery, rules}`.
- `roster`: `{players:[{id, name}]}`, sent on every join and leave.
- `snapshot`: `{tick, timeMs, ack, ammo, pilots:[{id, name, alive, hp, weapon, p, q, v}], pickups, taken, match, events}`.
  - `taken` lists placed pickups that someone collected and that are waiting to return (added November 25; older clients ignore it).
  - `ack` is the last input sequence number the server applied, used for reconciliation.
  - `match` holds standings, the time left, the respawn countdown, the winner and the rematch countdown.
  - `events` lists `shot`, `kill`, `respawn`, `match-start` and `match-over` since the previous snapshot.
- `pong`: `{time, tick}`.
- `error`: `{error}`. Before joining, an error also closes the connection with code 4000. Reasons are `room-not-found`, `room-full`, `protocol-mismatch`, `bad-room-code`, `bad-json`, `too-large` and `hello-timeout`.

**What the server never trusts:**
- Inputs are cleaned: unknown keys are dropped and amounts clamped to 0–1.
- Turns are capped at 0.6 rad per input.
- Old or repeated sequence numbers are ignored.
- Shots are limited to one per 100 ms, whatever the client sends.
- Weapons switch only if the pilot has unlocked them.

## Tests

- `tests/anarchy.test.mjs` (6 tests):
  - scoring, penalties and respawn timing;
  - safest spawn and the time limit;
  - arena validity, size, spawns and salvage;
  - a live two-pilot fight where the rival destroys the local ship, the session continues and the local ship respawns away from the rival;
  - frag-limit end with standings;
  - pickup return after 20 s.
- `tests/net-room.test.mjs` (6): message cleaning, room codes, spawning apart, inputs and sequence numbers, turn cap, fire-rate cap, kill and respawn events, automatic rematch, leaving and the 8-pilot limit.
- `tests/net-server.test.mjs` (4): WebSocket frame encoding; two real clients creating and joining a room, flying and seeing each other, about 20 snapshots a second, ping, and the roster after leaving; refused hellos; a full room; the origin allow-list.
- `tests/net-client.test.mjs` (7):
  - input numbering, turn cap and acknowledgement;
  - reconciliation: replay agrees with the server exactly, small errors ease in, big ones snap, unsent mouse turn is kept;
  - the server clock and its reset on a rematch;
  - interpolation, coasting and no blending across a respawn;
  - lobby address handling, defaults and invite links;
  - readable server errors;
  - live: a headless browser-side game joins a real server, is refused a missing room, flies with prediction that settles within 1 unit of the server, sees a second pilot (named, coloured, interpolated near the server's pose), draws their shot, and leaves.
- `tests/browser/anarchy.spec.js` opens the arena from the menu and checks the scoreline.
- `tests/browser/online-lobby.spec.js` starts a game server, opens the lobby, checks the bad-code and missing-room messages, creates a room, sees the room code and a second pilot join and leave, and returns to base (the server sees the pilot leave).
- `tests/helpers/headlessGame.mjs` is the shared headless game, used by the multiplayer and Anarchy tests.

## Known gaps

- Fixed November 25: lava and water now hurt every pilot on the server (Phase 4 per-pilot hazards); a lava death costs a frag.

- No lag compensation: you hit what the server sees, so with high latency you must lead targets by your round trip. Other ships are drawn 100 ms in the past.
- The kill feed is a message line.
- There is no room browser or public matchmaking; rooms are shared by code or invite link.
- The hosted site needs a deployed server and `VITE_GAME_SERVER` set at build time before strangers can play without typing an address.
