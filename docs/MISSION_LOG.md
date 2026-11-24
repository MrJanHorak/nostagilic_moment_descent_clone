# Mission status, comms log and data-log archive

Added November 24, 2026 after the first story playtest. Sources: `src/js/core/MissionStatus.js`, `src/js/ui/MissionLogPanel.js`, `StoryController.history`, and the `MissionSelect` archive.

## In a mission

- **Pause menu → Mission status** (open by default):
  - Required objectives with ✓/○: each relay or reactor (noting which one starts the escape countdown), required guards (n/N) and extraction, with a note on whether the exit is locked.
  - Optional counts: survivors aboard, data logs recovered, robots destroyed.
  - Elapsed time, difficulty and the remaining escape time.
- **Pause menu → Comms log (n):** every radio line and data log received this attempt, newest first, with mission time. It is cleared on restart.
- **Mission log key: J by default** (remappable under Settings → Controls). It pauses and opens the comms log. On a controller, **View/Share** does the same, during flight or from the pause menu.
- **HUD guide line:** adds "Aboard x/y · Logs x/y" for story missions, plus the mission-log key. Relay and fire hints now show your current key bindings.

Locations of unfound logs and survivors are deliberately not shown; finding them is part of the mission.

## Between missions

Completed campaign cards in **Select Mission** show:
- the best rescue count (`Rescued x/y`)
- a **Data logs recovered x/y** section that expands to show the full text of every log ever recovered in that mission

Logs count once you extract with them.

## Verification

`tests/mission-status.test.mjs` (five cases) covers:
- required, optional and meta status
- reactor/guard/escape status
- comms history order
- the J key and controller View button
- pause/open behaviour

Browser: J opened the log from flight with the comms section focused. The HUD counts and the seeded library archive rendered with a clean console. Settings-during-pause, victory/death/reboot and mission-library browser tests pass.

## Readability and comms signal (November 24, second pass)

From playtest feedback that the bottom bar was hard to read:

- **Two-line guide (HUD and external views):**
  - Bold first line: mission, objective state, relay/system counts and Aboard/Logs.
  - Smaller second line: what to do next (nearest relay prompt, where the exit is, location and next room, reactor notes) and the mission-log key.
  - Control hints (fire, aim, pickup colours, Esc) appear only during the first 15 seconds of each attempt.
- **Cockpit view:** the top strip also shows Aboard/Logs.
- **Incoming message signal:**
  - A short radio chirp, with a softer three-note chime for data logs and the pickup cue for rescues.
  - Three quick pulses on the comms panel.
  - A fourth cockpit status lamp that blinks cyan for three seconds.
- **Cockpit is the default view for new profiles.** Saves made before the camera option existed keep the HUD view; anyone who chose a view keeps it. C still cycles cockpit → HUD → external.

Browser checks: the cockpit default, panel and lamp; the guide before and after the hint window; camera persistence, cockpit instruments, Deepworks cockpit, mission list, Deep Relay start and settings pass.
