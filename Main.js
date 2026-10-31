import { Game } from './Game.js';

try {
  const game = new Game(document.getElementById('game'));
  game.init();
  window.metroRush = game; // handy for debugging in the console
} catch (err) {
  console.error(err);
  const el = document.querySelector('[data-screen="loading"] .hint');
  if (el) el.textContent = 'Could not start: ' + err.message + ' (WebGL + a local web server are required)';
}