# Editor and player experience follow-up

October 19, 2026. The owner confirmed the editor works and authored levels are playable, closing [M4 functional acceptance](M4_ACCEPTANCE.md). This pass addresses presentation and new content.

## Editor workflow

The editor opens with the viewport and selection inspector. **Build tools** opens the optional prefab/numeric placement palette; **Scene browser** opens the optional searchable room/item list. They can be opened together for detailed authoring, or closed to recover canvas space. The scene browser is useful for hidden/overlapping objects and large maps, but direct wall/item selection remains the main workflow. Search matches room IDs, item kinds, relay IDs and containing rooms. F focuses the selection. Right-click or Shift+F10 opens its actions. Panel/search state stays outside the saved level and Undo history.

The mine name and save status remain visible above the workspace. Draft/format details are behind **Save details**. **Open example** now loads Signal Breach, which uses the same v7 document as the campaign.

Reviewed screenshots: [default editor](progress/canvas-first-editor.png), [external ship view](progress/external-ship-view.png), [mission library](progress/new-mission-library.png).

Useful further editor work includes top/front/side camera presets, selection isolation, multi-selection with safe connected transforms, clearer dimension/axis labels, and a short in-editor first-use walkthrough. Arbitrary vertex editing and custom texture import are still absent. These are separate follow-ups rather than prerequisites to authoring a playable mission.

## Ship presentation

- **C** cycles HUD / first-person, external chase and immersive cockpit views.
- **M** enlarges/closes the explored-volume map in any flight view. Flight remains active.
- **L** toggles the two ship headlights.
- **H** toggles flight HUD/reticle visibility. Mission objectives and the small shortcut/status legend remain visible.
- **Settings** exposes all three options and persists them with existing mouse/audio preferences. Old settings files acquire defaults; invalid values are ignored. Shortcuts are inactive in settings and outside active flight.

The external camera traces against the actual static/convex walls and closed doors and retracts before a surface. At very close range the external ship model hides to avoid filling the screen. The player transform, weapon origin, thrust/collision and ship-mounted headlights remain independent of camera placement. The external aiming marker projects the ship's forward wall-hit point.

October 20 follow-up: the third view adds a 3D canopy, perimeter ribs, console and three recessed instrument screens. Shields use the existing player-health value; the game does not have a second hull-health pool. Instruments show speed, a ship-relative 40-unit enemy scanner with height stems, selected weapon and all four inventory slots/ammo, plus a fixed isometric map of entered rooms. The cockpit renders in a separate depth pass so nearby walls cannot clip its frame. Screen textures refresh at 10 Hz; flight/rendering keep their existing cadence. H blanks screens and reticle but retains cabin geometry. Objectives move above the windshield. The existing first-person preference remains the default; all three views persist in Settings.

Discovery uses the existing validated room graph and transformed corners, including affine ramps and vertical/rotated rooms. It reveals only entered rooms and links between them, tracks current room and ship heading, and colors closed links amber. M expands the same map in all views. Visits reset with a new attempt, and no level format changes are required. Maps are available for campaign and authored/imported documents; legacy practice fixtures without a source document show no survey. Radar is range-based and can detect enemies through walls. Map pan/orbit/zoom, destination selection and persistent exploration across attempts are future work.

Cockpit verification: lint (65 modules), strict types, all 391 unit/simulation cases, production build and diff checks pass. Seven targeted browser cases passed together: view/settings persistence, cockpit instruments/fire/map, all three campaign flight/relay/extraction/replay routes, ten restart resource cycles, and settings at desktop/small viewport sizes. The final map DOM/layout cleanup was followed by passing cockpit and ordinary keyboard victory/death/reboot/menu cases (eight distinct browser scenarios across the runs). Campaign routes use the existing development drone-neutralization action; they verify navigation/progression rather than combat balance. Renderer diagnostics now include cabin resources and both render passes. No fresh hardware frame-time acceptance was performed; the existing large-chunk build warning remains.

Visually reviewed evidence: [cockpit 1280×800](progress/cockpit-view.png), [cockpit 960×540](progress/cockpit-compact.png), [expanded survey](progress/cockpit-map.png), and the [final two-case browser report](progress/cockpit-final-browser-check.json). No dependencies changed and no commit/push/deployment was performed.

The subsequent industrial cockpit refinement replaces the three matching screens with a continuous beveled cowl, two recessed displays and a raised circular shield instrument. A segmented shield ring surrounds an original ship schematic, numerical strength and speed; a small local-velocity cue avoids implying a gravity horizon. The weapon display has original drawn silhouettes, a large ammunition count and a compact four-slot inventory. The navigation display combines the existing survey and ship-relative contact scanner.

