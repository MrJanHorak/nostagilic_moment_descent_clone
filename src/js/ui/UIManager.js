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
      hudContainer.style.display = 'flex';
      hudContainer.style.flexDirection = 'column';
      hudContainer.style.gap = '10px';

      // Make sure document.body exists before appending
      if (document && document.body) {
        document.body.appendChild(hudContainer);
        console.log('HUD container added to DOM');
      } else {
        console.error('Cannot append HUD: document.body not available');
        return; // Exit early if we can't create the UI
      }

      // Top HUD wrapper
      const topHUDWrapper = document.createElement('div');
      topHUDWrapper.style.display = 'flex';
      topHUDWrapper.style.justifyContent = 'space-between';
      topHUDWrapper.style.width = '100%';
      hudContainer.appendChild(topHUDWrapper);

      // Left HUD section (Health)
      const leftHUD = document.createElement('div');
      leftHUD.style.display = 'flex';
      leftHUD.style.flexDirection = 'column';
      leftHUD.style.maxWidth = '280px';
      topHUDWrapper.appendChild(leftHUD);

      // Shield container with tech frame
      const healthContainer = document.createElement('div');
      healthContainer.style.background =
        'linear-gradient(rgba(0,10,20,0.7), rgba(0,20,40,0.7))';
      healthContainer.style.border = '1px solid #00aaff';
      healthContainer.style.borderRadius = '5px';
      healthContainer.style.padding = '8px 12px';
      healthContainer.style.boxShadow =
        '0 0 8px rgba(0, 170, 255, 0.4), inset 0 0 10px rgba(0, 100, 200, 0.2)';
      healthContainer.style.marginBottom = '10px';
      leftHUD.appendChild(healthContainer);

      const healthHeader = document.createElement('div');
      healthHeader.style.display = 'flex';
      healthHeader.style.justifyContent = 'space-between';
      healthHeader.style.marginBottom = '5px';
      healthHeader.style.alignItems = 'center';
      healthContainer.appendChild(healthHeader);

      const healthLabel = document.createElement('div');
      healthLabel.textContent = 'SHIELD INTEGRITY';
      healthLabel.style.fontSize = '14px';
      healthLabel.style.fontWeight = 'bold';
      healthLabel.style.color = '#00ddff';
      healthLabel.style.textTransform = 'uppercase';
      healthLabel.style.letterSpacing = '1px';
      healthLabel.style.textShadow = '0 0 5px rgba(0, 200, 255, 0.7)';
      healthHeader.appendChild(healthLabel);

      // Percentage display
      const healthPercentage = document.createElement('div');
      healthPercentage.id = 'health-percentage';
      healthPercentage.textContent = '100%';
      healthPercentage.style.fontSize = '14px';
      healthPercentage.style.fontWeight = 'bold';
      healthPercentage.style.color = '#00ff88';
      healthPercentage.style.textShadow = '0 0 5px rgba(0, 255, 136, 0.7)';
      healthHeader.appendChild(healthPercentage);

      // Health bar with tech design
      const healthBarContainer = document.createElement('div');
      healthBarContainer.style.width = '100%';
      healthBarContainer.style.height = '15px';
      healthBarContainer.style.background = 'rgba(0, 0, 0, 0.5)';
      healthBarContainer.style.border = '1px solid #00aaff';
      healthBarContainer.style.borderRadius = '3px';
      healthBarContainer.style.overflow = 'hidden';
      healthBarContainer.style.position = 'relative';

      const healthBarInner = document.createElement('div');
      healthBarInner.id = 'health-bar-inner';
      healthBarInner.style.height = '100%';
      healthBarInner.style.width = '100%';
      healthBarInner.style.background =
        'linear-gradient(to right, #00ff88, #00ddff)';
      healthBarInner.style.transition = 'width 0.3s ease-out';
      healthBarContainer.appendChild(healthBarInner);

      // Add tech pattern overlay
      const healthBarPattern = document.createElement('div');
      healthBarPattern.style.position = 'absolute';
      healthBarPattern.style.top = '0';
      healthBarPattern.style.left = '0';
      healthBarPattern.style.width = '100%';
      healthBarPattern.style.height = '100%';
      healthBarPattern.style.backgroundImage =
        'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)';
      healthBarPattern.style.backgroundSize = '5px 100%';
      healthBarPattern.style.pointerEvents = 'none';
      healthBarContainer.appendChild(healthBarPattern);

      healthContainer.appendChild(healthBarContainer);

      // Weapon system section
      const weaponSystem = document.createElement('div');
      weaponSystem.style.background =
        'linear-gradient(rgba(0,10,20,0.7), rgba(0,20,40,0.7))';
      weaponSystem.style.border = '1px solid #00aaff';
      weaponSystem.style.borderRadius = '5px';
      weaponSystem.style.padding = '8px 12px';
      weaponSystem.style.boxShadow =
        '0 0 8px rgba(0, 170, 255, 0.4), inset 0 0 10px rgba(0, 100, 200, 0.2)';
      leftHUD.appendChild(weaponSystem);

      const weaponLabel = document.createElement('div');
      weaponLabel.textContent = 'WEAPON SYSTEM';
      weaponLabel.style.fontSize = '14px';
      weaponLabel.style.fontWeight = 'bold';
      weaponLabel.style.color = '#00ddff';
      weaponLabel.style.textTransform = 'uppercase';
      weaponLabel.style.letterSpacing = '1px';
      weaponLabel.style.textShadow = '0 0 5px rgba(0, 200, 255, 0.7)';
      weaponLabel.style.marginBottom = '5px';
      weaponSystem.appendChild(weaponLabel);

      // Weapon selector
      const weaponSelector = document.createElement('div');
      weaponSelector.style.display = 'flex';
      weaponSelector.style.gap = '5px';
      weaponSelector.style.marginTop = '5px';

      // Create weapon slots with numbers 1-4
      const weaponSlots = ['PULSE', 'LASER', 'MISSILE', 'PLASMA'];
      for (let i = 0; i < 4; i++) {
        const weaponSlot = document.createElement('div');
        weaponSlot.id = `weapon-slot-${i + 1}`;
        weaponSlot.className = 'weapon-slot';
        weaponSlot.style.flex = '1';
        weaponSlot.style.padding = '4px 0';
        weaponSlot.style.border = '1px solid #0088cc';
        weaponSlot.style.borderRadius = '3px';
        weaponSlot.style.textAlign = 'center';
        weaponSlot.style.fontSize = '12px';
        weaponSlot.style.background =
          i === 0 ? 'rgba(0, 170, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        weaponSlot.style.color = i === 0 ? '#ffffff' : '#0088cc';
        weaponSlot.style.cursor = 'pointer';
        weaponSlot.style.transition = 'all 0.2s ease';
        weaponSlot.style.position = 'relative';
        weaponSlot.innerHTML = `<div style="font-weight: bold;">${
          i + 1
        }</div><div style="font-size: 10px;">${weaponSlots[i]}</div>`;

        weaponSlot.onmouseover = () => {
          if (weaponSlot.style.background !== 'rgba(0, 170, 255, 0.3)') {
            weaponSlot.style.background = 'rgba(0, 100, 150, 0.3)';
            weaponSlot.style.color = '#00aaff';
          }
        };

        weaponSlot.onmouseout = () => {
          if (weaponSlot.style.background !== 'rgba(0, 170, 255, 0.3)') {
            weaponSlot.style.background = 'rgba(0, 0, 0, 0.3)';
            weaponSlot.style.color = '#0088cc';
          }
        };

        weaponSelector.appendChild(weaponSlot);
      }

      weaponSystem.appendChild(weaponSelector);

      // Right HUD section (Score, etc.)
      const rightHUD = document.createElement('div');
      rightHUD.style.textAlign = 'right';
      rightHUD.style.display = 'flex';
      rightHUD.style.flexDirection = 'column';
      rightHUD.style.alignItems = 'flex-end';
      rightHUD.style.marginRight = '2.2em';
      topHUDWrapper.appendChild(rightHUD);

      // Score display with tech frame
      const scoreContainer = document.createElement('div');
      scoreContainer.style.background =
        'linear-gradient(rgba(0,10,20,0.7), rgba(0,20,40,0.7))';
      scoreContainer.style.border = '1px solid #00aaff';
      scoreContainer.style.borderRadius = '5px';
      scoreContainer.style.padding = '8px 15px';
      scoreContainer.style.boxShadow =
        '0 0 8px rgba(0, 170, 255, 0.4), inset 0 0 10px rgba(0, 100, 200, 0.2)';
      scoreContainer.style.marginBottom = '10px';
      scoreContainer.style.width = '150px';
      scoreContainer.style.textAlign = 'center';
      rightHUD.appendChild(scoreContainer);

      const scoreLabel = document.createElement('div');
      scoreLabel.textContent = 'COMBAT SCORE';
      scoreLabel.style.fontSize = '14px';
      scoreLabel.style.fontWeight = 'bold';
      scoreLabel.style.color = '#00ddff';
      scoreLabel.style.textTransform = 'uppercase';
      scoreLabel.style.letterSpacing = '1px';
      scoreLabel.style.textShadow = '0 0 5px rgba(0, 200, 255, 0.7)';
      scoreLabel.style.marginBottom = '5px';
      scoreContainer.appendChild(scoreLabel);

      const scoreDisplay = document.createElement('div');
      scoreDisplay.id = 'score-display';
      scoreDisplay.style.fontSize = '24px';
      scoreDisplay.style.fontWeight = 'bold';
      scoreDisplay.style.fontFamily = 'Arial Black, sans-serif';
      scoreDisplay.style.color = '#ffffff';
      scoreDisplay.style.textShadow = '0 0 10px rgba(0, 170, 255, 0.7)';
      scoreDisplay.textContent = '0';
      scoreContainer.appendChild(scoreDisplay);

      // Enemy counter with tech frame
      const enemyContainer = document.createElement('div');
      enemyContainer.style.background =
        'linear-gradient(rgba(0,10,20,0.7), rgba(0,20,40,0.7))';
      enemyContainer.style.border = '1px solid #00aaff';
      enemyContainer.style.borderRadius = '5px';
      enemyContainer.style.padding = '8px 15px';
      enemyContainer.style.boxShadow =
        '0 0 8px rgba(0, 170, 255, 0.4), inset 0 0 10px rgba(0, 100, 200, 0.2)';
      enemyContainer.style.width = '150px';
      enemyContainer.style.textAlign = 'center';
      rightHUD.appendChild(enemyContainer);

      const enemyLabel = document.createElement('div');
      enemyLabel.textContent = 'THREAT ANALYSIS';
      enemyLabel.style.fontSize = '14px';
      enemyLabel.style.fontWeight = 'bold';
      enemyLabel.style.color = '#00ddff';
      enemyLabel.style.textTransform = 'uppercase';
      enemyLabel.style.letterSpacing = '1px';
      enemyLabel.style.textShadow = '0 0 5px rgba(0, 200, 255, 0.7)';
      enemyLabel.style.marginBottom = '5px';
      enemyContainer.appendChild(enemyLabel);

      const enemyCountDisplay = document.createElement('div');
      enemyCountDisplay.id = 'enemy-count-display';
      enemyCountDisplay.style.fontSize = '18px';
      enemyCountDisplay.style.fontWeight = 'bold';
      enemyCountDisplay.style.color = '#ff6600';
      enemyCountDisplay.style.textShadow = '0 0 5px rgba(255, 102, 0, 0.7)';
      enemyCountDisplay.textContent = 'SCANNING...';
      enemyContainer.appendChild(enemyCountDisplay);

      this.hudElements.healthBar = healthBarInner;
      this.hudElements.healthPercentage = healthPercentage;
      this.hudElements.scoreDisplay = scoreDisplay;
      this.hudElements.enemyCountDisplay = enemyCountDisplay;

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
      gameOverDisplay.style.background =
        'linear-gradient(rgba(0,0,0,0.85), rgba(40,0,0,0.95))';
      gameOverDisplay.style.border = '2px solid #ff0044';
      gameOverDisplay.style.borderRadius = '10px';
      gameOverDisplay.style.boxShadow =
        '0 0 30px rgba(255, 0, 68, 0.5), inset 0 0 30px rgba(255, 0, 68, 0.2)';

      const gameOverTitle = document.createElement('h2');
      gameOverTitle.textContent = 'SYSTEM FAILURE';
      gameOverTitle.style.color = '#ff0044';
      gameOverTitle.style.fontSize = '36px';
      gameOverTitle.style.fontFamily = 'Arial Black, sans-serif';
      gameOverTitle.style.textTransform = 'uppercase';
      gameOverTitle.style.letterSpacing = '3px';
      gameOverTitle.style.marginBottom = '20px';
      gameOverTitle.style.textShadow = '0 0 10px rgba(255, 0, 68, 0.7)';
      gameOverDisplay.appendChild(gameOverTitle);

      const finalScore = document.createElement('p');
      finalScore.id = 'final-score';
      finalScore.style.fontSize = '24px';
      finalScore.style.marginBottom = '30px';
      finalScore.style.color = '#ffffff';
      finalScore.style.textShadow = '0 0 5px rgba(255, 255, 255, 0.7)';
      gameOverDisplay.appendChild(finalScore);

      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.gap = '20px';
      buttonContainer.style.justifyContent = 'center';

      const restartButton = document.createElement('button');
      restartButton.textContent = 'REBOOT';
      restartButton.style.padding = '12px 30px';
      restartButton.style.fontSize = '18px';
      restartButton.style.fontWeight = 'bold';
      restartButton.style.background =
        'linear-gradient(to bottom, #cc0033, #990022)';
      restartButton.style.color = '#fff';
      restartButton.style.border = '1px solid #ff0044';
      restartButton.style.borderRadius = '5px';
      restartButton.style.cursor = 'pointer';
      restartButton.style.textTransform = 'uppercase';
      restartButton.style.letterSpacing = '2px';
      restartButton.style.boxShadow = '0 0 10px rgba(255, 0, 68, 0.5)';
      restartButton.style.transition = 'all 0.2s ease';
      restartButton.onmouseover = () => {
        restartButton.style.background =
          'linear-gradient(to bottom, #dd0044, #aa0033)';
        restartButton.style.boxShadow = '0 0 15px rgba(255, 0, 68, 0.7)';
      };
      restartButton.onmouseout = () => {
        restartButton.style.background =
          'linear-gradient(to bottom, #cc0033, #990022)';
        restartButton.style.boxShadow = '0 0 10px rgba(255, 0, 68, 0.5)';
      };
      restartButton.onclick = () => {
        if (this.game && typeof this.game.restartGame === 'function') {
          this.game.restartGame();
        } else {
          window.location.reload();
        }
      };
      buttonContainer.appendChild(restartButton);

      const levelSelectButton = document.createElement('button');
      levelSelectButton.textContent = 'MISSION SELECT';
      levelSelectButton.style.padding = '12px 30px';
      levelSelectButton.style.fontSize = '18px';
      levelSelectButton.style.fontWeight = 'bold';
      levelSelectButton.style.background =
        'linear-gradient(to bottom, #0088ff, #0044aa)';
      levelSelectButton.style.color = '#fff';
      levelSelectButton.style.border = '1px solid #00aaff';
      levelSelectButton.style.borderRadius = '5px';
      levelSelectButton.style.cursor = 'pointer';
      levelSelectButton.style.textTransform = 'uppercase';
      levelSelectButton.style.letterSpacing = '2px';
      levelSelectButton.style.boxShadow = '0 0 10px rgba(0, 136, 255, 0.5)';
      levelSelectButton.style.transition = 'all 0.2s ease';
      levelSelectButton.onmouseover = () => {
        levelSelectButton.style.background =
          'linear-gradient(to bottom, #0099ff, #0055bb)';
        levelSelectButton.style.boxShadow = '0 0 15px rgba(0, 136, 255, 0.7)';
      };
      levelSelectButton.onmouseout = () => {
        levelSelectButton.style.background =
          'linear-gradient(to bottom, #0088ff, #0044aa)';
        levelSelectButton.style.boxShadow = '0 0 10px rgba(0, 136, 255, 0.5)';
      };
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

      // Add animation style for the health bar
      const hudStyle = document.createElement('style');
      hudStyle.textContent = `
        @keyframes healthPulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
        
        .weapon-slot {
          user-select: none;
          pointer-events: auto;
        }
      `;
      document.head.appendChild(hudStyle);
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
        <div class="title-container" style="
          background: linear-gradient(rgba(0,0,0,0.7), rgba(0,10,20,0.9));
          border: 1px solid #00aaff;
          border-radius: 10px;
          box-shadow: 0 0 20px #0066aa, inset 0 0 30px rgba(0,100,200,0.3);
          padding: 40px;
          max-width: 800px;
          width: 90%;
        ">
          <div class="logo-area" style="
            position: relative;
            margin-bottom: 30px;
            text-align: center;
          ">
            <h1 style="
              color: #ffffff;
              font-size: 72px;
              margin-bottom: 10px;
              font-family: 'Arial Black', sans-serif;
              text-transform: uppercase;
              letter-spacing: 6px;
              text-shadow: 0 0 10px #00aaff, 0 0 20px #00aaff, 0 0 30px #00aaff;
              background: linear-gradient(#ffffff, #00aaff);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            ">DESCENDED</h1>
            <h2 style="
              color: #00ddff;
              font-size: 24px;
              margin-bottom: 30px;
              font-style: italic;
              letter-spacing: 3px;
              text-shadow: 0 0 5px #00aaff;
            ">Zero Gravity Shooter</h2>
            <div style="
              width: 80%;
              height: 2px;
              background: linear-gradient(to right, transparent, #00aaff, transparent);
              margin: 0 auto 40px;
            "></div>
          </div>
          
          <div class="controls-container" style="
            background: rgba(0,30,60,0.5);
            border-radius: 8px;
            padding: 20px;
            color: #b0e0ff;
            font-size: 16px;
            margin-bottom: 30px;
            border-left: 2px solid #00aaff;
          ">
            <h3 style="
              color: #ffffff;
              font-size: 22px;
              margin-bottom: 15px;
              text-shadow: 0 0 5px #00aaff;
            ">CONTROL SYSTEMS</h3>
            
            <div class="controls-grid" style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            ">
              <div class="control-group">
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Movement:</span> 
                  <span style="color: #00ddff; font-weight: bold;">W A S D</span>
                </p>
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Look:</span> 
                  <span style="color: #00ddff; font-weight: bold;">Mouse</span>
                </p>
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Shoot:</span> 
                  <span style="color: #00ddff; font-weight: bold;">Left Click</span>
                </p>
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Pause:</span> 
                  <span style="color: #00ddff; font-weight: bold;">ESC</span>
                </p>
              </div>
              <div class="control-group">
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Roll Left/Right:</span> 
                  <span style="color: #00ddff; font-weight: bold;">Q / E</span>
                </p>
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Move Up:</span> 
                  <span style="color: #00ddff; font-weight: bold;">Space</span>
                </p>
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Move Down:</span> 
                  <span style="color: #00ddff; font-weight: bold;">Shift / Ctrl</span>
                </p>
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Weapon Switch:</span> 
                  <span style="color: #00ddff; font-weight: bold;">1-4</span>
                </p>
              </div>
            </div>
          </div>
          
          <div class="buttons-container" style="
            display: flex;
            gap: 30px;
            justify-content: center;
          ">
            <div id="start-game-btn" class="game-button" style="
              font-size: 22px;
              cursor: pointer;
              background: linear-gradient(to bottom, #00cc22, #008800);
              color: #fff;
              padding: 12px 30px;
              border-radius: 5px;
              text-transform: uppercase;
              letter-spacing: 2px;
              text-shadow: 0 0 5px rgba(0,0,0,0.5);
              box-shadow: 0 0 15px #00aa00, inset 0 0 10px rgba(255,255,255,0.3);
              transition: all 0.2s ease;
              font-weight: bold;
              border: 1px solid #00dd00;
              position: relative;
              overflow: hidden;
            ">
              <span style="position: relative; z-index: 2;">START ENDLESS MODE</span>
              <div style="
                position: absolute;
                top: -10%;
                left: -10%;
                width: 120%;
                height: 10%;
                background: rgba(255,255,255,0.3);
                transform: rotate(45deg);
                animation: shine 3s infinite;
              "></div>
            </div>
            
            <div id="select-level-btn" class="game-button" style="
              font-size: 22px;
              cursor: pointer;
              background: linear-gradient(to bottom, #0088ff, #0044aa);
              color: #fff;
              padding: 12px 30px;
              border-radius: 5px;
              text-transform: uppercase;
              letter-spacing: 2px;
              text-shadow: 0 0 5px rgba(0,0,0,0.5);
              box-shadow: 0 0 15px #0066cc, inset 0 0 10px rgba(255,255,255,0.3);
              transition: all 0.2s ease;
              font-weight: bold;
              border: 1px solid #00aaff;
              position: relative;
              overflow: hidden;
            ">
              <span style="position: relative; z-index: 2;">SELECT LEVEL</span>
              <div style="
                position: absolute;
                top: -10%;
                left: -10%;
                width: 120%;
                height: 10%;
                background: rgba(255,255,255,0.3);
                transform: rotate(45deg);
                animation: shine 3s infinite 1s;
              "></div>
            </div>
          </div>
        </div>
        
        <style>
          @keyframes shine {
            0% { top: -10%; left: -10%; }
            20% { top: 110%; left: 110%; }
            100% { top: 110%; left: 110%; }
          }
          
          .game-button:hover {
            transform: scale(1.05);
            box-shadow: 0 0 25px currentColor, inset 0 0 15px rgba(255,255,255,0.5);
          }
          
          .game-button:active {
            transform: scale(0.98);
          }
        </style>
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
    menuContainer.style.top = '0';
    menuContainer.style.left = '0';
    menuContainer.style.width = '100%';
    menuContainer.style.height = '100%';
    menuContainer.style.display = 'flex';
    menuContainer.style.justifyContent = 'center';
    menuContainer.style.alignItems = 'center';
    menuContainer.style.background = 'rgba(0, 0, 0, 0.7)';
    menuContainer.style.zIndex = '1000';

    const contentContainer = document.createElement('div');
    contentContainer.style.background =
      'linear-gradient(rgba(0,0,0,0.8), rgba(0,10,30,0.95))';
    contentContainer.style.border = '1px solid #00aaff';
    contentContainer.style.borderRadius = '10px';
    contentContainer.style.boxShadow =
      '0 0 20px #0066aa, inset 0 0 30px rgba(0,100,200,0.3)';
    contentContainer.style.padding = '40px';
    contentContainer.style.maxWidth = '600px';
    contentContainer.style.width = '90%';
    contentContainer.style.maxHeight = '80vh';
    contentContainer.style.overflowY = 'auto';
    contentContainer.style.textAlign = 'center';

    // Title with matching style to main screen
    const title = document.createElement('h1');
    title.textContent = 'SELECT MISSION';
    title.style.color = '#ffffff';
    title.style.fontSize = '48px';
    title.style.marginBottom = '30px';
    title.style.fontFamily = 'Arial Black, sans-serif';
    title.style.textTransform = 'uppercase';
    title.style.letterSpacing = '4px';
    title.style.textShadow = '0 0 10px #00aaff, 0 0 15px #00aaff';
    title.style.background = 'linear-gradient(#ffffff, #00aaff)';
    title.style.webkitBackgroundClip = 'text';
    title.style.webkitTextFillColor = 'transparent';
    contentContainer.appendChild(title);

    // Decorative divider
    const divider = document.createElement('div');
    divider.style.width = '80%';
    divider.style.height = '2px';
    divider.style.background =
      'linear-gradient(to right, transparent, #00aaff, transparent)';
    divider.style.margin = '0 auto 30px';
    contentContainer.appendChild(divider);

    // Levels container with styled scrollbar
    const levelsContainer = document.createElement('div');
    levelsContainer.style.marginBottom = '20px';
    levelsContainer.style.maxHeight = '50vh';
    levelsContainer.style.overflowY = 'auto';
    levelsContainer.style.padding = '0 10px';
    levelsContainer.style.scrollbarWidth = 'thin';
    levelsContainer.style.scrollbarColor = '#00aaff #001830';

    // Get levels from the level manager
    const levels = this.game.levelManager.levels;

    // Level selection buttons
    levels.forEach((level, index) => {
      const levelBtnContainer = document.createElement('div');
      levelBtnContainer.style.position = 'relative';
      levelBtnContainer.style.marginBottom = '15px';

      const levelBtn = document.createElement('button');
      levelBtn.textContent = `Level ${level.id}: ${level.name}`;
      levelBtn.className = 'level-btn';
      levelBtn.style.width = '100%';
      levelBtn.style.padding = '15px 20px';
      levelBtn.style.background =
        'linear-gradient(to bottom, #003366, #001830)';
      levelBtn.style.color = '#00ddff';
      levelBtn.style.border = '1px solid #0088cc';
      levelBtn.style.borderRadius = '5px';
      levelBtn.style.cursor = 'pointer';
      levelBtn.style.fontSize = '18px';
      levelBtn.style.fontWeight = 'bold';
      levelBtn.style.textTransform = 'uppercase';
      levelBtn.style.letterSpacing = '1px';
      levelBtn.style.textShadow = '0 0 5px rgba(0, 170, 255, 0.5)';
      levelBtn.style.boxShadow =
        '0 0 10px rgba(0, 100, 200, 0.3), inset 0 0 15px rgba(0, 100, 200, 0.2)';
      levelBtn.style.transition = 'all 0.2s ease';
      levelBtn.style.position = 'relative';
      levelBtn.style.overflow = 'hidden';

      // Add shine effect
      const shine = document.createElement('div');
      shine.style.position = 'absolute';
      shine.style.top = '-10%';
      shine.style.left = '-10%';
      shine.style.width = '120%';
      shine.style.height = '10%';
      shine.style.background = 'rgba(255,255,255,0.2)';
      shine.style.transform = 'rotate(45deg)';
      shine.style.animation = `shine${index} 4s infinite`;
      levelBtn.appendChild(shine);

      // Add custom animation for each button with different delays
      const style = document.createElement('style');
      style.textContent = `
        @keyframes shine${index} {
          0% { top: -10%; left: -10%; }
          20% { top: 110%; left: 110%; }
          100% { top: 110%; left: 110%; }
        }
        
        .level-btn:hover {
          transform: scale(1.03);
          box-shadow: 0 0 15px #00aaff, inset 0 0 20px rgba(0, 170, 255, 0.3);
          background: linear-gradient(to bottom, #004488, #002244);
        }
        
        .level-btn:active {
          transform: scale(0.98);
        }
      `;
      document.head.appendChild(style);

      levelBtn.addEventListener('click', () => {
        this.game.selectLevel(index);
        menuContainer.remove();
        this.game.startGame();
      });

      levelBtnContainer.appendChild(levelBtn);
      levelsContainer.appendChild(levelBtnContainer);
    });

    contentContainer.appendChild(levelsContainer);

    // Endless mode button (special styling)
    const endlessContainer = document.createElement('div');
    endlessContainer.style.marginTop = '30px';
    endlessContainer.style.position = 'relative';

    const endlessBtn = document.createElement('button');
    endlessBtn.textContent = 'ENDLESS MODE';
    endlessBtn.className = 'endless-btn';
    endlessBtn.style.width = '100%';
    endlessBtn.style.padding = '18px 20px';
    endlessBtn.style.background =
      'linear-gradient(to bottom, #660033, #330011)';
    endlessBtn.style.color = '#ff77aa';
    endlessBtn.style.border = '1px solid #cc3366';
    endlessBtn.style.borderRadius = '5px';
    endlessBtn.style.cursor = 'pointer';
    endlessBtn.style.fontSize = '22px';
    endlessBtn.style.fontWeight = 'bold';
    endlessBtn.style.textTransform = 'uppercase';
    endlessBtn.style.letterSpacing = '2px';
    endlessBtn.style.textShadow = '0 0 8px rgba(255, 50, 100, 0.7)';
    endlessBtn.style.boxShadow =
      '0 0 15px rgba(200, 50, 100, 0.4), inset 0 0 20px rgba(200, 50, 100, 0.2)';
    endlessBtn.style.transition = 'all 0.2s ease';
    endlessBtn.style.position = 'relative';
    endlessBtn.style.overflow = 'hidden';

    // Add pulsing effect to endless mode button
    const pulseStyle = document.createElement('style');
    pulseStyle.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 15px rgba(255, 50, 100, 0.4), inset 0 0 20px rgba(255, 50, 100, 0.2); }
        50% { box-shadow: 0 0 20px rgba(255, 50, 100, 0.7), inset 0 0 30px rgba(255, 50, 100, 0.3); }
        100% { box-shadow: 0 0 15px rgba(255, 50, 100, 0.4), inset 0 0 20px rgba(255, 50, 100, 0.2); }
      }
      
      .endless-btn {
        animation: pulse 2s infinite;
      }
      
      .endless-btn:hover {
        transform: scale(1.05);
        background: linear-gradient(to bottom, #880044, #440022);
      }
      
      .endless-btn:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(pulseStyle);

    // Add shine effect
    const endlessShine = document.createElement('div');
    endlessShine.style.position = 'absolute';
    endlessShine.style.top = '-10%';
    endlessShine.style.left = '-10%';
    endlessShine.style.width = '120%';
    endlessShine.style.height = '10%';
    endlessShine.style.background = 'rgba(255,255,255,0.3)';
    endlessShine.style.transform = 'rotate(45deg)';
    endlessShine.style.animation = 'endlessShine 4s infinite';
    endlessBtn.appendChild(endlessShine);

    // Add endless shine animation
    const endlessShineStyle = document.createElement('style');
    endlessShineStyle.textContent = `
      @keyframes endlessShine {
        0% { top: -10%; left: -10%; }
        20% { top: 110%; left: 110%; }
        100% { top: 110%; left: 110%; }
      }
    `;
    document.head.appendChild(endlessShineStyle);

    endlessBtn.addEventListener('click', () => {
      this.game.selectEndlessMode();
      menuContainer.remove();
      this.game.startGame();
    });

    endlessContainer.appendChild(endlessBtn);
    contentContainer.appendChild(endlessContainer);

    // Return button
    const backContainer = document.createElement('div');
    backContainer.style.marginTop = '25px';

    const backButton = document.createElement('button');
    backButton.textContent = 'RETURN TO MAIN MENU';
    backButton.style.padding = '10px 20px';
    backButton.style.background =
      'linear-gradient(to bottom, #333333, #111111)';
    backButton.style.color = '#aaaaaa';
    backButton.style.border = '1px solid #555555';
    backButton.style.borderRadius = '5px';
    backButton.style.cursor = 'pointer';
    backButton.style.fontSize = '16px';
    backButton.style.textTransform = 'uppercase';
    backButton.style.transition = 'all 0.2s ease';
    backButton.addEventListener('click', () => {
      menuContainer.remove();
      this.createStartScreen();
    });

    backButton.onmouseover = () => {
      backButton.style.background =
        'linear-gradient(to bottom, #444444, #222222)';
      backButton.style.color = '#ffffff';
    };

    backButton.onmouseout = () => {
      backButton.style.background =
        'linear-gradient(to bottom, #333333, #111111)';
      backButton.style.color = '#aaaaaa';
    };

    backContainer.appendChild(backButton);
    contentContainer.appendChild(backContainer);

    menuContainer.appendChild(contentContainer);
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
    pauseMenu.style.top = '0';
    pauseMenu.style.left = '0';
    pauseMenu.style.width = '100%';
    pauseMenu.style.height = '100%';
    pauseMenu.style.display = 'flex';
    pauseMenu.style.justifyContent = 'center';
    pauseMenu.style.alignItems = 'center';
    pauseMenu.style.background = 'rgba(0, 0, 0, 0.7)';
    pauseMenu.style.zIndex = '1000';
    pauseMenu.style.backdropFilter = 'blur(5px)';

    const contentContainer = document.createElement('div');
    contentContainer.style.background =
      'linear-gradient(rgba(0,0,0,0.8), rgba(0,10,30,0.95))';
    contentContainer.style.border = '1px solid #00aaff';
    contentContainer.style.borderRadius = '10px';
    contentContainer.style.boxShadow =
      '0 0 20px #0066aa, inset 0 0 30px rgba(0,100,200,0.3)';
    contentContainer.style.padding = '30px';
    contentContainer.style.maxWidth = '400px';
    contentContainer.style.width = '90%';
    contentContainer.style.textAlign = 'center';

    // Title with matching style to main screen
    const title = document.createElement('h1');
    title.textContent = 'PAUSED';
    title.style.color = '#ffffff';
    title.style.fontSize = '48px';
    title.style.marginBottom = '20px';
    title.style.fontFamily = 'Arial Black, sans-serif';
    title.style.textTransform = 'uppercase';
    title.style.letterSpacing = '4px';
    title.style.textShadow = '0 0 10px #00aaff, 0 0 15px #00aaff';
    title.style.background = 'linear-gradient(#ffffff, #00aaff)';
    title.style.webkitBackgroundClip = 'text';
    title.style.webkitTextFillColor = 'transparent';
    contentContainer.appendChild(title);

    // Decorative divider
    const divider = document.createElement('div');
    divider.style.width = '80%';
    divider.style.height = '2px';
    divider.style.background =
      'linear-gradient(to right, transparent, #00aaff, transparent)';
    divider.style.margin = '0 auto 30px';
    contentContainer.appendChild(divider);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.gap = '15px';

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'CONTINUE';
    continueBtn.className = 'pause-btn continue-btn';
    continueBtn.style.width = '100%';
    continueBtn.style.padding = '15px 20px';
    continueBtn.style.background =
      'linear-gradient(to bottom, #00cc22, #008800)';
    continueBtn.style.color = '#ffffff';
    continueBtn.style.border = '1px solid #00dd00';
    continueBtn.style.borderRadius = '5px';
    continueBtn.style.cursor = 'pointer';
    continueBtn.style.fontSize = '20px';
    continueBtn.style.fontWeight = 'bold';
    continueBtn.style.textTransform = 'uppercase';
    continueBtn.style.letterSpacing = '2px';
    continueBtn.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    continueBtn.style.boxShadow =
      '0 0 15px rgba(0, 170, 0, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.2)';
    continueBtn.style.transition = 'all 0.2s ease';
    continueBtn.style.position = 'relative';
    continueBtn.style.overflow = 'hidden';

    // Add shine effect
    const continueShine = document.createElement('div');
    continueShine.style.position = 'absolute';
    continueShine.style.top = '-10%';
    continueShine.style.left = '-10%';
    continueShine.style.width = '120%';
    continueShine.style.height = '10%';
    continueShine.style.background = 'rgba(255,255,255,0.3)';
    continueShine.style.transform = 'rotate(45deg)';
    continueShine.style.animation = 'continueShine 3s infinite';
    continueBtn.appendChild(continueShine);

    continueBtn.onclick = () => this.togglePauseMenu();
    buttonContainer.appendChild(continueBtn);

    // Select level button
    const selectLevelBtn = document.createElement('button');
    selectLevelBtn.textContent = 'SELECT MISSION';
    selectLevelBtn.className = 'pause-btn select-level-btn';
    selectLevelBtn.style.width = '100%';
    selectLevelBtn.style.padding = '15px 20px';
    selectLevelBtn.style.background =
      'linear-gradient(to bottom, #0088ff, #0044aa)';
    selectLevelBtn.style.color = '#ffffff';
    selectLevelBtn.style.border = '1px solid #00aaff';
    selectLevelBtn.style.borderRadius = '5px';
    selectLevelBtn.style.cursor = 'pointer';
    selectLevelBtn.style.fontSize = '20px';
    selectLevelBtn.style.fontWeight = 'bold';
    selectLevelBtn.style.textTransform = 'uppercase';
    selectLevelBtn.style.letterSpacing = '2px';
    selectLevelBtn.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    selectLevelBtn.style.boxShadow =
      '0 0 15px rgba(0, 100, 200, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.2)';
    selectLevelBtn.style.transition = 'all 0.2s ease';
    selectLevelBtn.style.position = 'relative';
    selectLevelBtn.style.overflow = 'hidden';

    // Add shine effect
    const levelShine = document.createElement('div');
    levelShine.style.position = 'absolute';
    levelShine.style.top = '-10%';
    levelShine.style.left = '-10%';
    levelShine.style.width = '120%';
    levelShine.style.height = '10%';
    levelShine.style.background = 'rgba(255,255,255,0.3)';
    levelShine.style.transform = 'rotate(45deg)';
    levelShine.style.animation = 'levelShine 3s infinite 0.5s';
    selectLevelBtn.appendChild(levelShine);

    selectLevelBtn.onclick = () => {
      this.togglePauseMenu();
      if (this.game) {
        this.game.showLevelSelection();
      }
    };
    buttonContainer.appendChild(selectLevelBtn);

    // Restart button
    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'RESTART MISSION';
    restartBtn.className = 'pause-btn restart-btn';
    restartBtn.style.width = '100%';
    restartBtn.style.padding = '15px 20px';
    restartBtn.style.background =
      'linear-gradient(to bottom, #ff9900, #cc7700)';
    restartBtn.style.color = '#ffffff';
    restartBtn.style.border = '1px solid #ffaa00';
    restartBtn.style.borderRadius = '5px';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.fontSize = '20px';
    restartBtn.style.fontWeight = 'bold';
    restartBtn.style.textTransform = 'uppercase';
    restartBtn.style.letterSpacing = '2px';
    restartBtn.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    restartBtn.style.boxShadow =
      '0 0 15px rgba(200, 100, 0, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.2)';
    restartBtn.style.transition = 'all 0.2s ease';
    restartBtn.style.position = 'relative';
    restartBtn.style.overflow = 'hidden';

    // Add shine effect
    const restartShine = document.createElement('div');
    restartShine.style.position = 'absolute';
    restartShine.style.top = '-10%';
    restartShine.style.left = '-10%';
    restartShine.style.width = '120%';
    restartShine.style.height = '10%';
    restartShine.style.background = 'rgba(255,255,255,0.3)';
    restartShine.style.transform = 'rotate(45deg)';
    restartShine.style.animation = 'restartShine 3s infinite 1s';
    restartBtn.appendChild(restartShine);

    restartBtn.onclick = () => {
      this.togglePauseMenu();
      if (this.game) {
        this.game.restartLevel();
      }
    };
    buttonContainer.appendChild(restartBtn);

    // Quit to menu button
    const quitBtn = document.createElement('button');
    quitBtn.textContent = 'RETURN TO BASE';
    quitBtn.className = 'pause-btn quit-btn';
    quitBtn.style.width = '100%';
    quitBtn.style.padding = '15px 20px';
    quitBtn.style.background = 'linear-gradient(to bottom, #cc0033, #990022)';
    quitBtn.style.color = '#ffffff';
    quitBtn.style.border = '1px solid #ff0044';
    quitBtn.style.borderRadius = '5px';
    quitBtn.style.cursor = 'pointer';
    quitBtn.style.fontSize = '20px';
    quitBtn.style.fontWeight = 'bold';
    quitBtn.style.textTransform = 'uppercase';
    quitBtn.style.letterSpacing = '2px';
    quitBtn.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    quitBtn.style.boxShadow =
      '0 0 15px rgba(200, 0, 50, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.2)';
    quitBtn.style.transition = 'all 0.2s ease';
    quitBtn.style.position = 'relative';
    quitBtn.style.overflow = 'hidden';

    // Add shine effect
    const quitShine = document.createElement('div');
    quitShine.style.position = 'absolute';
    quitShine.style.top = '-10%';
    quitShine.style.left = '-10%';
    quitShine.style.width = '120%';
    quitShine.style.height = '10%';
    quitShine.style.background = 'rgba(255,255,255,0.3)';
    quitShine.style.transform = 'rotate(45deg)';
    quitShine.style.animation = 'quitShine 3s infinite 1.5s';
    quitBtn.appendChild(quitShine);

    quitBtn.onclick = () => {
      window.location.reload();
    };
    buttonContainer.appendChild(quitBtn);

    // Add animations
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes continueShine {
        0% { top: -10%; left: -10%; }
        20% { top: 110%; left: 110%; }
        100% { top: 110%; left: 110%; }
      }
      
      @keyframes levelShine {
        0% { top: -10%; left: -10%; }
        20% { top: 110%; left: 110%; }
        100% { top: 110%; left: 110%; }
      }
      
      @keyframes restartShine {
        0% { top: -10%; left: -10%; }
        20% { top: 110%; left: 110%; }
        100% { top: 110%; left: 110%; }
      }
      
      @keyframes quitShine {
        0% { top: -10%; left: -10%; }
        20% { top: 110%; left: 110%; }
        100% { top: 110%; left: 110%; }
      }
      
      .pause-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 0 25px currentColor, inset 0 0 15px rgba(255,255,255,0.5);
      }
      
      .pause-btn:active {
        transform: scale(0.98);
      }
      
      .continue-btn:hover {
        box-shadow: 0 0 20px #00cc22, inset 0 0 15px rgba(255,255,255,0.5);
      }
      
      .select-level-btn:hover {
        box-shadow: 0 0 20px #0088ff, inset 0 0 15px rgba(255,255,255,0.5);
      }
      
      .restart-btn:hover {
        box-shadow: 0 0 20px #ff9900, inset 0 0 15px rgba(255,255,255,0.5);
      }
      
      .quit-btn:hover {
        box-shadow: 0 0 20px #cc0033, inset 0 0 15px rgba(255,255,255,0.5);
      }
    `;
    document.head.appendChild(styleSheet);

    contentContainer.appendChild(buttonContainer);
    pauseMenu.appendChild(contentContainer);
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
    this.hudElements.healthPercentage.textContent = `${Math.floor(
      healthPercent
    )}%`;

    // Change color based on health level
    if (healthPercent > 60) {
      this.hudElements.healthBar.style.background =
        'linear-gradient(to right, #00ff88, #00ddff)';
      this.hudElements.healthPercentage.style.color = '#00ff88';
    } else if (healthPercent > 30) {
      this.hudElements.healthBar.style.background =
        'linear-gradient(to right, #ffaa00, #ffdd00)';
      this.hudElements.healthPercentage.style.color = '#ffdd00';
    } else {
      this.hudElements.healthBar.style.background =
        'linear-gradient(to right, #ff0044, #ff6600)';
      this.hudElements.healthPercentage.style.color = '#ff6600';
      // Add pulsing effect when health is low
      this.hudElements.healthBar.style.animation = 'healthPulse 0.8s infinite';
    }

    // Update score
    this.hudElements.scoreDisplay.textContent = `${this.gameState.score}`;
  }

  // Update enemy count display
  updateEnemyCount(destroyedCount, totalCount) {
    if (!this.hudElements.enemyCountDisplay) {
      // Create enemy count display if it doesn't exist
      const enemyCountDisplay = document.createElement('div');
      enemyCountDisplay.id = 'enemy-count-display';
      enemyCountDisplay.style.fontSize = '18px';
      enemyCountDisplay.style.fontWeight = 'bold';
      enemyCountDisplay.style.marginTop = '10px';
      enemyCountDisplay.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.7)';
      enemyCountDisplay.style.color = '#ff6600';

      const hudContainer = document.getElementById('hud-container');
      if (hudContainer) {
        hudContainer.appendChild(enemyCountDisplay);
      } else {
        document.body.appendChild(enemyCountDisplay);
      }

      this.hudElements.enemyCountDisplay = enemyCountDisplay;
    }

    // Update the display with current counts
    if (this.hudElements.enemyCountDisplay) {
      this.hudElements.enemyCountDisplay.textContent = `ENEMIES: ${destroyedCount}/${totalCount}`;

      // Change color based on progress
      const percentComplete = (destroyedCount / totalCount) * 100;
      if (percentComplete < 33) {
        this.hudElements.enemyCountDisplay.style.color = '#ff6600'; // Red-orange when just starting
      } else if (percentComplete < 66) {
        this.hudElements.enemyCountDisplay.style.color = '#ffdd00'; // Yellow when halfway done
      } else if (percentComplete < 100) {
        this.hudElements.enemyCountDisplay.style.color = '#00ffaa'; // Cyan-green when almost done
      } else {
        this.hudElements.enemyCountDisplay.style.color = '#00ff00'; // Bright green when complete
      }
    }
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

  showMessage(message, duration = 2000, color = '#ffffff', verticalOffset = 0) {
    const messageElement = document.createElement('div');
    messageElement.style.position = 'absolute';
    messageElement.style.top = `calc(30% + ${verticalOffset}px)`;
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
