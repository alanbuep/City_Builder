import { GameMode } from '../sim/Simulation';
import { icon } from './icons';

export interface ActionBarCallbacks {
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleMode: () => void;
  onStartAll: () => void;
  onOpenBuild: () => void;
  onOpenMissions: () => void;
  onOpenTech: () => void;
  onOpenDisasters: () => void;
  onOpenMenu: () => void;
}

/**
 * Barra de acciones de abajo (estilo BuildIt): a la izquierda el reloj
 * (pausa/velocidad/modo/obras) y a la derecha los menús (misiones, tecnología,
 * catástrofes, opciones) con el gran botón CONSTRUIR al final. Todo con iconos.
 */
export class ActionBar {
  /** Para colgar botones extra. */
  readonly extras: HTMLElement;

  private pauseBtn!: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];
  private modeBtn!: HTMLButtonElement;
  private disasterBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, cb: ActionBarCallbacks) {
    const btn = (html: string, title: string, onClick: () => void, cls = 'ctrl icon-btn'): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = cls;
      b.innerHTML = html;
      b.title = title;
      b.addEventListener('click', onClick);
      container.appendChild(b);
      return b;
    };

    // --- Reloj ---
    this.pauseBtn = btn(icon('pause'), 'Pausa / reanudar', cb.onTogglePause);
    for (const speed of [1, 2, 3]) {
      const b = btn(`${speed}×`, `Velocidad ${speed}×`, () => cb.onSetSpeed(speed), 'ctrl speed-btn');
      if (speed === 1) b.classList.add('active');
      this.speedBtns.push(b);
    }
    this.modeBtn = btn(icon('building'), 'Cambiar entre Simulación (crece solo) y Constructor (mejoras a mano)', cb.onToggleMode);
    btn(`${icon('play', 18)}<span>Obras</span>`, 'Arranca todas las obras pendientes que puedas pagar', cb.onStartAll, 'ctrl');

    const spacer = document.createElement('div');
    spacer.className = 'ab-spacer';
    container.appendChild(spacer);

    // --- Menús (todos abren ventanas centradas) ---
    this.disasterBtn = btn(icon('alert'), 'Catástrofes', cb.onOpenDisasters);
    this.disasterBtn.style.display = 'none'; // se muestra al alcanzar el nivel
    btn(icon('target'), 'Misiones', cb.onOpenMissions);
    btn(icon('flask'), 'Tecnología', cb.onOpenTech);
    btn(icon('settings'), 'Menú (guardar, sonido, ayuda)', cb.onOpenMenu);
    this.extras = document.createElement('div');
    this.extras.className = 'ab-extras';
    container.appendChild(this.extras);
    btn(`${icon('hammer', 20)}<span>Construir</span>`, 'Abrí el catálogo y elegí qué construir', cb.onOpenBuild, 'ctrl build-btn');
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.innerHTML = paused ? icon('play') : icon('pause');
    this.pauseBtn.classList.toggle('active', paused);
  }

  setSpeed(speed: number): void {
    this.speedBtns.forEach((b, i) => b.classList.toggle('active', i + 1 === speed));
  }

  setMode(mode: GameMode): void {
    this.modeBtn.innerHTML = mode === 'auto' ? icon('building') : icon('wrench');
    this.modeBtn.title =
      mode === 'auto'
        ? 'Modo Simulación: la ciudad crece sola. Tocá para pasar a Constructor.'
        : 'Modo Constructor: vos dirigís cada mejora. Tocá para pasar a Simulación.';
  }

  /** Muestra el botón de catástrofes recién cuando la ciudad alcanza el nivel necesario. */
  setDisastersVisible(show: boolean): void {
    this.disasterBtn.style.display = show ? '' : 'none';
  }
}
