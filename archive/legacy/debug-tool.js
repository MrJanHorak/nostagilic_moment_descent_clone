// Debug environment for the game
// This file will help us diagnose the white screen issue

// Create a simple UI for debugging
function createDebugUI() {
  const debugElement = document.createElement('div');
  debugElement.style.position = 'fixed';
  debugElement.style.top = '10px';
  debugElement.style.left = '10px';
  debugElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  debugElement.style.color = '#fff';
  debugElement.style.padding = '15px';
  debugElement.style.fontFamily = 'monospace';
  debugElement.style.fontSize = '12px';
  debugElement.style.maxHeight = '90vh';
  debugElement.style.overflowY = 'auto';
  debugElement.style.zIndex = '9999';
  debugElement.style.borderRadius = '5px';
  debugElement.style.maxWidth = '80%';
  debugElement.style.minWidth = '300px';

  const title = document.createElement('h2');
  title.textContent = 'Debug Console';
  title.style.margin = '0 0 10px 0';
  title.style.color = '#0f0';
  debugElement.appendChild(title);

  const logArea = document.createElement('div');
  logArea.id = 'debug-log';
  debugElement.appendChild(logArea);

  // Add buttons for tests
  const testButtonsContainer = document.createElement('div');
  testButtonsContainer.style.marginTop = '15px';
  testButtonsContainer.style.display = 'flex';
  testButtonsContainer.style.flexDirection = 'column';
  testButtonsContainer.style.gap = '5px';

  // Test Three.js renderer
  const testThreeButton = createDebugButton('Test THREE.js', testThreeJs);
  testButtonsContainer.appendChild(testThreeButton);

  // Test DOM rendering
  const testDOMButton = createDebugButton('Test DOM Rendering', testDOM);
  testButtonsContainer.appendChild(testDOMButton);

  // Test module imports
  const testImportsButton = createDebugButton('Test Imports', testImports);
  testButtonsContainer.appendChild(testImportsButton);

  // Create game instance
  const createGameButton = createDebugButton(
    'Create Game Instance',
    createGameInstance
  );
  testButtonsContainer.appendChild(createGameButton);

  debugElement.appendChild(testButtonsContainer);
  document.body.appendChild(debugElement);

  // Setup console overrides
  setupConsoleOverrides();

  logDebug('Debug environment initialized');
  return debugElement;
}

// Create a debug button
function createDebugButton(text, onClick) {
  const button = document.createElement('button');
  button.textContent = text;
  button.style.padding = '8px';
  button.style.margin = '2px 0';
  button.style.backgroundColor = '#222';
  button.style.color = '#0f0';
  button.style.border = '1px solid #0f0';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  button.addEventListener('click', onClick);
  return button;
}

// Log a debug message
function logDebug(msg, type = 'info') {
  const logArea = document.getElementById('debug-log');
  if (!logArea) return;

  const logEntry = document.createElement('div');
  const timestamp = new Date().toLocaleTimeString();

  logEntry.style.margin = '5px 0';
  logEntry.style.borderLeft = '3px solid';
  logEntry.style.paddingLeft = '8px';

  switch (type) {
    case 'error':
      logEntry.style.color = '#f66';
      logEntry.style.borderColor = '#f00';
      break;
    case 'warn':
      logEntry.style.color = '#ff6';
      logEntry.style.borderColor = '#ff0';
      break;
    case 'success':
      logEntry.style.color = '#6f6';
      logEntry.style.borderColor = '#0f0';
      break;
    default:
      logEntry.style.color = '#6cf';
      logEntry.style.borderColor = '#09f';
  }

  logEntry.textContent = `[${timestamp}] ${msg}`;
  logArea.appendChild(logEntry);

  // Auto-scroll to bottom
  logArea.scrollTop = logArea.scrollHeight;
}

