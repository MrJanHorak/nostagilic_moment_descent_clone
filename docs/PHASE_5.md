# Phase 5: Acts 2–3, heavy robots, ratings and sharing

Phase 4 finished the co-op campaign. Phase 5 finishes the story and gives players reasons to come back.

| Step | What | Status |
| --- | --- | --- |
| 1 | Robot roster: destroyer directional armour, boss phases, finite robot generators (format v16) | Done (November 25) |
| 2 | Act 2 missions 06–08, using generators and heavy robots | Done (November 25) |
| 3 | Act 3 and the ending: FOREMAN's core, destroy or free it; rescues change the ending | Done (November 25) |
| 4 | Mission rating: medals and par times; server leaderboards | Done (November 25) |
| 5 | Online sharing for My Levels | Done (November 25) |

## Step 3: Act 3 and the ending

Built by `scripts/build-act3.mjs` and registered as campaign missions 9–11. The story is in [STORY.md](STORY.md#act-3-status).

| Mission | Spaces | Fabricators | Heavy robots | Objective | Escape |
| --- | --- | --- | --- | --- | --- |
| 09 Dead Signal | 17 (two levels) | 3 | 2 destroyers (required) | West and East jammers (linked, 15 s / 60 s solo) → mast power → mast uplink | None |
| 10 Breaker Yard | 20 (two levels) | 3 | **The Warden (boss)** and 2 destroyers (boss and one destroyer required) | Crane release, depot lock, then the breaker console after the Warden falls | 90 s |
| 11 Core of the Matter | 22 | 3 | **The Executor (boss)** and 1 destroyer (both required) | West and East seals (linked) → deep relay sync → **choice: Release or Purge FOREMAN** | None |

- **The choice** uses format 17 (below). Release FOREMAN and Purge FOREMAN are optional relays. The first one activated answers, the other turns dark and locks, and each opens its own route to the lift cage, so the pilot cannot leave without choosing.
- **The ending** (`campaignEnding` in `Campaign.js`) comes after the last mission, before the results. It depends on the choice (Open line or Contract closed) and on how many campaign miners came home. The count uses each mission's best run, out of all 26 miners. The tiers are 90% or more, 50% or more, and fewer.
- The ending shows only in single player. Online teams can still make the choice, and the server locks the other relay for everyone, but the result screen is the usual team screen.
- **Tests** (`tests/act3.test.mjs`): order, story, bosses and loops; format 17 validation; ending tiers; a simulated play-through of all three missions, then the final mission flown again with the other choice (the lock, the epilogue and the end of the campaign).

### Format 17: choice relays
`mission.choice = { deviceIds: [2–3 relays] }`. Choice relays are the one kind of relay that need not be required. The validator rejects reactors, required relays, unknown or repeated ids, and any choice that would leave the exit unreachable. See [LEVEL_DOCUMENT_FORMAT.md](LEVEL_DOCUMENT_FORMAT.md#version-17-choice-relays).

## Step 4: medals, par times and leaderboards

- **Medals** (`src/js/core/MissionRating.js`):
  - **Gold:** beat par, rescue every miner and find every data log.
  - **Silver:** finish within 1.5× par and rescue at least half the miners.
  - **Bronze:** any other completion.
  - The results screen shows the medal, the par time and what the next medal needs. The best medal is saved with campaign progress and shown on the mission cards.
- **Par times:** the authored missions use hand-set pars in `PAR_SECONDS` (tune them after playtests). Other levels get 60 s + 30 s per required relay + 20 s per required robot.
- **Leaderboards** (`server/HttpApi.mjs`, on the same port as the game):
  - `GET /scores?mission=<id>` returns the top 10. `POST /scores` takes `{mission, name, timeMs, score, medal, difficulty}`.
  - The server keeps each pilot name's best time (top 20 per mission), ranked by time, then score.
  - Only built-in campaign and team missions count. Times must be 10 s to 2 h, and each address may post once every 5 s.
- **Client:** `src/js/net/GameServerApi.js`. After a campaign or team mission, the game posts the run if Play Online has a server and a pilot name. It then adds "you are #N" and the top 5 to the results screen. With no server it does nothing.
- These are honour-system leaderboards: the server checks that values are plausible, but it cannot prove a run happened. Server-verified runs would need the mission to be replayed on the server. A mission board mixes difficulty levels and hangar upgrades, so its times are not directly comparable; the results screen labels this limitation. Difficulty IDs from new submissions are saved accurately, but older entries previously recorded as `pilot` cannot be reconstructed automatically.

## Step 5: sharing levels online

- **Server** (`server/HttpApi.mjs`):
  - `GET /levels` lists the newest 100 levels; `GET /levels/<id>` downloads one.
  - `POST /levels` takes `{document, name, author}`. Each upload passes the full level validator. Each address may upload once a minute, and the library holds up to 500 levels.
  - `DELETE /levels/<id>` removes a level and needs `Authorization: Bearer $ADMIN_TOKEN`.
- **My Levels:** each level gets **Share online** (with a confirmation naming the server). **Browse shared levels** lists the uploads, and each can be played directly or saved with **Save to My Levels**. Both are disabled until Play Online has a server address.
- **Storage:** set `DATA_DIR` to keep scores and levels in JSON files, written atomically. Without it they live in memory until the server restarts. The GCP startup script uses `/var/lib/descended`.
- **CORS:** with `ALLOW_ORIGINS` set, the API answers only those sites, including preflight requests.
- **Tests** (`tests/server-api.test.mjs`): medal rules; leaderboard best-time keeping, ranking, rate limits, bad input and saving to disk; level upload validation, listing, downloads and admin-only deletion; CORS.

## Editor additions

- **Team & choice relays…** (Mission group): up to two linked pairs with their windows, and a choice of two or three relays. Choice relays leave the required list; removing a relay from a choice makes it required again.
- **Place robot generator here…** (right-click in a room) chooses the robot type, total count, release interval and how many may be active at once. **Robot generators…** lists them and removes any.
- Deleting a relay or room cleans up the pairs, choices and generators that used it. A choice left with one relay ends, and that relay becomes required.
- Generators are not drawn in the 3D view yet. Use the list to check them.
- **Tests** (`tests/editor-relay-rules.test.mjs`).

## Step 2: Act 2 missions 06–08

Built by `scripts/build-act2.mjs` (shared helpers in `scripts/lib/missionKit.mjs`, also used by the team missions) and registered in `src/js/core/levels/Campaign.js` as campaign missions 6–8. The story is in [STORY.md](STORY.md#act-2-status).

| Mission | Spaces | Fabricators | Heavy robots | Objective | Escape |
| --- | --- | --- | --- | --- | --- |
| 06 Witness | 17 | 2 (suite scouts, security fighters) | 1 destroyer (required) | Archive power → ledger download → uplink | None (the generators supply the pressure) |
| 07 Fabricator | 19 (two levels) | 3 (fighters, bombers, core scouts) | 2 destroyers (required) | Coolant cutoff, grid breaker, then shoot the fabricator core (reactor, 300) | 75 s |
| 08 Moving Day | 17 (two levels) | 3 (scouts, fighters, vault fighters) | 2 destroyers (required) | West and East transfer (linked, 12 s / 48 s solo) → core cradle → lift release | 90 s |

- Each mission has 7–8 radio messages, 2–3 data logs, 2 miners, a hidden or optional side area, and at least two loops.
- After Moving Day, "next mission" continues into Act 3.
- **Tests** (`tests/act2.test.mjs`): the campaign order, story, generators, heavy robots and loops of each mission; a simulated play-through of each (fabricators wake, objectives complete including the linked pair and the reactor, extraction); next-mission chaining.
- The existing per-mission portal traversal tests (`tests/experience.test.mjs`) also cover the three missions.
- Updated tests for an 8-mission campaign: campaign progress counts, The Seal no longer last, and story ID prefixes.

## Step 1: heavy robots and generators

### Destroyer armour (`src/js/entities/HeavyRoles.js`)
- Damage depends on which side a shot strikes: front plate ×0.25, sides ×0.8 (the old flat resistance), rear ×2.
- The side comes from the shot's direction of travel against the destroyer's facing, falling back to where the shot came from.
- The first front-plate hit (then at most every 8 s) shows *DESTROYER FRONT ARMOR · Flank it*. In co-op one pilot can draw its fire while another circles behind.

### Boss phases
- A boss enters phase 2 at 2/3 shields and phase 3 at 1/3. Each new phase calls in two escort scouts and shows a message.
- Phase 2 fires 25% faster and always in volleys; phase 3 fires 45% faster with three-shot volleys.
- Overall resistance stays ×0.7.
- No shipped mission uses a boss yet; Act 3 will.

### Robot generators (format v16, `src/js/entities/RobotGenerators.js`)
- A top-level `generators` list. Each entry has `{id, roomId, position, enemyType (scout, fighter, bomber or destroyer), count 1–12, intervalSeconds 2–60, maxAlive 1–4 (default 2)}`.
- A generator wakes the first time a living pilot is in its room (*ROBOT GENERATOR ACTIVE · N robots inbound*).
- Once awake it releases one robot per interval while fewer than `maxAlive` of its own are active, until `count` run out.
- Generated robots and boss escorts are named `<generator>#<n>`. They never count toward objectives and drop no salvage.
- **Online:** generators and phases run on the server. Clients draw robots they don't know as puppets and remove them when the server does.
- The editor opens v16 documents but cannot place generators yet.

### Tests
`tests/heavy-robots.test.mjs` (5):
- armour sides and multipliers, and phase thresholds;
- generator waking, interval, limit and running dry;
- v16 validation and its errors;
- in a mission: named generated robots with no salvage or credit, front versus rear destroyer damage (2.5 against 20 for a 10-power shot), and boss escorts at phases 2 and 3;
- live online: a server-generated fighter appears on the client as a puppet and disappears when destroyed.
