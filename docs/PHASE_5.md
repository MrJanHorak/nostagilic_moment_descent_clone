# Phase 5: Acts 2–3, heavy robots, ratings and sharing

Phase 4 finished the co-op campaign. Phase 5 finishes the story and gives players reasons to come back.

| Step | What | Status |
| --- | --- | --- |
| 1 | Robot roster: destroyer directional armour, boss phases, finite robot generators (format v16) | Done (November 25) |
| 2 | Act 2 missions 06–08, using generators and heavy robots | Planned |
| 3 | Act 3 and the ending: FOREMAN's core, destroy or free it; rescues change the ending | Planned |
| 4 | Mission rating: medals and par times; server leaderboards | Planned |
| 5 | Online sharing for My Levels | Planned |

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
