# M4 ramps and diagonal corridor walls

October 18, 2026. Follows [upright corridors](M4_VERTICAL_CORRIDORS.md). The owner requested sloped ramps and diagonal walls for more geometric variety. This increment implements a bounded convex corridor prefab with a raised/lowered and/or sideways-shifted far end.

## Authoring

- Select an unused room face, choose **Ramp up**, **Ramp down**, **Diagonal right** or **Diagonal left**, then **Attach shaped corridor**. Presets use a 16-unit corridor with an eight-unit end offset.
- Alternatively, right-click a connectable face and choose **Attach ramp or diagonal corridor…**. Enter whole-unit sideways/rise values and attach. Positive values move the far end toward the new corridor's local right/up; negative rise slopes down. Combined offsets make a corridor both rise and shift sideways.
- The sides are real planar diagonal/sloped surfaces. The two rectangular end faces connect to existing room/corridor ports. Sloped side faces stay solid; port selectors disable them and the context menu gives one explanation instead of repeating unsupported attachment choices. You can still pick, color/pattern and place content against those faces.
- The Room inspector exposes **Far end sideways** and **Far end rise**. Changing an already connected shape moves its openings and may invalidate connections; reposition/reconnect neighbors or Undo. The entire initial attachment, including clicked-point offsets and the format upgrade, is one undo command.
- Dimensions and content coordinates are relative to the corridor's unsheared cross-section. A placement at local X=Y=0 follows its centerline at the authored local Z. Pitch/roll/yaw orient the whole prefab afterward; for upright shafts, local up/right can differ from world up/right.
- Solid cutaway, solid exterior and X-ray show the actual skewed volume. Right-click style controls operate on the picked sloped floor/wall. Invalid drafts still block solid preview, export and playtest.

This adds sloped floors/ceilings and parallel diagonal side walls through corridor presets. It does not introduce freeform vertices, arbitrary wall drawing, concave rooms, intersecting-room unions or imported image textures.

## Shared geometry and gameplay

Format v5 adds `offset-corridor` and its required `endOffset: [sideways, rise]`. Offsets are integers within ±32, with combined distance no greater than local length (maximum 45-degree centerline inclination). Width/height stay within 4–8 and length within 4–64, at least the width/height. The v3/v4 root structure and all count/ID/objective rules remain. Older formats retain their semantics and version on import; operations never downgrade v5.

The compiler applies a single affine shear to the shell and its contents, then the existing orthogonal room orientation. Each wall panel's eight vertices generate both its visible triangles and convex collider. End openings retain the existing canonical world-plane coordinates. Doors still seal the actual rectangular portal and unlock through the normal relay/session path.

Player/enemy spheres use closest points on the convex panels, with rounded edge/corner response, inward-velocity removal and the existing bounded substep/slide solver. Surrounding AABBs provide rejection bounds and never fill empty space beside a sloped panel. Shot/visibility segments clip against the actual convex wall planes; the small shot radius retains the existing conservative edge-clearance policy. Ordinary box walls keep their existing fast path.

Validation measures placement spheres perpendicular to sloped walls and compares room volumes with a separating-axis test. Overlapping surrounding boxes alone do not mean two diagonal corridors intersect. Navigation finds/clamps points inside the real convex volume, filters body clearance and follows approach/center/departure points at shaped end ports. Turns between safe interior points stay inside the convex room.

Playtest keeps its explicit `?smoke` flag when the parent editor has it. The game still gates diagnostics on a development build. Browser steering reads that existing diagnostic output while sending ordinary keyboard input; production preview exposes no diagnostic panel or global game object.

## Verification and remaining acceptance

Runtime tests cover rounded convex contacts and boundary recovery, empty AABB space, all quarter-turn transforms, true volume overlap, ramps up/down, diagonal offsets both directions, combined offsets, maximum slope, all six attachment directions, both-way body traversal, sloped sliding, shots, body clearance, side-port rejection, profile/version limits, duplication, undo/recovery, relay doors across fresh worlds and an actual alerted scout following the shaped passage to a remembered target.

Scoped lint and strict types pass for 50 source modules. All 353 unit/runtime cases, the production build and `git diff --check` pass. All 25 browser cases pass in 6.7 minutes with zero skips, unexpected results, flaky cases or retries: fourteen designer checks and eleven game checks. [The evidence record](m4-shaped-browser-check.json) preserves the Windows / Node 22.14.0 / npm 11.2.0 / Chromium SwiftShader environment and individual results.

The production shape scenario picks/styles a sloped floor, undoes invalid reshaping, restores/exports/imports JSON and previews/returns through the normal Esc mouse release. The development scenario authors a combined rise/sideways corridor and relay door, exports/imports, flies with native keyboard input to extraction and returns unchanged JSON. Screenshots were reviewed for the actual sloped surface menu, patterned ramp, skewed outline and flight view at 1280x800.

Screenshot review prompted a final menu-only simplification: one end-port explanation replaces repeated disabled attachment actions on a solid sloped side. All fourteen editor browser cases pass again in 1.4 minutes afterward. Both gameplay bundle SHA-256 hashes remain identical to the successful full-suite build; the evidence records that comparison. The final scoped verify/build also passes.

M4 still needs the owner's hands-on authoring/handling acceptance. M3 remains accepted; the M2 hardware frame-time gate is unchanged. The existing large-chunk build warning remains. No dependencies changed; no fresh audit, hardware capture, hosted CI run, commit, push or deployment was performed. Owned browser servers exited and the temporary verification log was removed.
