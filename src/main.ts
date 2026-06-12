import { Game } from './Game';

const app = document.getElementById('app');
const toolbar = document.getElementById('toolbar');
const hud = document.getElementById('hud');
const inspector = document.getElementById('inspector');

if (!app || !toolbar || !hud || !inspector) {
  throw new Error('Faltan contenedores (#app, #toolbar, #hud o #inspector) en index.html');
}

// Arranca el juego. A partir de aquí todo vive dentro de Game.
new Game(app, toolbar, hud, inspector);

// PWA: tras la primera visita el juego queda jugable sin internet (solo en el
// build publicado; en desarrollo molestaría con caché vieja).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* sin SW se juega igual, solo que no offline */
  });
}
