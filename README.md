# DESCENDED - Zero Gravity Shooter

> **Project status (October 22, 2026):** **[M1](docs/M1_ACCEPTANCE.md), [M3](docs/M3_ACCEPTANCE.md) and [M4's functional workflow](docs/M4_ACCEPTANCE.md) are accepted.** Four campaign missions, the local designer, My Levels and Crossfire Relay are implemented. Authored enemies use [stronger tactics](docs/ENEMY_PRESSURE.md), with [increased durability, equipment salvage and usable special weapons](docs/SALVAGE_AND_WEAPONS.md). Scoped lint/types, all 507 unit/simulation tests and production build pass. Hosted CI was owner-confirmed October 18; latest-revision full browser verification and broader M2 hardware acceptance remain open. The last pre-pressure hardware capture recorded p95 16.7–16.8 ms; see [fighter verification](docs/FIGHTER_MOVEMENT.md#verification) for limits. Start with the [roadmap](docs/ROADMAP.md) and [handoff](docs/progress/NEXT_SESSION.md).

**Try the designer:** run `npm run dev` and open `/editor.html`, or choose **LEVEL DESIGNER** from the main menu. Click a wall/item to select it; right-click to style a face, edit an opening/door or place content at that point. Right-drag still pans; Shift+F10 or **Actions** opens the keyboard menu. Use **Playtest level** for first-person flight, then Esc and **Return to editor**. Drafts save locally and offer Restore/Discard on reload; export JSON for a portable backup. See [the UX/authoring guide](docs/progress/M4_DESIGNER_UX.md).

**Play and share your own levels:** open **MY LEVELS** from the main menu or mission selector to import, play, rename, export or delete a level. The designer's **Save to My Levels** adds the current mine; opening it from the library lets you update it or **Save a copy**. Levels stay in this browser; export JSON for a portable backup. See [the user level guide](docs/USER_LEVELS.md).

**Enemy pressure:** authored fighters now pursue/reposition at 4.8 units/s and fire every 1.45–1.75 seconds, with 450 ms amber warnings and 400 ms blue recovery windows. Scouts pursue at 5.4 units/s and lunge at 14. Nearby robots can respond to an ally's actual sighting. Try **SELECT MISSION → Practice & prototypes → Fighter Proving Ground** or **Crossfire Relay**. See [pressure rules](docs/ENEMY_PRESSURE.md) and [the fighter guide](docs/FIGHTER_MOVEMENT.md).

**Mixed encounter:** **SELECT MISSION → Practice & prototypes → Crossfire Relay** pits a ranged fighter and side-passage scout against direct or overhead approaches. Clear both, activate the relay and return to arrival; the green loop holds optional supplies and an unlocked shortcut. See [the route and balance checklist](docs/CROSSFIRE_RELAY.md).

**Lava, water and scout attacks:** Vector Foundry and Nightfall Reactor now include animated lava floors; Nightfall also has safe coolant water. Fly above lava to avoid shield damage. In the editor, choose a face and **lava** or **water** under **Surface pattern** to author these in format v9. These are solid surfaces; submerged flight is future work. Scouts warn, lunge in a committed direction, then retreat/recover for return fire. See [the environment and mission roadmap](docs/ENVIRONMENT_AND_MISSION_ROADMAP.md).

**Reactor escape:** Nightfall's shutdown starts a 60-second return to the arrival exit through the lift and lower loop. Clear required guards and other relays first. A visible timer stays on with the HUD hidden, freezes on pause and resets on replay. Use **Reactor escape…** in the designer to configure a trigger relay and 10–600 seconds in format v10. See [the reactor guide](docs/REACTOR_ESCAPE.md).

**Deepworks combat performance:** campaign shots, effects, robots and pickups now retain emissive visuals without changing the scene's light count. This removes the reproduced combat shader stalls. See [the hardware comparison and profiling command](docs/DEEPWORKS_COMBAT_PERFORMANCE.md).

**Close loops and add doors:** right-click an end/wall → **Connect to existing room…**. Use **Fit corridor end to target** when a corridor stops short or penetrates the target, or **Snap separate branch** for a disconnected piece. **Full shared opening** uses the mutual clear wall area. You can attach/join separate passages on different areas of a large wall. Right-click its cyan frame → **Add or edit relay door…**, choose an existing relay or **Create relay near player spawn**, then use R nearby in Playtest. See [the loop/door guide](docs/progress/M4_LOOPS_AND_SHARED_OPENINGS.md) for format v7 and bounds.

**Move an item:** select its marker or Mission content entry, then choose **Move** or **Move selected item**. Drag the axes; white/red feedback shows whether the placement fits. Release applies one undoable move, and Esc cancels. It stays in its room and preserves heading/objective/door links. Room rotation/stretch tools are disabled until you select a room again. See [the movement guide](docs/progress/M4_CONTENT_MOVEMENT.md).

**Build vertically:** attaching a corridor to a floor or ceiling now creates a vertical shaft. The right-click menu calls this **Attach vertical shaft at this point**. Room properties include Pitch (X)/Roll (Z), and **Rotate XYZ** exposes all three quarter-turn rings. [The orientation checkpoint](docs/progress/M4_VERTICAL_CORRIDORS.md) explains format v4 compatibility.

**Resize and keep passages:** select a room/corridor and use **Stretch** to drag local X/Y/Z dimensions, or **Resize and keep connections…** to enter precise dimensions and choose a fixed opening. Numeric size edits use the same safe behavior. Attached branches move with the change; overlaps or incompatible loops are rejected. Use **Snap connections** to repair an existing misalignment. Successful resizing opts into format v6: 256 rooms, 512 connections and dimensions up to 256 units. Older imports keep their original format until an expanded edit is needed. See [the resizing guide](docs/progress/M4_CONNECTED_RESIZING.md).

**Build slopes and diagonal walls:** choose a ramp/diagonal preset and **Attach shaped corridor**, or right-click a wall → **Attach ramp or diagonal corridor…** to combine rise and sideways offset. The preview and game share real convex wall collision and end openings. Sloped sides can be styled; connections use the two rectangular ends. See [the shaped-corridor guide](docs/progress/M4_SHAPED_CORRIDORS.md) for format v5 and bounds.

Run `npm run verify` for scoped lint/type checks, unit/simulation regressions and the production build. `tsconfig.check.json` declares checked source; `npm run lint` and `npm run typecheck` can run separately. Run `npm run browser:install` once, then `npm run test:browser` for the full functional browser suite. Use `npm run smoke` for diagnostics, `npm run profile:arena` for warmed arena captures, or `npm run profile:deepworks -- --renderer=hardware` for combat profiling. See [toolchain and verification](docs/TOOLCHAIN.md) for commands, evidence and limits.

A 3D zero-gravity shooter in the style of Descent, built with JavaScript and Three.js. Pilot through authored connected spaces, restore relays, battle drones and extract. Build and play your own missions in the local level designer.

![Game Screenshot](public/screenshot.jpg)

## Play Now

**[Play the game online here](https://aishootergame.netlify.app/)**

## Table of Contents

- [Game Overview](#game-overview)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Game Modes](#game-modes)
- [Getting Started](#getting-started)
- [Controls](#controls)
- [Code Structure](#code-structure)
- [Extending the Game](#extending-the-game)
- [Technical Details](#technical-details)
- [Future Enhancements](#future-enhancements)
- [Credits and Acknowledgments](#credits-and-acknowledgments)

## Game Overview

DESCENDED is a six-degree-of-freedom 3D shooter inspired by Descent. Navigate finite connected mines with loops, ramps, vertical hatches and relay doors. Choose first-person, external ship or immersive cockpit view.

### Game Mechanics

- **Zero Gravity Movement**: Full 6 degrees of freedom movement with your spaceship
- **Missions and practice**: Four authored campaign missions plus optional training/prototype fixtures
- **Lighting**: Emissive surfaces and ship headlights with stable campaign light counts
- **Enemy AI**: Scouts warn, lunge and recover; fighters strafe/change height between readable warning/fire/recovery phases. Bombers, destroyers and bosses have distinct models and projectile variants; their authored-mine tactical roles remain follow-up work
- **Pulse combat**: Signal Breach, Vector Foundry and Nightfall start with 80 rounds; Deepworks starts with 120. Authored refills replenish ammunition; the flight arena retains unlimited practice ammo
- **Legacy weapon paths**: Laser/missile/plasma inventory and visuals remain in code, but complete beam, penetration and splash mechanics are not established by those paths
- **Supplies**: Authored shield repairs and pulse ammunition reward exploration
- **Scoring**: Enemy defeats and mission completion award points

## Technologies Used

- **JavaScript**: Core programming language
- **Three.js**: 3D rendering engine
- **WebGL**: GPU-accelerated rendering
- **Vite**: Build tool and development server
- **Web Audio API**: Advanced audio management with spatial effects
- **Netlify**: Deployment and hosting platform

## Features

- Three.js/WebGL rendering with conservative static-room portal visibility
- Particle systems for explosions and environmental effects
- Spatial audio for immersive gameplay
- Five enemy models, wall-aware navigation, scout strikes and mobile fighter encounters
- Authored health pickups restore up to 25% shields; pulse refills add up to 20 rounds within capacity
- Four-mission progression through the completion screen; saved campaign progress is future work
- Sliding/shot/concealed doors, relay force fields, lava hazards and reactor escape countdowns
- Browser-local custom level library with JSON sharing, rename, update and copy
- Local level designer with portable JSON export, autosave recovery and real-runtime preview
- Collision detection and physics system
- Combat lighting regression fixes and repeatable hardware profiling; broader performance acceptance remains open

## Game Modes

### Campaign

- **Signal Breach**: Shoot the marked entry door, use cover or the blue overhead route against a ranged fighter, and activate the uplink relay to open extraction. Explore the green loop and inspect wall seams for a hidden repair alcove. Kills are optional.
- **Vector Foundry**: Disable the lift force field, follow a rising ramp and shaft, and unlock extraction. Keep above lava surfaces.
- **Nightfall Reactor**: Clear two guards, restore coolant and activate shutdown, then return through the lower loop to arrival within 60 seconds.
- **Asterion Deepworks**: Explore 48 spaces and nine loops, restore three controls, clear required guards and destroy the reactor, then reach the southern quay within 120 seconds.

Signal Breach has eleven authored spaces; Vector Foundry and Nightfall Reactor have seven each; Asterion Deepworks adds forty-eight spaces and nine independent loops. Missions include pickups, color/pattern landmarks and relay-controlled doors. Select missions individually or advance after completion. The main Start button begins Signal Breach.

### Practice and custom missions

The collapsed **Practice & prototypes** section retains Flight Training Arena, Arena Escape, Mine Link, Relay Gate, Deep Relay, Fighter Proving Ground and Crossfire Relay. The level designer and My Levels use the same validated documents as the campaign. The old finite segment levels are removed; the internal endless generator remains only for existing tests/diagnostics.

## Getting Started

### Prerequisites

- Node.js **24.22.0** (pinned in `.nvmrc`; see [toolchain setup](docs/TOOLCHAIN.md))
- npm **11.21.1** (declared in `package.json`; CI installs it explicitly)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/MrJanHorak/nostagilic_moment_descent_clone.git
   cd nostagilic_moment_descent_clone
   ```

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Controls

- **WASD**: Forward, Left, Backward, Right
- **Space**: Move Up
- **Shift/Ctrl**: Move Down
- **Mouse**: Look around
- **Q/E**: Roll left/right
- **Arrow keys**: Local yaw/pitch (keyboard alternative to mouse look)
- **Left Click / F**: Shoot (F works without mouse capture; one shot per key press)
- **ESC**: Pause game
- **R**: Activate a visible relay within 2.5 units
- **C**: Cycle first-person → external → immersive cockpit (also available in Settings)
- **M**: Expand/close the explored-room map in any flight view; flight stays active
- **L / H**: Toggle headlights / flight instruments (also available in Settings)
- **1–4**: Select an unlocked weapon; cockpit screens show selection, ammo and locked slots
- **Reboot / Replay buttons**: Restart after death or completion; restart during play from the pause menu

## Code Structure

The project is organized into several modules for better maintainability:

```text
index.html -> main.js -> src/js/main.js  # Live game entry
src/js/
  core/             # Session, input, audio, settings, level runtime
    levels/         # Campaign JSON, finite practice fixtures and shared compiler
  entities/         # Player, enemies, projectiles, pickups
    meshBuilders/   # Five concrete enemy models
  effects/          # Managed hit/explosion visuals
  ui/               # HUD, menus and settings dialog
  utils/            # Collision, disposal, diagnostics and effect helpers
  contracts.d.ts    # Shared runtime interfaces
  combatContracts.d.ts
tests/              # Runtime, compiler and browser regressions
scripts/            # Supported lint, smoke and profiling tools
archive/            # Preserved historical sources and hash manifest
```

## Extending the Game

The game is designed to be easily extendable. Check the [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for detailed instructions on:

- Adding new enemy types
- Creating new power-ups
- Implementing additional weapons
- Building custom level features
- Extending the UI

## Technical Details

### Cockpit and exploration

The industrial cockpit uses a continuous beveled dashboard, recessed weapon/navigation screens and a central round shield instrument. Diagonal canopy supports, triangular side panes, instrument hoods, textured finishes and room-palette lighting frame the view. It includes weapon silhouettes and large ammo readouts, shields/speed, a local contact scanner, an explored-room survey, modeled flight controls, panel fasteners, switches and warning lighting. The stick and thrust lever respond visually to flight; the switches are decorative. Its near-field render pass prevents walls from cutting through the cabin without changing flight physics or firing origins. H blanks the instruments and reticle while retaining the cabin; a compact mission strip remains above the windshield. See the [reviewed cockpit image](docs/progress/cockpit-canopy.png).

The automap shares the authored room/portal geometry, including rotated rooms, ramps and vertical shafts. Only entered rooms and connections between them appear. Mint marks the current room; white marks ship position/heading; amber dashed links mark closed doors between explored rooms. Discovery lasts for the current attempt and resets on replay or a new mission. It works in campaign and imported/editor missions; practice fixtures without room documents report no survey. The local contact scanner shows active enemies within 40 units relative to the ship, with height stems; it can detect contacts through walls. This first map is a fixed isometric survey, without pan/rotate/zoom or route planning.

### Renderer

The game uses Three.js/WebGL with shared wall materials, emissive markers and ship-mounted spotlights. Hardware frame-time acceptance remains open.

### Level System

- Validated, portable JSON documents shared by the editor and runtime
- Rooms, corridors, ramps, vertical shafts and loops with matching render/collision geometry
- Multiple openings per face, relay-controlled doors and mission objectives
- Sliding shot/relay doors and concealed wall panels in v8 documents; choose their controls/appearance in the editor's **Add or edit door…** dialog
- Face colors and repeating surface patterns
- Entire compact finite mission loaded together; campaign streaming is not implemented

### Physics

Custom collision detection between projectiles, enemies, and environment obstacles.

### Audio

Web Audio supplies synthesized effects and an original 40-second stereo mission score. Music/effects volumes and mute are saved; pause silences the mixer while preserving active loops. No recorded soundtrack downloads are required.

### Performance Optimization

- Reused geometry/materials and bounded effect/light ownership
- Fixed-step simulation and bounded swept movement against boxes/convex solids
- Room/portal navigation and overlap broad phase
- Runtime resource/frame diagnostics and browser regressions

## Future Enhancements

The [roadmap](docs/ROADMAP.md#next-work-queue) prioritizes human balance feedback for Crossfire Relay, one finished heavy-enemy role, broader performance/release verification, and campaign persistence/user campaigns. Rescue objectives, map controls/markers and further editor usability follow. Complete special-weapon mechanics require explicit implementation and tests. Multiplayer, mobile controls and VR require separate scope.

## Credits and Acknowledgments

- Three.js community for the excellent 3D library
- Sound effects created with Web Audio API
- Original procedural stereo mission music
- Inspired by the classic game Descent

Relay-controlled [force fields](docs/FORCE_FIELDS.md) now guard Vector Foundry’s lift. Cyan membranes absorb shots and stop ships until their control relay is activated with R. The editor supports field authoring, and the survey map marks discovered fields and controls.

[Asterion Deepworks](docs/DEEPWORKS.md) adds 48 spaces, nine loops, three hidden stores and a destructible reactor with timed extraction. Choose it in Mission Select or Open Deepworks in the designer. Reactors have editable integrity and can control gates/countdowns. The editor now places additional corridors on an already used wall, and finite mines use conservative portal visibility plus procedural panel relief and recessed fixtures.
