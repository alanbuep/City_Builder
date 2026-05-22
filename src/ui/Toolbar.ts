import { TileType, TILE_DEF } from '../sim/types';

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
    label: '🌳 Amenidades',
    tools: [
      { tool: TileType.Park, label: '🌳 Parque', desc: 'Sube el valor del suelo en un radio chico → las zonas cercanas crecen más rápido.' },
      { tool: TileType.Plaza, label: '⛲ Plaza', desc: 'Amenidad chica y barata; aporta algo de valor del suelo cerca.' },
      { tool: TileType.Stadium, label: '🏟️ Estadio', desc: 'Edificio 2×2. Gran atractivo: mucho valor del suelo en un radio amplio.' },
      { tool: TileType.Museum, label: '🖼️ Museo', desc: 'Cultura: sube el valor del suelo en un buen radio.' },
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

  private openCat(i: number): void {
    this.openCategory = i;
    this.catButtons.forEach((b, j) => b.classList.toggle('active', j === i));
    this.renderTools();
  }

  private renderTools(): void {
    this.listEl.innerHTML = '';
    for (const entry of CATEGORIES[this.openCategory].tools) {
      const cost = this.costOf(entry.tool);

      const row = document.createElement('div');
      row.className = 'tool-row';

      const btn = document.createElement('button');
      btn.className = 'tool';
      if (entry.tool === this.current) btn.classList.add('active');
      btn.innerHTML = `<span>${entry.label}</span>${cost > 0 ? `<span class="tool-cost">$${cost}</span>` : ''}`;
      btn.addEventListener('click', () => this.select(entry.tool));

      const info = document.createElement('button');
      info.className = 'tool-info';
      info.textContent = 'ⓘ';
      const tip = entry.desc + (cost > 0 ? ` (Costo: $${cost})` : '');
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
