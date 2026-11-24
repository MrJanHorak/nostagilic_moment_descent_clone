# Campaign progress

Added November 23, 2026.

Built-in campaign progress is saved in the browser under `descended.campaign.v1` (`src/js/core/CampaignProgress.js`). It is separate from preferences (`descended.settings.v1`) and the My Levels library.

## Player behavior

- **Main menu:** the campaign button reads **START CAMPAIGN** on a fresh profile, **CONTINUE · MISSION 0N** once a mission has been extracted, and **REPLAY CAMPAIGN** after all four. It starts the first unfinished mission in campaign order; a status line shows progress and the next mission.
- **Mission library:** completed campaign cards show `✓ COMPLETED`, the completion count, best time and best score. Missions are never locked; any mission can still be played directly. **Reset campaign progress** appears when progress exists and requires a second click to erase it.
- **Completion screen:** after a campaign extraction it shows run time, best time and best score, any new record, overall campaign progress and whether progress was saved.

## Rules

- Only successful extraction from a built-in campaign mission records progress. Practice/prototype missions, My Levels, imported documents and editor playtests never change it, even when an imported document reuses a campaign id such as `signal-breach`.
- Records are keyed by the campaign document's stable `id`, not its list position, so reordering or inserting missions keeps existing progress.
- Time is simulation time (`GameSession.timeMs`): it freezes during pause and excludes loading.
- Score includes the 1,000-point completion bonus, matching the completion screen.
- Stored data is untrusted: unknown versions, malformed JSON, invalid ids, non-positive completion counts and negative or non-numeric values are ignored. A bad record is not overwritten until the next completion or reset.
- If storage is unavailable or full, progress is kept in memory for the current page and the completion screen says so. Play is never blocked.

## Not yet included

Mid-mission checkpoints, carrying salvage/weapons between missions, cloud/cross-device sync and user campaign bundles. These belong to later roadmap items (progression, multiplayer backend, user campaigns).

## Verification

`tests/campaign-progress.test.mjs` (eight cases) covers ordering and resume, best-record tracking, persistence round-trips, malformed/hostile records, storage failures, bounds, reset, time formatting, and the game rule that only built-in campaign completions count.
