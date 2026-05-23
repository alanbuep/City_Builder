import { TileType, TILE_DEF } from '../sim/types';
import { TECH_BY_TYPE, METRIC_LABEL } from '../sim/Tech';

/** Una herramienta: colocar un tipo de casilla, o "seleccionar". */
export type Tool = TileType | 'select';

interface ToolEntry {
  tool: Tool;
  label: string;
  desc: string;
}

interface Category {
  label: string;
  tools: ToolEntry[];
}

// Menú agrupado por categorías. La industria tiene su propio grupo desplegable.
const CATEGORIES: Category[] = [
  {
    label: '🔧 Básico',
    tools: [
      { tool: 'select', label: '🔍 Seleccionar', desc: 'Elegí una casilla para ver su info, mejorarla o demolerla.' },
      { tool: TileType.Road, label: '🛣️ Carretera', desc: 'Las zonas necesitan una calle al lado para crecer. Se mejora a avenida/autopista (sube todo el tramo recto de una).' },
      { tool: TileType.Empty, label: '🧨 Demoler', desc: 'Borra lo que haya en la casilla. Es gratis.' },
    ],
  },
  {
    label: '🏙️ Zonas',
    tools: [
      { tool: TileType.Residential, label: '🏠 Residencial', desc: 'Donde vive la gente. Crece con la demanda (barra R) y los servicios cercanos.' },
      { tool: TileType.Commercial, label: '🏢 Comercial', desc: 'Tiendas y oficinas. Dan empleo y atienden a la población (barra C).' },
    ],
  },
  {
    label: '🏭 Industria',
    tools: [
      { tool: TileType.Industrial, label: '🏭 Industrial (zona)', desc: 'Da empleos (barra I). Si un bloque 2×2 llega al máximo con calle, se fusiona solo en una fábrica mediana.' },
      { tool: TileType.FactorySmall, label: '🏭 Fábrica chica', desc: 'Fábrica 1×1. Da 20 empleos al instante, sin esperar a que crezca.' },
      { tool: TileType.FactoryMedium, label: '🏭 Fábrica mediana', desc: 'Fábrica 2×2. Da 90 empleos. Es en lo que se fusionan las zonas industriales.' },
      { tool: TileType.FactoryLarge, label: '🏭 Fábrica grande', desc: 'Fábrica 3×3. Da 220 empleos. El motor de una gran ciudad industrial.' },
      { tool: TileType.TechPark, label: '🔬 Parque tecnológico', desc: 'Edificio 2×2. Empleo industrial limpio (150) y agradable: sube el valor del suelo cercano.' },
    ],
  },
  {
    label: '🛒 Comercio',
    tools: [
      { tool: TileType.ShoppingMall, label: '🛒 Centro comercial', desc: 'Edificio 2×2. Muchos empleos comerciales (70) y atrae gente (sube el valor del suelo).' },
      { tool: TileType.Hotel, label: '🏨 Hotel', desc: 'Edificio 2×2. Turismo: sube mucho el valor del suelo alrededor + 50 empleos comerciales.' },
      { tool: TileType.OfficeTower, label: '🏦 Torre de oficinas', desc: 'Altísima densidad de empleo comercial (100) en una sola casilla.' },
      { tool: TileType.Airport, label: '✈️ Aeropuerto', desc: 'Edificio 3×3. Turismo: 80 empleos comerciales, gran valor del suelo y renta fija ($60/mes).' },
    ],
  },
  {
    label: '🏪 Negocios',
    tools: [
      { tool: TileType.Kiosk, label: '🏪 Kiosco', desc: 'Comercio chico y barato (6 empleos). Ideal para huecos chicos y el arranque.' },
      { tool: TileType.Boutique, label: '👗 Boutique', desc: 'Tienda de ropa: 18 empleos y sube un poco el valor del suelo.' },
      { tool: TileType.Pharmacy, label: '💊 Farmacia', desc: 'Comercio (12 empleos) que además da algo de cobertura de salud cercana.' },
      { tool: TileType.GasStation, label: '⛽ Estación de servicio', desc: '12 empleos + renta fija ($20/mes) por venta de combustible.' },
      { tool: TileType.Bank, label: '💰 Banco', desc: '30 empleos + renta fija ($30/mes). El negocio financiero de la ciudad.' },
      { tool: TileType.Dealership, label: '🚗 Concesionaria', desc: 'Edificio 2×2. Mucho empleo comercial (50) y algo de valor del suelo.' },
    ],
  },
  {
    label: '🧱 Materiales',
    tools: [
      { tool: TileType.SandPit, label: '⏳ Arenera', desc: 'Produce 8 de arena por mes (necesita energía y un corralón conectado por calle).' },
      { tool: TileType.CementPlant, label: '🪨 Cementera', desc: 'Convierte 6 arena → 4 cemento por mes. Necesita energía + corralón conectado.' },
      { tool: TileType.BrickKiln, label: '🧱 Ladrillería', desc: 'Convierte 6 arena → 5 ladrillo por mes. Necesita energía + corralón conectado.' },
      { tool: TileType.BuildYard, label: '🏬 Corralón', desc: 'Edificio 2×2. Almacena materiales y los distribuye por su red de calles. Hace falta para construir lo avanzado.' },
      { tool: TileType.Hardware, label: '🔧 Ferretería', desc: 'Vende materiales del corralón conectado a la población → renta + empleos. Compite con la construcción por el stock.' },
      { tool: TileType.ExportTerminal, label: '🚢 Terminal de exportación', desc: 'Edificio 2×2. Exporta el excedente de materiales (sobre un stock mínimo que configurás) → renta.' },
      { tool: TileType.TechCompany, label: '🔬 Empresa tecnológica', desc: 'Edificio 2×2. Requiere un corralón conectado con 40 ladrillo + 30 cemento. 200 empleos de alto valor.' },
    ],
  },
  {
    label: '🚓 Servicios',
    tools: [
      { tool: TileType.Police, label: '🚓 Policía', desc: 'Cobertura de servicios (radio 5) para que las zonas crezcan a niveles altos. Atiende ~250 habitantes.' },
      { tool: TileType.Fire, label: '🚒 Bomberos', desc: 'Cobertura de servicios (radio 5). Atiende ~250 habitantes.' },
      { tool: TileType.Government, label: '🏛️ Gobierno', desc: 'Edificio 2×2. Gran cobertura de servicios (radio 7). Atiende ~600 habitantes.' },
    ],
  },
  {
    label: '⚡ Básicos',
    tools: [
      { tool: TileType.PowerPlant, label: '⚡ Central eléctrica', desc: 'Edificio 2×2. Produce 400 de energía para toda la ciudad. Sin energía suficiente, las zonas no pasan de nivel 1.' },
      { tool: TileType.WaterTower, label: '💧 Torre de agua', desc: 'Produce 350 de agua. Junto al gas, hace falta para que las zonas lleguen al nivel máximo.' },
      { tool: TileType.GasPlant, label: '🔥 Planta de gas', desc: 'Produce 320 de gas. Junto al agua, hace falta para el nivel máximo de las zonas.' },
    ],
  },
  {
    label: '🎓 Bienestar',
    tools: [
      { tool: TileType.School, label: '🏫 Escuela', desc: 'Cobertura educativa (radio 5). Las zonas con buena educación crecen más rápido. Atiende ~300 hab.' },
      { tool: TileType.University, label: '🎓 Universidad', desc: 'Edificio 2×2. Gran cobertura educativa (radio 7). Atiende ~800 hab.' },
      { tool: TileType.Clinic, label: '⛑️ Clínica', desc: 'Cobertura de salud (radio 5). Atiende ~300 hab.' },
      { tool: TileType.Hospital, label: '🏥 Hospital', desc: 'Edificio 2×2. Gran cobertura de salud (radio 7). Atiende ~800 hab.' },
      { tool: TileType.Library, label: '📚 Biblioteca', desc: 'Cobertura educativa (radio 6). Alternativa cultural a la escuela. Atiende ~500 hab.' },
    ],
  },
  {
    label: '🎡 Ocio',
    tools: [
      { tool: TileType.Cinema, label: '🎬 Cine', desc: 'Empleos comerciales (25) + valor del suelo cercano.' },
      { tool: TileType.AmusementPark, label: '🎡 Parque de diversiones', desc: 'Edificio 2×2. Gran atractivo (radio 6) + 40 empleos comerciales.' },
      { tool: TileType.Casino, label: '🎰 Casino', desc: 'Edificio 2×2. 60 empleos comerciales, sube el valor del suelo y genera renta fija ($40/mes).' },
    ],
  },
  {
    label: '🍽️ Comida',
    tools: [
      { tool: TileType.Cafe, label: '☕ Café', desc: 'Cobertura de comida chica + 8 empleos. La población necesita comida cerca para crecer mejor.' },
      { tool: TileType.Diner, label: '🍔 Casa de comidas', desc: 'Comida rápida: buena cobertura de comida (radio 5) + 15 empleos.' },
      { tool: TileType.Restaurant, label: '🍽️ Restaurante', desc: 'Más empleos (25) y sube el valor del suelo, además de cobertura de comida.' },
      { tool: TileType.Market, label: '🛒 Mercado', desc: 'Edificio 2×2. Gran cobertura de comida (radio 7) + 40 empleos.' },
    ],
  },
  {
    label: '🌳 Amenidades',
    tools: [
      { tool: TileType.Park, label: '🌳 Parque', desc: 'Sube el valor del suelo en un radio chico → las zonas cercanas crecen más rápido.' },
      { tool: TileType.Plaza, label: '⛲ Plaza', desc: 'Amenidad chica y barata; aporta algo de valor del suelo cerca.' },
      { tool: TileType.Stadium, label: '🏟️ Estadio', desc: 'Edificio 2×2. Gran atractivo: mucho valor del suelo en un radio amplio.' },
      { tool: TileType.Museum, label: '🖼️ Museo', desc: 'Cultura: sube el valor del suelo en un buen radio.' },
      { tool: TileType.Church, label: '⛪ Iglesia', desc: 'Comunidad: sube el valor del suelo de las zonas cercanas.' },
      { tool: TileType.Monument, label: '🗽 Monumento', desc: 'Edificio 2×2. Hito de prestigio: muchísimo valor del suelo en un radio amplio.' },
    ],
  },
];

