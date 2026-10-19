# M4 direct editing, room commands and draft recovery

> Follow-up: [upright corridors and room orientation](M4_VERTICAL_CORRIDORS.md) adds automatic vertical shaft attachment, pitch/roll, XYZ rotation and orientation-aware face labels in format v4. This document records the preceding UX checkpoint; its test counts are historical.

October 18, 2026. This follows [content authoring and preview](M4_DESIGNER_AUTHORING.md). The owner requested the remaining steps and an assessment of whether the designer feels intuitive, specifically selecting walls and using right-click menus to style them, edit doors, and place content in a room.

## UX assessment

The earlier designer was functional but too dependent on forms. A user had to identify a room, translate a visible surface to a local face name, scroll through unrelated properties, and enter coordinates for an item they could already see where to place. The viewport selected only room boxes, so it did not provide enough feedback about the wall or item being edited. It also used the same long inspector for every task.

The new workflow addresses those observed problems:

| Area | Current behavior |
| --- | --- |
| Selection | Click a visible wall/floor/ceiling or an item. A face overlay or enlarged marker and a text heading identify the selection. |
| Direct actions | Right-click the surface/location for relevant actions; color/pattern and opening/door forms appear beside the click. |
| Placement feedback | Hover/focus a placement action to see its planned center. White indicates a valid placement; red and a local error explain rejection. |
| Inspector | Room, Wall, Content and Connections tabs show relevant controls. All properties retains the numeric workflow. A selected wall shows only its own connection; a solid face explains how to attach/connect a neighbor. |
| Discovery | Solid cutaway is the default. Visible action hints, an Actions button, and friendly face names reduce the need to remember shortcuts or raw port IDs. |
| Camera/menu input | A right-click opens only on release without dragging. Right-drag continues to pan. Esc dismisses and returns focus to the canvas; menu arrows and Shift+F10 provide keyboard access. |
| Recovery | Drafts save after committed commands. Startup offers Restore/Discard, preserving the old recovery candidate until that choice is made. Export remains the portable backup. |

This is a code/workflow assessment supported by browser interaction tests and screenshot review, not a user study. Picking/gizmo feel still needs the owner's hands-on review. The menu scrolls within small windows when necessary; dense layouts may need X-ray view or the object lists to select an occluded item. Imported level IDs still identify rooms; this checkpoint does not add a separate room naming system or freeform geometry.

## Using the context menus

Run `npm run dev` and open `/editor.html`, or use LEVEL DESIGNER from the game menu.

- **Wall appearance:** click/right-click a wall, choose **Wall color and pattern…**, change the values and Apply. It affects the picked local face, not every face. The right-side Wall tab provides the same precise controls and a reset-to-preset option.
- **Opening/door:** on a connected face, choose **Opening and door…** to set passage size, offsets and the relay that unlocks its door. Choose **Move opening to this point** to move the existing opening near the click, constrained to both rooms' frame clearance. A door needs a real connection to a neighboring room; it cannot open into empty space. An unconnected wall offers room/corridor attachment; use Connections to join already touching rooms and close loops.
- **Attach at the click:** choose **Attach room at this point** or **Attach corridor at this point**. The new prefab shifts along the selected face and shares one real, possibly offset opening. The entire operation is one undo command and rejects overlap or other invalid results atomically.
- **Place content:** right-click inside the visible room, including its floor or a wall. Choose an enemy, health/ammo pickup or relay. The point snaps to the half-unit grid and moves inward enough for that item's body/authoring clearance. Existing placements are checked; an overlapping action leaves the menu's error visible and does not change the document. Content can still be adjusted numerically afterward.
- **Move spawn/exit:** the menu moves the existing unique placement instead of adding a second one. Spawn heading is preserved. The exit requires more wall clearance than a small pickup, so its preview marker can sit further inward.
- **Edit an item:** click its marker or select it in the list. Right-clicking an item also provides edit/delete actions. The unique spawn and exit are moved rather than deleted.
- **Keyboard:** focus the viewport and use Shift+F10, or choose Actions. This uses the selected room's center as its placement point; use numeric properties for a different precise location. Arrow keys move through the menu, Enter activates, and Esc closes. Inspector tabs support arrow navigation. The object lists and numeric panels remain keyboard-operable alternatives to 3D picking.

