# Enemy pressure pass

This records the initial October 22 aggression checkpoint. The later [salvage and weapons pass](SALVAGE_AND_WEAPONS.md) increases authored scout/fighter health to 20/40 and enables equipment drops and special weapons. Its rules supersede the health values below; movement, reports and attack timing remain as recorded here.

October 22, 2026. Owner feedback on Crossfire Relay was that combat felt easy and robots were not aggressive. This pass changes the shared authored-mine behaviors, rather than the mission's enemy count or hit-point budget. Campaign, practice documents and My Levels use the same rules; the original non-document training fixtures keep their existing behavior.

## What changed

| Behavior | Previous authored behavior | Current authored behavior |
| --- | --- | --- |
| Fighter movement | 1.8 units/s | 4.8 units/s for pursuit and local repositioning |
| Fighter planning / preferred distance | 750–900 ms / 7–12 units | 350–500 ms / 5.5–9 units |
| Fighter warning / recovery | 650 / 850 ms | 450 / 400 ms |
| Fighter shot interval | 2–3 s | 1.45–1.75 s; a freshly spawned fighter can fire after about 700 ms |
| Fighter projectile | 10 units/s, 0.05 directional spread | 18 units/s, 0.025 directional spread |
| Scout pursuit / strike | 3 / 10 units/s; wind-up within six units | 5.4 / 14 units/s; wind-up within eight units |
| Scout warning / recovery / retry | 550 / 1,100 / 500 ms | 450 / 700 / 250 ms |
| Nearby allies | Individual sightings only | Bounded reports of an actually seen ship position |

Health, damage and ammunition costs are unchanged: the fighter still has 25 health and fires ten-damage projectiles; the scout has ten health and deals five damage on a successful strike. The ship's normal maximum speed remains six units/s. A faster pursuer and shorter attack gaps make holding a firing position or slowly touring a live encounter more dangerous.

An eligible fighter still needs an uninterrupted warning before each shot. Breaking sight cancels a charge; reacquisition needs a fresh warning. Recovery remains a stationary counterattack window. Scouts still commit to a straight lunge, apply damage once per strike, and can miss when the player changes direction. No aim prediction, homing attack, new enemy model or attack burst is added.

## Sighting reports

A robot that actually sees the ship within 30 units can share that observed position with at most four allies within 24 units in the same room or an adjacent room connected by an open passage. Each reporter waits at least 1,200 simulation milliseconds between reports. Closed passages exclude adjacent recipients. Recipients use the existing body-clear navigation and collision; an alert does not authorize firing through walls or doors.

An ally can now leave its room to investigate without personally seeing the player first. Once all observers lose sight, hidden player movement does not update their remembered target. Pause freezes reporting/attacks, and replay replaces the memory and combat state.

In [Crossfire Relay](CROSSFIRE_RELAY.md), the overhead shaft still changes the firing angle, but the fighter's report can draw the scout toward it. In Signal Breach, the maintenance scout may respond while the fighter engages. In Fighter Proving Ground, the second fighter can join the fight before the player enters its original bay. Do not rely on these enemies staying at their authored spawn markers.

## Implementation and verification

Tuning lives in `src/js/entities/EnemyTactics.js`. The manager selects the authored behavior from the loaded shared document; no new JSON field/version is required. Legacy definitions retain their original speed convention. Attacks, warnings and reporting use simulation time; the pass adds no wall-clock callbacks or scene lights.

`npm run verify` passes scoped lint for 82 runtime modules plus two tooling files, strict types, all 497 unit/simulation cases and production build. New cases check increased closing/lateral speed, five real fighter shots in eight seconds, full warning/damage/projectile speed, comparable 30/60/120 Hz movement, faster committed scout lunges and evasion, local report bounds, closed passages and memory after sight is lost. Existing pause/reset, collision, resource and mission checks remain included.

Five distinct targeted browser scenarios passed across completed runs with zero retries: Signal Breach's native fight/overhead route/extraction/replay; both Crossfire approaches; the two-fighter drill; and production victory/death/reboot/menu. [The check record](progress/enemy-pressure-browser-check.json) preserves results and controller corrections. Ordinary-input controllers now answer responding allies, prioritize the ranged guard from doorway cover, and reveal a scout if it starts outside the local report radius. Earlier controllers died while ignoring live attackers or waiting on an unavailable sighting; these did not establish runtime exceptions. No state injection, enemy neutralization or supply grants were introduced. This is targeted functional coverage; full browser/hosted/hardware acceptance remains separate.

Automated success does not replace another human playtest. The owner's next feedback should judge cue readability, evasion and whether both approaches now demand movement. Initial Crossfire observations are preserved as pre-pressure evidence rather than overwritten or presented as current balance measurements.
