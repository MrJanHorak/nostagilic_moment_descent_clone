# Asterion Deepworks and destructible reactors

Choose **Asterion Deepworks** in Mission Select. In the designer, **Open Deepworks** loads the same editable mission; Export JSON saves a portable copy. The reproducible authoring script is `scripts/build-showcase.mjs`, and gameplay loads `asterion-deepworks.v12.json` through the shared validator/compiler.

The mine has **48 spaces, 56 passages and nine independent loops**. The 48 spaces include rooms, corridors and shafts. Its central concourse has two separate northern lanes on the same wall, east/west freight routes, a southern extraction route, an overhead observation circuit and a lower coolant circuit. Three hidden stores branch off the main routes. A rising ramp and diagonal passage lead to an optional heavy-robot testing wing.

All currently authorable element families appear: all five robot types; health and pulse ammunition; three material presets; plain, grid, panel, hazard, lava and water surfaces; straight, vertical, pitched, rolled, sloped and diagonal spaces; open passages; marked shot doors; concealed shot doors; relay sliding doors; a force field; relays; the destructible reactor and timed extraction. Water remains a solid surface treatment, not a flooded volume. Hazard stripes remain decorative; lava contact damages shields.

## Objectives and route

1. Restore **Freight field power** in western Power Control. This disables the eastern entry field.
2. Restore **Reactor coolant bypass** in the northwestern Coolant Pumps, and **Reactor safety interlock** in southeastern Security Control. They open the two approaches to the reactor vault.
3. Clear the transfer scout, pump fighter and vault fighter. Other robot kills are optional, including the boss in the testing wing.
4. Shoot the orange **Primary reactor** in the northern vault. Its 150 integrity takes fifteen normal campaign pulse hits. Its protective interlock remains active until the other required objectives are complete.
5. Destruction starts **120 seconds** to reach the southern **Extraction Quay**. Return through either north lane, or use the newly opened ceiling hatch and overhead return. The full ship must enter the green ring.

Starting ammunition can defeat every authored robot and the reactor; distributed ammunition and repairs reward exploration. That is a budget check, not a claim that encounter difficulty has been balanced for every player. The optional heavy wing is intentionally more dangerous.

<details><summary>Hidden stores and alternate routes — spoilers</summary>

- Inspect the western wall of Power Control for the repair access seam.
- Inspect the eastern wall of the Lava Foundry for ammunition access.
- Past the rising smelter ramp, follow the diagonal passage and inspect its far wall for the survey cache.
- The twin north lanes reconnect across North Cross Link. The western and eastern outer circuits return to the southern quay. Observation and the lower reservoir both reconnect to Freight Dock, creating routes at three elevations.

</details>

## Reactor authoring

Choose **Destructible reactor** under Add mission content, or right-click and **Place reactor here**. Select the object and edit **Reactor integrity** in the Content inspector (10–1000, integer). Reactors are required system objectives. Their orange core and structural cage are physical shot targets; R and enemy fire cannot destroy them. Player impacts use the same swept collision as doors and robots, and the reactor consumes the shot.

Open **Reactor escape…** and select the reactor under **Countdown objective**, then choose a 10–600 second duration. The clock begins on the destruction shot, once only. You can also use the reactor as a door/field control: its destruction unlocks linked passages. This reuses objective IDs and existing gate references; it does not synthesize an R activation. A reactor without an escape link is still a destruction objective, with no timer.

Interlocked reactors absorb shots without losing integrity until required guards and other controls are complete. The cockpit shows integrity and system progress. Pause freezes simulation/countdown, expiry causes meltdown, and restart reconstructs the intact core, gates and unarmed clock. Robot kill credit is separate; destroying the core is not a drone kill. Version 12 adds reactor `kind` and `health` to device records; older documents keep their behavior and reject these fields.

## Multiple connections on one wall

The v7+ format and runtime already support up to eight non-overlapping openings per wall. The older centered Attach/Connect model APIs were the gap. Attach now searches for another clear position when the selected face is already used. Connect can match offset overlapping wall areas. Both reject overlaps without changing the document or undo history.

For precise placement, right-click a free wall area and **Attach corridor at this point**. For rooms already touching, use **Connect to existing room…**, **Keep positions / close loop**, and choose a doorway or full shared opening. A connection creates an open physical passage; add a door only if a gate is wanted. Distinct openings can each have their own controls. Corridors need space outside the room as well as room for an opening on its wall.

## Appearance and visibility

Panel materials now have bolts, seams, deterministic surface grain, metallic response and subtle bump relief. Recessed ceiling fixtures provide visible construction depth and luminous strips without adding a dynamic light to every room. Existing headlights provide directional illumination. This is an incremental procedural art pass, not a complete lighting/art replacement; shadows, baked indirect light, localized grime/decals and authored machinery remain useful later work.

Descent traversed connected segments and built portal viewing windows rather than treating every mine surface as equally visible; its [released renderer source](https://github.com/videogamepreservation/descent/blob/master/MAIN/RENDER.C) contains the segment render-list and window logic. Previously this project kept the finite mine resident and relied on ordinary Three.js object frustum culling. It now additionally computes conservative room visibility through projected opening windows, starting at the actual camera room.

The new pass skips hidden-room static meshes, fixtures, doors, fields, relays, cores and exit markers using render layers. Multiple paths widen a room's window, near-plane crossings retain neighboring rooms, and an outside camera or traversal-budget overflow renders all rooms as a safe fallback. Transparent fields and partially opening doors are deliberately not treated as opaque portal blockers. The pass can overdraw; it is not pixel-precise portal clipping or a copy of Descent's software renderer.

Geometry and collision stay loaded. AI, dynamic robots, projectiles and effects continue their existing simulation/render behavior, and discovery still depends on entering a room. Rendering fewer static rooms does not unload enemies, reset their health or reveal unexplored map areas. Development diagnostics expose visible/total rooms and skipped static meshes. Software-rendered checks establish behavior, not a hardware FPS claim.

## Verification

Unit/simulation checks cover reactor damage and interlocks, old-version rejection, editing/history, physical shot/body collision, exact countdown lifecycle, same-wall attachments/connections, portals around bends and loops, camera crossings, outside fallback, all 112 approaches to the showcase's 56 portals, and physical traversal of all campaign passages after unlocking. Browser evidence and reviewed images are listed in `progress/deepworks-browser-check.json`.
