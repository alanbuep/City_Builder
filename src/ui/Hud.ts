import { CityStats, GameMode, TechStatus } from '../sim/Simulation';
import { MissionStatus } from '../sim/Missions';
import { Material, MATERIALS, MATERIAL_ICON, MATERIAL_LABEL, CORRALON_CAP } from '../sim/types';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const START_YEAR = 2000;
const BAR_HALF_PX = 26;

const RCI_INFO =
  'Demanda RCI: cuánto quiere crecer cada tipo de zona — Residencial, Comercial e Industrial. ' +
  'Barra hacia arriba (en color) = se quiere más de ese tipo (construilo). Hacia abajo (rojo) = sobra. ' +
  'Es tu guía de qué construir.';
const UTIL_INFO =
  'Servicios básicos: lo que la ciudad PRODUCE vs lo que CONSUME. Consumen las casas, los comercios ' +
  'y la industria — si demolís edificios, el consumo BAJA. En rojo = falta, construí otra planta (o demolé). ' +
  'La energía hace falta para que las zonas pasen de nivel 1; agua y gas para que lleguen al nivel máximo.';
const TECH_INFO =
  'Tecnología: tu ciudad desbloquea edificios nuevos al alcanzar hitos de población, ' +
  'empleo industrial, tesoro o CIENCIA. La barra muestra cuánto te falta para el próximo desbloqueo. ' +
  'La ciencia 🔬 la generan los laboratorios/observatorios/parque científico (necesitan energía) y se acumula ' +
  'para habilitar lo más avanzado, como el Centro Espacial.';
const MISSION_INFO =
  'Misiones: metas concretas que guían tu ciudad. Cumplirlas da dinero o fichas 🗝️ ' +
  'de territorio. Se muestran las próximas 3; las cumplidas quedan contadas arriba.';
const MAT_INFO =
  'Materiales de tu ciudad: total = reserva inicial + lo guardado en los corralones. ' +
  'Cada corralón almacena hasta ' + CORRALON_CAP + ' de cada material. Conectá productoras por CALLE a un corralón para fabricar más. ' +
  'Ojo: muchas productoras consumen un insumo (la cementera y la ladrillería gastan ARENA, la electrónica gasta ACERO), ' +
  'que sale del corralón o de la reserva. Casi todo lo que construís gasta materiales.';

export interface HudCallbacks {
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onToggleMode: () => void;
  onStartAll: () => void;
}

