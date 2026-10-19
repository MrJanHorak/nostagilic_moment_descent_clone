# M4 — Move the selected item

October 19, 2026. This follows [connected resizing and snapping](M4_CONNECTED_RESIZING.md). Human M4 authoring/handling acceptance remains open; M3 remains accepted and M2 still has its hardware-performance gate.

## UX finding and behavior

The previous viewport highlighted a selected enemy, pickup, relay, spawn or exit, but its transform control still attached to the parent room. **Move** could therefore move the room while the inspector said an item was selected. This made selection feedback unreliable and could misalign room connections during content authoring.

Move now follows the selected item. Choose a marker or the Mission content list, then use **Move**, the Content panel's **Move selected item**, or the same action in its right-click/Actions menu. The world-axis handles translate only that item. Its proposed center snaps to the room's half-unit local grid, including quarter-turn orientations and affine ramp geometry. White indicates a valid candidate; red and a message explain rejection. Release commits one undo command. **Esc cancels the drag** without changing the document, undo/redo history or local draft. Room Move/Rotate/Stretch drags also support Escape cancellation.

Rotation and Stretch toolbar buttons are disabled while content is selected; selecting an item during those room tools returns to Select. Select a room in Rooms to use its tools again. The tool-status line identifies the editing target. F and the focus action center on the selected item. Keyboard Actions preserves its content selection and uses the item's local point instead of silently switching to its room.

Moves stay in the item's existing room. Use the Content room dropdown and numeric properties to transfer it deliberately. A wall, overlapping placement, malformed coordinate or other invalid draft rejects the move without changing the saved layout. The full spawn quaternion, enemy requirement membership, pickup type, exit radius, relay identity and door links are preserved. No document-format upgrade or runtime state is needed. Import/export and local draft recovery keep the moved authored position.

## Verification

Lint/strict types pass for 53 source modules. All 371 unit/runtime cases and the production build pass. Seven new model cases cover all five item kinds, preview ownership, atomic rejection, no-op history, undo/redo, import/export, metadata preservation and all 64 quarter-turn orientations of a shaped room.

Four new browser cases use native mouse/keyboard input for pickup movement/rejection/undo/cancel/recovery, picking and moving a spawn in a rotated ramp, moving enemy/relay/exit without altering objectives/doors, and Escape cancellation of room Move/Stretch. All 22 editor browser cases pass in 1.8 minutes with zero skips, flaky/unexpected results or retries. The full editor-suite result is recorded in [the browser evidence](m4-content-move-browser-check.json). Preview and rejection screenshots were reviewed at 1280x800.

The eleven gameplay browser cases were not rerun for this editor-only change. Gameplay bundles are byte-identical to the [previous full 29-case browser run](m4-resize-browser-check.json); this is an editor change. No dependency change, new audit, hardware capture, commit, push or deployment. The existing bundle-size warning remains. These functional checks do not establish hardware frame-time acceptance or a human usability study.

The next acceptance exercise remains a small mission authored without code: create connected spaces, place the required content, resize a corridor, adjust an item, export/reload, complete the mission and return to editing. Human handling feedback is still needed before declaring M4 accepted.
