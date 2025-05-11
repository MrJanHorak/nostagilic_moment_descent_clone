// UI Manager for handling game interface elements
class UIManager {
  constructor(gameState, audioManager) {
    this.gameState = gameState;
    this.audioManager = audioManager;

    this.startScreen = null;
    this.hudElements = {
      healthBar: null,
      scoreDisplay: null,
      gameOverDisplay: null,
    };

    this.initHUD();
  }

  initHUD() {
    console.log('Initializing HUD elements');

    try {
      // Create HUD container
      const hudContainer = document.createElement('div');
      hudContainer.id = 'hud-container';
      hudContainer.style.position = 'absolute';
      hudContainer.style.top = '0';
      hudContainer.style.left = '0';
      hudContainer.style.width = '100%';
      hudContainer.style.pointerEvents = 'none';
      hudContainer.style.zIndex = '100';
      hudContainer.style.padding = '20px';
      hudContainer.style.fontFamily = 'Arial, sans-serif';
      hudContainer.style.color = '#fff';

      // Make sure document.body exists before appending
      if (document && document.body) {
        document.body.appendChild(hudContainer);
        console.log('HUD container added to DOM');
      } else {
        console.error('Cannot append HUD: document.body not available');
        return; // Exit early if we can't create the UI
      }

      // Health bar
      const healthContainer = document.createElement('div');
      healthContainer.style.marginBottom = '10px';

      const healthLabel = document.createElement('div');
      healthLabel.textContent = 'SHIELD:';
      healthLabel.style.fontSize = '14px';
      healthLabel.style.marginBottom = '5px';
      healthContainer.appendChild(healthLabel);

      const healthBarContainer = document.createElement('div');
      healthBarContainer.style.width = '200px';
      healthBarContainer.style.height = '15px';
      healthBarContainer.style.background = 'rgba(0, 0, 0, 0.5)';
      healthBarContainer.style.border = '1px solid #00aaff';
      healthBarContainer.style.borderRadius = '3px';
      healthBarContainer.style.overflow = 'hidden';

      const healthBarInner = document.createElement('div');
      healthBarInner.id = 'health-bar-inner';
      healthBarInner.style.height = '100%';
      healthBarInner.style.width = '100%';
      healthBarInner.style.background =
        'linear-gradient(to right, #00ff00, #aaff00)';
      healthBarInner.style.transition = 'width 0.3s ease-out';
      healthBarContainer.appendChild(healthBarInner);
      healthContainer.appendChild(healthBarContainer);
      hudContainer.appendChild(healthContainer);

      this.hudElements.healthBar = healthBarInner;

      // Score display
      const scoreDisplay = document.createElement('div');
      scoreDisplay.id = 'score-display';
      scoreDisplay.style.fontSize = '24px';
      scoreDisplay.style.fontWeight = 'bold';
      scoreDisplay.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.7)';
      scoreDisplay.textContent = 'SCORE: 0';
      hudContainer.appendChild(scoreDisplay);

      this.hudElements.scoreDisplay = scoreDisplay;

      // Game over display (initially hidden)
      const gameOverDisplay = document.createElement('div');
      gameOverDisplay.id = 'game-over-display';
      gameOverDisplay.style.position = 'absolute';
      gameOverDisplay.style.top = '50%';
      gameOverDisplay.style.left = '50%';
      gameOverDisplay.style.transform = 'translate(-50%, -50%)';
      gameOverDisplay.style.textAlign = 'center';
      gameOverDisplay.style.display = 'none';
      gameOverDisplay.style.zIndex = '200';
      gameOverDisplay.style.pointerEvents = 'auto';
      gameOverDisplay.style.width = '400px';
      gameOverDisplay.style.padding = '30px';
      gameOverDisplay.style.background = 'rgba(0, 0, 0, 0.7)';
      gameOverDisplay.style.border = '2px solid #ff0000';
      gameOverDisplay.style.borderRadius = '10px';

      const gameOverTitle = document.createElement('h2');
      gameOverTitle.textContent = 'GAME OVER';
      gameOverTitle.style.color = '#ff0000';
      gameOverTitle.style.fontSize = '36px';
      gameOverTitle.style.marginBottom = '20px';
      gameOverDisplay.appendChild(gameOverTitle);

      const finalScore = document.createElement('p');
      finalScore.id = 'final-score';
      finalScore.style.fontSize = '24px';
      finalScore.style.marginBottom = '30px';
      gameOverDisplay.appendChild(finalScore);

      const restartButton = document.createElement('button');
      restartButton.textContent = 'RESTART';
      restartButton.style.padding = '10px 30px';
      restartButton.style.fontSize = '20px';
      restartButton.style.background = '#aa0000';
      restartButton.style.color = '#fff';
      restartButton.style.border = 'none';
      restartButton.style.borderRadius = '5px';
      restartButton.style.cursor = 'pointer';
      restartButton.onclick = () => window.location.reload();
      gameOverDisplay.appendChild(restartButton);

      document.body.appendChild(gameOverDisplay);

      this.hudElements.gameOverDisplay = gameOverDisplay;
      this.hudElements.finalScore = finalScore;
    } catch (error) {
      console.error('Error initializing HUD:', error);
    }
  }

  createStartScreen() {
    try {
      console.log('Creating start screen');
      const startScreen = document.createElement('div');
      startScreen.style.position = 'absolute';
      startScreen.style.top = '0';
      startScreen.style.left = '0';
      startScreen.style.width = '100%';
      startScreen.style.height = '100%';
      startScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      startScreen.style.display = 'flex';
      startScreen.style.flexDirection = 'column';
      startScreen.style.justifyContent = 'center';
      startScreen.style.alignItems = 'center';
      startScreen.style.zIndex = '1000';

      startScreen.innerHTML = `
        <h1 style="color: #fff; font-size: 48px; margin-bottom: 20px;">DESCENT</h1>
        <h2 style="color: #fff; font-size: 24px; margin-bottom: 40px;">Zero Gravity Shooter</h2>
        <div style="color: #fff; font-size: 18px; margin-bottom: 30px;">
          <p>Controls:</p>
          <p>WASD - Movement</p>
          <p>Mouse - Look around</p>
          <p>Left Click - Shoot</p>
          <p>Q/E - Roll left/right</p>
          <p>Space - Move up</p>
          <p>Shift/Ctrl - Move down</p>
        </div>
        <div id="start-game-btn" style="
          font-size: 24px;
          cursor: pointer;
          background-color: #00ff00; 
          color: #000;
          padding: 10px 30px;
          border-radius: 5px;
        ">START GAME</div>
      `;
      document.body.appendChild(startScreen);
      this.startScreen = startScreen;

      return document.getElementById('start-game-btn');
    } catch (error) {
      console.error('Error creating start screen:', error);
      return null;
    }
  }

  updateHUD() {
    // Update health bar
    const healthPercent =
      (this.gameState.playerHealth / this.gameState.maxPlayerHealth) * 100;
    this.hudElements.healthBar.style.width = `${healthPercent}%`;

    // Change color based on health level
    if (healthPercent > 60) {
      this.hudElements.healthBar.style.background =
        'linear-gradient(to right, #00ff00, #aaff00)';
    } else if (healthPercent > 30) {
      this.hudElements.healthBar.style.background =
        'linear-gradient(to right, #ffaa00, #ffdd00)';
    } else {
      this.hudElements.healthBar.style.background =
        'linear-gradient(to right, #ff0000, #ff6600)';
    }

    // Update score
    this.hudElements.scoreDisplay.textContent = `SCORE: ${this.gameState.score}`;
  }

  showGameOver() {
    this.hudElements.finalScore.textContent = `Final Score: ${this.gameState.score}`;
    this.hudElements.gameOverDisplay.style.display = 'block';
  }

  hideStartScreen() {
    if (this.startScreen) {
      this.startScreen.style.display = 'none';
    }
  }

  showMessage(message, duration = 2000, color = '#ffffff') {
    const messageElement = document.createElement('div');
    messageElement.style.position = 'absolute';
    messageElement.style.top = '30%';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translate(-50%, -50%)';
    messageElement.style.color = color;
    messageElement.style.fontSize = '28px';
    messageElement.style.fontWeight = 'bold';
    messageElement.style.textShadow = '0 0 10px rgba(0, 0, 0, 0.7)';
    messageElement.style.zIndex = '150';
    messageElement.style.opacity = '1';
    messageElement.style.transition = 'opacity 0.5s ease-in-out';
    messageElement.textContent = message;

    document.body.appendChild(messageElement);

    setTimeout(() => {
      messageElement.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(messageElement);
      }, 500);
    }, duration);
  }
}

export default UIManager;
