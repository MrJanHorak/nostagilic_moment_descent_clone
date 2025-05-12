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

    // References to other game systems (assigned by main.js)
    this.camera = null;
    this.audioManager = null;
    this.uiManager = null;
    this.activeAnimations = [];
  }

  // Set references to other game components
  setReferences(camera, audioManager, uiManager, activeAnimations) {
    this.camera = camera;
    this.audioManager = audioManager;
    this.uiManager = uiManager;
    this.activeAnimations = activeAnimations;
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
}

export default GameState;
