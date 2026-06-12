import { CityStats } from '../sim/Simulation';
import { Material, MATERIALS, MATERIAL_ICON, MATERIAL_LABEL, CORRALON_CAP } from '../sim/types';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const START_YEAR = 2000;
const RCI_BAR_PX = 16; // alto de las mini-barras de demanda R/C/I

/**
 * Barra superior SIEMPRE visible con todos los recursos y servicios de la
 * ciudad: nivel/XP, dinero, población, demanda RCI, energía/agua/gas,
 * coberturas, materiales y ciencia. Nada queda escondido detrás de un botón;
 * en pantallas chicas la barra se desliza horizontalmente.
 */
export class TopBar {
  private levelEl!: HTMLElement;
  private levelFill!: HTMLElement;
  private dateEl!: HTMLElement;
  private moneyEl!: HTMLElement;
  private popEl!: HTMLElement;
  private jobsEl!: HTMLElement;
  private unempEl!: HTMLElement;
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
  private scienceEl!: HTMLElement;
  private territoryEl!: HTMLElement;

  constructor(container: HTMLElement) {
    container.innerHTML = `
      <div class="chip chip-level" title="Nivel de tu ciudad: ganás XP construyendo, cumpliendo misiones y desbloqueando tecnología">
        <span>⭐<b id="tb-level">—</b></span>
        <span class="chip-bar"><span id="tb-level-fill"></span></span>
      </div>
      <div class="chip" title="Dinero del tesoro">💰<b id="tb-money">—</b></div>
      <div class="chip" title="Población total">👥<b id="tb-pop">—</b></div>
      <div class="chip" title="Empleos totales de la ciudad">💼<b id="tb-jobs">—</b></div>
      <div class="chip" title="Desempleo: en rojo si supera el 25%">📉<b id="tb-unemp">—</b></div>
      <div class="chip" title="Fecha del juego">📅<b id="tb-date">—</b></div>
      <div class="chip" title="Demanda RCI: cuánto quiere crecer cada tipo de zona — Residencial (verde), Comercial (azul) e Industrial (amarillo). Barra llena = construí de eso; en rojo = sobra.">
        <span class="rci-mini">
          <span class="rci-col"><i id="tb-rci-r"></i></span>
          <span class="rci-col"><i id="tb-rci-c"></i></span>
          <span class="rci-col"><i id="tb-rci-i"></i></span>
        </span><span style="opacity:.7">RCI</span>
      </div>
      <div class="chip" title="Energía: producción / consumo. Sin energía las zonas no pasan de nivel 1.">⚡<b id="tb-power">—</b></div>
      <div class="chip" title="Agua: producción / consumo. Hace falta para el nivel máximo de las zonas.">💧<b id="tb-water">—</b></div>
      <div class="chip" title="Gas: producción / consumo. Hace falta para el nivel máximo de las zonas.">🔥<b id="tb-gas">—</b></div>
      <div class="chip" title="Seguridad (policía/bomberos/gobierno): % de la población atendida. Habilita que las zonas suban de nivel.">🛡️<b id="tb-sec">—</b></div>
      <div class="chip" title="Salud: % de la población atendida. Acelera el crecimiento.">🏥<b id="tb-health">—</b></div>
      <div class="chip" title="Educación: % de la población atendida. Acelera el crecimiento.">🎓<b id="tb-edu">—</b></div>
      <div class="chip" title="Comida: % de la población atendida. Acelera el crecimiento.">🍽️<b id="tb-food">—</b></div>
      ${MATERIALS.map((m) => `<div class="chip" id="tb-mat-${m}-chip">${MATERIAL_ICON[m]}<b id="tb-mat-${m}">—</b></div>`).join('')}
      <div class="chip" title="Ciencia acumulada: la generan laboratorios/observatorios y desbloquea lo más avanzado.">🔬<b id="tb-science">—</b></div>
      <div class="chip" title="Fichas de territorio para expandir la ciudad (se ganan con tecnología, catástrofes superadas, población y misiones).">🗝️<b id="tb-territory">—</b></div>
    `;
    const q = (id: string) => container.querySelector<HTMLElement>(`#${id}`)!;
    this.levelEl = q('tb-level');
    this.levelFill = q('tb-level-fill');
    this.moneyEl = q('tb-money');
    this.popEl = q('tb-pop');
    this.jobsEl = q('tb-jobs');
    this.unempEl = q('tb-unemp');
    this.dateEl = q('tb-date');
    this.barR = q('tb-rci-r');
    this.barC = q('tb-rci-c');
    this.barI = q('tb-rci-i');
    this.powerEl = q('tb-power');
    this.waterEl = q('tb-water');
    this.gasEl = q('tb-gas');
    this.covSecEl = q('tb-sec');
    this.covHealthEl = q('tb-health');
    this.covEduEl = q('tb-edu');
    this.covFoodEl = q('tb-food');
    this.matEls = {} as Record<Material, HTMLElement>;
    for (const m of MATERIALS) this.matEls[m] = q(`tb-mat-${m}`);
    this.scienceEl = q('tb-science');
    this.territoryEl = q('tb-territory');
  }

