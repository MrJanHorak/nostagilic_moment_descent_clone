# DESCENDED - Zero Gravity Shooter

> **Project status (October 19, 2026):** **[M1 is accepted](docs/M1_ACCEPTANCE.md)** and **[M3 is accepted](docs/M3_ACCEPTANCE.md)**. The owner reports hosted CI passes. M2's hardware frame-time acceptance remains open (last Intel GPU p95 about 18 ms against the provisional 16.7 ms target). [M4's latest checkpoint](docs/progress/M4_LOOPS_AND_SHARED_OPENINGS.md) adds off-center loop joining, corridor-end fitting, full shared openings and multiple relay doors on one wall, alongside direct item movement and local recovery. Author/export/reload/play/return/undo has automated coverage; human M4 acceptance remains. See the [roadmap](docs/ROADMAP.md).

**Try the designer:** run `npm run dev` and open `/editor.html`, or choose **LEVEL DESIGNER** from the main menu. Click a wall/item to select it; right-click to style a face, edit an opening/door or place content at that point. Right-drag still pans; Shift+F10 or **Actions** opens the keyboard menu. Use **Playtest level** for first-person flight, then Esc and **Return to editor**. Drafts save locally and offer Restore/Discard on reload; export JSON for a portable backup. See [the UX/authoring guide](docs/progress/M4_DESIGNER_UX.md).

**Close loops and add doors:** right-click an end/wall → **Connect to existing room…**. Use **Fit corridor end to target** when a corridor stops short or penetrates the target, or **Snap separate branch** for a disconnected piece. **Full shared opening** uses the mutual clear wall area. You can attach/join separate passages on different areas of a large wall. Right-click its cyan frame → **Add or edit relay door…**, choose an existing relay or **Create relay near player spawn**, then use R nearby in Playtest. See [the loop/door guide](docs/progress/M4_LOOPS_AND_SHARED_OPENINGS.md) for format v7 and bounds.

**Move an item:** select its marker or Mission content entry, then choose **Move** or **Move selected item**. Drag the axes; white/red feedback shows whether the placement fits. Release applies one undoable move, and Esc cancels. It stays in its room and preserves heading/objective/door links. Room rotation/stretch tools are disabled until you select a room again. See [the movement guide](docs/progress/M4_CONTENT_MOVEMENT.md).

**Build vertically:** attaching a corridor to a floor or ceiling now creates a vertical shaft. The right-click menu calls this **Attach vertical shaft at this point**. Room properties include Pitch (X)/Roll (Z), and **Rotate XYZ** exposes all three quarter-turn rings. [The orientation checkpoint](docs/progress/M4_VERTICAL_CORRIDORS.md) explains format v4 compatibility.

**Resize and keep passages:** select a room/corridor and use **Stretch** to drag local X/Y/Z dimensions, or **Resize and keep connections…** to enter precise dimensions and choose a fixed opening. Numeric size edits use the same safe behavior. Attached branches move with the change; overlaps or incompatible loops are rejected. Use **Snap connections** to repair an existing misalignment. Successful resizing opts into format v6: 256 rooms, 512 connections and dimensions up to 256 units. Older imports keep their original format until an expanded edit is needed. See [the resizing guide](docs/progress/M4_CONNECTED_RESIZING.md).

**Build slopes and diagonal walls:** choose a ramp/diagonal preset and **Attach shaped corridor**, or right-click a wall → **Attach ramp or diagonal corridor…** to combine rise and sideways offset. The preview and game share real convex wall collision and end openings. Sloped sides can be styled; connections use the two rectangular ends. See [the shaped-corridor guide](docs/progress/M4_SHAPED_CORRIDORS.md) for format v5 and bounds.

Run `npm run verify` for scoped lint/type checks, unit/simulation/metrics regressions and the production build. Use `npm run lint` or `npm run typecheck` separately while editing the [checked modules](docs/progress/M3_ROOM_NAVIGATION.md). Run `npm run browser:install` once, then `npm run test:browser` for production and restart browser checks. Run `npm run smoke` for development diagnostics, or `npm run profile:arena` for three warmed hardware captures with renderer verification. See the [browser checkpoint](docs/progress/M2_BROWSER.md) and [profiling checkpoint](docs/progress/M2_PERFORMANCE.md) for coverage, commands and limits.

A 3D zero-gravity shooter game in the style of Descent, built with JavaScript and Three.js. Pilot your spaceship through procedurally generated cave tunnels, battle enemies, and collect power-ups.

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

DESCENDED is a first-person 3D shooter with zero-gravity movement inspired by the classic game Descent. Navigate through procedurally generated tunnels, destroy enemy ships, and collect power-ups to increase your score and survival chances.

### Game Mechanics