/** Panel de información (dinero, población, demanda RCI, servicios básicos, controles). */
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
  private powerEl!: HTMLElement;
  private waterEl!: HTMLElement;
  private gasEl!: HTMLElement;
  private covSecEl!: HTMLElement;
  private covHealthEl!: HTMLElement;
  private covEduEl!: HTMLElement;
  private covFoodEl!: HTMLElement;
  private matEls!: Record<Material, HTMLElement>;
  private matCapEl!: HTMLElement;
  private scienceEl!: HTMLElement;
  private territoryEl!: HTMLElement;
  private techCountEl!: HTMLElement;
  private techNextEl!: HTMLElement;
  private techBarWrap!: HTMLElement;
  private techFill!: HTMLElement;
  private missionCountEl!: HTMLElement;
  private missionListEl!: HTMLElement;
  private missionSig = ''; // para no reconstruir el DOM si nada cambió
  private pauseBtn!: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];
  private modeBtn!: HTMLButtonElement;
  private tooltip: HTMLElement;

  constructor(container: HTMLElement, private callbacks: HudCallbacks) {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tool-tip';
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);

    this.buildStats(container);
    this.buildMissions(container);
    this.buildRci(container);
    this.buildUtilities(container);
    this.buildCoverage(container);
    this.buildMaterials(container);
    this.buildTech(container);
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
      <div class="panel-head"><span style="opacity:0.85">Demanda</span></div>
      <div class="rci">
        <div><div class="bar-wrap"><div class="mid"></div><div class="fill" id="bar-r"></div></div><div class="lbl">R</div></div>
        <div><div class="bar-wrap"><div class="mid"></div><div class="fill" id="bar-c"></div></div><div class="lbl">C</div></div>
        <div><div class="bar-wrap"><div class="mid"></div><div class="fill" id="bar-i"></div></div><div class="lbl">I</div></div>
      </div>
    `;
    container.appendChild(panel);
    this.addInfo(panel.querySelector('.panel-head')!, RCI_INFO);
    this.barR = panel.querySelector('#bar-r')!;
    this.barC = panel.querySelector('#bar-c')!;
    this.barI = panel.querySelector('#bar-i')!;
  }

  private buildUtilities(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-head"><span style="opacity:0.85">Servicios básicos</span></div>
      <div class="util-row"><span>⚡ Energía</span><span class="util-val" id="util-power">—</span></div>
      <div class="util-row"><span>💧 Agua</span><span class="util-val" id="util-water">—</span></div>
      <div class="util-row"><span>🔥 Gas</span><span class="util-val" id="util-gas">—</span></div>
    `;
    container.appendChild(panel);
    this.addInfo(panel.querySelector('.panel-head')!, UTIL_INFO);
    this.powerEl = panel.querySelector('#util-power')!;
    this.waterEl = panel.querySelector('#util-water')!;
    this.gasEl = panel.querySelector('#util-gas')!;
  }

  private buildCoverage(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-head"><span style="opacity:0.85">Servicios (por población)</span></div>
      <div class="util-row"><span>🛡️ Seguridad</span><span class="util-val" id="cov-sec">—</span></div>
      <div class="util-row"><span>🏥 Salud</span><span class="util-val" id="cov-health">—</span></div>
      <div class="util-row"><span>🎓 Educación</span><span class="util-val" id="cov-edu">—</span></div>
      <div class="util-row"><span>🍽️ Comida</span><span class="util-val" id="cov-food">—</span></div>
    `;
    container.appendChild(panel);
    this.addInfo(
      panel.querySelector('.panel-head')!,
      'Servicios por población: cada categoría suma la capacidad de sus edificios y la compara con ' +
        'los habitantes. 100% = alcanza para toda la ciudad. La seguridad habilita que las zonas suban de nivel; ' +
        'salud, educación y comida aceleran el crecimiento. Construí más a medida que sube la población.',
    );
    this.covSecEl = panel.querySelector('#cov-sec')!;
    this.covHealthEl = panel.querySelector('#cov-health')!;
    this.covEduEl = panel.querySelector('#cov-edu')!;
    this.covFoodEl = panel.querySelector('#cov-food')!;
  }

  private buildMaterials(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-head"><span style="opacity:0.85">📦 Materiales</span></div>
      ${MATERIALS.map(
        (m) =>
          `<div class="util-row"><span>${MATERIAL_ICON[m]} ${MATERIAL_LABEL[m]}</span><span class="util-val" id="mat-${m}">—</span></div>`,
      ).join('')}
      <div class="util-row" style="opacity:0.7; font-size:11px; border-top:1px solid rgba(255,255,255,0.12); margin-top:3px; padding-top:4px;">
        <span>🏬 Almacén</span><span class="util-val" id="mat-cap">—</span>
      </div>
    `;
    container.appendChild(panel);
    this.addInfo(panel.querySelector('.panel-head')!, MAT_INFO);
    this.matEls = {} as Record<Material, HTMLElement>;
    for (const m of MATERIALS) this.matEls[m] = panel.querySelector(`#mat-${m}`)!;
    this.matCapEl = panel.querySelector('#mat-cap')!;
  }

  private buildMissions(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-head"><span style="opacity:0.85">🎯 Misiones</span></div>
      <div class="tech-count" id="mission-count">—</div>
      <div id="mission-list"></div>
    `;
    container.appendChild(panel);
    this.addInfo(panel.querySelector('.panel-head')!, MISSION_INFO);
    this.missionCountEl = panel.querySelector('#mission-count')!;
    this.missionListEl = panel.querySelector('#mission-list')!;
  }

  private buildTech(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-head"><span style="opacity:0.85">🔬 Tecnología</span></div>
      <div class="util-row"><span>🔬 Ciencia</span><span class="util-val" id="hud-science">—</span></div>
      <div class="util-row"><span>🗝️ Territorio</span><span class="util-val" id="hud-territory">—</span></div>
      <div class="tech-count" id="tech-count">—</div>
      <div class="tech-next" id="tech-next"></div>
      <div class="tech-bar" id="tech-bar"><div class="tech-fill" id="tech-fill"></div></div>
    `;
    container.appendChild(panel);
    this.addInfo(panel.querySelector('.panel-head')!, TECH_INFO);
    this.scienceEl = panel.querySelector('#hud-science')!;
    this.territoryEl = panel.querySelector('#hud-territory')!;
    this.techCountEl = panel.querySelector('#tech-count')!;
    this.techNextEl = panel.querySelector('#tech-next')!;
    this.techBarWrap = panel.querySelector('#tech-bar')!;
    this.techFill = panel.querySelector('#tech-fill')!;
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

    const actions = document.createElement('div');
    actions.className = 'panel controls';
    const startAllBtn = document.createElement('button');
    startAllBtn.className = 'ctrl';
    startAllBtn.style.flex = '1';
    startAllBtn.textContent = '▶️ Iniciar obras';
    startAllBtn.title = 'Arranca todas las obras pendientes que puedas pagar';
    startAllBtn.addEventListener('click', () => this.callbacks.onStartAll());
    actions.appendChild(startAllBtn);
    container.appendChild(actions);
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

  /** Crea un botón ⓘ que muestra `text` al pasar el mouse (o al hacer click). */
  private addInfo(host: HTMLElement, text: string): void {
    const btn = document.createElement('button');
    btn.className = 'hud-info';
    btn.textContent = 'ⓘ';
    btn.addEventListener('mouseenter', () => this.showTip(text, btn));
    btn.addEventListener('click', () => this.showTip(text, btn));
    btn.addEventListener('mouseleave', () => this.hideTip());
    host.appendChild(btn);
  }

  private showTip(text: string, near: HTMLElement): void {
    this.tooltip.textContent = text;
    this.tooltip.style.display = 'block';
    const r = near.getBoundingClientRect();
    // El HUD está a la derecha: mostramos el tooltip hacia la izquierda.
    this.tooltip.style.left = 'auto';
    this.tooltip.style.right = `${window.innerWidth - r.left + 8}px`;
    this.tooltip.style.top = `${r.top}px`;
  }

  private hideTip(): void {
    this.tooltip.style.display = 'none';
  }

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
    this.unempEl.style.color = stats.adults === 0 ? '#fff' : unempPct > 25 ? '#ff6b6b' : '#7CFC9A';

    this.setBar(this.barR, stats.demand.residential, '#4caf50');
    this.setBar(this.barC, stats.demand.commercial, '#2196f3');
    this.setBar(this.barI, stats.demand.industrial, '#ffc107');

    this.setUtility(this.powerEl, stats.utilities.power);
    this.setUtility(this.waterEl, stats.utilities.water);
    this.setUtility(this.gasEl, stats.utilities.gas);

    this.setCoverage(this.covSecEl, stats.coverage.security);
    this.setCoverage(this.covHealthEl, stats.coverage.health);
    this.setCoverage(this.covEduEl, stats.coverage.education);
    this.setCoverage(this.covFoodEl, stats.coverage.food);

    for (const m of MATERIALS) {
      const total = Math.round(stats.materials.totals[m]);
      const p = Math.round(stats.materials.produced[m]);
      const c = Math.round(stats.materials.consumed[m]);
      let flow = '';
      if (p > 0 || c > 0) {
        const net = p - c;
        const col = net > 0 ? '#7CFC9A' : net < 0 ? '#ff6b6b' : '#bbb';
        // Ritmo del mes: lo que se produjo y lo que se consumió (insumos + ventas).
        flow = ` <span style="font-size:10px; color:${col}">(+${p} −${c})</span>`;
      }
      this.matEls[m].innerHTML = `${total.toLocaleString('es')}${flow}`;
    }
    const n = stats.materials.corralones;
    this.matCapEl.textContent = n > 0 ? `${n} corralón${n > 1 ? 'es' : ''} · ${CORRALON_CAP} c/u` : 'sin corralón (solo reserva)';

    const sc = stats.science;
    this.scienceEl.innerHTML =
      sc.rate > 0
        ? `${sc.total.toLocaleString('es')} <span style="font-size:10px; color:#26c6da">(+${sc.rate}/mes)</span>`
        : sc.total.toLocaleString('es');

    const terr = stats.territory;
    this.territoryEl.innerHTML = `${terr.unlocked}/${terr.total} <span style="font-size:10px; color:#ffd54f">${terr.tokens} 🗝️</span>`;
    const sr = terr.sources;
    this.territoryEl.title =
      `Fichas 🗝️ para expandir territorio\n` +
      `Disponibles: ${terr.tokens} · próxima parcela: ${terr.nextCost}\n` +
      `Ganadas: ${sr.tech} hitos tecnológicos + ${sr.disasters} catástrofes + ${sr.population} hitos de población + ${sr.missions} misiones`;
  }

  /** Actualiza el panel de misiones: cumplidas + las próximas 3 con progreso. */
  setMissions(missions: MissionStatus[]): void {
    const done = missions.filter((m) => m.done).length;
    const active = missions.filter((m) => !m.done).slice(0, 3);
    const sig = `${done}|${active.map((m) => `${m.def.id}:${Math.round(m.progress * 100)}`).join(',')}`;
    if (sig === this.missionSig) return;
    this.missionSig = sig;

    this.missionCountEl.textContent = `Cumplidas: ${done} / ${missions.length}`;
    if (!active.length) {
      this.missionListEl.innerHTML = '<b style="color:#7CFC9A">✓ ¡Todas cumplidas!</b>';
      return;
    }
    this.missionListEl.innerHTML = active
      .map((m) => {
        const r = m.def.reward;
        const reward = [r.money ? `$${r.money.toLocaleString('es')}` : '', r.tokens ? `${r.tokens} 🗝️` : '']
          .filter(Boolean)
          .join(' + ');
        return (
          `<div class="tech-next" style="margin-bottom:2px">${m.def.icon} <b>${m.def.name}</b> ` +
          `<span style="opacity:.7; font-size:11px">(${reward})</span><br>` +
          `<span style="opacity:.75; font-size:11px">${m.def.desc}</span></div>` +
          `<div class="tech-bar" style="margin-bottom:6px"><div class="tech-fill" style="width:${Math.round(m.progress * 100)}%"></div></div>`
        );
      })
      .join('');
  }

  /** Actualiza el panel de tecnología: hitos logrados y el próximo desbloqueo. */
  setTech(status: TechStatus): void {
    this.techCountEl.textContent = `Desbloqueos: ${status.unlocked} / ${status.total}`;
    const n = status.next;
    if (!n) {
      this.techNextEl.innerHTML = '<b style="color:#7CFC9A">✓ Todo desbloqueado</b>';
      this.techBarWrap.style.display = 'none';
      return;
    }
    this.techBarWrap.style.display = '';
    const fmt = (v: number) => (n.isMoney ? `$${v.toLocaleString('es')}` : v.toLocaleString('es'));
    this.techNextEl.innerHTML =
      `Próximo: ${n.icon} <b>${n.name}</b><br>` +
      `<span style="opacity:.75">${n.metricLabel}: ${fmt(n.current)} / ${fmt(n.target)}</span>`;
    this.techFill.style.width = `${Math.round(n.progress * 100)}%`;
  }

  /** Muestra producción/consumo de un servicio básico, en verde si alcanza. */
  private setUtility(el: HTMLElement, u: { supply: number; demand: number }): void {
    el.textContent = `${u.supply} / ${u.demand}`;
    const ok = u.supply >= Math.max(1, u.demand);
    el.style.color = ok ? '#7CFC9A' : '#ff6b6b';
  }

  /** Muestra el % de cobertura por población, en verde si llega al 100%. */
  private setCoverage(el: HTMLElement, ratio: number): void {
    const pct = Math.round(ratio * 100);
    el.textContent = `${pct}%`;
    el.style.color = pct >= 100 ? '#7CFC9A' : pct >= 50 ? '#ffd54f' : '#ff6b6b';
  }

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
