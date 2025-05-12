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
      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.gap = '20px';
      buttonContainer.style.justifyContent = 'center';

      const restartButton = document.createElement('button');
      restartButton.textContent = 'RESTART';
      restartButton.style.padding = '10px 30px';
      restartButton.style.fontSize = '20px';
      restartButton.style.background = '#aa0000';
      restartButton.style.color = '#fff';
      restartButton.style.border = 'none';
      restartButton.style.borderRadius = '5px';
      restartButton.style.cursor = 'pointer';
      restartButton.onclick = () => {
        if (this.game && typeof this.game.restartGame === 'function') {
          this.game.restartGame();
        } else {
          window.location.reload();
        }
      };
      buttonContainer.appendChild(restartButton);

      const levelSelectButton = document.createElement('button');
      levelSelectButton.textContent = 'SELECT LEVEL';
      levelSelectButton.style.padding = '10px 30px';
      levelSelectButton.style.fontSize = '20px';
      levelSelectButton.style.background = '#0066aa';
      levelSelectButton.style.color = '#fff';
      levelSelectButton.style.border = 'none';
      levelSelectButton.style.borderRadius = '5px';
      levelSelectButton.style.cursor = 'pointer';
      levelSelectButton.onclick = () => {
        if (this.game && typeof this.game.showLevelSelection === 'function') {
          this.game.showLevelSelection();
        }
      };
      buttonContainer.appendChild(levelSelectButton);

      gameOverDisplay.appendChild(buttonContainer);

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
        <div style="display: flex; gap: 20px;">
          <div id="start-game-btn" style="
            font-size: 24px;
            cursor: pointer;
            background-color: #00ff00; 
            color: #000;
            padding: 10px 30px;
            border-radius: 5px;
          ">START ENDLESS MODE</div>
          
          <div id="select-level-btn" style="
            font-size: 24px;
            cursor: pointer;
            background-color: #00aaff; 
            color: #000;
            padding: 10px 30px;
            border-radius: 5px;
          ">SELECT LEVEL</div>
        </div>
      `;
      document.body.appendChild(startScreen);
      this.startScreen = startScreen;

      // Add event listener for the level selection button
      const selectLevelBtn = document.getElementById('select-level-btn');
      if (selectLevelBtn) {
        selectLevelBtn.addEventListener('click', () => {
          this.hideStartScreen();
          this.createLevelSelect(this.game);
        });
      }

      return document.getElementById('start-game-btn');
    } catch (error) {
      console.error('Error creating start screen:', error);
      return null;
    }
  }

  // Create level selection screen
  createLevelSelect(game) {
    this.game = game;

    const menuContainer = document.createElement('div');
    menuContainer.className = 'level-select';
    menuContainer.style.position = 'absolute';
    menuContainer.style.top = '50%';
    menuContainer.style.left = '50%';
    menuContainer.style.transform = 'translate(-50%, -50%)';
    menuContainer.style.background = 'rgba(0, 0, 0, 0.8)';
    menuContainer.style.padding = '20px';
    menuContainer.style.borderRadius = '10px';
    menuContainer.style.textAlign = 'center';
    menuContainer.style.minWidth = '300px';

    const title = document.createElement('h1');
    title.textContent = 'SELECT LEVEL';
    title.style.color = '#fff';
    title.style.marginBottom = '20px';
    menuContainer.appendChild(title);

    // Get levels from the level manager
    const levels = this.game.levelManager.levels;

    levels.forEach((level, index) => {
      const levelBtn = document.createElement('button');
      levelBtn.textContent = `Level ${level.id}: ${level.name}`;
      levelBtn.className = 'level-btn';
      levelBtn.style.display = 'block';
      levelBtn.style.margin = '10px auto';
      levelBtn.style.padding = '10px 20px';
      levelBtn.style.background = '#4466aa';
      levelBtn.style.color = 'white';
      levelBtn.style.border = 'none';
      levelBtn.style.borderRadius = '5px';
      levelBtn.style.cursor = 'pointer';

      levelBtn.addEventListener('click', () => {
        this.game.selectLevel(index);
        menuContainer.remove();
        this.game.startGame();
      });

      menuContainer.appendChild(levelBtn);
    });

    const endlessBtn = document.createElement('button');
    endlessBtn.textContent = 'Endless Mode';
    endlessBtn.className = 'endless-btn';
    endlessBtn.style.display = 'block';
    endlessBtn.style.margin = '20px auto 10px';
    endlessBtn.style.padding = '10px 20px';
    endlessBtn.style.background = '#aa4466';
    endlessBtn.style.color = 'white';
    endlessBtn.style.border = 'none';
    endlessBtn.style.borderRadius = '5px';
    endlessBtn.style.cursor = 'pointer';

    endlessBtn.addEventListener('click', () => {
      this.game.selectEndlessMode();
      menuContainer.remove();
      this.game.startGame();
    });

    menuContainer.appendChild(endlessBtn);

    document.body.appendChild(menuContainer);
    this.levelSelectMenu = menuContainer;

    return menuContainer;
  }

  hideLevelSelect() {
    if (this.levelSelectMenu) {
      this.levelSelectMenu.style.display = 'none';
    }
  }

  // Create pause menu
  createPauseMenu() {
    if (this.pauseMenu) {
      this.togglePauseMenu();
      return;
    }

    const pauseMenu = document.createElement('div');
    pauseMenu.className = 'pause-menu';
    pauseMenu.style.position = 'absolute';
    pauseMenu.style.top = '50%';
    pauseMenu.style.left = '50%';
    pauseMenu.style.transform = 'translate(-50%, -50%)';
    pauseMenu.style.background = 'rgba(0, 0, 0, 0.8)';
    pauseMenu.style.padding = '20px';
    pauseMenu.style.borderRadius = '10px';
    pauseMenu.style.textAlign = 'center';
    pauseMenu.style.minWidth = '300px';
    pauseMenu.style.zIndex = '500';

    const title = document.createElement('h2');
    title.textContent = 'GAME PAUSED';
    title.style.color = '#fff';
    title.style.marginBottom = '20px';
    pauseMenu.appendChild(title);

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Continue';
    continueBtn.style.display = 'block';
    continueBtn.style.margin = '10px auto';
    continueBtn.style.padding = '10px 20px';
    continueBtn.style.background = '#00aa00';
    continueBtn.style.color = 'white';
    continueBtn.style.border = 'none';
    continueBtn.style.borderRadius = '5px';
    continueBtn.style.cursor = 'pointer';
    continueBtn.style.width = '200px';
    continueBtn.onclick = () => this.togglePauseMenu();
    pauseMenu.appendChild(continueBtn);

    // Select level button
    const selectLevelBtn = document.createElement('button');
    selectLevelBtn.textContent = 'Select Level';
    selectLevelBtn.style.display = 'block';
    selectLevelBtn.style.margin = '10px auto';
    selectLevelBtn.style.padding = '10px 20px';
    selectLevelBtn.style.background = '#0066aa';
    selectLevelBtn.style.color = 'white';
    selectLevelBtn.style.border = 'none';
    selectLevelBtn.style.borderRadius = '5px';
    selectLevelBtn.style.cursor = 'pointer';
    selectLevelBtn.style.width = '200px';
    selectLevelBtn.onclick = () => {
      this.togglePauseMenu();
      if (this.game) {
        this.game.showLevelSelection();
      }
    };
    pauseMenu.appendChild(selectLevelBtn);

    // Restart button
    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Restart Level';
    restartBtn.style.display = 'block';
    restartBtn.style.margin = '10px auto';
    restartBtn.style.padding = '10px 20px';
    restartBtn.style.background = '#aa6600';
    restartBtn.style.color = 'white';
    restartBtn.style.border = 'none';
    restartBtn.style.borderRadius = '5px';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.width = '200px';
    restartBtn.onclick = () => {
      this.togglePauseMenu();
      if (this.game) {
        this.game.restartLevel();
      }
    };
    pauseMenu.appendChild(restartBtn);

    // Quit to menu button
    const quitBtn = document.createElement('button');
    quitBtn.textContent = 'Quit to Menu';
    quitBtn.style.display = 'block';
    quitBtn.style.margin = '10px auto';
    quitBtn.style.padding = '10px 20px';
    quitBtn.style.background = '#aa0000';
    quitBtn.style.color = 'white';
    quitBtn.style.border = 'none';
    quitBtn.style.borderRadius = '5px';
    quitBtn.style.cursor = 'pointer';
    quitBtn.style.width = '200px';
    quitBtn.onclick = () => {
      window.location.reload();
    };
    pauseMenu.appendChild(quitBtn);

    document.body.appendChild(pauseMenu);
    this.pauseMenu = pauseMenu;

    // Pause the game
    if (this.game) {
      this.game.gameState.isPaused = true;
    }

    return pauseMenu;
  }

  // Toggle pause menu visibility
  togglePauseMenu() {
    if (!this.pauseMenu) {
      this.createPauseMenu();
      return;
    }

    if (this.pauseMenu.style.display === 'none') {
      this.pauseMenu.style.display = 'block';
      if (this.game) {
        this.game.gameState.isPaused = true;
      }
    } else {
      this.pauseMenu.style.display = 'none';
      if (this.game) {
        this.game.gameState.isPaused = false;
      }
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
