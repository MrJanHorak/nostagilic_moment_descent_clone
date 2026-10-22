# Mission authoring

Finite missions use the validated shared level documents in `documents/`. Open `/editor.html` to build and play a mission without editing code. Export JSON for portable backups.

The campaign is defined by `Campaign.js`: Signal Breach uses v8 (eleven spaces); Vector Foundry uses v11 and Nightfall Reactor uses v10 (seven spaces each). They share authored relay/door progression, pickups and color/pattern landmarks. Signal Breach introduces a shot-open entry door, a concealed repair alcove, a sliding extraction gate, a ranged fighter, arrival doorway cover, a ceiling-hatch route through an overhead gallery, and a scout in the optional maintenance branch. Its kills are optional. Nightfall requires two guard defeats. Asterion Deepworks adds 48 spaces, nine loops, three secrets, three required guards and a destructible reactor. The previous Level1/Level2/Level3/ExampleLevel segment blueprints have been removed.

Use the editor's **Open example** to inspect Signal Breach. Select a wall or item and right-click for actions. **Build tools** and the searchable **Scene browser** are optional panels. Import/export round trips use the exact same compiler, collision solids and objectives as the runtime.

See [the document format](../../../../docs/LEVEL_DOCUMENT_FORMAT.md), [editor design](../../../../docs/LEVEL_EDITOR_DESIGN.md), and [current player experience](../../../../docs/PLAYER_EXPERIENCE.md).

Flight Training Arena, Arena Escape, Mine Link, Relay Gate, Deep Relay and Fighter Proving Ground remain available in **Practice & prototypes** for testing and practice. These are finite fixtures; the proving ground is a four-room loop with two mobile fighters and five-damage pulse fire. `LevelBlueprint.js` and `SegmentTypes.js` support the internal endless generator and its regression checks; do not use them to author new campaign missions. Endless mode is no longer a mission-library choice.

Use **Save to My Levels** to keep an authored mine in the browser, **Save a copy** for an independent entry, and JSON export/import for sharing. See [the library guide](../../../../docs/USER_LEVELS.md). Built-in campaign advancement exists; saved campaign progress and custom campaign bundles remain future work.

Vector Foundry’s lower lift hatch is protected by a relay-controlled force field; Nightfall Reactor’s shutdown starts a timed return to arrival.
