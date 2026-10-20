# Enemy and encounter design review

October 20, 2026. Assessment of the authored campaign and current runtime, followed by proposed work. The first ranged encounter and overhead route are now implemented in Signal Breach. Further behavior and mission recommendations remain proposed.

## What is actually in the campaign

| Mission | Rooms / connections | Enemies | Required combat | Supplies |
| --- | --- | --- | --- | --- |
| Signal Breach | 11 / 12 | 1 fighter in signal hall, 1 scout in maintenance | None | Pulse ammo, repair; additional hidden ammo/repair alcove |
| Vector Foundry | 7 / 6 | 1 scout in optional coolant cache | None | Pulse ammo, repair |
| Nightfall Reactor | 7 / 7 | 2 scouts in coolant works/reactor | Both scouts | Two ammo and two repair pickups |

All three use pulse damage 10. Scout health is 10: a normal pulse hit defeats a scout. Scouts pursue and inflict contact damage; they are excluded from projectile firing and are destroyed on contact. The new Signal Breach fighter has 25 health and takes three normal pulse hits. Before this encounter pass, the campaign had only four scouts across 21 rooms; the ranged fighter/scout Arena Escape was separate practice content.

The runtime contains five distinct visual models, health/speed/damage values, firing ranges and weapon patterns. Authored-mine movement already respects physical walls/closed doors and routes through portals toward a last observed position. Ranged types share the broad approach/hold-within-eight-units behavior; scouts continue closing. This is a useful navigation foundation, but not yet a varied tactical roster. Campaign geometry supports loops, vertical routes, affine ramps and optional supply spaces. Vector Foundry's graph is a tree; Signal Breach now has two independent graph cycles and Nightfall has one.

Evidence: [campaign documents](../src/js/core/levels/documents), [enemy definitions](../src/js/entities/EnemyTypes.js), [perception/navigation/combat](../src/js/entities/EnemyManager.js), [campaign compilation](../src/js/core/levels/Campaign.js).

## Implemented first encounter

Signal Breach's fighter starts at the back of the amber hall, outside pursuit/fire range from spawn. The direct entry tunnel teaches incoming fire. Moving sideways behind the arrival doorway breaks the sightline; the guard can still pursue a last seen position, so cover provides a repositioning opportunity rather than permanent immunity.

Two ceiling shafts and a blue overhead gallery connect arrival to the hall from above. Hazard-pattern end walls distinguish this route; the mission briefing describes Space to climb the arrival hatch. The former hall scout is replaced by the fighter, with a scout placed in maintenance away from spawn. The existing green return loop and repair cache remain available. Enemy definitions, damage values, AI and objective requirements are unchanged; combat remains optional and the relay still controls extraction. The same document opens in the editor without a schema change.

