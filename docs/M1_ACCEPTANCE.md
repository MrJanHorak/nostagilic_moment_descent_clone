# M1 acceptance status

Updated October 15, 2026. **Implementation complete for Arena Escape; acceptance remains open.** This is a small test mission, not a finished campaign. Starting M2's isolated toolchain work does not mark M1 accepted.

| Gate | Evidence | Status |
| --- | --- | --- |
| Menu, start, pause/resume, death/reboot, exit/replay without game errors | Production keyboard playthrough, automated Chromium flow and session tests | Passed for keyboard play |
| Local yaw/pitch/roll, inverted thrust, doorway traversal in both directions | Real controller/geometry tests, including equivalent 30/60/120 FPS | Automated checks passed; hands-on flight pending |
| Solid boundaries, sliding, blocked shots and single damage ownership | Arena/combat regression tests | Automated checks passed |
| Exit/death happens once; no cleanup kills; ten equivalent resets | Real manager/simulation tests, plus production win/loss/reboot | Passed |
| Pause freezes projectiles, buffs, cooldowns and callbacks | Session/flight/combat tests and production pause UI | Passed |
| Captured mouse aiming/firing and lock-loss recovery | Embedded browser refused capture; refusal handling was checked | Regular-browser check pending |
| Handling and objective/pickup readability | Reticle, objective guide, exit marker and provisional tuning implemented | Hands-on assessment pending |

See [mission evidence](progress/M1_MISSION.md) and [control contract](CONTROL_AND_SESSION_CONTRACT.md). Frame-time/resource budgets belong to M2: [hardware profiling](progress/M2_PERFORMANCE.md) now records an Intel GPU baseline and bounded restart resources, while the frame-time target remains unmet.

## Remaining hands-on run

Use the pinned toolchain in [TOOLCHAIN.md](TOOLCHAIN.md), run `npm run dev`, and open the displayed URL in a regular Chrome, Edge or Firefox window. The embedded preview is not suitable for signing off native pointer lock.

1. Start quiet Flight Arena. Click to capture the mouse; confirm that acquisition itself does not shoot. Aim with the mouse, roll until inverted, thrust vertically, turn around, and return through the doorway. Slide against a wall and move away again. Record any sticking, disorientation or uncomfortable sensitivity.
2. Release capture, change tabs, and return. Confirm one pause transition, no background flight, and Continue preserving position. Recapture and confirm mouse aim responds normally.
3. Select Arena Escape. Confirm pulse aim/fire with captured left clicks, both drones can be shot, the exit stays locked until they are neutralized, and entering the green ring completes once. Spend ammo before visiting the orange refill, and take damage before collecting the green repair. Check that the guide and pickups are understandable during play.
4. Replay or Reboot, then confirm health 100, ammo 40, score 0, two drones and an amber exit. Verify there are no game console errors.

Record date, browser/version, machine/GPU, resolution, results, and any changes needed here. If handling/readability fails, adjust it and repeat the affected checks. Mark M1 accepted only when these checks pass; no hands-on result has been recorded yet.
