import { TileType } from '../sim/types';

/**
 * Una herramienta es o bien "colocar un tipo de casilla", o bien la acción
 * especial "seleccionar" (elegir una casilla para inspeccionarla y actuar
 * sobre ella desde el panel).
 */
export type Tool = TileType | 'select';

interface ToolDef {
  tool: Tool;
  label: string;
}

// El orden aquí es el orden en pantalla. "Demoler" = colocar Empty.
const TOOLS: ToolDef[] = [
  { tool: 'select', label: '🔍 Seleccionar' },
  { tool: TileType.Road, label: '🛣️ Carretera' },
  { tool: TileType.Residential, label: '🏠 Residencial' },
  { tool: TileType.Commercial, label: '🏢 Comercial' },
  { tool: TileType.Industrial, label: '🏭 Industrial' },
  // Amenidades:
  { tool: TileType.Park, label: '🌳 Parque' },
  { tool: TileType.Plaza, label: '⛲ Plaza' },
  { tool: TileType.Stadium, label: '🏟️ Estadio' },
  { tool: TileType.Museum, label: '🖼️ Museo' },
  // Servicios:
  { tool: TileType.Police, label: '🚓 Policía' },
  { tool: TileType.Fire, label: '🚒 Bomberos' },
  { tool: TileType.Government, label: '🏛️ Gobierno' },
  { tool: TileType.Empty, label: '🧨 Demoler' },
];

/**
 * Barra de herramientas en HTML. Recuerda qué herramienta está activa; el
 * resto del juego solo lee `toolbar.current`.
 */
export class Toolbar {
  current: Tool = TileType.Residential;

  constructor(container: HTMLElement) {
    for (const def of TOOLS) {
      const btn = document.createElement('button');
      btn.textContent = def.label;
      btn.className = 'tool';
      if (def.tool === this.current) btn.classList.add('active');

      btn.addEventListener('click', () => {
        this.current = def.tool;
        container.querySelectorAll('.tool').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });

      container.appendChild(btn);
    }
  }
}
