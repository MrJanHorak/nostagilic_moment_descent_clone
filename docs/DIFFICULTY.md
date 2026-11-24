# Difficulty levels

Added November 23, 2026. Source: `src/js/core/Difficulty.js`.

Four tiers scale combat around the authored balance. **Pilot is the default and is exactly the existing tuning**, so all earlier balance notes and playtest records describe Pilot.

| Tier | Robot health | Damage taken | Fighter shot interval | Starting pulse ammo / capacity |
| --- | ---: | ---: | ---: | ---: |
| Trainee | ×0.6 | ×0.5 | ×1.4 | ×1.5 |
| Pilot | ×1 | ×1 | ×1 | ×1 |
| Veteran | ×1.35 | ×1.4 | ×0.8 | ×0.8 |
| Insane | ×1.75 | ×2 | ×0.65 | ×0.65 |

## Where players choose it

- **Settings → Difficulty** (saved with other preferences in `descended.settings.v1`; older saves get Pilot).
- **Select Mission → Difficulty** at the top of the mission library, with a one-line summary.
- The main menu status line always shows the current tier.

## Rules

- The tier is **snapshotted when a mission starts** (`GameState.difficulty`). Changing it mid-run only takes effect on the next start or restart, so it cannot be toggled to escape a fight.
- **Robot health** applies to authored-mine robots (campaign, practice documents, My Levels, playtest). Legacy non-document training fixtures keep their original values.
- **Damage taken** applies to every source through `GameState.takeDamage`: robot shots, scout strikes, ramming and lava. Reactor timeout remains an instant failure.
- **Fighter cadence** scales the authored interval but never drops below the 450 ms warning + 400 ms recovery, so every shot keeps its full telegraph. Warning/recovery durations, projectile speed and accuracy are unchanged.
- **Ammunition** scales the mission's starting pulse rounds and capacity (capacity always holds the starting amount). Pickup refills and salvage amounts are unchanged.
- **Campaign progress** stores each mission's hardest cleared tier. The mission card shows `✓ COMPLETED on Veteran` (Pilot is implied) and the completion screen shows the tier and flags a first clear on a harder tier. Best time and best score are kept across tiers.

## Future tuning ideas

Scout lunge timing, sighting-report radius, robot counts per tier and a score multiplier are deliberately left out until human playtests show which axes matter most. Bomber, destroyer and boss roles should scale through the same tier object once they are finished.

## Verification

`tests/difficulty.test.mjs` (five cases) checks that Pilot is an identity for all authored values, tiers are monotonic and bounded, unknown names fall back safely, the preference persists, damage scales from every source, and a real Crossfire Relay session applies robot health, fighter cadence and ammunition at start while ignoring mid-run changes until restart. `tests/campaign-progress.test.mjs` adds a hardest-tier case.