- **Zero Gravity Movement**: Full 6 degrees of freedom movement with your spaceship
- **Multiple Game Modes**: Choose between level-based play or endless procedural generation
- **Dynamic Lighting**: Advanced lighting system that brings the cave environment to life
- **Enemy AI**: Five distinct enemy types with unique behaviors and attack patterns:
  - **Scouts**: Fast but fragile reconnaissance ships
  - **Fighters**: Balanced combat ships with moderate firepower
  - **Bombers**: Heavy ships that deploy explosives
  - **Destroyers**: Heavily armored ships with devastating weaponry
  - **Bosses**: Massive command ships with multiple attack patterns
- **Weapon System**: Multiple weapon types with unique characteristics:
  - **Pulse**: Basic weapon; Arena Escape starts with 40 rounds and has a refill, while practice/legacy modes retain unlimited ammo
  - **Laser**: High-accuracy beam weapon
  - **Missile**: Explosive projectiles with splash damage
  - **Plasma**: Advanced energy weapon with high damage
- **Power-up System**: Collect various power-ups that enhance your ship's capabilities
- **Scoring System**: Earn points by defeating enemies and surviving longer

## Technologies Used

- **JavaScript**: Core programming language
- **Three.js**: 3D rendering engine
- **WebGL**: GPU-accelerated rendering
- **Vite**: Build tool and development server
- **Web Audio API**: Advanced audio management with spatial effects
- **Netlify**: Deployment and hosting platform

## Features

- Responsive 3D graphics with dynamic lighting
- Particle systems for explosions and environmental effects
- Spatial audio for immersive gameplay
- Multiple enemy types with unique behaviors:
  - **Scouts**: Fast, agile ships with basic attacks
  - **Fighters**: Balanced ships with moderate firepower
  - **Bombers**: Slow but powerful ships with explosive weapons
  - **Destroyers**: Heavy ships with strong armor and high damage
  - **Bosses**: End-level enemies with complex attack patterns and high health
- Various power-up types with distinct effects:
  - **Health**: Repair your shield by 25%
  - **Speed Boost**: Temporarily increase movement speed
  - **Weapon Upgrade**: Temporarily enhance weapon power
  - **Weapon Pickup**: Acquire new weapons with ammo
  - **Ammo Pickup**: Replenish ammunition for special weapons
- Level progression system with increasing difficulty
- Endless mode with procedurally generated content
- Collision detection and physics system
- Performance optimizations for smooth gameplay

## Game Modes

### Level-Based Mode

- Multiple handcrafted levels with unique layouts:
  - **Level 1**: Cave Introduction - A beginner-friendly level to learn the controls
  - **Level 2**: Advanced Cave Network - More challenging with varied obstacles
  - **Level 3**: Deep Complex - Higher difficulty with more enemies
  - **Example Level**: Demonstration level showcasing all game features
- Predefined enemy and power-up placements
- Each level has specific obstacle patterns and lighting themes
- Progression through increasingly difficult challenges
- Boss encounters at the end of key levels

### Endless Mode

- Procedurally generated tunnel segments that continue infinitely
- Random obstacle placement for endless variety
- Dynamically spawning enemies and power-ups
- Gradually increasing difficulty

## Getting Started

### Prerequisites

- Node.js **24.22.0** (pinned in `.nvmrc`; see [toolchain setup](docs/TOOLCHAIN.md))
- npm **11.21.1** (declared in `package.json`; CI installs it explicitly)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/descended-game.git
   cd descended-game
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
- **Reboot / Replay buttons**: Restart after death or completion; restart during play from the pause menu

## Code Structure

The project is organized into several modules for better maintainability:

```text
index.html -> main.js -> src/js/main.js  # Live game entry
src/js/
  core/             # Session, input, audio, settings, level runtime
    levels/         # Finite arenas and legacy executable blueprints
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

### Renderer

The game uses Three.js WebGL renderer for high-performance 3D graphics with dynamic lighting and shadow effects.

### Level System

- Blueprint-based level design system
- Different segment types (straight, curved, boss rooms)
- Various obstacle patterns
- Custom light colors for atmospheric effects
- Segment streaming for performance optimization

### Physics

Custom collision detection between projectiles, enemies, and environment obstacles.

### Audio

WebAudio API for 3D spatial audio effects and dynamic sound management with:

- Positional audio for enemies and effects
- Synthesized sound fallbacks with option for custom audio files
- Adaptive audio based on game state

### Performance Optimization

- Object pooling for projectiles
- Level streaming (only rendering visible tunnel segments)
- Distance-based enemy activation
- Optimized collision detection

## Future Enhancements

- Boss encounters
- Expanded weapon upgrade system
- Additional power-ups with unique effects
- Level objectives and mission system
- Multiplayer mode
- Mobile touch controls
- VR support

## Credits and Acknowledgments

- Three.js community for the excellent 3D library
- Sound effects created with Web Audio API
- Inspired by the classic game Descent
