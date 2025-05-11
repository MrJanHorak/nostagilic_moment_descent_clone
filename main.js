// Main entry point for the game

import Game from './src/js/main.js';

// // Initialize the game when the page loads
// document.addEventListener('DOMContentLoaded', () => {
//   console.log("Initializing game...");

//   try {
//     console.log("Creating Game instance");
//     const game = new Game();
//     console.log("Game instance created, calling init()");
//     game.init().then(() => {
//       console.log("Game initialization successful!");
//     }).catch(error => {
//       console.error("Game initialization failed:", error);
//     });
//   } catch (error) {
//     console.error("Error during game creation:", error);
//   }
// });

// Export for anyone who imports this file directly
export default Game;
