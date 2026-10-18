# Hosted CI follow-up: independent browser jobs and immediate failure evidence

October 17, 2026. The owner supplied the complete Ubuntu log and a Windows success screenshot for [run 38993829244](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38993829244), testing `5bb8004`.

## Evidence from the new run

- Windows passed the complete verification job in 13m19s; its browser step took 9m50s.
- Ubuntu passed JSON mission reset, Deep Relay startup, mine traversal, relay traversal, restart resource checks and the first settings case. The three original timing failures therefore did not recur in this run.
- Ubuntu's production combat case failed after about 1.2 minutes. The owner subsequently supplied its separate `error-context.md`: `Controlled browser clock did not reach the expected state`, with health `0%`, score `0`, ammo `35` and enemies `0/2`, plus the SYSTEM FAILURE screen. This identifies the opening fighter-defeat wait: five shots were consumed, but the fighter was not defeated before the player died. Advancing more clock ticks cannot satisfy that expectation after death. The context does not establish why those shots failed to finish the fighter.
- Ubuntu's Deep Relay traversal failed after 8.1 minutes. The owner subsequently supplied its `error-context.md`, confirming `Test timeout of 480000ms exceeded` during `keyboard.down`. The last observation is still playing at 120.1 simulation seconds / 7,206 steps, position `[16.05415, 15.78958, -7.60267]` and speed 1.679. The page shows Green Upper Lift, one of two relays activated and zero reported runtime errors. This confirms the overall test deadline expired during active flight; it does not establish a keyboard mapping, blocked hatch or objective assertion failure. Whether twelve minutes is sufficient on Ubuntu still needs hosted verification.
- The overall twenty-minute job limit interrupted the suite, leaving the last three audio/storage cases without results and preventing the final reporter summary. Ubuntu uploaded five artifact files. Both error contexts have now been supplied and identify the failure stages. A production trace from the [artifact ZIP](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38993829244/artifacts/12086399029) could further establish the input sequence, but mouse/pointer capture interference is currently a hypothesis rather than a proven cause.

The earlier [controlled-clock repair](M2_CI_CONTROLLED_CLOCK.md) remains in place. M1 and M3 acceptance remain complete. Windows hosted verification is now confirmed by the owner's screenshot; Ubuntu hosted verification and M2 hardware performance remain open.

## Changes

Contracts, runtime tests, build and dependency audit remain a two-OS verification matrix. After that succeeds, each OS runs three independent browser jobs:

| Browser project | Cases |
| --- | --- |
| production | Seven production cases plus the real-time restart-resource case |
| prototypes | Mine loop/hatch and relay-gate traversal |
| deep-relay | Complete Deep Relay keyboard route and replay |

Each browser job retains one worker and zero retries. A long traversal cannot consume the other groups' time budget. All eleven cases still run once per OS; running Playwright locally without a project filter still runs all eleven.

Playwright's list reporter now prints failure details immediately. A failure hook prints and attaches read-only HUD, guide and flight/diagnostic attributes before teardown. Axis steering uses named test steps, and combat waits have specific failure messages. These changes preserve useful evidence if the overall suite is later interrupted.

The production keyboard route now uses Enter for the native mission, Continue, replay, reboot and pause-menu buttons, avoiding cursor repositioning around pointer capture/recapture. The two legacy main-menu div controls still use clicks before capture; they do not implement Enter activation. Other test flows retain their existing activation method. A read-only native mouse-event probe records unexpected aiming motion during opening setup. The opening combat/exit waits read HUD state and immediately report an unexpected death, instead of continuing for 1,500 ticks in a terminal session. The expected enemy-fire death after replay still uses its original death condition.

The old click-based flow did not reproduce the Ubuntu failure in a focused local run, and its local input probe recorded no aiming motion. Keyboard activation removes a possible interference source without changing gameplay, but is not proof of the original Ubuntu cause.

Deep Relay's test deadline increases from eight to twelve minutes. Every hosted browser invocation has a fifteen-minute global Playwright deadline inside the twenty-minute job limit, leaving time for teardown, final reports and uniquely named per-project artifact uploads. The timeout increase is headroom for the observed slow runner, not evidence that either Ubuntu failure is solved.

Runtime source, physics, missions, dependencies and the production bundle are unchanged. Fresh hosted Ubuntu verification is still required after these changes are pushed.

## Local verification

`npm run verify` passes lint, strict type checks, all 260 runtime tests and the production build on Node 22.14.0 / npm 11.2.0, which satisfy the declared engine ranges. CI continues to use its pinned Node/npm versions. The existing bundle-size warning remains.

Before these changes, both newly failing browser cases passed a focused local Windows run under fourfold Chromium CPU throttling, in 2.8 minutes total. This does not reproduce or explain Ubuntu's production assertion failure.

All eleven browser cases then passed locally under fourfold Chromium CPU throttling in **6.0 minutes**, with zero browser errors, skips or retries. [The evidence](ci-job-isolation-browser-check.json) preserves per-project timings, environment, errors and the held-input clock probe. Deep Relay took 2.1 minutes locally. The production group contains eight cases, prototypes two and Deep Relay one; the final project filters were also checked with `playwright test --list` and still select each case exactly once. The production group's exclusion filter also ensures future tests default to running rather than being silently omitted.

The workflow YAML parses successfully, browser test syntax checks pass and `git diff --check` is clean. This is local verification of the harness/job changes, not a fresh hosted Ubuntu result. No commit or push was made.

After the production error context arrived, the keyboard activation and early-death follow-up passed **three consecutive production combat runs under fourfold CPU throttling**, in 1.5 minutes total. Every repetition completed victory, replay, actual enemy-fire death, reboot and menu return, with zero browser errors and no observed opening mouse-aim motion. [Focused evidence](ci-keyboard-combat-browser-check.json) preserves all three results and native-input observations. The earlier eleven-case report predates this focused follow-up; the other ten cases and runtime source were not changed by it. No fresh Ubuntu run has been triggered, so hosted success remains unconfirmed.
