import { Modal } from './Modal';

export interface DisasterModalCallbacks {
  onTriggerFire: () => void;
  onTriggerMeteor: () => void;
  onTriggerTornado: () => void;
  onTriggerHurricane: () => void;
  onToggleRandom: (enabled: boolean) => void;
}

/**
 * Ventana centrada de catástrofes (🌪️): botones para provocar cada tipo a mano
 * + un interruptor para que se desaten al azar mientras jugás. Al provocar una,
 * la ventana se cierra sola para ver el espectáculo.
 */
export class DisasterModal {
  private modal = new Modal('🌪️ Catástrofes');
  private randomBtn: HTMLButtonElement;
  private random = false;

  constructor(cb: DisasterModalCallbacks) {
    const body = this.modal.body;
    const intro = document.createElement('div');
    intro.style.cssText = 'opacity:.8; font-size:12px; line-height:1.5; margin-bottom:10px';
    intro.textContent =
      'Provocá una catástrofe a mano (y mirá cómo la ciudad la sufre), o activá el azar para vivir con el riesgo. ' +
      'Los edificios dañados quedan en ruinas hasta repararlos. Cada catástrofe superada da una ficha 🗝️.';
    body.appendChild(intro);

    const list = document.createElement('div');
    list.className = 'build-list';
    const add = (label: string, desc: string, fn: () => void): void => {
      const btn = document.createElement('button');
      btn.className = 'build-item';
      btn.innerHTML = `<span class="row1"><span>${label}</span></span><span class="desc">${desc}</span>`;
      btn.addEventListener('click', () => {
        this.modal.close();
        fn();
      });
      list.appendChild(btn);
    };
    add('🔥 Incendio', 'Se prende fuego un edificio al azar. Los bomberos cercanos (o el héroe) lo apagan.', cb.onTriggerFire);
    add('🌠 Meteorito', 'Cae sobre la ciudad: arrasa e incendia la zona del impacto.', cb.onTriggerMeteor);
    add('🌪️ Tornado', 'Cruza el mapa serpenteando y daña lo que toca.', cb.onTriggerTornado);
    add('🌀 Huracán', 'Castiga TODA la ciudad. El más destructivo.', cb.onTriggerHurricane);
    body.appendChild(list);

    this.randomBtn = document.createElement('button');
    this.randomBtn.className = 'ctrl';
    this.randomBtn.style.cssText = 'margin-top:10px; width:100%';
    this.randomBtn.textContent = '🎲 Catástrofes al azar: OFF';
    this.randomBtn.title = 'Cada tanto se desata una sola (casi siempre un incendio)';
    this.randomBtn.addEventListener('click', () => {
      this.random = !this.random;
      this.randomBtn.textContent = `🎲 Catástrofes al azar: ${this.random ? 'ON' : 'OFF'}`;
      this.randomBtn.classList.toggle('active', this.random);
      cb.onToggleRandom(this.random);
    });
    body.appendChild(this.randomBtn);
  }

  open(): void {
    this.modal.open();
  }
}
