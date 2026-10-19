# M4 — Loops, shared openings and relay doors

October 19, 2026. This extends [connected resizing](M4_CONNECTED_RESIZING.md) and [selected-item movement](M4_CONTENT_MOVEMENT.md). Human M4 authoring/handling acceptance remains open. M3 is accepted; M2's hardware-performance acceptance remains open.

## Connect an existing hallway or close a loop

Right-click a rectangular wall or corridor end and choose **Connect to existing room…**. The dialog lists opposing faces whose projected clear areas intersect. The face centers do not have to match. The Connections tab also provides **Connect / snap existing rooms…** with the selected source port.

Choose a target and alignment:

- **Keep positions / close loop** joins faces already sharing a plane. Existing paths remain intact.
- **Fit corridor end to target** lengthens or shortens a corridor's free local Z end to meet the target plane. Its opposite end must already have a connection; that opening stays fixed. This is the useful option when a hallway stops short of, or penetrates slightly into, a room it should meet. The target room must stay fixed. Corridor dimensions still use the half-unit grid and 4–256 limits.
- **Snap separate branch to target** translates the selected room and its attached branch along the normal. It carries local content and preserves existing openings. If the target is already in that branch's graph, use Fit or align the loop instead; snapping cannot move the entire loop while claiming its target stayed fixed.

Choose **Doorway at this point** for a passage up to 6×6 near the click, or **Full shared opening** for the entire mutual clear rectangle. Corners and offsets are calculated on both faces. Loop closure, fitting or snapping is one undo command; overlap, clearance, conflicting constraints and input limits reject it without changing history.

## Smaller rooms and multiple joins on a large wall

Right-click another clear area of a wall and use **Attach room at this point** or its corridor equivalent, even when that wall already has a passage elsewhere. The new piece snaps to the plane and the clicked tangent position. Overlapping room volumes or openings reject the attachment.

Right-click a passage frame and choose **Use full shared opening**, or use that button in Opening and door. The smaller face's clear interior can become the full passage into a larger room. The intersection can also be partial/off-center. Physical side-wall/floor/ceiling thickness remains; this does not erase the surrounding room shell or join intersecting volumes by a geometric union.

Format v7 permits up to **eight distinct non-overlapping openings per face**, within the existing 256-room/512-connection bounds. Each passage can have its own door. The compiler subtracts the complete set of portal rectangles from that wall; solid regions between holes remain visible and collidable. Sloped corridor sides remain solid; rectangular end caps support these joins. Frame picking and existing door meshes retain connection identity, so an edge of a large door does not accidentally select a neighboring smaller passage. Wall selection highlights actual panels and leaves openings empty.

## Add a door and relay

Right-click a cyan passage frame or its door and choose **Add or edit relay door…**. The Wall inspector's Opening and door section exposes the same button. Choose:

- **Create relay near player spawn**: finds a clear accessible position near the authored spawn, creates the required relay and links this door in one undo command. If no tested position fits, the action leaves the level unchanged and asks for manual placement.
- An existing relay: right-click an accessible room and **Place relay here**, then choose it as this door's control. One relay may control several doors.
- **Always open / remove door**: restores an open passage while keeping authored relay content intact.

In Playtest, press **R** within 2.5 units of a visible relay. The linked door opens, including removal of its actual collider. The shared opening's size/offset determines the door slab. The level validator rejects self-locked or otherwise inaccessible relay progression. An alternate open route around a loop remains an alternate route; adding one door does not automatically gate every path.

## Format and compatibility

V7 adds no executable fields. It permits the full clear face (0.5 wall margin instead of the older 0.75 authoring margin), opening sizes 2–255 and eighth-unit opening sizes/offsets. Exact eighth-unit centers are needed when two quarter-grid face edges share an odd quarter-unit width. Room sizes remain on the half-unit grid; centers remain quarter-unit as in v6. Other caps and geometry/mission fields remain unchanged.

Existing v1–6 imports retain their versions and original validation rules. Shared-face joining, full-opening fitting and an additional same-wall attachment opt into v7. Later resizing, snapping, styles, orientation and relay edits preserve it. Undo restores the exact preceding version/document. Older runtimes must be updated to load v7 files. See [the format specification](../LEVEL_DOCUMENT_FORMAT.md).

## Verification

Lint and strict types pass for 57 source modules; all 380 unit/runtime cases and build pass. Nine new model/geometry cases cover multiple full openings, exact partial-face centers, all 64 orientations, gapped loop fitting, separate-branch snapping, wall area/collision preservation, actual relay activation/collider removal, affine end caps, per-face bounds and atomic undo/rejection. Existing v1–6 regressions pass.

The focused three browser cases pass using native mouse/keyboard input: off-center loop closure, frame/door picking, automatic relay creation and real flight through the unlocked full opening; fitting a gapped loop; and a second attachment with manual relay linking. Preview and door-dialog screenshots were reviewed at 1280×800. All 36 browser cases pass in 7.1 minutes (25 designer, 11 game), with zero skips, flaky/unexpected results or retries. The full run includes the final panel-only selection highlight and existing game route/replay checks. Full-suite verification is recorded in [the browser evidence](m4-joins-browser-check.json).

No dependencies changed; no new audit or hardware capture, commit, push or deployment. The existing bundle-size warning remains. Functional software-rendered checks do not establish performance acceptance for maximum-size worlds or substitute for human M4 handling review.
