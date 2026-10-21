# My Levels

Open **MY LEVELS** from the main menu or **SELECT MISSION**. This is a collection of your own levels, separate from the built-in campaign and practice missions.

## Create, save and play

1. Choose **Create a level**, or open the existing **LEVEL DESIGNER**.
2. Build a valid mine and give it a name. Choose **Save to My Levels** in the editor's document toolbar.
3. Follow **Back to game**, open **MY LEVELS**, and choose **Play level** on its card.

Each card also offers **Open in editor**, **Export JSON**, **Rename** and **Delete**. Deletion asks for confirmation. Editor saves update the opened library entry; **Save a copy** creates an independent entry. Starting a new mine, importing another file, opening an example or restoring a draft detaches the editor from the previously opened library entry, preventing an unrelated document from overwriting it.

Standalone user levels support the normal objectives, doors, enemies, reactors, escape timers, loss, completion and replay. They use their authored starting equipment and reset on replay. They do not advance into the built-in campaign or appear among its practice missions.

## Share and import

Choose **Export JSON** to download a portable level file. Another player can open **MY LEVELS → Import level JSON**, select that file and play it directly. The same file can be imported into the editor. Existing formats 1–12 use the shared validation and game loader; malformed or invalid levels do not replace saved content.

Imports create separate library entries. Many editor-created levels share the internal ID `custom-mine`; that does not make them the same saved level. Importing the same file twice deliberately creates two copies. Renaming changes its displayed/authored name and preserves its geometry, objective links and internal IDs.

## Saving and limits

Levels are saved in this browser for this site, with up to 32 entries and a bounded total size. Different browsers, profiles and site addresses have separate collections. Export files for backups and sharing; clearing site data removes the local collection.

If browser saving is blocked or full, **MY LEVELS** clearly labels the collection temporary. Imported content remains playable and exportable while navigating the game in that page, but disappears on reload. **Open in editor** is available only for a successfully saved collection, so it cannot open an older disk copy of a temporary edit. When an editor save fails, the document stays unsaved and JSON export/playtest remain available. Existing unreadable stored data is preserved rather than silently replaced.

The library re-reads saved data before mutations. If another tab changed or deleted the level currently open in the editor, saving reports the conflict. Reopen the saved version or use **Save a copy** to keep your edited version separately.

## Next steps

This is the first step toward user campaigns. Campaign ordering, briefings, campaign bundle import/export and saved campaign progression are not implemented yet. The next gameplay priority is a more mobile fighter with a compact combat test level, followed by difficulty and encounter tuning.

## Verification

`npm run verify` covers scoped lint/type checks, 476 unit/simulation tests and the production build. New library checks cover persistence, snapshots, duplicate IDs, invalid imports, old/current documents, bounded capacity, storage failure, cross-tab saves/deletions and standalone completion/replay routing.

Production browser coverage is in `tests/browser/user-levels.spec.js`: import/reload/play/complete/replay/rename/export/delete; save/open/update/copy through the editor and a second tab; and temporary play/export plus editor unsaved state when saving is blocked. It uses actual file inputs, menus, keyboard flight, downloads and reloads. It is functional coverage, not a new hardware performance measurement.

All three new workflows and three existing mission/settings/editor regressions passed in the final six-test browser run. The desktop library, 390-pixel layout and editor toolbar were inspected. See [the check record](progress/my-levels-browser-check.json), [desktop library](progress/my-levels-library.png), [small-screen layout](progress/my-levels-mobile.png) and [editor save controls](progress/my-levels-editor-save.png).
