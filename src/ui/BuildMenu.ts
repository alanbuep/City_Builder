import { Modal } from './Modal';
import { CATEGORIES, Tool, TOOL_LABEL, isPaintTool } from './Catalog';
import { TileType, TILE_DEF, ResidentialStyle, RES_STYLE } from '../sim/types';
import { TECH_BY_TYPE, METRIC_LABEL } from '../sim/Tech';

/**
 * El menú de construcción: UN botón (🏗️ Construir) abre una ventana centrada
 * con los RUBROS en grilla; tocar un rubro muestra sus edificios (con costo y
 * descripción) y se puede VOLVER con ←. Elegir un edificio activa esa
 * herramienta y muestra una píldora abajo ("Construyendo: …") con ✕ para
 * terminar y volver a la selección normal (tocar edificios para ver su info).
 */
export class BuildMenu {
  current: Tool = 'select';
  currentResStyle: ResidentialStyle = 'default'; // estilo elegido para pintar residencial

  private modal = new Modal('🏗️ Construir');
  private pill: HTMLElement;
  private pillLabel: HTMLElement;
  private openCategory = -1; // -1 = vista de rubros
  private unlocked: Set<TileType> | null = null; // null = todo disponible (aún sin datos)
  private unlockedSig = '';

  constructor(private onToolChange?: () => void) {
    // Píldora flotante con la herramienta activa (solo cuando no es "seleccionar").
    this.pill = document.createElement('div');
    this.pill.id = 'toolpill';
    this.pill.className = 'panel';
    this.pill.style.display = 'none';
    this.pillLabel = document.createElement('span');
    this.pill.appendChild(this.pillLabel);
    const done = document.createElement('button');
    done.className = 'ctrl';
    done.textContent = '✕ Listo';
    done.title = 'Terminar de construir (vuelve a la selección)';
    done.addEventListener('click', () => this.useSelect());
    this.pill.appendChild(done);
    document.body.appendChild(this.pill);

    // Cerrar el menú sin elegir nada = quedarse en selección general.
    this.modal.onClose = () => {
      this.openCategory = -1;
    };
  }

  /** Abre la ventana de construcción en la grilla de rubros. */
  open(): void {
    this.openCategory = -1;
    this.renderCats();
    this.modal.open();
  }

  /** Actualiza qué edificios están desbloqueados (solo re-renderiza si cambió). */
  setUnlocked(set: Set<TileType>): void {
    const sig = [...set].sort().join(',');
    if (sig === this.unlockedSig) return;
    this.unlockedSig = sig;
    this.unlocked = set;
    if (this.isLocked(this.current)) this.useSelect(); // por las dudas
    if (this.modal.isOpen && this.openCategory >= 0) this.renderTools();
  }

  /** Vuelve a la herramienta de selección 🔍 (tocar edificios = ver su info). */
  useSelect(): void {
    this.current = 'select';
    this.updatePill();
    this.onToolChange?.();
  }

  private select(tool: Tool, style?: ResidentialStyle): void {
    this.current = tool;
    if (style !== undefined) this.currentResStyle = style;
    this.modal.close();
    this.updatePill();
    this.onToolChange?.();
  }

  /** Muestra/oculta la píldora "Construyendo: …" según la herramienta activa. */
  private updatePill(): void {
    if (this.current === 'select') {
      this.pill.style.display = 'none';
      return;
    }
    const st = RES_STYLE[this.currentResStyle];
    const label =
      this.current === TileType.Residential
        ? `${st.icon} Residencial ${st.label}`
        : TOOL_LABEL.get(this.current) ?? '';
    const hint = isPaintTool(this.current) || this.current === TileType.Road ? ' — arrastrá para trazar' : '';
    this.pillLabel.innerHTML = `<span style="opacity:.75">Construyendo:</span> <b>${label}</b><span style="opacity:.6; font-size:11px">${hint}</span>`;
    this.pill.style.display = '';
  }

  private isLocked(tool: Tool): boolean {
    if (!this.unlocked || !(tool in TILE_DEF)) return false; // select y terreno nunca se bloquean
    return !this.unlocked.has(tool as TileType);
  }

  /** Texto del requisito de un edificio bloqueado. */
  private lockReason(tool: Tool): string {
    const tech = tool in TILE_DEF ? TECH_BY_TYPE.get(tool as TileType) : undefined;
    if (!tech) return 'Bloqueado';
    const target = tech.metric === 'money' ? `$${tech.target.toLocaleString('es')}` : `${tech.target}`;
    return `Se desbloquea con "${tech.name}" — ${METRIC_LABEL[tech.metric]} ≥ ${target}`;
  }

  private costOf(tool: Tool): number {
    return tool in TILE_DEF ? TILE_DEF[tool as TileType].cost : 0;
  }

  /** Vista 1: grilla de rubros (con cuántos edificios tiene disponibles cada uno). */
  private renderCats(): void {
    this.modal.setTitle('🏗️ Construir');
    this.modal.setBack(null);
    this.modal.body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'build-cats';
    CATEGORIES.forEach((cat, i) => {
      const avail = cat.tools.filter((t) => !this.isLocked(t.tool)).length;
      const btn = document.createElement('button');
      btn.className = 'build-cat';
      btn.innerHTML =
        `<span class="ico">${cat.icon}</span><span class="nm">${cat.name}</span>` +
        `<span class="ct">${avail}/${cat.tools.length}</span>`;
      btn.addEventListener('click', () => {
        this.openCategory = i;
        this.renderTools();
      });
      grid.appendChild(btn);
    });
    this.modal.body.appendChild(grid);
  }

  /** Vista 2: edificios del rubro elegido, con ← para volver a los rubros. */
  private renderTools(): void {
    const cat = CATEGORIES[this.openCategory];
    if (!cat) return;
    this.modal.setTitle(`${cat.icon} ${cat.name}`);
    this.modal.setBack(() => {
      this.openCategory = -1;
      this.renderCats();
    });
    this.modal.body.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'build-list';
    for (const entry of cat.tools) {
      const cost = this.costOf(entry.tool);
      const locked = this.isLocked(entry.tool);
      const btn = document.createElement('button');
      btn.className = locked ? 'build-item locked' : 'build-item';
      const right = locked ? '🔒' : cost > 0 ? `<span class="tool-cost">$${cost}</span>` : '<span class="tool-cost">gratis</span>';
      const desc = locked ? `🔒 ${this.lockReason(entry.tool)}` : entry.desc;
      btn.innerHTML = `<span class="row1"><span>${entry.label}</span>${right}</span><span class="desc">${desc}</span>`;
      if (!locked) btn.addEventListener('click', () => this.select(entry.tool, entry.style));
      list.appendChild(btn);
    }
    this.modal.body.appendChild(list);
  }
}
