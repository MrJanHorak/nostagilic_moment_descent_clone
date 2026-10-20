# M4 — Find and repair authoring errors

October 19, 2026. This follows [loops, shared openings and relay doors](M4_LOOPS_AND_SHARED_OPENINGS.md). Human M4 authoring/handling acceptance and M2 hardware performance acceptance remain open; M3 remains accepted.

The Validation panel now presents the problem first, followed by **Show item / connection / room** and its document path. Choose an issue with the mouse or keyboard to select the affected object, frame it in the viewport, open its inspector and focus an edit control. Navigation does not change the document, autosave or Undo history. Undo still reverses the actual authoring edit.

Previously, clicking an issue mostly changed a room ID. If an unrelated content item was selected, refresh could immediately switch back to that item's room. Entity and relay errors did not select the actual item, spawn errors were not handled, and connection errors did not open the passage inspector. Navigation now resolves the validator's structured path against the current document, including the specific connection endpoint, room face, door's passage and mission objective references. Missing/dangling references without a scene target remain readable text rather than an ineffective action. The content list only marks an item as selected when content is the active selection.

For an overlap, follow the room issue and adjust its position/dimensions or Undo. For an item outside its room, follow the item issue and edit its local position or use Move. For misaligned connections, follow the passage issue to inspect the opening; use the Room tab's Snap connections on the displaced piece, or Undo its move. A larger opening cannot repair separated face planes. Export and Playtest remain blocked while validation fails.

## Verification

Lint and strict types pass for 58 source modules; all 383 unit/runtime tests and production build pass. Three new model tests cover content/spawn/mission references, endpoint B and exact door identity, face selection, legacy documents, missing references and unchanged document/history. Two new native browser scenarios exercise invalid-item repair, room overlap navigation from an unrelated selected item, spawn selection, passage properties, keyboard activation/focus and one-step Undo. All 27 editor browser cases pass in 1.9 minutes, with zero skips, unexpected/flaky results or retries. The [browser evidence](m4-validation-browser-check.json) records the run and unchanged gameplay/compiler/playtest hashes; the eleven game cases retain the previous full-suite evidence and were not rerun. The [overlap screenshot](m4-validation-navigation.png) was visually reviewed at 1280×800.

No format, geometry, game runtime or dependency changes. The existing large-chunk build warning remains. This improves error recovery; it does not establish human handling or hardware performance acceptance.
