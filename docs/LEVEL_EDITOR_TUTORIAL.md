# Level editor tutorial

Build and play your first DESCENDED mission in about fifteen minutes. The same ten steps are available inside the editor: choose **Start the tutorial** on the hint bar of a new mine, or **Tutorial** next to the title at any time. The in-editor guide ticks each step off as you do it.

Open the editor from the game's main menu (**LEVEL DESIGNER**) or at `/editor.html`.

## 1. Look around

- **Drag** in the view to orbit, **right-drag** to pan and **scroll** to zoom.
- **1–4** switch between 3D, Top, Front and Side views. **F** focuses the selection.
- **Click** a wall, floor or item to select it. The panel on the right shows its properties in tabs: Room, Wall, Content and Connections.

## 2. Add a second room

Right-click a wall of the starter room and choose **Attach room at this point**. The rooms are joined by a passage with a cyan frame. From the same menu:

- **Attach corridor at this point** adds a straight corridor (a vertical shaft on a floor or ceiling).
- **Attach ramp or diagonal corridor…** adds a sloped or sideways corridor.
- **Connect to existing room…** joins two rooms whose walls already face each other, which is how you close a loop.

Resize a room by dragging with **Stretch** (R) or with **Resize and keep connections…** on the Room tab. Attached rooms move with it.

## 3. Name a room

Click the room, then click the **Room name** box on the right-hand side of the screen, directly under the selected room's title (it is there whichever tab is open; **Mine name** at the top left names the whole level), type a name and press Enter. Or right-click inside the room and choose **Name this room…**. Click into the box before typing: with the 3D view focused, letters such as Q, W, E and R are tool shortcuts. The name appears in the room list and story triggers, and in the pilot's guide during the mission ("Location: Pump hall"). Naming a room saves the level in format 14.

## 4. Place an enemy

Right-click the floor of a room and choose **Place enemy…**, pick a type, then **Place enemy**. While you hover a placement item, a white marker shows where it will go (red means it doesn't fit). Enemies are required kills unless you untick **Required for completion** on the Content tab.

The same menu places health and ammo pickups, relays, reactors, data logs and trapped miners. It also moves the player spawn and the exit.

## 5. Lock the way with a door

Right-click a cyan passage frame and choose **Add or edit door…**:

| Door | How the pilot opens it |
| --- | --- |
| Shot door | Shoot it |
| Concealed panel | Shoot the hidden wall |
| Relay gate | Activate the linked relay (R) |
| Force field | Activate the linked relay; blocks ships and shots until then |

The dialog can place a reachable relay for you. Relays and reactors are objectives too; **Reactor escape…** in the top bar turns one into a timed escape.

## 6. Move the exit

Right-click the floor of the far room and choose **Move exit here**. The mission completes when the pilot has cleared the required enemies and relays and flies into the green exit ring.

## 7. Tell the story

Open **Story & radio…** in the top bar and choose **Add radio message**. Set a speaker, the text and when it plays:

- at mission start;
- when the pilot enters a room;
- when a relay is activated or a reactor destroyed;
- when a robot is destroyed.

Messages with the same trigger play in list order; **Earlier** and **Later** reorder them.

## 8. Hide a data log or a trapped miner

Right-click a floor and choose **Place data log here…** (a title and text) or **Place trapped miner here…** (a name). Logs are read later in the pause-menu mission log. Miners count as rescued when the pilot flies close and then reaches the exit. Both are optional objectives with score bonuses.

## 9. Playtest

**Playtest level** flies the mission as it stands. **Playtest from this room** (Room tab or right-click menu) starts the ship in the selected room, for testing a late section. **Return to editor** brings you back with your document and undo history intact.

If something is wrong, the bar under the view lists it and blocks export and playtest. Click an issue to jump to the room, item or opening concerned.

## 10. Save and share

- **Save to My Levels** keeps the level in this browser. In the game, **MY LEVELS** plays it.
- **New campaign** in My Levels chains several levels into a story with a briefing before each mission.
- **Export JSON** (or **Export campaign**) downloads a file you can share; others load it with **Import level JSON** or **Import campaign**.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Q / W / E / R | Select / Move / Rotate / Stretch |
| Delete or Backspace | Delete the selected item, room or group |
| Shift- or Ctrl-click | Add to or remove from the selection |
| Ctrl+Z / Ctrl+Y | Undo / Redo (the buttons' tooltips name the edit) |
| F | Focus the selection |
| 1 / 2 / 3 / 4 | 3D / Top / Front / Side view |
| Shift+F10 or the Menu key | Open the right-click menu from the keyboard |
| Esc | Close a menu or cancel a drag |

## Tips

- Every edit can be undone, including group moves and deletes.
- Your work is saved as a browser draft as you go; after a crash or reload, **Restore draft** brings it back.
- **Open example** loads Signal Breach, a finished mission with story, logs and miners, to take apart.
- The format reference is in [level document format](LEVEL_DOCUMENT_FORMAT.md).
