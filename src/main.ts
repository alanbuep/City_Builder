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
