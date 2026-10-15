# M1 checkpoint: startup foundation

Date: October 14, 2026. Started from documentation baseline `91602aa`; game audit baseline remains `7e70489`. This checkpoint begins [M1 in the roadmap](../ROADMAP.md). It does **not** complete M1 or establish a reliably completable game.

## Delivered

- Wrote the [control/session contract](../CONTROL_AND_SESSION_CONTRACT.md), including the intended stationary world, authoritative player transform, local quaternion flight, and target session transitions. The movement/state-machine changes are still pending.
- Added the missing custom-buffer registration API and immediate synthesized default audio. Removed the absent placeholder-file requests and startup playback delay. Unsupported devices, initialization failures, and sound setup failures no longer strand startup. Repeated starts keep one engine/music loop.
- Fixed the per-frame `powerUps`/`powerups` exception and the `powerupType` authoring mismatch. Unknown pickup types now report a useful error.
- Wired every recreated start screen, including mission-selection -> main-menu -> start, and reset the selected mode when choosing Start Endless Mode.
- Corrected enemy projectile constructor dependencies and game-over fading of playing source handles. These are adjacent startup/death integration fixes; broader combat/reset work remains.
- Handled unsupported, throwing, and rejected pointer-lock requests; suppressed firing/mouse-look/movement while paused; cleared held keys on blur/unlock/start. Automatic pause on focus/unlock and full session transitions remain pending.
- Made initialization failure reject correctly. Restricted global Three.js debug patches to development. Added an opt-in development smoke status/error overlay without exposing mutable game internals on `window`.
- Added 21 assertion-based Node tests, including authored/endless update fixtures that verify a shot advances over 20 actual game updates while a pickup is present.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | 21 tests pass; no additional test dependencies |
| `npm run build` | Passes; existing >500 kB bundle warning remains |
| Development menu -> mission selection -> back -> endless start | Works; start action remains connected |
| Development endless mode | Recorded 1,427 completed updates, zero captured runtime errors |
| Development Level 1 | Recorded 4,995 completed updates, zero captured runtime errors |
| Pause -> Continue | Updates held at 931 while frames advanced from 2,425 to 3,076; updates resumed on Continue |
| Production preview | Starts without captured errors; development overlay absent |

Browser evidence: [saved results](startup-browser-check.json), [endless screenshot](startup-endless.jpg), [authored-level screenshot](startup-authored.jpg). The embedded browser refused native mouse capture. That refusal was handled without an uncaught exception; actual captured mouse aiming and a full combat/mission-completion run are **not** verified.

The sandbox blocked Vite's filesystem resolution/dependency scan. Build and browser servers were verified outside the sandbox after approval. Node tests run within the sandbox. No dependencies were upgraded and no hosted build was published.

The prior [audit results](../audit/probe-results.json) are preserved as historical evidence. `docs/audit/reproduce.mjs` probes the old baseline and is not the current regression suite; several defects it describes are now fixed. Use `npm test` for the current expected behavior.

## Repeating the browser smoke check

```powershell
npm test
npm run build
npm run smoke
```

Open `http://127.0.0.1:5183/?smoke=1`. Verify MENU, zero updates before starting, rising updates after Start, and no caught errors. Exercise mission selection -> back -> start. Pause and confirm updates stop while frames continue; Continue must resume them. Reload, select Level 1, and verify updates advance there as well. Inspect the browser console; missing placeholder audio requests and the two original startup exceptions should be absent.

For production, use `npm run preview`, open its printed address, and exercise both start routes. The development overlay should not appear. Stop local servers when finished. The smoke server deliberately binds only to loopback and fails if port 5183 is already in use.

## Remaining work, in order

1. **Centralize the session lifecycle.** One start/end/reset path, immutable spawn definitions, cleanup without combat side effects, completion latch, simulation-owned timers, and focus/pointer-lock pause/resume. Current restarts are still incomplete and gameplay callbacks can outlive sessions.
2. **Replace movement ownership.** Move an authoritative player root through a stationary world, preserve camera aim, implement actual roll and local thrust, and time-scale damping/motion. The visible ship/camera behavior remains the legacy implementation.
3. **Build the finite graybox mission.** Correct straight geometry/colliders, disable streaming for this fixture, implement solid-wall/projectile collision, and add an explicit objective/exit. The old authored maps still contain geometry, placement, connectivity, and progression defects.
4. **Close and test the full M1 gate.** Damage/combat, pickups, death/restart, exactly-once completion, repeated-session invariants, and frame-rate independence.

Do not treat either the successful bundle or zero-error startup as proof that flight, the existing maps, or campaign progression are fixed.
