# M4 first checkpoint: local designer shell

> Follow-up: [authoring, offset openings, styles and first-person playtest](M4_DESIGNER_AUTHORING.md) extends this shell. The scope and counts below record the earlier checkpoint.

October 18, 2026. The owner reports that hosted CI now passes. That closes the previously open hosted-CI gate based on owner confirmation; no new run URL was supplied or independently inspected. [M3 remains accepted](../M3_ACCEPTANCE.md). M2 still has an open hardware performance gate: the last recorded Intel GPU p95 was approximately 18 ms against the provisional 16.7 ms target. CI functional success does not establish hardware performance acceptance.

## Implemented workflow

Run `npm run dev`, then open `/editor.html`, or use **LEVEL DESIGNER** on the game's main menu. Production builds include both HTML entries. Editor UI, orbit controls and transform controls load from a separate dynamic entry; the game does not import editor modules.

- Start a new one-room mine with a valid spawn and exit, or open the bundled Mine Link example.
- Select rooms from the list or viewport. Orbit, pan, zoom, frame the whole mine, or press F to focus a room.
- Attach a box room or straight corridor to an unused face. The command aligns opposite ports and creates a connection atomically. Horizontal corridors orient along the chosen axis; vertical attachments use the same validated horizontal hatches as the runtime.
- Translate with a 0.5-unit gizmo, rotate around Y in 90-degree increments, or enter bounded position/dimension/yaw/material properties.
- Connect already aligned unused ports to close a loop. Disconnect a connection to rework a layout.
- Undo/redo edits, including an entire transform drag as one command. History is bounded to 100 commands.
- Export validated JSON as a portable file, then reload it with Import JSON. Invalid imports preserve the current document and history. Dirty documents prompt before replacement or navigation away.

The preview uses `compileLevelDocument` and `buildArena`, including actual wall splits and doors. Translucent walls and room outlines make interiors inspectable. Spawn/enemy/pickup/exit/relay markers are editor decorations; they are never saved. Existing v1 and v2 mission content survives import/export.

Room transforms can temporarily break alignment, cause overlaps, or move contained placements outside a room. Those drafts remain editable. The shared validator lists actionable errors, export is disabled, and the viewport switches to outlines instead of retaining stale compiled walls. Error entries focus the affected room when their path identifies one. Undo restores a valid previous layout.

## Scope and next checkpoint

This is **M4 step 1 and the initial connection/file round trip**, not acceptance of the full designer milestone. Entity/device/door/objective placement, playtest and return to editing, room deletion/duplication, and autosave/recovery remain. Current mission markers are read-only; new mines contain only the starter spawn and exit. Closing an existing loop requires selecting the correct pair of aligned ports. Browser storage is not yet used; export is the current persistence mechanism.

The next M4 step is content placement and mission properties using the shared registries and validator, followed by runtime playtest from a detached snapshot. Hardware performance acceptance remains a separate M2 item.

## Verification

The new document suite covers all six attachment faces at all four supported source yaws, real compiler openings, overlap/occupied-port rollback, closing a loop, invalid draft/export/undo/redo, bounded properties, transactional invalid imports and preservation of Deep Relay v2 gameplay data. Browser checks cover three-space authoring, invalid edits and recovery, production download/reimport, rejected imports, v2 loading, and the main-menu link.

Lint and strict types pass for 41 source modules. All 292 unit/runtime cases and the production build pass. All 14 browser cases (three designer and eleven existing game cases) pass in 4.8 minutes, with no retries. The designer's native mouse drag snaps to the half-unit grid and undoes as one command. [Evidence](m4-designer-browser-check.json) records the local environment and limits. Layout screenshots were reviewed at 960x540 and 1280x800. The existing large-chunk build warning remains. No dependencies changed and no new audit or hardware capture was run. This change has not yet run on hosted CI. Manual mouse/gizmo feel and hardware performance remain human checks.
