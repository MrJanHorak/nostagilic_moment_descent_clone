# M4 upright corridors and room orientation

> Follow-up: [ramps and diagonal corridor walls](M4_SHAPED_CORRIDORS.md) implements the next bounded convex geometry increment in format v5. This document and its counts record the preceding vertical-orientation checkpoint.

October 18, 2026. Follows [the direct editing/UX checkpoint](M4_DESIGNER_UX.md). The owner found that corridors only rotated around Y and asked for up/down corridors, ramps and diagonal walls.

## Implemented behavior

- Attach a corridor to a floor or ceiling and its long axis runs vertically. The connected hatches are real compiler-generated openings. Horizontal attachments follow their selected world axis too, even when the source room is pitched or rolled.
- Right-click a floor/ceiling and choose **Attach vertical shaft at this point**. This uses the same clicked-point alignment, clearance/overlap validation and single undo command as horizontal corridor attachment. Alternatively, select a floor/ceiling in Attachment port and use **Attach corridor**.
- Room properties expose **Pitch (X)** and **Roll (Z)** beside Yaw. **Rotate XYZ** shows all three gizmo rings. Every rotation snaps to 90 degrees. Connected rooms may need reconnection after a manual transform; validation blocks export/playtest until corrected or undone.
- The room list identifies vertical shafts. Port selectors, wall selection headings and context menus describe the actual world-facing floor, ceiling or wall. Raw endpoint IDs remain local and appear in selectors as local axes.
- Dimensions/content coordinates and face styles stay local. Preview geometry, picking, compiled spawn position/orientation, runtime collision, shots, relay doors and navigation share the same full transform. Gizmo commits prefer the existing equivalent Euler representation, avoiding angle jumps at 90-degree pitch.
- Version 4 adds optional quarter-turn pitch/roll. Imported v1–3 files retain their version until an edit needs it; unchanged zero controls do not cause an upgrade. Later appearance, opening or relay edits preserve v4. Export/import, duplication, undo/redo and local recovery retain orientation.

## UX assessment and remaining work

Automatic shaft attachment provides the straightforward operation: select the visible floor/ceiling, attach, then continue from the labeled end of the shaft. A user need not swap dimensions or calculate a 3D rotation to build vertically. Numeric controls and all three rings remain available for precise changes. Surface labels now follow world orientation, addressing the misleading “Floor” label on a rotated side wall. This is an implementation/workflow assessment; hands-on picking and gizmo usability still need owner acceptance.

**Ramps and diagonal walls remain requested, unimplemented geometry work.** Rotating the current box meshes by 30/45 degrees would leave axis-aligned solid bounds and box-based interior/navigation assumptions incorrect. This checkpoint deliberately accepts only orthogonal transforms.

The next geometry increment should add a bounded convex sloped segment/corner prefab before considering freeform editing:

1. Define a versioned convex volume with explicit end-port planes and a limited slope/corner parameter. Keep openings compatible with adjoining segments and retain local material faces.
2. Generate the visible surfaces and collision from the same volume. Add sphere contacts/sliding against sloped faces and their edges/corners, projectile/visibility intersections and broad-phase bounds. Preserve the accepted box path.
3. Validate interior body clearance, adjoining openings and actual polyhedron overlap. Navigation must use the convex volume and clearance at its ends rather than only the surrounding AABB; door geometry must fit the actual portal.
4. Add a small ramp/corner authoring control and context action, with shared solid preview and atomic undo. Prove ascending/descending and inverted flight, diagonal sliding, shot blocking, enemy passage, relay-door behavior, export/import and restart before calling it usable.

This is separate from arbitrary vertex editing, concave room unions and custom image uploads. The user has requested the slope/corner capability; no further permission is needed to start that next increment. M4 remains pending human authoring/handling acceptance. M3 is accepted; M2 still has its unchanged hardware performance gate.

## Verification

The new runtime tests exhaust all 64 quarter-turn angle combinations, check inverse picking and mesh/collider bounds, and attach corridors to all six faces from every orientation. Both three-space up/down routes cover closed/open relay hatches, sphere travel, wall/shot blocking, navigation and JSON round trips. They also cover local placement, duplication, legacy/version rejection, invalid draft recovery and undo.

Scoped lint and strict types pass for 47 source modules, as do all 340 unit/runtime cases, the production build and `git diff --check`. All 23 browser cases pass in 6.5 minutes, with zero skips, unexpected results, flaky cases or retries: twelve designer checks and eleven existing game checks. [The evidence record](m4-vertical-browser-check.json) preserves individual results and the Windows / Node 22.14.0 / npm 11.2.0 / Chromium SwiftShader environment.

The vertical browser scenario uses native floor-menu attachment, authors a relay hatch, exports/imports, flies downward through two passages to extraction, returns to unchanged JSON and verifies upward attachment/undo. The orientation scenario checks numeric pitch/roll, an actual mouse drag of a rotation ring and draft recovery. Screenshots were reviewed for the upright three-space stack and XYZ controls at 1280x800. A small CSS fix preserves Export button contrast on hover.

The existing large-chunk build warning remains. These are local functional checks, not hardware performance or hosted CI evidence. No dependencies changed; no fresh audit, commit, push or deployment was performed. Owned browser servers exited after verification.
