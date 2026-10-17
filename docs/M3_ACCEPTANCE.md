# M3 acceptance — connected authored mine

**Accepted by the project owner on October 16, 2026.** Deep Relay works and is playable. In a follow-up the owner explicitly confirmed activating both relays, reaching **MISSION COMPLETE**, and replaying with enemies, ammo and gates reset.

This closes M3's human completion/replay gate on top of the existing automated loader, traversal, combat and restart evidence. The owner did not provide a browser version, GPU, completion time or detailed balance measurements for this M3 run; none are inferred from the earlier M1 report.

| Gate | Evidence | Status |
| --- | --- | --- |
| Shared validated data, useful errors, immutable export/reload | v1/v2 document regressions and strict contracts | Accepted |
| Eight connected spaces, loop, vertical travel, optional cache | Deep Relay document; real thrust/collision through all eight connections in both directions | Accepted |
| Required relay progression, enemy defeats and extraction | Objective/door/AI regressions; owner confirms both relays and mission completion | Accepted |
| Ordinary combat, supplies and playable route | Pulse/projectile encounter simulations; owner reports the level is playable and completes it | Accepted; further tuning remains possible |
| Exactly one completion and clean replay | Objective tests, ten-restart ownership checks, local browser evidence; owner confirms replay resets enemies/ammo/gates | Accepted |

The [mission checkpoint](progress/M3_DEEP_RELAY.md) and [playtest route](DEEP_RELAY_PLAYTEST.md) describe the content and evidence. The original eleven-case local CPU-throttled browser pass is preserved, but the owner's later hosted logs expose test timing problems. **Hosted CI remains failing/unaccepted under M2** until a fresh workflow verifies the harness repairs. M2's Intel GPU frame-time target also remains open. M3 acceptance does not erase those separate gates.

## Next feature milestone

M4 is a minimal local level designer using the existing v2 document and compiler:

1. Create a new document and place, select, move, resize and delete snapped box rooms/corridors.
2. Connect compatible ports and display validation errors before playtesting.
3. Place player spawn, enemies, supplies, exit, relays and linked doors using stable IDs.
4. Play the draft through the existing loader, return to editing, export JSON, reload it and prove the authored intent survives.

Start with room assembly and a saved-document round trip. Defer arbitrary geometry, scripting and a large asset library. The existing primitive visuals and text guidance can be refined independently after a usable author/play/export loop exists.
