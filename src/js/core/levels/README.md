# Mission authoring

Finite missions use the validated shared level documents in `documents/`. Open `/editor.html` to build and play a mission without editing code. Export JSON for portable backups.

The campaign is defined by `Campaign.js` and three v7 documents: Signal Breach, Vector Foundry and Nightfall Reactor. Each has seven spaces, authored relay/door progression, pickups and color/pattern landmarks. The last mission requires two guard defeats. The previous Level1/Level2/Level3/ExampleLevel segment blueprints have been removed.

Use the editor's **Open example** to inspect Signal Breach. Select a wall or item and right-click for actions. **Build tools** and the searchable **Scene browser** are optional panels. Import/export round trips use the exact same compiler, collision solids and objectives as the runtime.

See [the document format](../../../../docs/LEVEL_DOCUMENT_FORMAT.md), [editor design](../../../../docs/LEVEL_EDITOR_DESIGN.md), and [current player experience](../../../../docs/PLAYER_EXPERIENCE.md).

Flight Training Arena, Arena Escape, Mine Link, Relay Gate and Deep Relay remain available in **Practice & prototypes** for testing and practice. These are finite fixtures. `LevelBlueprint.js` and `SegmentTypes.js` support the internal endless generator and its regression checks; do not use them to author new campaign missions. Endless mode is no longer a mission-library choice.