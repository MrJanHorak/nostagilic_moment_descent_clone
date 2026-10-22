# Crossfire Relay

Implemented October 22, 2026. Open **SELECT MISSION → Practice & prototypes → Crossfire Relay**. This standalone encounter is a balance fixture for the existing scout/fighter behaviors. It does not change the four-mission campaign order or global enemy values.

## Play the encounter

The blue arrival starts behind real doorway cover. Center on the north passage for the direct approach, or move beneath the blue ceiling hatch and climb with Space. The overhead gallery crosses to a second shaft into the amber combat hall. From the upper shaft, look down and engage before descending. The opening changes the firing angle, but the fighter's sighting report can now draw the scout toward the shaft. Watch for both; descending onto a pursuing fighter can cause a ram. Amber panels mark the destination; green rooms mark the supply circuit.

One fighter guards the hall while one scout approaches from its eastern side passage. The fighter changes position between stationary amber warning/fire/blue recovery phases. The scout warns, commits to a straight lunge and recovers; changing height or sidestepping after commitment can evade it. Doorway walls give an opportunity to break sight and reposition, but enemies can pursue remembered sightings: cover is not permanent immunity.

Clear both guards, then use **R** within sight and 2.5 units of **Return shortcut** on the hall's western side. It opens the green supply bay's door back to arrival. The relay can open this route before combat ends; extraction still requires both guards and the relay. Take the green circuit for optional repairs/ammunition, or return by either blue route. Enter the green exit ring in the southwestern arrival corner to finish. Replay restores both enemies, supplies, the closed shortcut, 100% shields and 40 rounds.

## Layout and resources

The portable source is [crossfire-relay.v7.json](../src/js/core/levels/documents/crossfire-relay.v7.json); import it into the editor or My Levels to edit/share. The mission uses existing format v7 with nine spaces, ten passages and two independent loops. It adds no document fields or combat behavior flags.

| Resource | Authored rule |
| --- | --- |
| Pulse | 40 starting rounds, 80 capacity, five damage per hit |
| Fighter | 40 health, eight normal pulse hits; drops laser salvage |
| Scout | 20 health, four normal pulse hits; drops pulse ammunition |
| Optional supply bay | One repair (up to 25 shields), one pulse refill (up to 20 rounds) |
| Objectives | Both guard defeats, Return shortcut activation, arrival extraction |

Twelve perfect pulse hits suffice without optional supplies or salvage. Forty rounds provide a miss allowance; this budget and automated completion do not establish human difficulty. The overhead route's advantage comes from a changed firing angle and real cover. The [pressure pass](ENEMY_PRESSURE.md) added faster pursuit/attacks and nearby sighting reports. The subsequent [salvage pass](SALVAGE_AND_WEAPONS.md) raises durability and rewards shot kills: fly into the fighter's cyan drop, select the piercing laser with **2**, and return to pulse with **1**. The layout and starting ammunition remain intact.

## Balance playtest checklist

Run each route with ordinary input. Avoid development neutralization or supply grants. Replay between attempts to reset the encounter. Use a fresh attempt for each row; do not mix automated steering measurements with human feedback.

| Attempt | Entry route | Shots fired | Minimum shields | Supply/retreat route used | Completion time | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| First encounter | Direct | | | | | Could you identify both threats and retreat? |
| Alternate approach | Overhead | | | | | Was the hatch route readable and tactically useful? |
| Repeat attempt | Either | | | | | Did recognizing cues improve ammo use or damage taken? |

Check that arrival gives time to read the briefing; the scout warns before contact; the fighter's shot/recovery can be recognized while the scout is active; a fallback corner is usable; supplies are optional; the relay/return path is understandable; and replay restores the same starting state. Record deaths and missed objectives as well as wins. Use that feedback to tune placements/supplies before changing the shared enemy roster.

## Current pressure and verification

Shared authored tactics use the [pressure rules](ENEMY_PRESSURE.md) with subsequent [durability, salvage and weapon changes](SALVAGE_AND_WEAPONS.md), verified with 507 unit/simulation cases. The upper route no longer guarantees an idle scout while its ally fights. The [handoff](progress/NEXT_SESSION.md#verification-available) identifies current browser results. The earlier [pressure browser evidence](progress/enemy-pressure-browser-check.json) predates the durability/salvage pass. The initial observations below retain their original behavior and cannot establish current balance.

## Initial implementation checkpoint

Six simulation/integration cases in `tests/crossfire-relay.test.mjs` cover portable loading and standalone progression, ten seconds of safe arrival, physical passage traversal in both directions, the overhead path, simultaneous commitment on the direct route, isolated fighter engagement from above, pause, actual aimed pulse damage/kill credit, relay gating, single collection and completion/replay reset. State placement in these Node fixtures isolates conditions; browser route checks separately use native input.

The browser cases in `tests/browser/crossfire-relay.spec.js` cover direct and overhead approaches, mixed combat, pause, the green supply loop, relay activation, extraction and replay. They use ordinary keyboard movement/fire/interaction and read-only diagnostic positions, without enemy damage hooks or transform injection. Each run writes shots, minimum sampled shields, visited rooms, observed attack phases and simulation completion time to `crossfire-playthrough.json`. Those are automated route observations, not human balance feedback or hardware performance measurements.

Run `npm run verify`, then `npx playwright test --project=encounters`. The dedicated encounters project includes the existing mobile-fighter drill and keeps the longer combat routes out of the production project's CI budget. Each case is assigned once across the four projects. Completed browser results are recorded in the [current handoff](progress/NEXT_SESSION.md#verification-available); test presence alone is not a pass.

The final local verification passed lint for 81 runtime modules, strict types, all 491 unit/simulation cases and production build. Six distinct targeted browser scenarios passed across completed runs: both Crossfire approaches, the mobile-fighter drill, production victory/death/reboot, My Levels import/play/replay/sharing, and mission/settings compatibility. A stale six-choice menu assertion was corrected to seven and rechecked; the initial overhead controller was corrected to engage the fighter before descending. The [check record](progress/crossfire-browser-check.json) retains those corrections and the individual results. No retries, dependencies or hardware captures were added. Full browser/hosted release verification remains separate work.

| Automated route | Pulse shots | Minimum sampled shields | Simulation completion time |
| --- | ---: | ---: | ---: |
| Direct | 7 | 40% | 124.5 s |
| Overhead | 7 | 75% | 153.2 s |

These single controlled-clock runs include a ten-second safe-arrival wait and steering/observation stops. They demonstrate successful routes, not a statistically balanced difficulty comparison or expected human completion times. Both guards reset on replay; optional supplies were collected on the green return circuit. Reviewed images: [overhead survey](progress/crossfire-overhead-map.png), [direct completion](progress/crossfire-direct-complete.png). Diagnostic frame intervals in these images are not hardware FPS measurements.
