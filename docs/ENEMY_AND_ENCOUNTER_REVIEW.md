# Enemy and encounter design review

October 20, 2026. Assessment of the authored campaign and current runtime, followed by proposed work. Enemy/mission recommendations below are not implemented by this review.

## What is actually in the campaign

| Mission | Rooms / connections | Enemies | Required combat | Supplies |
| --- | --- | --- | --- | --- |
| Signal Breach | 7 / 7 | 1 scout in signal hall | None | Pulse ammo, repair |
| Vector Foundry | 7 / 6 | 1 scout in optional coolant cache | None | Pulse ammo, repair |
| Nightfall Reactor | 7 / 7 | 2 scouts in coolant works/reactor | Both scouts | Two ammo and two repair pickups |

All three use pulse damage 10. Scout health is 10: a normal pulse hit defeats each campaign enemy. Scouts pursue and inflict contact damage; they are excluded from projectile firing and are destroyed on contact. There is therefore no ranged enemy fire in the current authored campaign. The fighter/scout Arena Escape practice mission exercises ranged combat, but that is separate content.

The runtime contains five distinct visual models, health/speed/damage values, firing ranges and weapon patterns. Authored-mine movement already respects physical walls/closed doors and routes through portals toward a last observed position. Ranged types share the broad approach/hold-within-eight-units behavior; scouts continue closing. This is a useful navigation foundation, but not yet a varied tactical roster. Campaign geometry already supports loops, vertical routes, affine ramps and optional supply spaces. Vector Foundry's graph is a tree; Signal Breach and Nightfall each have one graph cycle.

Evidence: [campaign documents](../src/js/core/levels/documents), [enemy definitions](../src/js/entities/EnemyTypes.js), [perception/navigation/combat](../src/js/entities/EnemyManager.js), [campaign compilation](../src/js/core/levels/Campaign.js).

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

1. Add a ranged fighter to a deliberately tested encounter using existing systems; measure damage taken, ammo expenditure and escape/fallback options.
2. Give fighter/scout attacks clear cues and recovery, then add bounded lateral movement or strike/withdraw behavior with simulation tests.
3. Author one mixed encounter around a loop and vertical approach; test ordinary input/fire and restart, not only the development neutralize action.
4. Add one new mission mechanic (for example, reactor-triggered timed escape), with portable document validation and editor authoring.

Record kills/shots, minimum shields, optional-route use and completion time during playtesting. Set balance from those results rather than multiplying enemy counts or health across the campaign. Separate weapon energy/secondary fire and a rotatable marked automap remain useful cockpit-system follow-ups, but are separate from this visual/encounter review.
