// Game state management
import { shakeCamera } from '../utils/effectsUtils.js';

class GameState {
  constructor() {
    this.playerHealth = 100;
    this.maxPlayerHealth = 100;
    this.score = 0;
    this.isGameOver = false;
    this.isGameStarted = false;
    this.isPaused = false;
    this.speedMultiplier = 1.0;
    this.weaponPower = 1;

    // Weapon system
    this.currentWeapon = 'pulse'; // Default weapon
    this.weaponInventory = {
      pulse: { unlocked: true, ammo: Infinity }, // Basic weapon with unlimited ammo
      laser: { unlocked: false, ammo: 0 },
      missile: { unlocked: false, ammo: 0 },
      plasma: { unlocked: false, ammo: 0 },
    };

    // References to other game systems (assigned by main.js)
    this.camera = null;
    this.audioManager = null;
    this.uiManager = null;
    this.activeAnimations = [];
    // Track player's enemy kill statistics
    this.enemyKills = {
      scout: 0,
      fighter: 0,
      bomber: 0,
      destroyer: 0,
      boss: 0,
    };

    // Track collected weapon pickups
    this.weaponPickups = {
      laser: 0,
      missile: 0,
      plasma: 0,
    };
  }

  // Record an enemy kill
  recordEnemyKill(enemyType) {
    if (this.enemyKills[enemyType] !== undefined) {
      this.enemyKills[enemyType]++;

      // Update UI if needed
      if (this.uiManager && this.uiManager.updateKillCounter) {
        this.uiManager.updateKillCounter(this.enemyKills);
      }
    }
  }

  // Record weapon pickup
  recordWeaponPickup(weaponType) {
    if (this.weaponPickups[weaponType] !== undefined) {
      this.weaponPickups[weaponType]++;
    }
  }

  // Switch weapon if it's unlocked
  switchWeapon(weaponType) {
    if (this.weaponInventory[weaponType]?.unlocked) {
      this.currentWeapon = weaponType;
      // Update weapon UI if UI manager exists
      if (this.uiManager) {
        this.uiManager.updateWeaponUI();
      }

      // Play weapon switch sound if audio manager exists
      if (this.audioManager && this.audioManager.initialized) {
        this.audioManager.playSound('weaponSwitch', { volume: 0.3 });
      }

      return true;
    }
    return false;
  }

  // Add ammo to a weapon type and unlock it if not already unlocked
  addWeaponAmmo(weaponType, amount) {
    if (this.weaponInventory[weaponType]) {
      this.weaponInventory[weaponType].unlocked = true;

      // Only add ammo if not infinite
      if (this.weaponInventory[weaponType].ammo !== Infinity) {
        this.weaponInventory[weaponType].ammo += amount;
      }

      // Update weapon UI
      if (this.uiManager) {
        this.uiManager.updateWeaponUI();
      }
    }
  }

  // Reset weapon inventory (e.g., when starting a new game)
  resetWeaponInventory() {
    this.currentWeapon = 'pulse';
    this.weaponInventory = {
      pulse: { unlocked: true, ammo: Infinity },
      laser: { unlocked: false, ammo: 0 },
      missile: { unlocked: false, ammo: 0 },
      plasma: { unlocked: false, ammo: 0 },
    };

    // Update weapon UI
    if (this.uiManager) {
      this.uiManager.updateWeaponUI();
    }
  }

  // Set references to other game components
  setReferences(
    camera,
    audioManager,
    uiManager,
    activeAnimations,
    game = null
  ) {
    this.camera = camera;
    this.audioManager = audioManager;
    this.uiManager = uiManager;
    this.activeAnimations = activeAnimations;
    this.game = game; // Add reference to main game object
  }

  // Handle player taking damage
  takeDamage(amount) {
    this.playerHealth -= amount;

    // Play damage sound
    if (this.audioManager && this.audioManager.initialized) {
      this.audioManager.playSound('playerDamage', { volume: 0.6 });
    }

    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.gameOver();
    }

    // Update HUD
    if (this.uiManager) {
      this.uiManager.updateHUD();
    }

