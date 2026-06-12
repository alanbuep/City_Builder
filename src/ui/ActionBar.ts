import { GameMode } from '../sim/Simulation';

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
 * catástrofes, opciones) con el gran botón 🏗️ CONSTRUIR al final.
 */
export class ActionBar {
  /** Para colgar botones extra (p. ej. el de sonido 🔊). */
  readonly extras: HTMLElement;

  private pauseBtn!: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];
  private modeBtn!: HTMLButtonElement;
  private disasterBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, cb: ActionBarCallbacks) {
    const btn = (
      label: string,
      title: string,
      onClick: () => void,
      cls = 'ctrl',
    ): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', onClick);
      container.appendChild(b);
      return b;
    };

    // --- Reloj ---
    this.pauseBtn = btn('⏸️', 'Pausa / reanudar', cb.onTogglePause);
    for (const speed of [1, 2, 3]) {
      const b = btn(`${speed}x`, `Velocidad ${speed}x`, () => cb.onSetSpeed(speed));
      if (speed === 1) b.classList.add('active');
      this.speedBtns.push(b);
    }
    this.modeBtn = btn('🏙️', 'Cambiar entre Simulación (crece solo) y Constructor (mejoras a mano)', cb.onToggleMode);
    btn('▶️ Obras', 'Arranca todas las obras pendientes que puedas pagar', cb.onStartAll);

    const spacer = document.createElement('div');
    spacer.className = 'ab-spacer';
    container.appendChild(spacer);

    // --- Menús (todos abren ventanas centradas) ---
    this.disasterBtn = btn('🌪️', 'Catástrofes', cb.onOpenDisasters);
    this.disasterBtn.style.display = 'none'; // se muestra al alcanzar el nivel
    btn('🎯', 'Misiones', cb.onOpenMissions);
    btn('🔬', 'Tecnología', cb.onOpenTech);
    btn('⚙️', 'Menú (guardar, sonido, ayuda)', cb.onOpenMenu);
    this.extras = document.createElement('div');
    this.extras.className = 'ab-extras';
    container.appendChild(this.extras);
    btn('🏗️ Construir', 'Abrí el catálogo y elegí qué construir', cb.onOpenBuild, 'ctrl build-btn');
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? '▶️' : '⏸️';
    this.pauseBtn.classList.toggle('active', paused);
  }

  setSpeed(speed: number): void {
    this.speedBtns.forEach((b, i) => b.classList.toggle('active', i + 1 === speed));
  }

  setMode(mode: GameMode): void {
    this.modeBtn.textContent = mode === 'auto' ? '🏙️' : '🔧';
    this.modeBtn.title =
      mode === 'auto'
        ? 'Modo Simulación: la ciudad crece sola. Tocá para pasar a Constructor.'
        : 'Modo Constructor: vos dirigís cada mejora. Tocá para pasar a Simulación.';
  }

  /** Muestra el botón 🌪️ recién cuando la ciudad alcanza el nivel necesario. */
  setDisastersVisible(show: boolean): void {
    this.disasterBtn.style.display = show ? '' : 'none';
  }
}