  update(stats: CityStats): void {
    const year = START_YEAR + Math.floor(stats.month / 12);
    this.dateEl.textContent = `${MONTHS[stats.month % 12]} ${year}`;

    this.moneyEl.textContent = `$${stats.money.toLocaleString('es')}`;
    this.moneyEl.style.color = stats.money < 0 ? '#ff6b6b' : '';

    this.popEl.textContent = stats.population.toLocaleString('es');
    this.jobsEl.textContent = stats.jobs.toLocaleString('es');

    const unempPct = Math.round(stats.unemploymentRate * 100);
    this.unempEl.textContent = `${unempPct}%`;
    this.unempEl.style.color = stats.adults === 0 ? '' : unempPct > 25 ? '#ff6b6b' : '#7CFC9A';

    this.setRci(this.barR, stats.demand.residential, '#4caf50');
    this.setRci(this.barC, stats.demand.commercial, '#2196f3');
    this.setRci(this.barI, stats.demand.industrial, '#ffc107');

    this.setUtility(this.powerEl, stats.utilities.power);
    this.setUtility(this.waterEl, stats.utilities.water);
    this.setUtility(this.gasEl, stats.utilities.gas);

    this.setCoverage(this.covSecEl, stats.coverage.security);
    this.setCoverage(this.covHealthEl, stats.coverage.health);
    this.setCoverage(this.covEduEl, stats.coverage.education);
    this.setCoverage(this.covFoodEl, stats.coverage.food);

    const n = stats.materials.corralones;
    for (const m of MATERIALS) {
      const total = Math.round(stats.materials.totals[m]);
      const p = Math.round(stats.materials.produced[m]);
      const c = Math.round(stats.materials.consumed[m]);
      const el = this.matEls[m];
      el.textContent = total.toLocaleString('es');
      el.style.color = p - c < 0 ? '#ffb74d' : '';
      el.parentElement!.title =
        `${MATERIAL_LABEL[m]}: ${total} en total` +
        (p > 0 || c > 0 ? ` (este mes: +${p} producido, −${c} consumido)` : '') +
        `\nAlmacén: ${n > 0 ? `${n} corralón${n > 1 ? 'es' : ''} de ${CORRALON_CAP} c/u` : 'sin corralón (solo reserva)'}`;
    }

    const sc = stats.science;
    this.scienceEl.textContent = sc.rate > 0 ? `${sc.total.toLocaleString('es')} (+${sc.rate})` : sc.total.toLocaleString('es');

    const terr = stats.territory;
    this.territoryEl.textContent = `${terr.tokens}`;
    const sr = terr.sources;
    this.territoryEl.parentElement!.title =
      `Fichas 🗝️ para expandir territorio\n` +
      `Disponibles: ${terr.tokens} · parcelas: ${terr.unlocked}/${terr.total} · próxima cuesta: ${terr.nextCost}\n` +
      `Ganadas: ${sr.tech} hitos tecnológicos + ${sr.disasters} catástrofes + ${sr.population} hitos de población + ${sr.missions} misiones`;
  }

  /** Actualiza el nivel de ciudad (⭐) y su barrita de XP. */
  setLevel(s: { level: number; xp: number; from: number; to: number; progress: number }): void {
    this.levelEl.textContent = `${s.level}`;
    this.levelFill.style.width = `${Math.round(s.progress * 100)}%`;
    this.levelEl.parentElement!.parentElement!.title =
      s.to > s.from ? `Nivel ${s.level} — XP: ${s.xp} / ${s.to} para el nivel ${s.level + 1}` : `Nivel ${s.level} — XP: ${s.xp} (máximo)`;
  }

  private setRci(fill: HTMLElement, demand: number, color: string): void {
    const px = Math.max(1, Math.round(Math.abs(demand) * RCI_BAR_PX));
    fill.style.height = `${px}px`;
    fill.style.background = demand >= 0 ? color : '#e53935';
  }

  private setUtility(el: HTMLElement, u: { supply: number; demand: number }): void {
    el.textContent = `${u.supply}/${u.demand}`;
    el.style.color = u.supply >= Math.max(1, u.demand) ? '#7CFC9A' : '#ff6b6b';
  }

  private setCoverage(el: HTMLElement, ratio: number): void {
    const pct = Math.round(ratio * 100);
    el.textContent = `${pct}%`;
    el.style.color = pct >= 100 ? '#7CFC9A' : pct >= 50 ? '#ffd54f' : '#ff6b6b';
  }
}