/**
 * Barra de herramientas agrupada por categorías. Una categoría abierta a la vez;
 * cada herramienta tiene un botón de info (ⓘ) que muestra qué es y su costo.
 */
export class Toolbar {
  current: Tool = 'select';

  private listEl: HTMLElement;
  private tooltip: HTMLElement;
  private catButtons: HTMLButtonElement[] = [];
  private openCategory = 0;
  private unlocked: Set<TileType> | null = null; // null = todo disponible (aún sin datos)
  private unlockedSig = '';

  constructor(container: HTMLElement) {
    const cats = document.createElement('div');
    cats.className = 'tool-cats';
    CATEGORIES.forEach((cat, i) => {
      const btn = document.createElement('button');
      btn.className = 'cat';
      btn.textContent = cat.label;
      btn.addEventListener('click', () => this.openCat(i));
      this.catButtons.push(btn);
      cats.appendChild(btn);
    });
    container.appendChild(cats);

    this.listEl = document.createElement('div');
    this.listEl.className = 'tool-list';
    container.appendChild(this.listEl);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tool-tip';
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip);

    this.openCat(0);
  }

  private costOf(tool: Tool): number {
    return tool === 'select' ? 0 : TILE_DEF[tool].cost;
  }

  /** Actualiza qué edificios están desbloqueados (solo re-renderiza si cambió). */
  setUnlocked(set: Set<TileType>): void {
    const sig = [...set].sort().join(',');
    if (sig === this.unlockedSig) return;
    this.unlockedSig = sig;
    this.unlocked = set;
    if (this.isLocked(this.current)) this.current = 'select'; // por las dudas
    this.renderTools();
  }

  private isLocked(tool: Tool): boolean {
    if (tool === 'select' || !this.unlocked) return false;
    return !this.unlocked.has(tool);
  }

  /** Texto del requisito de un edificio bloqueado. */
  private lockReason(tool: Tool): string {
    const tech = tool === 'select' ? undefined : TECH_BY_TYPE.get(tool);
    if (!tech) return 'Bloqueado';
    const target = tech.metric === 'money' ? `$${tech.target.toLocaleString('es')}` : `${tech.target}`;
    return `Se desbloquea con "${tech.name}" — ${METRIC_LABEL[tech.metric]} ≥ ${target}`;
  }

  private openCat(i: number): void {
    this.openCategory = i;
    this.catButtons.forEach((b, j) => b.classList.toggle('active', j === i));
    this.renderTools();
  }

  private renderTools(): void {
    this.listEl.innerHTML = '';
    for (const entry of CATEGORIES[this.openCategory].tools) {
      const cost = this.costOf(entry.tool);
      const locked = this.isLocked(entry.tool);

      const row = document.createElement('div');
      row.className = 'tool-row';

      const btn = document.createElement('button');
      btn.className = locked ? 'tool locked' : 'tool';
      if (entry.tool === this.current && !locked) btn.classList.add('active');
      const right = locked ? '🔒' : cost > 0 ? `<span class="tool-cost">$${cost}</span>` : '';
      btn.innerHTML = `<span>${entry.label}</span>${right}`;
      if (locked) btn.title = this.lockReason(entry.tool);
      else btn.addEventListener('click', () => this.select(entry.tool));

      const info = document.createElement('button');
      info.className = 'tool-info';
      info.textContent = 'ⓘ';
      let tip = entry.desc + (cost > 0 ? ` (Costo: $${cost})` : '');
      if (locked) tip += `\n🔒 ${this.lockReason(entry.tool)}`;
      info.addEventListener('mouseenter', () => this.showTip(tip, info));
      info.addEventListener('click', () => this.showTip(tip, info));
      info.addEventListener('mouseleave', () => this.hideTip());

      row.appendChild(btn);
      row.appendChild(info);
      this.listEl.appendChild(row);
    }
  }

  private select(tool: Tool): void {
    this.current = tool;
    this.renderTools();
  }

  private showTip(text: string, near: HTMLElement): void {
    this.tooltip.textContent = text;
    this.tooltip.style.display = 'block';
    const r = near.getBoundingClientRect();
    this.tooltip.style.left = `${r.right + 8}px`;
    this.tooltip.style.top = `${r.top}px`;
  }

  private hideTip(): void {
    this.tooltip.style.display = 'none';
  }
}
