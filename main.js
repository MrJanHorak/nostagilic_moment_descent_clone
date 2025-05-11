// Main entry point for the game
import Game from './src/js/main.js';

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Create error display for debugging
  const debugDisplay = document.createElement('pre');
  debugDisplay.style.position = 'fixed';
  debugDisplay.style.top = '10px';
  debugDisplay.style.left = '10px';
  debugDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  debugDisplay.style.color = 'white';
  debugDisplay.style.padding = '10px';
  debugDisplay.style.fontFamily = 'monospace';
  debugDisplay.style.zIndex = '9999';
  debugDisplay.style.maxHeight = '80%';
  debugDisplay.style.overflow = 'auto';
  debugDisplay.style.fontSize = '12px';
  debugDisplay.style.visibility = 'hidden';
  document.body.appendChild(debugDisplay);
  
  // Override console to capture logs
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn
  };
  
  function logToDisplay(msg, type) {
    debugDisplay.style.visibility = 'visible';
    const line = document.createElement('div');
    line.style.color = type === 'error' ? '#ff6666' : 
                      type === 'warn' ? '#ffff66' : '#aaffaa';
    line.textContent = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
    debugDisplay.appendChild(line);
    debugDisplay.scrollTop = debugDisplay.scrollHeight;
  }
  
  console.log = function(...args) {
    logToDisplay(args.join(' '), 'log');
    originalConsole.log.apply(console, args);
  };
  
  console.error = function(...args) {
    logToDisplay(args.join(' '), 'error');
    originalConsole.error.apply(console, args);
  };
  
  console.warn = function(...args) {
    logToDisplay(args.join(' '), 'warn');
    originalConsole.warn.apply(console, args);
  };
  
  // Setup error handlers
  window.addEventListener('error', function(event) {
    logToDisplay(`${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, 'error');
  });
  
  window.addEventListener('unhandledrejection', function(event) {
    logToDisplay(`Unhandled Promise: ${event.reason}`, 'error');
  });
  
  console.log("Initializing game...");
  
  try {
    console.log("Creating Game instance");
    const game = new Game();
    console.log("Game instance created, calling init()");
    game.init()
      .then(() => {
        console.log("Game initialization successful!");
      })
      .catch(error => {
        console.error("Game initialization failed:", error);
      });
  } catch (error) {
    console.error("Error during game creation:", error);
  }
});