Flat canopy members, rubber seals, panel fasteners, vent slats, switch banks, a guarded red control and painted identification give the cabin a manufactured scale. Fasteners/vents use instancing and simple repeated parts share geometry. The visible stick responds to local attitude changes and the thrust lever to forward/reverse velocity. These are presentation animations, not clickable controls. Status lamps follow headlights, ammunition availability and shields; finite-ammo consumption briefly illuminates the cabin, and damage/critical shields drive red warning light. Camera, aiming and flight physics remain unchanged.

Cockpit mode now uses a compact mission strip and a lower shortcut legend. The full mission guidance remains in the other views and the accessible document. H still blanks the instruments; M still expands the explored map. Broad cockpit shake, animated hands, interactive switches, glass reflections and world-light sampling are outside this pass.

Refinement verification: `npm run verify` passes (66 checked runtime modules, all 391 unit/simulation cases and build). Seven targeted browser scenarios pass: camera/settings persistence, cockpit fire/map/compact layout, actual enemy-fire shield damage plus reset, Vector Foundry's vertical relay/extraction/replay route, ordinary victory/death/reboot/menu flow, ten restart resource cycles, and desktop/small-viewport settings. After the final hand-control clearance adjustment, lint/types/build and the two cockpit scenarios pass again. The [seven-case browser report](progress/cockpit-industrial-browser-check.json) and [final cockpit report](progress/cockpit-industrial-final-check.json) record these runs. This is functional software-rendering evidence; hardware frame-time acceptance remains open.

Reviewed refinement images: [normal 1280×800](progress/cockpit-industrial.png), [compact 960×540](progress/cockpit-industrial-compact.png), [expanded map](progress/cockpit-industrial-map.png), and [critical shields under enemy fire](progress/cockpit-industrial-warning.png). No new dependencies or deployment.

## Campaign

The mission library leads with three new authored v7 missions. The main Start route defaults to Signal Breach. Completed missions advance through the campaign in order; replay restores authored enemies, pickups, relay state and doors.

| Mission | Layout and objective |
| --- | --- |
| Signal Breach | Seven spaces, an optional green supply loop and amber signal hall. Restore the uplink and unlock extraction. Combat is optional. |
| Vector Foundry | Seven spaces with a rising affine corridor, ceiling shaft and side cache. Restore lift power, climb and activate extraction controls. |
| Nightfall Reactor | Seven spaces, a lower loop, reserve supplies and upper control room. Defeat two guards, activate coolant bypass/shutdown relays, then extract. |

The old Level1/Level2/Level3/ExampleLevel finite segment blueprints are retired from the catalog and source. The old finite-level guide is replaced. The proven flight/combat arenas and Mine Link, Relay Gate and Deep Relay fixtures remain in the optional **Practice & prototypes** section. Endless mode is no longer offered in the mission library; the internal segment generator remains for existing diagnostics/tests. New missions are finite shared-document geometry, not that generator.

The layouts validate, but final encounter balance and mission pacing still benefit from player feedback. They use distinct color/pattern landmarks and real openings/doors rather than legacy segment geometry. Ship silhouette/colors and engine emissive material have also been updated for the external view.

## Music

The original two-tone drone is replaced by an original deterministic 40-second stereo score at 96 BPM: four-chord pads, a pulsed bass, kick/backbeat, hats, a developing melody and delay. Notes and tails wrap into the loop. It is generated once per audio context with no downloads or extra dependencies, and uses the existing music volume/mute/pause controls. Automated checks cover finite bounded stereo samples, deterministic generation and the loop boundary; musical taste and final mastering require listening review.

## Verification

Lint/strict types (62 source modules), all 389 unit/runtime cases, production build and diff checks pass. New tests cover camera obstruction with a rotated ship, independent flight/headlight ownership, preference compatibility, stereo music and campaign geometry/progression. All 43 browser cases pass in 10.7 minutes (28 designer/workbench, 15 game), with zero skips, unexpected/flaky results or retries. The [full browser evidence](progress/player-experience-browser-check.json) includes final bundle hashes, native campaign flight/relay/replay checks, ordinary-fire combat and existing mixer/resource regressions. Three screenshots were visually reviewed at 1280×800.

The new campaign route tests use the existing labeled development action to neutralize drones and isolate geometry/progression; they do not establish encounter balance. Production combat still has its ordinary-fire victory/death/replay checks. M2 hardware acceptance remains open; software rendering is functional evidence only. No dependencies changed, no fresh audit/hardware capture, and no commit/push/deployment. The existing large-chunk build warning remains.