Only compiled wall/door meshes and item markers participate in visible-surface picking. Hidden cutaway faces and selection overlays do not intercept clicks. Empty exposed room space falls back to a room interior point. Markers can be picked through translucent walls in X-ray mode. World intersections are converted through the inverse room orientation before storing room-local placement coordinates.

## Room commands

Duplicate room copies the room's geometry, yaw, appearance, enemies, pickups and relays with new unique IDs. Required enemy/relay references follow the copies; relay labels identify the new device. The unique player spawn/exit and external door links stay with the original. A context-menu duplicate uses the picked unused face when possible; the sidebar button uses the first unused face. Overlap/count/clearance failures leave the original document and history intact.

Delete room removes its connections, ordinary content, affected relay doors and objective references in one undoable command. The last room and any room containing the spawn/exit are protected: move those placements elsewhere first. Deleting a bridge can leave a disconnected editing draft; validation blocks export/playtest until it is fixed or undone. Undo restores the full dependency set.

## Local persistence and safety boundary

The separate local-storage key is `descended.designer.draft.v1`. A bounded record contains only version, timestamp and document JSON. It is saved after a committed command, including undo/redo and explicit file operations, rather than per rendered frame. No runtime health/entities/activation state is saved. A pending recovery record is never overwritten by merely opening the designer or starting edits in the blank document. Restore first asks about any current unsaved work; Discard is explicit. Restored documents are marked unexported, and recovery starts a new undo history.

Recovery uses the same structural JSON reader as the level format, while deliberately allowing temporary semantic errors such as room overlap/misalignment. The editor displays those errors and withholds compiled walls, export and playtest. Runtime compilation and JSON file import continue to use full structural **and semantic** validation. Unsupported, malformed, oversized or executable-shaped recovery records are rejected without replacing current work. Storage access/quota failures leave editing and portable JSON export usable and show a local status message.

## Verification and milestone status

Unit coverage includes inverse coordinates at all four room yaws, snapped body-clear placement, atomic rejected placement, clicked-point corridor attachment, room duplication/reference identity, deletion cascades/undo, invalid-draft recovery, recovery overwrite protection and blocked/corrupt storage. Browser checks use real mouse/keyboard events to style a picked wall, place content without numeric input, pick an item, edit a door, attach at a wall point, duplicate/delete/undo and recover the same layout. They also cover menu bounds, Esc/focus, Shift+F10 and right-drag panning.

The complete automated M4 scenario creates three connected spaces, moves spawn/exit, adds an enemy/pickup/relay and a relay door, exports/imports JSON, activates the relay, flies to mission completion, returns to byte-identical editing JSON and undoes a later appearance edit. The enemy is optional in this authoring/navigation scenario; the existing accepted game regressions cover required combat. Its simulation clock is controlled between native input commands to prevent hosted command latency from adding unintended thrust or enemy fire. This is functional evidence, not hardware performance evidence.

The previously pending room commands and autosave/recovery are now implemented. **M4 remains pending human acceptance**, rather than being declared complete from automation. Suggested acceptance: build three spaces from New mine, try the right-click workflow and a required enemy, play to completion, return, undo an edit, export/reload and restore after a page reload. The remaining judgment is actual usability and handling, not a repeat of M3 mission sign-off. Custom image uploads and freeform room unions remain deferred. M2's hardware p95 gate is unchanged.

Scoped lint and strict types pass for 47 source modules. All 334 unit/runtime cases, the production build and `git diff --check` pass. All 21 browser cases pass in 5.9 minutes with no skips, retries or unexpected results: ten designer checks and all eleven existing game cases. [Local evidence](m4-ux-browser-check.json) records individual results and environment limits. Screenshots were reviewed for picked walls, placement menus/markers, the grouped inspector and recovery at 1280x800; keyboard/menu bounds also pass at 960x540. No dependency changes, new audit or hardware measurement were made. The change has not run on hosted CI; no commit, push or deployment was requested or performed.
