# DESCENT - Zero Gravity Shooter

A 3D zero-gravity shooter game in the style of Descent, built with JavaScript and Three.js. Pilot your spaceship through procedurally generated cave tunnels, battle enemies, and collect power-ups.

![Game Screenshot](public/screenshot.png)

## Table of Contents

- [Game Overview](#game-overview)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Getting Started](#getting-started)
- [Controls](#controls)
- [Code Structure](#code-structure)
- [Technical Details](#technical-details)
- [Future Enhancements](#future-enhancements)
- [Credits and Acknowledgments](#credits-and-acknowledgments)

## Game Overview

DESCENT is a first-person 3D shooter with zero-gravity movement inspired by the classic game Descent. Navigate through procedurally generated tunnels, destroy enemy ships, and collect power-ups to increase your score and survival chances.

### Game Mechanics

- **Zero Gravity Movement**: Full 6 degrees of freedom movement with your spaceship
- **Procedurally Generated Cave System**: Endless tunnel exploration
- **Dynamic Lighting**: Advanced lighting system that brings the cave environment to life
- **Enemy AI**: Multiple enemy types with different behaviors
- **Power-up System**: Collect power-ups that enhance your ship's capabilities
- **Scoring System**: Earn points by defeating enemies and surviving longer

## Technologies Used

- **JavaScript**: Core programming language
- **Three.js**: 3D rendering engine
- **WebGL**: GPU-accelerated rendering
- **Vite**: Build tool and development server
- **Web Audio API**: Advanced audio management

## Features

- Responsive 3D graphics
- Dynamic lighting effects
- Particle systems for explosions and environmental effects
- Spatial audio for immersive gameplay
- Power-up collection and effects system
- Enemy AI with different behavior patterns
- Collision detection and physics

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm (v6+) or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/descent-game.git
   cd descent-game
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

## Code Structure

The project is organized into several modules for better maintainability:

```
src/
├── js/
│   ├── core/           # Core game systems
│   │   ├── AudioManager.js
│   │   ├── GameState.js
│   │   ├── InputManager.js
│   │   └── LevelManager.js
│   ├── entities/       # Game objects
│   │   ├── EnemyManager.js
│   │   ├── PowerUpManager.js
│   │   ├── ProjectileManager.js
│   │   └── Spaceship.js
│   ├── ui/             # User interface components
│   │   └── UIManager.js
│   ├── utils/          # Utility functions
│   │   ├── debugUtils.js
│   │   └── effectsUtils.js
│   └── main.js         # Main game initialization
├── style.css
└── index.html
```

## Technical Details

### Renderer

The game uses Three.js WebGL renderer for high-performance 3D graphics.

### Physics

Custom collision detection between projectiles, enemies, and the environment.

### Audio

WebAudio API for 3D spatial audio effects and dynamic sound management.

### Performance Optimization

- Object pooling for projectiles
- Level streaming (only rendering visible tunnel segments)
- Distance-based enemy activation

## Future Enhancements

- Boss encounters
- Weapon upgrade system
- Additional power-ups
- Level objectives
- Multiplayer mode
- Mobile touch controls

## Credits and Acknowledgments

- Three.js community for the excellent 3D library
- Sound effects from [source]
- Inspired by the classic game Descent
