// UI Manager for handling game interface elements
import SettingsDialog from './SettingsDialog.js';
import MineGuide from '../core/levels/document/MineGuide.js';
import createMissionSelect from './MissionSelect.js';
import NavigationDisplay from './NavigationDisplay.js';

class UIManager {
  constructor(gameState, audioManager) {
    this.gameState = gameState;
    this.audioManager = audioManager;

    this.startScreen = null;
    this.transientElements = new Set();
    this.presentationTimers = new Set();
    this.hudElements = {
      healthBar: null,
      scoreDisplay: null,
      gameOverDisplay: null,
    };

    this.initHUD();
    this.navigationDisplay = new NavigationDisplay();
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
      hudContainer.style.boxSizing = 'border-box';
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
      weaponSelector.style.marginTop = '5px'; // Create weapon slots with numbers 1-4
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
        weaponSlot.style.cursor = i === 0 ? 'pointer' : 'not-allowed';
        weaponSlot.style.transition = 'all 0.2s ease';
        weaponSlot.style.position = 'relative';
        weaponSlot.style.opacity = i === 0 ? '1.0' : '0.5';
        weaponSlot.innerHTML = `<div style="font-weight: bold;">${
          i + 1
        }</div><div style="font-size: 10px;">${weaponSlots[i]}</div>${
          i === 0 ? '<div style="font-size: 9px;">∞</div>' : ''
        }`;

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
      this.startScreen?.remove();
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
                  <span style="color: #00ddff; font-weight: bold;">Mouse / Arrows</span>
                </p>
                <p style="margin: 5px 0; display: flex; justify-content: space-between;">
                  <span style="color: #ffffff;">Shoot:</span> 
                  <span style="color: #00ddff; font-weight: bold;">Left Click / F</span>
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
            gap: 16px;
            flex-wrap: wrap;
            justify-content: center;
          ">
            <button type="button" id="start-game-btn" class="game-button" style="
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
              <span style="position: relative; z-index: 2;">START CAMPAIGN</span>
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
            </button>
            
            <button type="button" id="select-level-btn" class="game-button" style="
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
              <span style="position: relative; z-index: 2;">SELECT MISSION</span>
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
            </button>
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
          .game-button:focus-visible { outline: 2px solid white; outline-offset: 4px; }
        </style>
      `;
      document.body.appendChild(startScreen);
      this.startScreen = startScreen;
      const designerLink = document.createElement('a');
      designerLink.href = '/editor.html';
      designerLink.textContent = 'LEVEL DESIGNER';
      designerLink.id = 'level-designer-link';
      Object.assign(designerLink.style, { display: 'block', color: '#8bdeef', textAlign: 'center', margin: '14px auto', position: 'relative', zIndex: '2' });
      startScreen.firstElementChild.appendChild(designerLink);
      const settingsButton = this.createSettingsButton();
      Object.assign(settingsButton.style, { display: 'block', margin: '16px auto 0' });
      startScreen.querySelector('.title-container').appendChild(settingsButton);
      Object.assign(startScreen.querySelector('.title-container').style, {
        boxSizing: 'border-box', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' });

      // Add event listener for the level selection button
      const selectLevelBtn = document.getElementById('select-level-btn');
      if (selectLevelBtn) {
        selectLevelBtn.addEventListener('click', () => {
          this.game.showLevelSelection();
        });
      }

      const startButton = document.getElementById('start-game-btn');
      startButton.addEventListener('click', () => {
        const campaign = this.game.levelManager.levels.findIndex(level => level.campaignOrder === 1);
        this.game.startSession({ endless: false, levelIndex: Math.max(0, campaign) });
      });
      return startButton;
    } catch (error) {
      console.error('Error creating start screen:', error);
      return null;
    }
  }

  // Update weapon UI to reflect current weapon selection and ammo counts
  updateWeaponUI() {
    const weaponTypes = ['pulse', 'laser', 'missile', 'plasma'];

    for (let i = 0; i < 4; i++) {
      const slot = document.getElementById(`weapon-slot-${i + 1}`);
      const weaponType = weaponTypes[i];

      if (slot) {
        const isUnlocked =
          this.gameState.weaponInventory?.[weaponType]?.unlocked ||
          weaponType === 'pulse';
        const isSelected = this.gameState.currentWeapon === weaponType;
        const ammo = this.gameState.weaponInventory?.[weaponType]?.ammo || 0;

        // Update appearance
        slot.style.opacity = isUnlocked ? '1.0' : '0.5';
        slot.style.background = isSelected
          ? 'rgba(0, 170, 255, 0.3)'
          : 'rgba(0, 0, 0, 0.3)';
        slot.style.color = isSelected ? '#ffffff' : '#0088cc';

        // Update ammo display
        const ammoDisplay = ammo === Infinity ? '∞' : ammo;
        slot.innerHTML = `<div style="font-weight: bold;">${i + 1}</div>
                          <div style="font-size: 10px;">${weaponTypes[
                            i
                          ].toUpperCase()}</div>
                          ${
                            isUnlocked
                              ? `<div style="font-size: 9px;">${ammoDisplay}</div>`
                              : ''
                          }`;

        // Update click handler
        slot.onclick = isUnlocked
          ? () => {
              this.gameState.switchWeapon(weaponType);
            }
          : null;

        slot.style.cursor = isUnlocked ? 'pointer' : 'not-allowed';
      }
    }
  }

  // Create level selection screen
  createLevelSelect(game) {
    this.levelSelectMenu?.remove();
    this.levelSelectMenu = createMissionSelect(game.levelManager.levels,
      index => game.startSession({ endless: false, levelIndex: index }), () => game.showMainMenu());
    document.body.appendChild(this.levelSelectMenu);
    this.levelSelectMenu.querySelector('button')?.focus();
    return this.levelSelectMenu;
  }
  hideLevelSelect() {
    if (this.levelSelectMenu) {
      this.levelSelectMenu.style.display = 'none';
    }
  }

  createSettingsButton() {
    const button = document.createElement('button');
    button.textContent = 'SETTINGS';
    Object.assign(button.style, { padding: '10px 20px', background: '#003048', color: '#cafaff',
      border: '1px solid #00aaff', borderRadius: '5px', fontSize: '16px', cursor: 'pointer' });
    button.addEventListener('click', () => this.showSettings());
    return button;
  }

  showSettings() {
    if (!['menu', 'paused'].includes(this.game.session.phase)) return false;
    this.game.inputManager?.clearKeys();
    this.settingsDialog ??= new SettingsDialog(this.game.settings);
    this.settingsDialog.open();
    return true;
  }

  // Create pause menu
  createPauseMenu() {
    if (this.pauseMenu) {
      return this.pauseMenu;
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
    Object.assign(contentContainer.style, { boxSizing: 'border-box',
      maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' });

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

    continueBtn.onclick = () => this.game.resumeGame();
    buttonContainer.appendChild(continueBtn);
    const settingsButton = this.createSettingsButton();
    settingsButton.style.width = '100%';
    buttonContainer.appendChild(settingsButton);

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
      this.game.showMainMenu();
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
    pauseMenu.appendChild(styleSheet);

    contentContainer.appendChild(buttonContainer);
    pauseMenu.appendChild(contentContainer);
    document.body.appendChild(pauseMenu);
    this.pauseMenu = pauseMenu;

    return pauseMenu;
  }

  // Toggle pause menu visibility
  togglePauseMenu() {
    this.game.togglePause();
  }

  showPauseMenu() {
    this.createPauseMenu().style.display = 'flex';
  }

  hidePauseMenu() {
    if (this.pauseMenu) this.pauseMenu.style.display = 'none';
  }

  showArenaGuide() {
    this.arenaGuide?.remove();
    const guide = document.createElement('aside');
    guide.id = 'arena-guide';
    guide.textContent = this.game.levelManager.currentLevel?.combat
      ? 'COMBAT TRAINING · Clear 2 drones · Click to capture mouse/fire pulse · Walls provide cover · Esc pause'
      : 'FLIGHT TRAINING · Fly through the cyan doorway and return. Q/E roll · Arrows look · Esc pause';
    this.guideDetails = document.createElement('span'); this.guideDetails.textContent = guide.textContent;
    this.guideSummary = document.createElement('span'); this.guideSummary.id = 'cockpit-objective'; this.guideSummary.hidden = true;
    this.guideSummary.textContent = this.game.levelManager.currentLevel?.combat ? 'COMBAT TRAINING · CLEAR DRONES' : 'FLIGHT TRAINING · CYAN DOORWAY';
    this.guideEscape = document.createElement('span'); this.guideEscape.id = 'escape-countdown'; this.guideEscape.hidden = true;
    this.guideEscape.setAttribute('role', 'timer'); this.guideEscape.setAttribute('aria-label', 'Reactor escape time remaining');
    Object.assign(this.guideEscape.style, { font: 'bold 18px monospace', marginTop: '6px', color: '#ffce77' });
    guide.replaceChildren(this.guideDetails, this.guideSummary, this.guideEscape);
    Object.assign(guide.style, { position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: this.game?.diagnostics.enabled ? '150px' : '24px', width: 'min(640px, 85vw)',
      padding: '10px 16px', background: '#001624dd', border: '1px solid #45e5ed',
      borderRadius: '6px', color: '#cafaff', font: '14px Arial, sans-serif',
      textAlign: 'center', pointerEvents: 'none', zIndex: '100' });
    document.body.appendChild(guide);
    this.transientElements.add(guide);
    this.arenaGuide = guide;
    this.updateMissionUI();
    if (this.game.mission) {
      const reticle = document.createElement('div');
      reticle.id = 'aim-reticle';
      reticle.textContent = '+';
      Object.assign(reticle.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        color: '#cafaff', opacity: '0.85', font: '20px monospace', pointerEvents: 'none', zIndex: '90' });
      document.body.appendChild(reticle);
      this.transientElements.add(reticle);
    }
  }

  updateShipView(aim) {
    const values = this.game?.settings.values;
    if (!values) return;
    const hud = document.getElementById('hud-container');
    if (hud) hud.style.visibility = values.showHUD ? 'visible' : 'hidden';
    if (hud) hud.style.display = values.cameraView === 'cockpit' ? 'none' : 'flex';
    const playing = this.game.session.phase === 'playing';
    this.navigationDisplay.update(this.gameState, this.game.spaceship, this.game.exploration,
      this.game.levelManager.interaction?.closedConnections ?? new Set(), playing, values.cameraView === 'cockpit', values.showHUD);
    if (this.arenaGuide && this.arenaGuide.dataset.view !== values.cameraView) {
      const cockpit = values.cameraView === 'cockpit';
      this.arenaGuide.dataset.view = values.cameraView;
      Object.assign(this.arenaGuide.style, { bottom: cockpit ? 'auto' : this.game?.diagnostics.enabled ? '150px' : '24px',
        top: cockpit ? '16px' : 'auto', font: cockpit ? '12px/1.5 monospace' : '14px Arial, sans-serif',
        padding: cockpit ? '6px 12px' : '10px 16px', width: cockpit ? 'fit-content' : 'min(640px, 85vw)', maxWidth: cockpit ? '78vw' : 'none',
        background: cockpit ? '#0b171bd9' : '#001624dd', borderRadius: cockpit ? '2px' : '6px' });
      if (this.guideSummary) this.guideSummary.hidden = !cockpit;
      if (this.guideDetails) Object.assign(this.guideDetails.style, cockpit
        ? { position: 'absolute', top: '0', left: '0', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' }
        : { position: 'static', width: 'auto', height: 'auto', overflow: 'visible', clipPath: 'none' });
    }
    const reticle = document.getElementById('aim-reticle');
    if (reticle) {
      reticle.style.visibility = values.showHUD ? 'visible' : 'hidden';
      reticle.style.left = `${aim ? (aim.x + 1) * 50 : 50}%`;
      reticle.style.top = `${aim ? (1 - aim.y) * 50 : 50}%`;
    }
    if (!this.shipStatus) {
      this.shipStatus = document.createElement('aside'); this.shipStatus.id = 'ship-view-status';
      this.shipStatus.setAttribute('aria-label', 'Ship systems');
      Object.assign(this.shipStatus.style, { position: 'fixed', right: '16px', top: '45%', zIndex: '90',
        color: '#b5dfe8', background: '#061925bf', padding: '8px 12px', borderRight: '2px solid #68c7d3',
        font: '11px/1.8 monospace', whiteSpace: 'pre', pointerEvents: 'none' });
      document.body.appendChild(this.shipStatus);
    }
    this.shipStatus.hidden = this.game.session.phase !== 'playing';
    const cockpit = values.cameraView === 'cockpit';
    if (this.shipStatus.dataset.view !== values.cameraView) {
      this.shipStatus.dataset.view = values.cameraView;
      Object.assign(this.shipStatus.style, { top: cockpit ? 'auto' : '45%', bottom: cockpit ? '8px' : 'auto',
        right: cockpit ? 'auto' : '16px', left: cockpit ? '50%' : 'auto', transform: cockpit ? 'translateX(-50%)' : 'none',
        padding: cockpit ? '3px 8px' : '8px 12px', borderRight: cockpit ? 'none' : '2px solid #68c7d3',
        fontSize: cockpit ? '10px' : '11px', background: cockpit ? '#0b171bc9' : '#061925bf' });
    }
    const text = cockpit ? `COCKPIT VIEW · C CAMERA · L LIGHTS ${values.headlights ? 'ON' : 'OFF'} · H HUD ${values.showHUD ? 'ON' : 'OFF'} · M MAP`
      : `C · ${values.cameraView === 'hud' ? 'HUD VIEW' : 'EXTERNAL VIEW'}\nL · LIGHTS ${values.headlights ? 'ON' : 'OFF'}\nH · HUD ${values.showHUD ? 'ON' : 'OFF'}\nM · EXPLORED MAP`;
    if (this.shipStatus.textContent !== text) this.shipStatus.textContent = text;
  }

  updateMissionUI() {
    const mission = this.game?.mission;
    if (!mission || !this.arenaGuide) return;
    const level = this.game.levelManager.currentLevel;
    if (level.sourceDocument !== this.mineGuide?.document) this.mineGuide = level.sourceDocument ? new MineGuide(level.sourceDocument) : null;
    const interaction = this.game.levelManager.interaction;
    const navigation = this.mineGuide?.describe(this.game.spaceship.group.position, mission.activatedDevices, interaction?.closedConnections ?? new Set());
    const destination = ['mine-link', 'relay-gate'].includes(level.id) ? 'in the upper green chamber (ceiling hatch · Space up / Shift down)' : level.sourceDocument ? 'at the marked exit' : 'at the far end';
    const status = mission.ready ? `EXIT READY · Fly into the green ring ${destination}`
      : `${mission.requiredIds.size ? `Neutralize drones ${mission.defeats.size}/${mission.requiredIds.size}` : 'Reach extraction'} · Exit locked (amber ring ${destination})`;
    const device = this.game.levelManager.interaction?.nearest(this.game.spaceship.group.position);
    const reactors = interaction?.reactors ?? [];
    const reactorStatus = reactors.filter(core => core.health > 0).map(core => ` · CORE ${core.health}/${core.device.health ?? 100}`).join('');
    const systemName = reactors.length ? 'Systems' : 'Relays';
    const relay = mission.requiredDeviceIds.size ? ` · ${systemName} ${mission.activatedDevices.size}/${mission.requiredDeviceIds.size}` +
      (device ? ` · R: activate ${device.label}` : mission.activatedDevices.size < mission.requiredDeviceIds.size ?
        level.id === 'relay-gate' ? ' · Cyan relay: lower blue return chamber · R activates nearby' : reactors.length ? ' · Cyan: R activates · Orange reactor: shoot the core' : ' · Find a cyan relay · R activates nearby' : ' · Linked doors unlocked') : '';
    const doors = level.sourceDocument?.formatVersion >= 8 ? ' · Striped doors: shoot to open' : '';
    const remaining = mission.remainingEscapeMs(this.game.session.timeMs);
    const escapeHint = mission.definition.escape && remaining === null ? ' · Reactor control starts the escape countdown after other objectives are clear' : '';
    if (this.guideEscape) {
      this.guideEscape.hidden = remaining === null;
      this.guideEscape.style.display = remaining === null ? 'none' : 'block';
      if (remaining !== null) {
        const seconds = Math.ceil(remaining / 1000), time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        const countdown = `REACTOR CRITICAL · ESCAPE ${time}`;
        if (this.guideEscape.textContent !== countdown) this.guideEscape.textContent = countdown;
        this.guideEscape.style.color = seconds <= 10 ? '#ff7777' : '#ffce77';
      }
    }
    const text = `${level.name.toUpperCase()} · ${status}${relay}${reactorStatus}${escapeHint}${navigation ? ` · ${navigation}` : ''} · Click/F fire${doors} · Mouse/arrows aim · Orange: ammo · Green: repair · Esc pause`;
    if (this.guideDetails && this.guideDetails.textContent !== text) this.guideDetails.textContent = text;
    if (this.guideSummary) {
      const objective = mission.ready ? 'EXIT READY' : mission.activatedDevices.size < mission.requiredDeviceIds.size
        ? `${systemName.toUpperCase()} ${mission.activatedDevices.size}/${mission.requiredDeviceIds.size}` : `DRONES ${mission.defeats.size}/${mission.requiredIds.size}`;
      const summary = `${level.name.toUpperCase()} · ${objective}${reactorStatus}${device ? ` · R: ${device.label}` : ''}`;
      if (this.guideSummary.textContent !== summary) this.guideSummary.textContent = summary;
    }
    this.arenaGuide.style.borderColor = mission.ready ? '#45ff96' : '#ffb343';
  }

  resetSessionUI() {
    this.navigationDisplay?.reset();
    this.settingsDialog?.close(false);
    for (const timer of this.presentationTimers) clearTimeout(timer);
    this.presentationTimers.clear();
    for (const element of this.transientElements) element.remove();
    this.transientElements.clear();
    this.arenaGuide = null;
    this.guideDetails = this.guideSummary = null;
    this.guideEscape = null;
    this.mineGuide = null;
    this.hidePauseMenu();
    this.resultScreen?.remove();
    this.resultScreen = null;
    this.levelSelectMenu?.remove();
    this.levelSelectMenu = null;
    if (this.hudElements.gameOverDisplay) this.hudElements.gameOverDisplay.style.display = 'none';
  }

  presentationSchedule(callback, delay) {
    const timer = setTimeout(() => { this.presentationTimers.delete(timer); callback(); }, delay);
    this.presentationTimers.add(timer);
  }

  flash(color) {
    const element = document.createElement('div');
    Object.assign(element.style, { position: 'fixed', inset: '0', background: color,
      pointerEvents: 'none', zIndex: '900' });
    document.body.appendChild(element);
    this.transientElements.add(element);
    element.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
    this.presentationSchedule(() => { element.remove(); this.transientElements.delete(element); }, 600);
  }

  showResult(title, message, actions) {
    this.resultScreen?.remove();
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', title);
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '1000',
      background: 'rgba(0, 8, 20, 0.94)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '18px', color: '#b9efff' });
    const heading = document.createElement('h1');
    heading.textContent = title;
    const description = document.createElement('p');
    description.textContent = message;
    overlay.append(heading, description);
    for (const [label, action] of actions) {
      const button = document.createElement('button');
      button.textContent = label;
      Object.assign(button.style, { padding: '12px 28px', fontSize: '18px', cursor: 'pointer' });
      button.addEventListener('click', action);
      overlay.appendChild(button);
    }
    this.resultScreen = overlay;
    document.body.appendChild(overlay);
  }

  showCompletion(hasNext) {
    const actions = [];
    if (hasNext) actions.push(['NEXT MISSION', () => this.game.nextMission()]);
    actions.push(['REPLAY MISSION', () => this.game.restartLevel()],
      ['SELECT MISSION', () => this.game.showLevelSelection()]);
    this.showResult('MISSION COMPLETE', `Score: ${this.gameState.score} (includes 1,000 completion bonus)`, actions);
  }

  showSessionError(error) {
    this.showResult('UNABLE TO CONTINUE', error.message || String(error), [
      ['RETRY MISSION', () => this.game.restartLevel()], ['MAIN MENU', () => this.game.showMainMenu()],
    ]);
  }

  updateHUD() {
    // Update health bar
    const healthPercent =
      (this.gameState.playerHealth / this.gameState.maxPlayerHealth) * 100;
    if (healthPercent > 30) this.hudElements.healthBar.style.animation = '';
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
    this.updateMissionUI();
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
      if (this.game?.levelManager.currentLevel?.kind === 'arena' && !this.game.levelManager.currentLevel.combat && !this.game.isEndlessMode) {
        this.hudElements.enemyCountDisplay.textContent = 'FLIGHT PRACTICE';
        this.hudElements.enemyCountDisplay.style.color = '#45e5ed';
        return;
      }
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
    const meltdown = this.game?.failureReason === 'reactor';
    this.hudElements.gameOverDisplay.querySelector('h2').textContent = meltdown ? 'REACTOR MELTDOWN' : 'SYSTEM FAILURE';
    this.hudElements.finalScore.textContent = `${meltdown ? 'Escape time expired · ' : ''}Final Score: ${this.gameState.score}`;
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

    this.transientElements.add(messageElement);
    this.presentationSchedule(() => {
      messageElement.style.opacity = '0';
      this.presentationSchedule(() => {
        messageElement.remove();
        this.transientElements.delete(messageElement);
      }, 500);
    }, duration);
  }
}

export default UIManager;