The following doors pass upgrades Signal Breach to v8: a marked player-shot door teaches opening the entry, a concealed wall panel leads to a new optional supply alcove off arrival, and the relay extraction gate slides open. The original green loop is retained. All doors stay open until restart; enemies cannot shoot them open. This introduces hidden-route discovery using existing pickup types without adding a key or secret-score system. See [the v8 door contract](LEVEL_DOCUMENT_FORMAT.md#version-8-sliding-doors-and-concealed-access).

New simulation cases exercise safe arrival, hidden scout placement, direct/covered sightlines, body-clear travel through the overhead route, real hostile projectile damage, three ordinary pulse shots, ammo use, kill credit and enemy reset. Existing campaign cases check every portal, relay gating and document round-trip validity.

Verification passes: lint/types, all 393 unit/simulation cases and production build. Four browser scenarios pass, including ordinary-input combat plus overhead flight/relay/extraction/replay, the original green-loop progression regression, and two production cockpit checks. See the [browser report](progress/signal-encounter-browser-check.json), [ranged encounter](progress/signal-ranged-encounter.png) and [overhead survey](progress/signal-overhead-route.png). The new combat route uses read-only development flight diagnostics, not enemy-neutralization controls; the separate green-loop regression still isolates geometry with the existing neutralize action. Final balance remains subject to player feedback.

## Lessons from the original

The released Descent AI distinguishes stationary, chasing, hiding, retreating and path-following modes. Its relative movement includes circling and moving away, and its projectile-awareness code supports evasion. These are concrete behavioral distinctions rather than additional health tiers. See [original AI.C](https://raw.githubusercontent.com/videogamepreservation/descent/master/MAIN/AI.C), particularly `ai_behavior_to_mode`, `ai_move_relative_to_player` and `move_around_player`.

The original manual describes keyed/hidden doors, energy centers, robot generators and reactor-dependent exit access: the mine changes what the player can reach and what risks are worth taking. See the [original manual](https://store.steampowered.com/manual/273570/), printed pages 13–17. Those are references for original new content, not a proposal to copy maps or assets.

## Recommended enemy roles

| Role | First useful behavior | Encounter purpose |
| --- | --- | --- |
| Scout / rusher | Recognizable approach sound and wind-up; later, a bounded strike/withdraw cycle | Dislodge a player who stays in one firing position |
| Fighter / ranged guard | Use existing ranged fighter first; later add bounded lateral movement and visible burst/recovery phases | Teach strafing, peeking and fighting across a doorway |
| Bomber / area denial | Slow, clearly signaled explosives with a recovery window | Make the player change altitude or leave cover |
| Destroyer / anchor | Guard an authored location, turn slowly and expose attack/recovery windows | Create a route-choice problem around a defended sight line |

Introduce roles individually before combining them. Distinguish them by silhouette, motion, attack sound and projectile pattern as well as color. Mining-machine identities (forks, drill heads, rotating tool mounts) would fit the setting and communicate function. Bosses can follow once the regular roster produces interesting encounters.

Retain collision and sight/memory guarantees. Dodging should require local perception, have a reaction delay and limited duration, and avoid walls/closed doors. A robot should not evade every shot perfectly or track an unseen player through walls. New behavior needs deterministic tests for warning/attack/recovery timing and route safety.

## A concrete next encounter sequence

Build a small new encounter mission or revise one mission as a deliberate balance pass:

1. **Orient:** a safe arrival with a distinct landmark, visible route choice and initial supplies. Show the eventual destination from a useful angle when geometry permits.
2. **Teach incoming fire:** one existing fighter across a passage, with a wall return the player can retreat behind. Ensure the fight works at the fighter's actual firing range and the enemy body fits its route.
3. **Change the approach:** a vertical side route reconnects behind the guard's position. Let the player understand that altitude and loops are tactical tools.
4. **Offer a choice:** a visible optional ammo/repair cache is guarded by one scout. Teach that supplies can carry a cost; leave enough resources on the mandatory route to finish without the cache.
5. **Combine carefully:** a ranged guard watches one approach while a telegraphed rusher uses a side passage. Provide a fallback corner; avoid simultaneous unseen fire from every direction.
6. **Reward progress:** the relay opens a shorter return route through a recognizable earlier space. Later, a reactor countdown can turn this learned route into an escape challenge.

Keep quiet travel, a supply/recovery beat, and a landmark between demanding fights. Use corners, height and opening placement to break sight lines. The existing editor can author those patterns with connected rooms/ramps/shafts. Freestanding cover props, triggered reinforcements, keyed secrets and timed reactor escape require additional runtime/editor support; they should not be implied by merely placing a marker.

## Suggested build order

1. **Implemented:** a ranged fighter encounter, doorway cover and an overhead approach in Signal Breach. Continue measuring damage taken, ammo expenditure and fallback use during player feedback.
2. Give fighter/scout attacks clear cues and recovery, then add bounded lateral movement or strike/withdraw behavior with simulation tests.
3. Author one mixed encounter around a loop and vertical approach; test ordinary input/fire and restart, not only the development neutralize action.
4. Add one new mission mechanic (for example, reactor-triggered timed escape), with portable document validation and editor authoring.

Record kills/shots, minimum shields, optional-route use and completion time during playtesting. Set balance from those results rather than multiplying enemy counts or health across the campaign. Separate weapon energy/secondary fire and a rotatable marked automap remain useful cockpit-system follow-ups, but are separate from this visual/encounter review.
