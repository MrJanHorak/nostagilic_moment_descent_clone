# Bomber: area denial

Added November 23, 2026. Sources: `src/js/entities/BomberAttack.js`, the bomb code in `ProjectileManager` (`fireBomb`, `moveBomb`, `armBomb`, `detonateBomb`) and `EnemyManager.updateBomberAttack`. Practice mission: **Select Mission → Practice & prototypes → Bomber Drill**.

## What the player sees

1. **Hold:** the bomber hangs back about 11 units away and moves slowly (2.4 units/s).
2. **Charge (900 ms):** warning lights and launch pods glow amber and pulse faster, with a low charge chirp.
3. **Launch:** a slow orange bomb (8 units/s) flies at the point where the ship was at launch. It does not home.
4. **Land and arm (1 s):**
   - The bomb stops at that point, or sticks to the near side of the first wall in its path.
   - An orange wireframe sphere shows the exact blast radius (3.6 units). It brightens and pulses faster until detonation.
5. **Detonate:**
   - 24 damage at the centre, falling linearly to 40% at the rim, and nothing outside it.
   - Walls between the bomb and the ship block it completely.
   - Difficulty scales the damage like any other damage.
6. **Recover (1.1 s):** the pods cool blue. This is the window to close in.

The next launch comes 3.6–4.2 s after the last one. Difficulty can shorten that, but never below the 2 s charge + recovery.

## Rules and guarantees

- **Every blast is telegraphed.** Bombs pass through the ship in flight, so even a pilot who doesn't move sees the marker around them for a full second. Bombs never cause instant contact damage.
- **Same telegraph rules as fighters.** Every launch needs an uninterrupted wind-up while the ship is visible, in range (18) and in front. Losing sight cancels the charge. Long frames never release catch-up launches.
- **Pause and restart.** Pause freezes flight and fuse. Death, restart and mission changes remove every bomb, including armed ones, so none can detonate later.
- **Bomb damage.** Bombs don't damage robots (their own or others) and can't be shot down. Both are possible follow-ups.
- **Scope.**
  - The role applies only to bombers in authored missions: campaign, practice documents, My Levels and playtest.
  - Old non-document fixtures keep the legacy bomber.
  - Authored bombers have 60 health (was 50) and still drop missile salvage.
- **Performance.** No lights are added: the bomb and marker are emissive or unlit meshes. The marker geometry is shared and its material is disposed with the bomb.

## Encounter design tips

- Bombers punish hovering and camping a doorway. Pair them with cover the player can duck behind, and with a second exit from the room.
- Place bombers at the far end of larger rooms so the player can see the charge before the bomb arrives.
- Introduce them alone (Bomber Drill) before mixing them with fighters, which already punish open movement.

## Verification

`tests/bomber.test.mjs` (ten cases) covers:
- blast falloff
- the wind-up/recovery cycle and cancellation
- the difficulty floor on the launch interval
- authored versus legacy bombers
- launching at a fixed point
- landing, arming the marker and a single detonation
- escaping the sphere
- falloff damage inside the sphere and wall occlusion
- sticking to a wall in the flight path
- passing through the ship
- difficulty-scaled damage, pause freezing the fuse, and restart cleanup
- a full Bomber Drill simulation run

Browser: a real-browser Bomber Drill run had a clean console; a hovering ship took one full blast per bomb. Mission-list and settings browser tests pass. Human balance feedback on the drill is the next step.
