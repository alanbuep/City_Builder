import { Game } from './Game';

const app = document.getElementById('app');
const topbar = document.getElementById('topbar');
const actionbar = document.getElementById('actionbar');
const inspector = document.getElementById('inspector');

if (!app || !topbar || !actionbar || !inspector) {
  throw new Error('Faltan contenedores (#app, #topbar, #actionbar o #inspector) en index.html');
}

// Arranca el juego. A partir de aquí todo vive dentro de Game.
new Game(app, topbar, actionbar, inspector);

// PWA: tras la primera visita el juego queda jugable sin internet (solo en el
// build publicado; en desarrollo molestaría con caché vieja).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* sin SW se juega igual, solo que no offline */
  });
}