    // Visual feedback - screen flash
    const flashEffect = document.createElement('div');
    flashEffect.style.position = 'absolute';
    flashEffect.style.top = '0';
    flashEffect.style.left = '0';
    flashEffect.style.width = '100%';
    flashEffect.style.height = '100%';
    flashEffect.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
    flashEffect.style.pointerEvents = 'none';
    flashEffect.style.zIndex = '1000';
    flashEffect.style.transition = 'opacity 0.5s ease-out';
    document.body.appendChild(flashEffect);

    // Fade out and remove
    setTimeout(() => {
      flashEffect.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(flashEffect);
      }, 500);
    }, 100);

    // Camera shake for damage feedback
    if (this.camera) {
      const shakeIntensity = Math.min(1.0, amount / 20);
      const shakeAnim = shakeCamera(this.camera, shakeIntensity);
      if (this.activeAnimations) {
        this.activeAnimations.push(shakeAnim);
      }
    }
  }

  // Heal the player
  healPlayer(amount) {
    this.playerHealth = Math.min(
      this.maxPlayerHealth,
      this.playerHealth + amount
    );

    if (this.uiManager) {
      this.uiManager.updateHUD();
    }

    // Visual feedback - green flash
    const flashEffect = document.createElement('div');
    flashEffect.style.position = 'absolute';
    flashEffect.style.top = '0';
    flashEffect.style.left = '0';
    flashEffect.style.width = '100%';
    flashEffect.style.height = '100%';
    flashEffect.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
    flashEffect.style.pointerEvents = 'none';
    flashEffect.style.zIndex = '1000';
    flashEffect.style.transition = 'opacity 0.5s ease-out';
    document.body.appendChild(flashEffect);

    // Fade out and remove
    setTimeout(() => {
      flashEffect.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(flashEffect);
      }, 500);
    }, 200);

    // Play heal sound
    if (this.audioManager && this.audioManager.initialized) {
      this.audioManager.playSound('healSound', { volume: 0.5 });
    }
  }

  // Game over handling
  gameOver() {
    if (this.isGameOver) return;

    this.isGameOver = true;

    // Update UI
    if (this.uiManager) {
      this.uiManager.updateHUD();
      this.uiManager.showGameOver();
    }

    // Sound effects for game over
    if (this.audioManager && this.audioManager.initialized) {
      // Stop engine sound
      if (this.audioManager.sounds.engine) {
        this.audioManager.sounds.engine.fadeOut(1.0);
      }

      // Stop background music with fade out
      if (this.audioManager.music) {
        this.audioManager.music.fadeOut(2.0);
      }

      // Play game over sound
      this.audioManager.playSound('gameOver', { volume: 0.6 });
    }

    // Release pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  // Handle level completion
  levelCompleted() {
    if (this.isGameOver) return;

    // Visual feedback
    if (this.uiManager) {
      this.uiManager.showMessage('LEVEL COMPLETE!', 3000, '#00ff00');
    }

    // Victory sound
    if (this.audioManager && this.audioManager.initialized) {
      this.audioManager.playSound('powerup', { volume: 0.7 });
    }

    // Award bonus points
    const levelBonus = 1000;
    this.score += levelBonus;

    // Show bonus notification
    setTimeout(() => {
      if (this.uiManager) {
        this.uiManager.showMessage(
          `BONUS: +${levelBonus} POINTS`,
          2000,
          '#ffff00',
          80 // Default position
        );
      }
    }, 1500);

    // Progress to next level after a delay
    setTimeout(() => {
      // Check if there's another level
      if (this.game && this.game.levelManager) {
        const nextLevelIndex = this.game.levelManager.currentLevelIndex + 1;

        if (nextLevelIndex < this.game.levelManager.levels.length) {
          // Load next level
          this.game.levelManager.loadLevel(nextLevelIndex);
          this.uiManager.showMessage(
            `STARTING LEVEL ${nextLevelIndex + 1}`,
            2000,
            '#00ffff',
            80 // Appears lower
          );
        } else {
          // No more levels - show game complete
          this.uiManager.showMessage('ALL LEVELS COMPLETE!', 3000, '#ffaa00');
          setTimeout(() => {
            // Return to level selection or show final stats
            if (this.game && this.game.showLevelSelection) {
              this.game.showLevelSelection();
            }
          }, 4000);
        }
      }
    }, 5000);
  }
}

export default GameState;
