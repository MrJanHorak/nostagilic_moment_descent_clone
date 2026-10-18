import Game from './src/js/main.js';
import mountPlaytest from './src/js/editor/PlaytestBridge.js';

const game = new Game();
game.init().then(() => mountPlaytest(game)).catch(error => {
  document.body.textContent = `Playtest could not start: ${error.message}`;
  console.error(error);
});
