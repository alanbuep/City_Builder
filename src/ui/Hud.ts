import { CityStats, GameMode } from '../sim/Simulation';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const START_YEAR = 2000;
const BAR_HALF_PX = 26; // mitad de la altura útil de cada barra RCI

export interface HudCallbacks {
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleMode: () => void;
}

/**
 * Panel de información en HTML (no en 3D): dinero, población, empleos, fecha,
 * barras de demanda RCI y controles de velocidad. El juego solo llama a
 * `update(stats)` cada frame y a `setPaused/setSpeed` cuando cambian.
 */
export class Hud {
  private moneyEl!: HTMLElement;
  private popEl!: HTMLElement;
  private kidsEl!: HTMLElement;
  private adultsEl!: HTMLElement;
  private jobsEl!: HTMLElement;
  private unempEl!: HTMLElement;
  private dateEl!: HTMLElement;
  private barR!: HTMLElement;
  private barC!: HTMLElement;
  private barI!: HTMLElement;
  private pauseBtn!: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];
  private modeBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, private callbacks: HudCallbacks) {
    this.buildStats(container);
    this.buildRci(container);
    this.buildMode(container);
    this.buildControls(container);
  }

  private buildStats(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="stat"><span>📅 Fecha</span><span class="val" id="hud-date">—</span></div>
      <div class="stat"><span>💰 Dinero</span><span class="val" id="hud-money">—</span></div>
      <div class="stat"><span>👥 Población</span><span class="val" id="hud-pop">—</span></div>
      <div class="stat"><span>🧒 Niños</span><span class="val" id="hud-kids">—</span></div>
      <div class="stat"><span>🧑 Adultos</span><span class="val" id="hud-adults">—</span></div>
      <div class="stat"><span>💼 Empleos</span><span class="val" id="hud-jobs">—</span></div>
      <div class="stat"><span>📉 Desempleo</span><span class="val" id="hud-unemp">—</span></div>
    `;
    container.appendChild(panel);
    this.dateEl = panel.querySelector('#hud-date')!;
    this.moneyEl = panel.querySelector('#hud-money')!;
    this.popEl = panel.querySelector('#hud-pop')!;
    this.kidsEl = panel.querySelector('#hud-kids')!;
    this.adultsEl = panel.querySelector('#hud-adults')!;
    this.jobsEl = panel.querySelector('#hud-jobs')!;
    this.unempEl = panel.querySelector('#hud-unemp')!;
  }

  private buildRci(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div style="text-align:center;margin-bottom:6px;opacity:0.8">Demanda</div>
      <div class="rci">
        <div><div class="bar-wrap"><div class="mid"></div><div class="fill" id="bar-r"></div></div><div class="lbl">R</div></div>
        <div><div class="bar-wrap"><div class="mid"></div><div class="fill" id="bar-c"></div></div><div class="lbl">C</div></div>
        <div><div class="bar-wrap"><div class="mid"></div><div class="fill" id="bar-i"></div></div><div class="lbl">I</div></div>
      </div>
    `;
    container.appendChild(panel);
    this.barR = panel.querySelector('#bar-r')!;
    this.barC = panel.querySelector('#bar-c')!;
    this.barI = panel.querySelector('#bar-i')!;
  }

  private buildMode(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel controls';
    this.modeBtn = document.createElement('button');
    this.modeBtn.className = 'ctrl';
    this.modeBtn.style.flex = '1';
    this.modeBtn.title = 'Cambiar entre Simulación (crece solo) y Constructor (mejoras a mano)';
    this.modeBtn.addEventListener('click', () => this.callbacks.onToggleMode());
    panel.appendChild(this.modeBtn);
    container.appendChild(panel);
    this.setMode('auto');
  }

  private buildControls(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel controls';

    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'ctrl';
    this.pauseBtn.textContent = '⏸️';
    this.pauseBtn.title = 'Pausa / reanudar';
    this.pauseBtn.addEventListener('click', () => this.callbacks.onTogglePause());
    panel.appendChild(this.pauseBtn);

    for (const speed of [1, 2, 3]) {
      const btn = document.createElement('button');
      btn.className = 'ctrl';
      btn.textContent = `${speed}x`;
      if (speed === 1) btn.classList.add('active');
      btn.addEventListener('click', () => this.callbacks.onSetSpeed(speed));
      this.speedBtns.push(btn);
      panel.appendChild(btn);
    }

    container.appendChild(panel);
  }

  /** Refresca todos los números y barras. Se llama cada frame. */
  update(stats: CityStats): void {
    const year = START_YEAR + Math.floor(stats.month / 12);
    this.dateEl.textContent = `${MONTHS[stats.month % 12]} ${year}`;

    this.moneyEl.textContent = `$${stats.money.toLocaleString('es')}`;
    this.moneyEl.style.color = stats.money < 0 ? '#ff6b6b' : '#fff';

    this.popEl.textContent = stats.population.toLocaleString('es');
    this.kidsEl.textContent = stats.children.toLocaleString('es');
    this.adultsEl.textContent = stats.adults.toLocaleString('es');
    this.jobsEl.textContent = stats.jobs.toLocaleString('es');

    const unempPct = Math.round(stats.unemploymentRate * 100);
    this.unempEl.textContent = `${unempPct}%`;
    // Rojo si el desempleo es alto, verde si es bajo (y hay adultos).
    this.unempEl.style.color = stats.adults === 0 ? '#fff' : unempPct > 25 ? '#ff6b6b' : '#7CFC9A';

    this.setBar(this.barR, stats.demand.residential, '#4caf50');
    this.setBar(this.barC, stats.demand.commercial, '#2196f3');
    this.setBar(this.barI, stats.demand.industrial, '#ffc107');
  }

  /** Pinta una barra: hacia arriba (zona) si la demanda es +, abajo (rojo) si -. */
  private setBar(fill: HTMLElement, demand: number, color: string): void {
    const px = Math.round(Math.abs(demand) * BAR_HALF_PX);
    fill.style.height = `${px}px`;
    if (demand >= 0) {
      fill.style.bottom = '50%';
      fill.style.top = '';
      fill.style.background = color;
    } else {
      fill.style.top = '50%';
      fill.style.bottom = '';
      fill.style.background = '#e53935';
    }
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? '▶️' : '⏸️';
  }

  setSpeed(speed: number): void {
    this.speedBtns.forEach((btn, i) => {
      btn.classList.toggle('active', i + 1 === speed);
    });
  }

  setMode(mode: GameMode): void {
    this.modeBtn.textContent = mode === 'auto' ? '🏙️ Modo: Simulación' : '🔧 Modo: Constructor';
  }
}
