export interface DisasterMenuCallbacks {
  onTriggerFire: () => void;
  onTriggerMeteor: () => void;
  onTriggerTornado: () => void;
  onTriggerHurricane: () => void;
  onToggleRandom: (enabled: boolean) => void;
}

/**
 * Panel de catástrofes (borde izquierdo, centrado). Botones para provocar cada
 * tipo a mano (incendio / meteorito / tornado / huracán) + un interruptor para
 * que se desaten al azar mientras jugás.
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

    const add = (label: string, title: string, fn: () => void): void => {
      const btn = document.createElement('button');
      btn.className = 'ctrl';
      btn.textContent = label;
      btn.title = title;
      btn.addEventListener('click', fn);
      row.appendChild(btn);
    };
    add('🔥', 'Incendio en un edificio al azar', cb.onTriggerFire);
    add('🌠', 'Meteorito sobre la ciudad', cb.onTriggerMeteor);
    add('🌪️', 'Tornado que cruza el mapa', cb.onTriggerTornado);
    add('🌀', 'Huracán sobre toda la ciudad', cb.onTriggerHurricane);

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
