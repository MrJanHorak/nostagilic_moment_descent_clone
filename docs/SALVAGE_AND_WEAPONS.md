# Enemy salvage and player weapons

Implemented October 22, 2026, following owner feedback that the more aggressive Crossfire enemies still died too quickly. This is the first delivery from the enemy-variety discussion: increased scout/fighter durability, equipment-specific salvage and usable special weapons. Bomber area denial, directional destroyer armor, boss phases, sniper and support robots remain future work.

## Existing and new authored levels

The runtime applies these rules to every level with a source document: campaign missions, practice mines, imported files, editor playtests and My Levels. Existing JSON needs no edit or re-export. Original non-document training fixtures retain their health and drop rules. The shared document format remains versions 1–12; special salvage is a runtime reward, not a new editor placement kind.

| Enemy | Authored health | Guaranteed reward after a shot kill |
| --- | ---: | --- |
| Scout | 20, previously 10 | Pulse ammunition, up to 20 rounds within mission capacity |
| Fighter | 40, previously 25 | Cyan laser salvage: 12 rounds, 60 capacity |
| Bomber | 50 | Orange missile salvage: 4 rounds, 20 capacity |
| Destroyer | 100, with existing 20% damage reduction | Purple plasma salvage: 8 rounds, 40 capacity |
| Boss | 200, with existing 30% damage reduction | Purple plasma salvage: 8 rounds, 40 capacity |

Fly into salvage to collect it. The first special pickup unlocks its weapon; later pickups replenish that weapon. Collection keeps the currently selected weapon. Use **1 pulse, 2 laser, 3 missile, 4 plasma**, then click or press **F** to fire. The pickup message identifies the selection key. A full inventory leaves the item available. Salvage persists for the mission and is cleared on replay/menu/session replacement; it does not carry across campaign missions. Cleanup and ramming do not award equipment. Kill credit, score and mission objectives remain separate from collection.

Normal campaign pulse damage is ten, so scouts take two hits and fighters four. Crossfire and Fighter Proving Ground use five-damage pulse: four scout hits or eight fighter hits. Crossfire's original forty rounds cover twelve perfect hits with room for misses before salvage or optional supplies. No required kill, relay, reactor or exit depends on collecting a special weapon.

## Weapon behavior

Special damage now scales from the current mission's pulse damage and the existing weapon-power modifier. The internal legacy mode retains a base of one.

| Weapon | Damage relative to pulse | Behavior |
| --- | ---: | --- |
| Pulse | 1× | One target per shot |
| Laser | 1.5× | Faster shot; pierces each encountered robot once, stops at the first wall/door |
| Missile | 3× direct | Slower straight shot; four-unit blast radius |
| Plasma | 2× direct | Pulse-speed projectile; 2.5-unit blast radius |

A blast applies full damage to its direct target once. Other active robots receive up to half direct damage, falling linearly to zero at the radius, measured to their collision box. Physical walls, closed doors and fields block blast visibility. Wall impacts explode on the incoming side. Blasts damage robots only; they do not damage the player or splash through reactor/door objectives. Reactors retain their authored direct-hit rules. Missiles fly along the aim and do not home. Out-of-ammunition selection returns to pulse; the next trigger fires it.

Penetration and blast dispatch obey session/reset ownership. Piercing targets are recorded before callbacks; spent explosive shots retire before damage/effects dispatch. A reentrant clear or session replacement cancels remaining impacts. All projectile/pickup updates remain on simulation time; finite-mission salvage, shots and explosions add no dynamic lights.

## Verification and next work

`npm run verify` passes scoped lint for 83 runtime modules plus two tooling files, strict types, all 507 unit/simulation tests and production build. Ten new salvage/weapon cases exercise type-specific rewards, durability versus legacy training, collection/caps/reset, wall-blocked collection, damage scaling/ammo/fallback, piercing across frames, blast falloff/occlusion and reentrant resets. Existing campaign/practice simulation checks use the new durability values.

Five distinct targeted browser scenarios pass across completed runs: Signal Breach fight/extraction/replay, Crossfire direct, Crossfire overhead with actual laser collection/selection/fire, fighter drill and production victory/death/reboot/menu. The first overhead check incorrectly expected a drop still on the floor after the descent had collected it; the corrected controller accepts that collection or flies into a remaining drop, then verifies twelve laser rounds, one shot spending a round, extraction and replay restoring locked weapons. No damage, inventory or transform hooks are used. See the [browser record](progress/salvage-browser-check.json) and [laser selected after firing](progress/salvage-laser.png).

The final automated overhead route fired sixteen pulse shots and one laser shot, sampled a minimum of 65% shields and completed in 152.63 simulation seconds. This single controlled-clock route includes steering stops; it is not a human balance measurement or a direct/overhead difficulty comparison. Human playtests and fresh hardware/hosted/full-suite verification remain separate.

Next: play Crossfire's direct and upper routes with and without salvaging the laser, record shields/shots/supply use, then finish a distinct bomber attack with warning, blast occlusion and recovery. Develop destroyer flanking weaknesses and boss phases before increasing the roster; sniper/support additions remain proposed.
