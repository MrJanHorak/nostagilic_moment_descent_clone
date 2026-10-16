# Current handoff — October 16, 2026

The owner supplied failures from hosted [run 38932266372](https://github.com/MrJanHorak/nostagilic_moment_descent_clone/actions/runs/38932266372): Ubuntu had three failures; Windows reported four and was canceled with five tests unrun. The previous relay implementation had passed locally and was subsequently committed/pushed by the owner (`3c865f9`). Do not present the old local browser reports as hosted acceptance.

## Current repair checkpoint

[CI reliability repairs](M2_CI_RELIABILITY.md) replace 75 ms wall-clock steering with read-only per-render position/velocity and simulation-time input. Metrics distinguish live geometry ownership from lazy GPU uploads. Resource tests use rendered/settled snapshots, two warm-ups and ten measurements, exact CPU ownership counts, a fixed six-program arena bound and a bounded GPU allocation/plateau check. Functional browser resolution is 960x540; hardware profiling stays at its named 1280x720 reference size. Retries remain zero. CI has twenty minutes for setup plus the expanded suite.

Pinned Node 24.22.0 / npm 11.21.1 passes lint, strict checks, 254 runtime cases and build. Node 22.14.0 / npm 11.2.0 passes lint/type checks and all 254 cases. Static scope remains 36 runtime modules / 108 negative compiler examples; diagnostics/metrics themselves are still outside the full checked scope. The production bundle is `/assets/index-B8DRX1je.js`, 693.97 kB / 177.63 kB gzip.

Eight new simulations cover real ship movement at 4/10/30/60 FPS with delayed observations. Two metrics tests cover per-render feedback and geometry-cache deduplication. The initial local browser run passed eight cases and caught a five-versus-six shader baseline assumption; its measurements are preserved in `ci-reliability-initial-check.json`. The final complete run passed all nine browser checks under fourfold Chromium CPU throttling, with zero browser errors. Evidence and twelve settled restart samples are saved in [ci-reliability-browser-check.json](ci-reliability-browser-check.json). The run took about 5.2 minutes locally; hosted Ubuntu/Windows acceptance still requires a new successful workflow run.

## Next gate and content work

Push these repair changes and rerun Ubuntu/Windows CI before marking the hosted gate complete. No commit/push was made by this repair turn. If a hosted failure persists, use its preserved resource attachment, trace/error context and last-flight observation. The pasted Windows excerpt does not identify the cancellation reason or prove a game crash.

Once this reliability checkpoint is verified, the next implementation step is the six-to-ten-room M3 mission using the shared v1/v2 documents: readable landmarks, a loop, vertical travel, manageable encounters, a relay sequence and sufficient pickups. M1 remains accepted. M3 still needs that authored mission and human playtesting; M4 designer UI has not started.

M2 hardware performance acceptance is separate and still open: the last Intel GPU p95 was about 18 ms against the provisional 16.7 ms target. Software-rendered browser timings are not that benchmark. Dependencies/lockfile and flight physics were unchanged; no new audit or hardware profile was run for this source-only repair.

Do not edit runtime JS or rebuild while Playwright owns its servers. Preserve untouched bytes when updating older mixed-encoding documents. The temporary CPU-throttle environment file was removed and the owned test servers were stopped.
