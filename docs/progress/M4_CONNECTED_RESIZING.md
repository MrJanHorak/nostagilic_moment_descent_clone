# M4 — Connected resizing and snapping

October 18, 2026. This extends the local authoring workflow; human M4 usability/handling acceptance remains open. M3 is accepted. Hosted CI was reported passing by the owner before this increment; M2 still has its hardware-performance acceptance gate.

## Authoring workflow

- Select a room or corridor, then **Stretch**. Drag local X for width, Y for height, or Z for length. Dimensions snap to half units. With connections, the first connected opening stays fixed; an isolated room keeps its center fixed.
- Use **Resize and keep connections…**, near the top of Room properties, or right-click **Resize room…**, for precise dimensions and a choice of fixed opening or room center.
- Editing numeric dimensions and **Apply properties** uses the same connection-preserving command. Position/rotation/end-offset edits remain separate manual transforms; they can create a temporarily invalid draft.
- If an older centered resize or manual move broke an existing hallway alignment, select it and use **Snap connections** in Room properties or the right-click menu. Its first connected neighbor stays fixed; the selected piece and attached branches translate to align their existing openings. This repairs existing connections; attach new rooms from unused faces to create new connections.
- During stretching, outlines, passage frames and content show the proposed snapped layout. The original solid walls are hidden until release. Invalid proposals show a red selected outline and an explanation; release rejects the whole edit. Successful release rebuilds shared runtime geometry.
- Each resize/snap is one undo command. A conflicting closed loop, room overlap, content/opening clearance failure or coordinate limit leaves the document/history unchanged. The tool does not force overlapping rooms into the level or silently delete doors/content to make a shrink fit.

The resize solver holds the chosen opening's world center fixed and propagates translation constraints through the connection graph. The far branch follows a changed corridor length; branches on other faces follow their corresponding opening centers. Door/relay links, opening offsets/dimensions, face styles and corridor end offsets are retained. Content inside the resized room stays at its world position; translated neighboring rooms carry their local content. Snap is a translation repair, so its selected piece carries local content too. Incompatible rotations or loop constraints still require Undo or disconnecting/reworking a branch.

## Why the old limit was 64

64 was a conservative document/work limit, not a Three.js room restriction. The game keeps the whole mine loaded. Earlier overlap checking also tested every room pair repeatedly. There is no streaming, room-union system or hardware guarantee for unlimited geometry.

Format v6 raises the bounds to **256 rooms / 512 connections**, with **4–256 unit width, height and length for every prefab**. Corridors no longer have an eight-unit cross-section/aspect constraint. The editor displays capacity 256 even for a legacy draft; adding its 65th room automatically opts into v6. Successful resizing or snapping also opts in. Imports of v1–5 retain their version and original strict validation until an expanded edit is made; undo restores the original version.

Half-unit stretches around a fixed end can place the center on a quarter unit, so v6 positions allow quarter units. Opening sizes expand to 2–254, endpoint offsets to ±128, and integer shaped end offsets to ±256 while retaining the combined-offset ≤ length rule. Text/node/depth/entity/device/door/position limits remain bounded. See [the format specification](../LEVEL_DOCUMENT_FORMAT.md).

Overlap validation and both editor highlight paths now sweep cached world bounds before the existing exact convex test. Frame all adjusts camera far distance and orbit range for larger maps. These are functional authoring improvements; maximum-size mines have not been accepted against the reference hardware frame-time target.

## Verification

Scoped lint/strict types pass for 53 source modules. All 364 unit/runtime cases and the production build pass. New coverage exercises anchored resizing in horizontal/vertical orientations, affine ramp content, shifted openings, linked doors, branch movement, loops, overlap/clearance rejection, numeric properties, snap repair, one-command undo/redo, export/import and local recovery. A 256-room connected document validates, compiles, routes and round-trips; a 257th room rejects atomically. Sweep results match exhaustive convex overlap results across rotated/sloped fixtures. The single local 256-room validation/compile observation was about 22 ms; this is functional timing, not a frame-rate or hardware benchmark.

All 29 browser cases pass in 7.2 minutes (18 designer, 11 game), with zero skips, unexpected results, flaky cases or retries. The four resize cases pass again after a final malformed-coordinate input guard, with gameplay bundles byte-identical to the full run. They use native mouse/keyboard input: wall-menu resizing, Stretch and recovery, connected resize/relay-door flight, large-mine import/frame/export, and the hallway-specific drag/numeric/snap regression. The anchored preview and controls were also reviewed in 1280x800 screenshots. Full-suite verification is recorded in [the browser evidence](m4-resize-browser-check.json).

No dependency changes, new audit or hardware capture. The existing bundle-size warning remains. No commit, push or deployment was requested. Human review should include the live anchored preview, branching/loop behavior, resize rejection messages and snap repair before M4 is marked accepted. Arbitrary wall vertices, room unions, custom image uploads and streaming remain outside this increment.
