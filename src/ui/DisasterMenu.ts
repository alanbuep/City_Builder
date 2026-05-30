export interface DisasterMenuCallbacks {
  onTriggerFire: () => void;
  onToggleRandom: (enabled: boolean) => void;
}

/**
 * Pequeño panel de catástrofes (abajo a la derecha, sobre la botonera de guardado).
 * Por ahora: provocar un incendio a mano + activar/desactivar catástrofes al azar.
 * Pensado para crecer con más tipos (meteorito/tornado/huracán).
 */
export class DisasterMenu {
  private randomBtn: HTMLButtonElement;
  private random = false;

  constructor(parent: HTMLElement, cb: DisasterMenuCallbacks) {
    const wrap = document.createElement('div');
    wrap.className = 'panel disaster-menu';

    const head = document.createElement('div');
    head.className = 'disaster-head';
    head.textContent = '🌪️ Catástrofes';
    wrap.appendChild(head);

    const row = document.createElement('div');
    row.className = 'disaster-row';

    const fireBtn = document.createElement('button');
    fireBtn.className = 'ctrl';
    fireBtn.textContent = '🔥 Incendio';
    fireBtn.title = 'Provocar un incendio en un edificio al azar';
    fireBtn.addEventListener('click', () => cb.onTriggerFire());
    row.appendChild(fireBtn);

    this.randomBtn = document.createElement('button');
    this.randomBtn.className = 'ctrl';
    this.randomBtn.textContent = '🎲 Azar: OFF';
    this.randomBtn.title = 'Activar catástrofes aleatorias';
    this.randomBtn.addEventListener('click', () => {
      this.random = !this.random;
      this.randomBtn.textContent = `🎲 Azar: ${this.random ? 'ON' : 'OFF'}`;
      this.randomBtn.classList.toggle('active', this.random);
      cb.onToggleRandom(this.random);
    });
    row.appendChild(this.randomBtn);

    wrap.appendChild(row);
    parent.appendChild(wrap);
  }
}
