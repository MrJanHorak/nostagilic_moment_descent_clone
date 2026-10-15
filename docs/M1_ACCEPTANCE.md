# M1 acceptance status

Recorded October 15, 2026. **M1 is accepted and complete for the finite Flight Arena / Arena Escape slice.** The project owner signed off after playing in Chrome, with and without enemies, reporting working pause/resume, immediate aiming recapture, and restart restoring defaults. This closes the remaining hands-on acceptance alongside the existing automated evidence.

## Owner playthrough and sign-off

The owner reported:

> I played through the area test flight with and without enemies and everything seems to work. I can pause nothing continues until I continue and the aiming recaptures instantly. Restarting places everything bacvk at default it seems to check out I would say M1 is complete

- **Browser:** Chrome; exact version not supplied.
- **Environment:** local Vite session, according to the supplied console excerpt. Exact source revision, machine/GPU and viewport were not recorded for this playthrough.
- **Directly reported observations:** flight with and without enemies works; pause stops gameplay until Continue; aiming recaptures immediately; restart appears to restore defaults.
- **Acceptance decision:** project owner accepts M1. Individual maneuvers, pickup checks and exact reset counter values were not itemized in this report; detailed assertions remain supported by the existing automated regressions. This record does not invent separate manual results for them.

The supplied [Chrome console excerpt](progress/M1_CHROME_CONSOLE.txt) shows successful initialization, synthesized default sounds, and repeated pointer-lock acquisition/release. No game error or exception is visible in the excerpt. The final console line is incomplete as supplied. These logs support the reported startup/capture behavior; the gameplay acceptance comes from the owner's playthrough and sign-off, rather than inferring gameplay success from logs alone.

The Console Ninja/Vite message identifies development tooling. Synthesized sound messages are expected for the generated default audio. `ExampleLevel` creation messages reflect initialization of level definitions and do not establish acceptance of legacy content.

## Acceptance evidence

| Gate | Evidence | Status |
| --- | --- | --- |
| Menu, start, pause/resume, death/reboot, exit/replay without game errors | Production browser flow, session tests, owner Chrome playthrough and overall sign-off | Accepted |
| Local yaw/pitch/roll, inverted thrust, doorway traversal in both directions | Explicit real-controller/geometry tests, including equivalent 30/60/120 FPS; owner signs off overall flight behavior | Accepted on combined evidence |
| Solid boundaries, sliding, blocked shots and single damage ownership | Arena/combat regressions and overall owner playthrough sign-off | Accepted |
| Exit/death happens once; no cleanup kills; equivalent resets | Manager/simulation tests, production win/loss/reboot, ten-restart browser fixture; owner reports default reset | Accepted |
| Pause freezes projectiles, buffs, cooldowns and callbacks | Session/flight/combat tests, production pause checks; owner confirms gameplay stops until Continue | Accepted |
| Captured mouse aiming and recovery after pause | Owner reports instant recapture in Chrome; supplied log shows repeated active/inactive transitions; refusal/loss handling has regression coverage | Passed in owner playthrough |
| Handling and objective/pickup readability | Owner reports the tested slice works and signs off; no handling/readability issue reported | Accepted by owner |

At sign-off, the latest local verification has **112 unit/simulation/metrics tests**, **17 negative compile-time examples**, scoped lint/type checks, **six browser checks**, and a passing production build. See the [audio settings checkpoint](progress/M2_AUDIO_SETTINGS.md) for that run and its browser evidence. These checks were completed before the owner acceptance; no runtime changes or new test run were needed to record this documentation-only sign-off.

## Scope and remaining milestones

Acceptance covers the small finite test slice, not the legacy levels, endless mode, a finished campaign or the future designer. M2 remains open for broader source contracts/cleanup, hosted CI and performance acceptance. The last [hardware profiling](progress/M2_PERFORMANCE.md) result was approximately 18 ms frame p95 against the provisional 16.7 ms target. The Chrome playthrough did not include a new timing measurement or change that M2 gate.

## Repeatable regression playthrough

Keep this procedure for future changes. It is not an outstanding M1 sign-off request.

Use the pinned toolchain in [TOOLCHAIN.md](TOOLCHAIN.md), run `npm run dev`, and open the displayed URL in a regular Chrome, Edge or Firefox window.

1. Open Settings and choose a comfortable mouse sensitivity/invert-Y preference. Start quiet Flight Arena. Click to capture; confirm acquisition does not shoot. Aim, roll until inverted, thrust vertically, turn around and return through the doorway. Slide against a wall and move away again.
2. Release capture, change tabs and return. Confirm one pause transition, no background flight and Continue preserving position. Recapture and confirm mouse aim responds normally.
3. Select Arena Escape. Confirm pulse aim/fire with captured left clicks, both drones can be shot, the exit stays locked until neutralization and entering the green ring completes once. Spend ammo before the orange refill and take damage before the green repair. Check guide/pickup readability.
4. Replay or Reboot, then confirm health 100, ammo 40, score 0, two drones and an amber exit. Verify there are no game console errors.

Record any future regression with browser/version, source revision, machine/GPU and resolution so it can be reproduced. See the [mission checkpoint](progress/M1_MISSION.md) and [control contract](CONTROL_AND_SESSION_CONTRACT.md) for implementation details.
