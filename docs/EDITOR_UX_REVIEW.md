# Level editor UX review — November 24, 2026

A hands-on review of the level designer at 1024×700, 1366×768 and 1920×1080, with the starter mine and the Signal Breach example. Screenshots were taken with the production build in the browser test harness.

## Fixed in this pass

| Problem | Fix |
| --- | --- |
| The top bar used two rows at 1366 wide: ten unrelated buttons in one flat row, plus a two-line title. | One row, grouped by job: **Open** (New mine, Open example, Open Deepworks, Import JSON), **Mission** (Story & radio, Reactor escape), **Test and save** (Playtest, Save to My Levels, Export JSON). The title is on one line; "DESCENDED" hides below 1500 px. |
| At 1366×768 the 3D view got about 375 px of the 768 px height. Two status lines, a two-line help strip and a tall validation box took the rest. | The status lines sit side by side, help is one line, and a valid level shows a one-line validation bar. The view is now about 490 px tall (+30%). |
| No quick camera angles: orbiting to see a layout from above took several drags. | **3D / Top / Front / Side** buttons next to Frame all, and keys **1–4**. |
| The right-click menu was one list of up to 20 items. | Section headings: Selected item, Wall, Place here, Room. Order and keyboard behaviour are unchanged. |
| Opening the menu with **Actions** or Shift+F10 immediately showed a red error, such as "Data log … overlaps enemy-1". Focusing the first item previewed a placement at the room's centre. | Previews now run only on hover or arrow-key focus, not when the menu opens. |

Covered by `tests/browser/editor-layout.spec.js`. All 28 existing editor browser tests still pass.

## Second pass: the eight remaining items (done)

1. **Inspector density.** The Room tab leads with a one-line summary ("room-1 · room · 16 × 12 × 16"), then dimensions before position, and yaw, pitch and roll on one row. Help paragraphs are folded under "How room edits work", "About surfaces" and "About doors". Spawn heading appears only for the spawn, and "Required for completion" only for enemies.
2. **Duplicate paths.** Build tools → Add mission content now adds to the selected room; exact coordinates sit in a fold. The second connect form is gone. "Connect / snap existing rooms…" opens the one dialog that lists every joinable wall.
3. **Shortcuts and named undo.** Q/W/E/R switch Select/Move/Rotate/Stretch, and Delete or Backspace deletes the selection. Undo and Redo tooltips name the edit ("Undo: Place enemy"), and undoing shows "Undid: …". Names are worked out by comparing the level before and after (`EditorHistory.js`), so every command gets one automatically.
4. **Multi-select.** Shift- or Ctrl-click items or rooms in the view or the scene browser. Move drags the group together, and Delete or the right-click menu removes it. Each is one validated undo step: a group move is rejected whole if any item would end up in a wall. Rotate and Stretch stay single-room.
5. **Room names (format 14).** An optional `label` (up to 40 characters) per room, set in the Room tab. It shows in the room list, the inspector, story triggers and the pilot's in-mission guide ("Location: Pump hall"). Setting one upgrades the draft to format 14.
6. **First-run hint.** A new, untouched mine shows a one-line getting-started bar above the view. **Got it** hides it for good in this browser.
7. **Narrow screens.** "Back to game" sits beside the title, and below 1400 px the viewport toolbar uses short labels (Build, Scene, Rotate, Frame) while keeping the full names for screen readers. Both bars fit on one row at 1366 wide, and the toolbar fits at 1024.
8. **Playtest from here.** **Playtest from this room** (Room tab or right-click menu) starts the ship in the selected room, using a throwaway copy of the level.

Covered by `tests/editor-polish.test.mjs` (6 unit tests) and the second test in `tests/browser/editor-layout.spec.js`.

## Still open

- Group moves preview only the primary room while dragging; the other rooms jump into place on release. Items in a group do follow during the drag.
- Validation messages from the core validator still name rooms by ID, not by label.
