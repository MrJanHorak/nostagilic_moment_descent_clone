# Deepworks combat stalls — October 21, 2026

The reported slideshow during shooting and enemy encounters reproduced on the local Intel UHD Graphics GPU. The cause was variable point-light counts: player shots, impacts and explosions added lights; every robot retained a fill light even with accent lighting disabled; pickups each contributed a light too. Deepworks started with 26 scene lights. Hidden-room lights still affect the lighting setup even when portal visibility skips the room's static meshes.

In the installed Three.js 0.176 renderer, `WebGLPrograms.js` includes `parameters.numPointLights` in the program cache key. Changing that count selects new variants for lit materials. The larger mine's new standard materials, panel relief and many decorative lights made the existing per-shot behavior much more expensive. This is supported by shader-program growth and the before/after measurements below; it is not a GPU trace assigning every millisecond to compilation.

Finite arena missions now use environment/ship lighting with emissive bullets, trails, robot eyes/engines and pickup cores/rings. Hit particles and expanding explosion meshes remain. Per-object illumination is disabled for shots, effects, robots and pickups in these missions. This deliberately removes their light spill on surrounding surfaces; room materials, headlights, geometry, combat rules, enemy AI and portal visibility remain intact. Legacy/endless modes retain their previous lighting policy, restored on session transitions.

## Hardware comparison

Same machine, headless Chromium, ANGLE Intel UHD Graphics `0x00009A60`, D3D11, 1280×720, cockpit view. One capture per scenario before and after; frame intervals measured with real `requestAnimationFrame`, without clock mocking, tracing, pre-fired shots or guard neutralization.

| Scenario | Before p95 / worst frame | After p95 / worst frame | Frames over 100 ms, before → after |
| --- | --- | --- | --- |
| Idle at authored spawn | 49.9 / 66.7 ms | 16.8 / 33.4 ms | 0 → 0 |
| Twenty shots at authored spawn | 49.9 / 966.7 ms | 16.7 / 16.8 ms | 8 → 0 |
| Pump fighter encounter and twenty shots | 33.4 / 533.4 ms | 16.8 / 50.0 ms | 1 → 0 |

Firing previously grew compiled programs from 15 to 40, versus 15 to 16 after the fix. The encounter previously grew 15 to 26, versus 14 to 17 afterward. A few programs are still expected when new effect materials first appear. Scene lights now remain nine throughout both sequences, including the guard's destruction. Both captures defeated the pump fighter (seven enemies down to six).

The encounter uses the ordinary editor JSON import/playtest workflow with only the player spawn moved into Coolant Pumps, facing its authored fighter. All enemies, rooms, doors, controls and objectives are retained. The idle/firing scenarios use the unchanged Mission Select level. These are focused local regression measurements, not acceptance of every route, browser or GPU; M2's broader hardware acceptance remains open. Earlier functional walkthroughs verified routing/objectives, but did not measure real-time combat stalls.

Raw evidence: [before](progress/deepworks-combat-before.json), [after](progress/deepworks-combat-after.json).

## Reproduce and verify

Run `npm run profile:deepworks -- --renderer=hardware --output=test-results/deepworks-profile.json`. The script launches a separate Vite server on port 5185, checks the actual renderer and rejects software fallback. It records frame intervals, shader programs, light counts, enemies and projectiles. On Windows its hardware selection uses D3D11. `--renderer=software` is available for functional investigation and does not establish hardware performance. Keep runtime source unchanged during a capture to avoid HMR contaminating the result.

`npm run verify` passes scoped lint, strict types, **466 unit/simulation tests** and the production build. New coverage exercises twenty actual player shots, impact particles, robot destruction, pickup removal, restart and finite/endless lighting transitions. Existing default-light policy and effect cleanup checks remain covered. Vite's existing large-chunk advisory remains unrelated to the combat stalls.

Five selected production browser checks also passed with software rendering: native combat victory/replay/enemy-fire death/reboot; cockpit firing/map/view persistence; cockpit enemy shield damage/restart; editor reactor destruction/countdown/pause/restart/escape; and force-field shooting/collision/relay disabling/extraction. The reactor cockpit screenshot was inspected for retained core glow, readable instruments and room/ship visibility. These functional checks are separate from the real-time hardware captures above.
