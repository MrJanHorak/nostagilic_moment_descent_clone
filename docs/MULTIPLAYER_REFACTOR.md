# Phase 2: multiplayer-ready refactor

Started November 24, 2026. Goal: the simulation can run several pilots in one session, headless, deterministically, with single-player play unchanged. No networking yet; that is Phase 3 (online Anarchy), then Phase 4 (co-op).

## Where the code assumes one player

- `EnemyManager`, `ProjectileManager` and `PowerUpManager` each hold one `playerTransform` and aim, chase, hit and collect against it.
- `GameState` mixes one pilot's health, ammunition, weapons and modifiers with shared session state (score, kills, difficulty). `takeDamage` and friends call the HUD, audio and camera shake directly.
- `Game.updateSimulation` moves one `spaceship` from one `InputManager`.
- Gameplay randomness uses `Math.random`, so two machines running the same inputs would disagree.

## Steps

Each step keeps `npm run verify` and the browser suite green, and single-player behaviour identical.

1. **Seeded randomness.** `GameSession` owns a seeded generator, reseeded at each session start (seed optional, for replays and network matches). Gameplay code (robot timing and choices, drops, spread) draws from it. Cosmetic effects may keep `Math.random`.
2. **Pilots.** A `Pilot` holds one ship: transform, velocity, radius, health, ammunition, weapons, timed modifiers, alive/dead, and whether it is the local player. `GameState` keeps a list of pilots plus shared state. Existing single-player properties (`playerHealth`, `weaponInventory`, …) stay as views of the local pilot, so the UI is untouched.
3. **Presentation only for the local pilot.** Damage, healing and pickups on a pilot raise HUD, audio and camera effects only when that pilot is local. A remote pilot's events stay in the simulation.
4. **Robots choose a target.** Each robot targets the nearest pilot it can see (alive, line of sight), with a short commitment so it does not flicker between targets. Pursuit memory, sighting reports, scout lunges, bombs and contact damage use that target.
5. **Projectiles and pickups know pilots.** Player shots carry an owner pilot id (for kill credit and, later, friendly fire rules). Enemy shots and bomb blasts can hit any pilot. Pickups go to the pilot that touches them.
6. **One input command per pilot.** Each pilot is driven by a `FlightInput` command per step: the local one from `InputManager`, others from a queue (later, the network). `updateSimulation` moves every pilot.
7. **Headless two-pilot tests.** Node tests run a mission with two pilots under scripted inputs: robots split their attention, each pilot takes its own damage and pickups, kill credit goes to the shooter, and two runs with the same seed and inputs produce identical results.

## Status (November 24)

Steps 1–7 are implemented; single-player play is unchanged (all 598 unit/simulation tests and the sampled browser tests pass).

- **Seeded randomness:** `SessionRandom` (mulberry32) in `GameSession`; `session.begin(seed)` and `startSession({ seed })`. Robot timing, drops and spread draw from `session.random()`; cosmetic animation keeps `Math.random`.
- **Pilots:** `src/js/core/Pilot.js`. `GameState.localPilot`, `pilots`, `addPilot`, `removePilot`, `pilot(id)`. `playerHealth`, `weaponInventory`, `currentWeapon`, `pulseAmmoCapacity`, `speedMultiplier`, `weaponPower` and `modifierTimers` are views of the local pilot. `takeDamage`, `healPlayer`, `switchWeapon`, `addWeaponAmmo` and `applyTimedModifier` take an optional pilot. Only the local pilot triggers HUD, audio and camera effects. A remote pilot at zero shields is marked down; only the local pilot's death ends the mission (co-op rules come in Phase 4).
- **Robot targeting:** `EnemyManager.targets()`, `chooseTarget()` (nearest visible pilot, else nearest; held for `TARGET_HOLD_MS` = 500 ms), `aimOf()` and `damageTarget()`. Chasing, aiming, lunges, bombs and shots use the robot's target; ramming hits whichever pilot it touches. A robot that is shot remembers where its shooter was.
- **Projectiles and pickups:**
  - `traceShot` accepts `players`;
  - enemy shots and bomb blasts hit any pilot (`ProjectileManager.pilotBodies`);
  - `fireProjectile(gameState, { pilot })` fires from that pilot's ship, using their loadout, and stamps `ownerId`;
  - kills credit `pilot.kills`;
  - pickups go to the first pilot in reach, through `pilotPickupState`, a view of that pilot's loadout with a silent UI.
- **Input per pilot:** `Pilot.input` holds a `FlightInput`. `Game.addPilot(id)`, `setPilotInput(id, input)`, `pilotFire(id)` and `removePilot(id)`. `moveRemotePilots` flies every remote pilot each step, with wall collisions.
- **Tests:** `tests/multiplayer.test.mjs` (10). Seeds, exact replay of a live fight, the pilot model, split robot attention and retargeting, wingmate flight, collisions and shot ownership, kill credit, per-pilot pickups, bomb blasts on two pilots, and identical two-pilot replays.

Phase 3 has started: the Anarchy rules and arena are described in [ANARCHY.md](ANARCHY.md).

### Known gaps, carried into Phase 3–4

- Lava and water contact, mission exit checks, story pickups (logs and miners) and the exploration map still follow the local pilot only.
- Remote ships use the plain ship model with no name tag or colour.
- There is no network transport yet; `setPilotInput` and `pilotFire` are the hooks the server and client will call.

## Not in Phase 2

Networking, lobbies, prediction and interpolation (Phase 3); co-op rules such as shared lives, respawn and "all pilots at extraction" (Phase 4); ship customization (cosmetic, Phase 3). Endless-mode tunnel generation stays single-player.
