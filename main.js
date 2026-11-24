// Page entry point: index.html -> main.js -> src/js/main.js
import Game from './src/js/main.js';

document.addEventListener('DOMContentLoaded', () => {
  try {
    new Game().init().catch(error => console.error('Game initialization failed:', error));
  } catch (error) {
    console.error('Error during game creation:', error);
  }
});

export default Game;
