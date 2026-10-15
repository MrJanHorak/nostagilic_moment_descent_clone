# M2 hardware profiling and arena lighting checkpoint

Implemented October 15, 2026, following the [browser/resource checkpoint](M2_BROWSER.md).

## What changed

Added `npm run profile:arena`: a local, untraced benchmark with an eight-second warm-up followed by a separate ten-second active-play capture, repeated three times. It starts and stops its own development server on port 5185. Each run opens a fresh page at the authored Arena Escape spawn, leaves normal AI/fire active, and supplies no player movement or firing during warm-up/capture. Scene rebuilds, screenshots and navigation stay outside the sample. Enemy fire timing retains its normal variation; runs are comparable scenarios, not identical replays.

The development smoke controls now include **Profile 10 seconds (test)**. Captures have their own bounded timing history, independent of the rolling diagnostics window. Pausing, death, completion or session replacement invalidates the sample. Pause/end hooks cancel immediately, including a pause/resume between rendered frames. The JSON snapshot holds the completed result, including elapsed time, sample count, simulation-time progress, timing percentiles and start/end resources. Sampling remains disabled in production.

Finite arenas now retain one main point light per enemy and omit the model builders' extra engine, antenna and eye lights. Emissive meshes, materials, geometry, camera/arena lighting and pickup lights remain. The normal scene drops from **14 to 9 lights**; enemy lights drop from seven to two. Legacy/default factory construction retains its existing lighting. Tests verify unchanged mesh counts, colliders and body clearance.

## Hardware measurement

Reference configuration: Intel i7-11800H CPU, **Intel UHD Graphics through ANGLE Direct3D 11**, driver 31.0.101.1999, Windows, Chromium headless shell 156.0.8078.4, Node 24.22.0/npm 11.21.1, 1280 x 720. The machine also reports an NVIDIA RTX 3050 Laptop GPU, but that adapter was not used or measured.

Default browser selection initially fell back to SwiftShader. Explicitly selecting Direct3D 11 produced the Intel renderer reported above. Hardware mode reads the actual WebGL renderer and rejects recognized software fallbacks rather than calling them GPU evidence. This uses ANGLE's documented [backend selection](https://chromium.googlesource.com/angle/angle/+/HEAD/doc/DebuggingTips.md).

| Measurement | Before | After |
| --- | --- | --- |
| Normal scene lights | 14 | 9 |
| Frame p50, three runs (ms) | 16.6 / 16.7 / 16.6 | 16.7 / 16.6 / 16.6 |
| Frame p95, three runs (ms) | 18.1 / 18.1 / 17.9 | 17.9 / 17.9 / 18.0 |
| Work p95, three runs (ms) | 0.8 / 0.9 / 0.8 | 0.8 / 0.9 / 0.9 |
| Measured frame intervals per run | 600 | 600 |

**The lower light count is verified. A meaningful frame-rate improvement is not established.** Median frame p95 changed by only 0.2 ms, while typical frame pacing stayed near 60 FPS and CPU submission work stayed below 1 ms. This is too small and variable a difference to attribute confidently to lighting. Do not describe this as a measured FPS boost.

The provisional **p95 <=16.7 ms** target remains unmet in this fixture. Frame intervals include browser/display scheduling; CPU work measures simulation plus renderer submission, not GPU completion time. This is one short, stationary-player encounter on one integrated GPU in headless mode. It does not establish frame budgets for exploration, the NVIDIA adapter, a larger mine, sustained play, or headed interactive use. No GPU timer-query measurement was added.

Evidence: [before](arena-profile-before.json), [after](arena-profile-after.json), [comparison and reference configuration](arena-profile-comparison.json). The [after-capture view](arena-profile-after.png) confirms that the fighter, pickup and doorway remain readable in this pose. Screenshots are live encounters with different damage/projectile states; the baseline screenshot includes a damage flash and is not a color-matched visual comparison.

## Verification

**98 unit/simulation/metrics tests pass**, including finite capture isolation, latching, cancellation, sample limits and model/collider preservation. The production build passes; its existing bundle warning remains (about 649 kB minified / 164 kB gzip). No dependencies changed in this checkpoint.

Both existing browser regressions pass after the change: normal production keyboard victory/replay/enemy-fire death/reboot/menu flow, and ten combat restarts after warm-up. No page, console or asset-request errors were recorded. Fresh-session renderer/scene counts remain bounded; the new lighting baseline has nine lights and 72 scene objects, with the same 41 geometries and 34 materials. See [updated browser/restart evidence](arena-profile-browser-check.json). `git diff --check` passes.

## Run it again

Select the [pinned toolchain](../TOOLCHAIN.md), install dependencies and Chromium, then:

```sh
npm run profile:arena
npm run profile:arena -- --runs=1 --scenario=flight
npm run profile:arena -- --renderer=software --output=test-results/software-profile.json
```

Default output is `test-results/arena-profile.json` plus a screenshot. `--runs=1..5`, `--scenario=combat|flight`, `--renderer=hardware|software` and `--output=path.json` are supported. The flight scenario is quiet practice with the player stationary; it does not drive a flight route. Hardware mode selects Direct3D 11 on Windows and default graphics elsewhere, records the actual renderer, and exits unsuccessfully if a known software fallback is detected. Software runs are explicitly labeled. Keep port 5185 free and avoid background load while comparing samples.

For a manual flight capture, run `npm run smoke`, start a session, allow it to warm, and activate the labeled profile button before flying. The completed finite capture is in the panel's `data-snapshot.profile`; the displayed rolling frame statistics continue to update independently. Pause aborts the capture. The script writes failed/aborted runs with a reason and exits unsuccessfully; it always closes its browser and server after starting them.

## Remaining milestones

M1's [hands-on mouse, inverted return flight and handling/readability acceptance](../M1_ACCEPTANCE.md) is still open. M2 now has real hardware baseline evidence and a lower arena light count, but the performance gate and hosted CI run remain unverified/unmet. Do not tune a threshold merely to label this passed.

Next: sensitivity/invert-Y and saved local settings to support M1 playtesting, focused lint/type contracts, and longer headed hardware profiling when assessing larger content. M3 can then establish shared validated level JSON and room/portal geometry before editor UI work.
