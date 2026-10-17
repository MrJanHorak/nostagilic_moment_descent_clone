# Current handoff — October 16, 2026

The owner pushed the CI reliability repairs and started another GitHub workflow run. Its hosted Ubuntu/Windows result remains pending. Do not infer hosted acceptance from a local pass. M1 is accepted and complete; M2 hardware performance still needs improvement/acceptance (last Intel GPU p95 about 18 ms versus provisional 16.7 ms).

## New M3 checkpoint

[Deep Relay](M3_DEEP_RELAY.md) is the new eight-room authored mission at catalog index 8, after both unchanged prototype indices. Its canonical source is `src/js/core/levels/documents/deep-relay.v2.json`; the tiny factory uses the existing validator/compiler. No format version, dependency or lockfile changed.

The four-room lower loop leads to a rotated narrow supply cache and a relay-controlled ceiling hatch. A taller upper deck contains the second relay and the gated extraction chamber. Three fighters and two scouts require 95 total damage / nineteen successful pulse hits. Starting ammo is seventy, with two twenty-round pickups (capacity 100) and two twenty-five-point repairs. The starting position is shielded from direct sight; ten seconds of idle simulation preserves full health. Both relays and all five defeats are mandatory. Five shot defeats plus extraction produce 1,400 points once.

The checked `MineGuide.js` builds room/route hints from the validated graph for every JSON mission. Room names come from descriptive stable IDs plus material colors; ceiling/floor hatches are explicit. It selects a reachable inactive relay by breadth-first room distance, excludes closed connections and points to extraction after relay activation. UI creates the guide once per immutable source document and discards it on session cleanup.

## Verification

Pinned Node 24.22.0 / npm 11.21.1 passes lint, strict checks, all 260 runtime cases and build. Strict scope is 38 runtime modules / 108 negative compiler examples. Bundle: `/assets/index-DiRlekEi.js`, 699.27 kB / 178.92 kB gzip, 63 build modules. The existing >500 kB bundle warning remains. UIManager and LevelManager are still outside the fully checked scope; the two new runtime modules are included.

Six new runtime tests cover document round trips/budget, quiet spawn, graph guidance, reversed relay authoring order, actual thrust through every connection in both directions and chained completion/ten restarts, plus ordinary pulse combat at fixed encounter positions. Flight tests neutralize drones first; combat tests position/aim the player at encounters. These are complementary system proofs, not a claim of a complete human combat playthrough.

Two browser cases were added: production selection/guidance/inventory restart, and development keyboard flight through the lower loop/cache/gates/exit/replay. All eleven cases pass in one complete local Windows run with fourfold Chromium CPU throttling, zero browser errors and no retries. Total duration was 10.3 minutes; Deep Relay traversal took 3.8 minutes. [Evidence](deep-relay-browser-check.json) preserves every test result, traversal observations and twelve restart resource samples. Production spawn and development upper-lift screenshots were visually inspected and saved beside that report. At 540px height the development-only diagnostics partly overlap the guide footer; tidy the tooling layout later. Production layout is readable.

## Next gate

Use [the human playtest checklist](../DEEP_RELAY_PLAYTEST.md) for navigation, pacing, combat fairness and replay. Record trouble spots and tune this mission before calling M3 complete. Visuals remain basic shells, and hints are text rather than an automap. M4 designer UI has not started; its first workflow should create/play/export/reload these same validated documents.

No commit or push is authorized by this turn. Preserve prior CI evidence and historical checkpoint reports. A successful pending hosted run applies to the previously pushed reliability checkpoint; this new mission needs a later push/run too. No hardware profile or fresh dependency audit was run for this source/content checkpoint.

Do not edit runtime JS or rebuild while Playwright owns its servers. Its functional viewport is 960x540 with ANGLE SwiftShader; hardware profiling remains 1280x720. The completed run released its owned servers and the temporary CPU-stress environment file was removed. Preserve untouched bytes when updating older mixed-encoding documents.
