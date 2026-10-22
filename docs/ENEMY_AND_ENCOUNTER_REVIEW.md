# Enemy and encounter design review

Updated October 22, 2026. Current campaign and combat summary, followed by proposed work. Signal Breach includes a ranged encounter, overhead route and sliding/hidden doors. Scouts have a committed strike/recovery cycle; fighters now reposition between warning/fire/recovery phases. Deepworks adds all five robot models and destructible reactor escape. Verification paragraphs below retain the scope of their original feature checkpoints; use the [roadmap](ROADMAP.md) for current priorities and verification boundaries.

## What is actually in the campaign

| Mission | Rooms / connections | Enemies | Required combat | Supplies |
| --- | --- | --- | --- | --- |
| Signal Breach | 11 / 12 | 1 fighter in signal hall, 1 scout in maintenance | None | Pulse ammo, repair; additional hidden ammo/repair alcove |
| Vector Foundry | 7 / 6 | 1 scout in optional coolant cache | None | Pulse ammo, repair |
| Nightfall Reactor | 7 / 7 | 2 scouts in coolant works/reactor | Both scouts | Two ammo and two repair pickups |
| Asterion Deepworks | 48 / 56 | 2 scouts, 2 fighters, 1 bomber, 1 destroyer, 1 boss | Transfer scout, pump fighter, vault fighter; then the interlocked reactor | Ten ammo and ten repair pickups, including hidden stores |

All four use pulse damage 10. Scout health is 10: a normal pulse hit defeats a scout. Scouts pursue, warn, commit to a straight strike and recover/withdraw; one strike deals 5 damage and leaves the scout alive for return fire. They do not fire projectiles or suicide on contact. A 25-health fighter takes three normal campaign pulse hits. The separate Fighter Proving Ground uses pulse damage 5, so its guards take five hits. The first three campaign missions start with 80 rounds; Deepworks starts with 120.

The runtime contains five distinct models, health/speed/resistance values, firing ranges and projectile variants. Authored-mine movement respects physical walls/closed doors and routes toward a last observed position. Fighters additionally choose bounded lateral/elevation/spacing targets in the player's room; they brace during warning/recovery. See [mobile fighters](FIGHTER_MOVEMENT.md). The heavier ranged types still share broad approach/hold behavior in authored mines; their legacy type-specific movement lives in a separate non-mine path. Hostile projectiles currently use power 10 rather than the enemy definition's damage value. Bomb visuals are not a completed area-denial/blast contract. Campaign geometry supports loops, vertical routes, affine ramps and supplies: Signal Breach has two independent graph cycles, Nightfall one, Deepworks nine; Vector Foundry is a tree.

Evidence: [campaign documents](../src/js/core/levels/documents), [enemy definitions](../src/js/entities/EnemyTypes.js), [perception/navigation/combat](../src/js/entities/EnemyManager.js), [campaign compilation](../src/js/core/levels/Campaign.js).

## Signal Breach encounter checkpoint

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
| Scout / rusher | Implemented: audible warning, committed strike and withdrawal/recovery | Dislodge a player who stays in one firing position |
| Fighter / ranged guard | Implemented: braced warning/shot/recovery plus bounded lateral/elevation/spacing movement between attacks | Teach strafing, peeking and fighting across a doorway |
| Bomber / area denial | Proposed: slow, clearly signaled explosives with explicit blast/occlusion rules and recovery | Make the player change altitude or leave cover |
| Destroyer / anchor | Proposed: guard an authored location, turn slowly and expose attack/recovery windows | Create a route-choice problem around a defended sight line |

Introduce roles individually before combining them. Distinguish them by silhouette, motion, attack sound and projectile pattern as well as color. Mining-machine identities (forks, drill heads, rotating tool mounts) would fit the setting and communicate function. Bosses can follow once the regular roster produces interesting encounters.

Retain collision and sight/memory guarantees. Dodging should require local perception, have a reaction delay and limited duration, and avoid walls/closed doors. A robot should not evade every shot perfectly or track an unseen player through walls. New behavior needs deterministic tests for warning/attack/recovery timing and route safety.

The fighter cycle braces during a 650 ms amber charge warning, emits one shot with a short white cannon/ring flash, then cools blue for 850 ms. A short synthesized chirp warns once per charge. Lost visibility/range/alignment cancels the shot; returning to sight requires a fresh full wind-up. The existing 2–3 second firing interval and 10-damage projectile are retained. Pause freezes it and no scheduled attack survives death/restart. Later fighter movement adds strafing and spacing between these stationary windows, preserving the counterattack opportunity.

The pass passes lint/types, all 416 unit/simulation cases and build, plus four browser cases including ordinary-input cue/shot/recovery capture, combat, extraction/replay, and production victory/death/reboot. See [player-experience verification](PLAYER_EXPERIENCE.md#fighter-attack-readability) and the [browser report](progress/fighter-attack-browser-check.json).

## A concrete next encounter sequence

Build a small new encounter mission or revise one mission as a deliberate balance pass:

1. **Orient:** a safe arrival with a distinct landmark, visible route choice and initial supplies. Show the eventual destination from a useful angle when geometry permits.
2. **Teach incoming fire:** one existing fighter across a passage, with a wall return the player can retreat behind. Ensure the fight works at the fighter's actual firing range and the enemy body fits its route.
3. **Change the approach:** a vertical side route reconnects behind the guard's position. Let the player understand that altitude and loops are tactical tools.
4. **Offer a choice:** a visible optional ammo/repair cache is guarded by one scout. Teach that supplies can carry a cost; leave enough resources on the mandatory route to finish without the cache.
5. **Combine carefully:** a ranged guard watches one approach while a telegraphed rusher uses a side passage. Provide a fallback corner; avoid simultaneous unseen fire from every direction.
6. **Reward progress:** the relay opens a shorter return route through a recognizable earlier space. Later, a reactor countdown can turn this learned route into an escape challenge.

Keep quiet travel, a supply/recovery beat, and a landmark between demanding fights. Use corners, height and opening placement to break sight lines. Existing rooms/ramps/shafts, doors, fields and reactor escapes support this sequence without new runtime systems. Freestanding cover props, triggered reinforcements and keyed secrets remain separate proposals; concealed shot-open supply rooms already work.

## Suggested build order

1. **Next:** author and tune one mixed scout/fighter encounter around a loop and vertical approach. Use the implemented attack cues and bounded fighter movement; cover ordinary input/fire, extraction and restart, and collect human balance feedback.
2. Finish bomber area denial with a warning, committed attack, explicit damage/blast rules and recovery before combining heavy roles.
3. Broaden real-time hardware captures and run full release/browser regressions on the resulting revision; inspect CI group duration as the suite grows.
4. Follow the [roadmap](ROADMAP.md#next-work-queue) for campaign persistence/user campaigns. [Rescue objectives](ENVIRONMENT_AND_MISSION_ROADMAP.md) remain a later distinct mission-system option.

Already delivered: Signal Breach's ranged/overhead encounter; scout strikes and mobile fighters; Nightfall's 60-second escape; Vector Foundry's relay field; Deepworks' destructible reactor and 120-second escape. These should not re-enter the backlog as missing features.

Record kills/shots, minimum shields, optional-route use and completion time during playtesting. Set balance from those results rather than multiplying enemy counts or health across the campaign. Separate weapon energy/secondary fire and a rotatable marked automap remain useful cockpit-system follow-ups, but are separate from this visual/encounter review.
