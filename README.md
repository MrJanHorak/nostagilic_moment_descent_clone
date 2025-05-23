# DESCENDED - Zero Gravity Shooter

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
  - **Pulse**: Basic weapon with unlimited ammo
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

- Node.js (v14+)
- npm (v6+) or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/descended-game.git
   cd descended-game
   ```

2. Install dependencies:

   ```bash
   npm install
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
- **Left Click**: Shoot
- **ESC**: Pause game
- **R**: Restart level (after game over)

## Code Structure

The project is organized into several modules for better maintainability:

```
src/
├── js/
│   ├── core/           # Core game systems
│   │   ├── AudioManager.js
│   │   ├── GameState.js
│   │   ├── InputManager.js
│   │   ├── LevelManager.js
│   │   └── levels/     # Level blueprints
│   │       ├── LevelBlueprint.js
│   │       ├── SegmentTypes.js
│   │       ├── Level1.js
│   │       ├── Level2.js
│   │       └── ExampleLevel.js
│   ├── entities/       # Game objects
│   │   ├── EnemyManager.js
│   │   ├── PowerUpManager.js
│   │   ├── ProjectileManager.js
│   │   └── Spaceship.js
│   ├── ui/             # User interface components
│   │   └── UIManager.js
│   ├── utils/          # Utility functions
│   │   ├── debugUtils.js
│   │   ├── effectsUtils.js
│   │   └── collisionUtils.js
│   └── main.js         # Main game initialization
├── style.css
└── index.html
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
