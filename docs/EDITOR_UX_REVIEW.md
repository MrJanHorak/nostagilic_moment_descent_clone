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

## Remaining, in priority order

1. **Inspector density.** The Room tab is mostly numbers and paragraphs of help, and "Resize and keep connections…" is the largest control on screen. Show size as one "16 × 12 × 16" line with an Edit button, put rotation and position under an "Advanced transform" fold, and move help text into short tooltips.
2. **Duplicate paths for the same job.** Build tools → "Add mission content" asks for XYZ coordinates although right-click placement is easier. "Connect existing rooms" exists both as a form and as a dialog. Keep one path for each (right-click and the dialog) and turn the panels into shortcuts to them.
3. **Selection shortcuts.** Delete/Backspace deletes the selected item or room, and W / E / R switch Move / Stretch / Rotate. Undo and Redo tooltips should name the edit they will revert ("Undo: Place enemy").
4. **Multi-select.** Shift-click to select several items or rooms, then move or delete them together. This is the largest item here; it needs a group transform and one undo step for the whole group.
5. **Readable names.** Rooms appear as `room-7`. An optional display label per room (a format change) would make the scene list, triggers and validation messages readable. Story triggers already show room IDs, so this helps the story tools too.
6. **First-run guidance.** A new mine shows one box and no hint. A dismissible empty-state card ("Right-click a wall to attach a room · Right-click the floor to place things · Playtest any time") would help new authors.
7. **Narrow screens.** At 1024 wide the viewport toolbar wraps and the help line is cut off. Icon buttons with tooltips for Move, Stretch, Rotate and the camera presets would keep it on one row.
8. **Playtest from here.** Start a playtest at the selected room instead of the spawn, for testing a late section quickly.

Items 1–3 are small and low-risk. Item 4 is a few days of work. Item 5 changes the level format (version 14).