// Override console methods
function setupConsoleOverrides() {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  console.log = function (...args) {
    logDebug(args.join(' '), 'info');
    originalConsole.log.apply(console, args);
  };

  console.warn = function (...args) {
    logDebug(args.join(' '), 'warn');
    originalConsole.warn.apply(console, args);
  };

  console.error = function (...args) {
    logDebug(args.join(' '), 'error');
    originalConsole.error.apply(console, args);
  };

  console.info = function (...args) {
    logDebug(args.join(' '), 'info');
    originalConsole.info.apply(console, args);
  };

  // Handle global errors
  window.addEventListener('error', (event) => {
    logDebug(
      `ERROR: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
      'error'
    );
  });

  // Handle unhandled promises
  window.addEventListener('unhandledrejection', (event) => {
    logDebug(`Unhandled Promise Rejection: ${event.reason}`, 'error');
  });
}

// Test if THREE.js works properly
function testThreeJs() {
  try {
    logDebug('Testing THREE.js...');

    // Import THREE dynamically
    import('three')
      .then((THREE) => {
        // Create a simple scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        );
        const renderer = new THREE.WebGLRenderer();

        renderer.setSize(200, 200);
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '50%';
        renderer.domElement.style.left = '50%';
        renderer.domElement.style.transform = 'translate(-50%, -50%)';
        renderer.domElement.style.border = '1px solid white';

        document.body.appendChild(renderer.domElement);

        // Create a simple cube
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
        });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        camera.position.z = 5;

        // Simple animation
        function animate() {
          requestAnimationFrame(animate);
          cube.rotation.x += 0.01;
          cube.rotation.y += 0.01;
          renderer.render(scene, camera);
        }

        animate();
        logDebug('THREE.js test successful!', 'success');

        // Clean up after 5 seconds
        setTimeout(() => {
          document.body.removeChild(renderer.domElement);
          logDebug('THREE.js test cleanup complete');
        }, 5000);
      })
      .catch((err) => {
        logDebug(`THREE.js import error: ${err}`, 'error');
      });
  } catch (err) {
    logDebug(`THREE.js test error: ${err}`, 'error');
  }
}

// Test DOM rendering
function testDOM() {
  try {
    logDebug('Testing DOM rendering...');
    const testContainer = document.createElement('div');
    testContainer.id = 'dom-test-container';
    testContainer.style.position = 'absolute';
    testContainer.style.top = '50%';
    testContainer.style.left = '50%';
    testContainer.style.transform = 'translate(-50%, -50%)';
    testContainer.style.padding = '20px';
    testContainer.style.backgroundColor = 'rgba(0, 100, 0, 0.7)';
    testContainer.style.color = 'white';
    testContainer.style.border = '2px solid white';
    testContainer.style.borderRadius = '10px';
    testContainer.style.zIndex = '9998';

    testContainer.innerHTML = `
      <h3>DOM Test</h3>
      <p>If you can see this, DOM rendering is working correctly.</p>
      <button id="dom-test-close">Close</button>
    `;

    document.body.appendChild(testContainer);

    document.getElementById('dom-test-close').addEventListener('click', () => {
      document.body.removeChild(testContainer);
      logDebug('DOM test cleanup complete');
    });

    logDebug('DOM rendering test successful!', 'success');
  } catch (err) {
    logDebug(`DOM test error: ${err}`, 'error');
  }
}

// Test imports
function testImports() {
  logDebug('Testing module imports...');

  // Check for Game import
  import('./src/js/main.js')
    .then((module) => {
      logDebug('Successfully imported Game module', 'success');
      if (typeof module.default === 'function') {
        logDebug('Game is a valid class', 'success');
      } else {
        logDebug(
          `Game export is not a function, it's a ${typeof module.default}`,
          'error'
        );
      }
    })
    .catch((err) => {
      logDebug(`Error importing Game: ${err}`, 'error');
    });

  // Check utility imports
  import('./src/js/utils/effectsUtils.js')
    .then(() => logDebug('Effects utils imported successfully', 'success'))
    .catch((err) => logDebug(`Error importing effects utils: ${err}`, 'error'));

  import('./src/js/utils/debugUtils.js')
    .then(() => logDebug('Debug utils imported successfully', 'success'))
    .catch((err) => logDebug(`Error importing debug utils: ${err}`, 'error'));

  // Check core imports
  import('./src/js/core/AudioManager.js')
    .then(() => logDebug('AudioManager imported successfully', 'success'))
    .catch((err) => logDebug(`Error importing AudioManager: ${err}`, 'error'));

  import('./src/js/core/GameState.js')
    .then(() => logDebug('GameState imported successfully', 'success'))
    .catch((err) => logDebug(`Error importing GameState: ${err}`, 'error'));
}

// Create game instance
function createGameInstance() {
  logDebug('Attempting to create a Game instance...');

  import('./src/js/main.js')
    .then((module) => {
      try {
        const Game = module.default;
        const game = new Game();
        logDebug('Game instance created successfully', 'success');

        logDebug('Initializing game...');
        game
          .init()
          .then(() => {
            logDebug('Game initialized successfully!', 'success');
          })
          .catch((err) => {
            logDebug(`Game initialization error: ${err}`, 'error');
            if (err.stack) logDebug(`Stack: ${err.stack}`, 'error');
          });
      } catch (err) {
        logDebug(`Error creating Game instance: ${err}`, 'error');
        if (err.stack) logDebug(`Stack: ${err.stack}`, 'error');
      }
    })
    .catch((err) => {
      logDebug(`Failed to import Game module: ${err}`, 'error');
    });
}

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  createDebugUI();
});
