import { TileInfo } from '../sim/Simulation';
import {
  TileType,
  TILE_DEF,
  isZone,
  MAX_LEVEL,
  ROAD_MAX_LEVEL,
  ROAD_LEVEL_NAME,
} from '../sim/types';

const NAME: Record<TileType, string> = {
  [TileType.Empty]: 'Terreno vacío',
  [TileType.Road]: 'Carretera',
  [TileType.Residential]: 'Residencial 🏠',
  [TileType.Commercial]: 'Comercial 🏢',
  [TileType.Industrial]: 'Industrial 🏭',
  [TileType.FactorySmall]: 'Fábrica chica 🏭',
  [TileType.FactoryMedium]: 'Fábrica mediana 🏭',
  [TileType.FactoryLarge]: 'Fábrica grande 🏭',
  [TileType.Park]: 'Parque 🌳',
  [TileType.Plaza]: 'Plaza ⛲',
  [TileType.Stadium]: 'Estadio 🏟️',
  [TileType.Museum]: 'Museo 🖼️',
  [TileType.Police]: 'Policía 🚓',
  [TileType.Fire]: 'Bomberos 🚒',
  [TileType.Government]: 'Gobierno 🏛️',
  [TileType.PowerPlant]: 'Central eléctrica ⚡',
  [TileType.WaterTower]: 'Torre de agua 💧',
  [TileType.GasPlant]: 'Planta de gas 🔥',
};

export interface InspectorCallbacks {
  onUpgrade: () => void;
  onDemolish: () => void;
  onClose: () => void;
}

/**
 * Panel que aparece al seleccionar una casilla (herramienta 🔍). Muestra su
 * información y deja actuar sobre ella (mejorar / demoler).
 */
export class Inspector {
  private root: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private upgradeBtn: HTMLButtonElement;
  private demolishBtn: HTMLButtonElement;

  constructor(container: HTMLElement, callbacks: InspectorCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'panel inspector';
    this.root.style.display = 'none';
    this.root.innerHTML = `
      <div class="insp-head">
        <span class="insp-title"></span>
        <button class="insp-close" title="Cerrar">✕</button>
      </div>
      <div class="insp-body"></div>
      <div class="insp-actions">
        <button class="ctrl insp-upgrade"></button>
        <button class="ctrl insp-demolish">🧨 Demoler</button>
      </div>
    `;
    container.appendChild(this.root);

    this.titleEl = this.root.querySelector('.insp-title')!;
    this.bodyEl = this.root.querySelector('.insp-body')!;
    this.upgradeBtn = this.root.querySelector('.insp-upgrade')!;
    this.demolishBtn = this.root.querySelector('.insp-demolish')!;

    this.root.querySelector('.insp-close')!.addEventListener('click', () => callbacks.onClose());
    this.upgradeBtn.addEventListener('click', () => callbacks.onUpgrade());
    this.demolishBtn.addEventListener('click', () => callbacks.onDemolish());
  }

  show(): void {
    this.root.style.display = '';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  update(info: TileInfo, money: number): void {
    this.titleEl.textContent = NAME[info.type];
    const def = TILE_DEF[info.type];
    const lines: string[] = [];

    if (info.type === TileType.Empty) {
      lines.push('Terreno libre. Construí algo aquí.');
    } else if (info.type === TileType.Road) {
      lines.push(`Tipo: ${ROAD_LEVEL_NAME[info.level]}`);
      lines.push(`Tráfico: ${Math.round(info.traffic)} / ${info.roadCapacity}`);
      const pct = Math.round(info.congestion * 100);
      const col = pct >= 100 ? '#ff6b6b' : pct >= 70 ? '#ffb74d' : '#7CFC9A';
      lines.push(`Congestión: <b style="color:${col}">${pct}%</b>`);
      if (info.roadSegmentSize > 1) lines.push(`Tramo conectado: ${info.roadSegmentSize} casillas`);
    } else if (def.service) {
      lines.push('Brinda cobertura de servicios. 🛡️');
      const over = info.serviceServed > info.serviceCapacity;
      const col = over ? '#ff6b6b' : '#7CFC9A';
      lines.push(`Atiende: <b style="color:${col}">${info.serviceServed} / ${info.serviceCapacity}</b> hab.`);
      lines.push(
        over
          ? '<i style="opacity:.8">⚠️ Saturada: construí otra cerca</i>'
          : 'Las zonas cercanas pueden crecer más alto.',
      );
    } else if (def.produces) {
      const KIND: Record<string, string> = { power: 'energía ⚡', water: 'agua 💧', gas: 'gas 🔥' };
      lines.push(`Produce <b>${def.produces.amount}</b> de ${KIND[def.produces.kind]} para toda la ciudad.`);
      lines.push('Las zonas la necesitan para crecer a niveles altos.');
    } else if (def.amenity) {
      lines.push('Sube el valor del suelo de las zonas cercanas. ✨');
    } else if (def.jobs) {
      lines.push('Fábrica (empleos industriales). 🏭');
      lines.push(`Empleos: ${def.jobs}`);
    } else {
      const capLabel = info.type === TileType.Residential ? 'Habitantes' : 'Empleos';
      lines.push(`Nivel: ${info.level} / ${MAX_LEVEL}`);
      lines.push(`${capLabel}: ${info.capacity}`);
      lines.push(`Acceso a calle: ${info.hasRoad ? 'Sí ✅' : 'No ⚠️'}`);
      if (!info.cityHasPower) {
        lines.push('<i style="opacity:.8">⚡ La ciudad necesita más energía para pasar de nivel 1</i>');
      } else if (info.maxLevel < MAX_LEVEL) {
        lines.push(`Máx. actual: nivel ${info.maxLevel}`);
        const faltan = [
          info.maxLevel < 2 ? 'servicios (policía/etc.)' : '',
          !info.cityHasWater ? 'agua' : '',
          !info.cityHasGas ? 'gas' : '',
        ].filter(Boolean);
        if (faltan.length) lines.push(`<i style="opacity:.8">Para crecer más: ${faltan.join(', ')}</i>`);
      }
      if (info.value > 0.001) lines.push(`Valor del suelo: +${info.value.toFixed(2)}`);
    }
    if (info.size > 1 && info.type !== TileType.Empty) {
      lines.push(`Ocupa ${info.size}×${info.size} casillas`);
    }
    this.bodyEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');

    this.updateUpgradeButton(info, money);
    this.demolishBtn.style.display = info.type === TileType.Empty ? 'none' : '';
  }

  private updateUpgradeButton(info: TileInfo, money: number): void {
    const isRoad = info.type === TileType.Road;
    if (!isRoad && !isZone(info.type)) {
      this.upgradeBtn.style.display = 'none';
      return;
    }
    this.upgradeBtn.style.display = '';
    const affordable = money >= info.upgradeCost;

    if (isRoad) {
      if (info.level >= ROAD_MAX_LEVEL) {
        this.upgradeBtn.textContent = '⬆️ Nivel máximo';
        this.upgradeBtn.disabled = true;
        this.upgradeBtn.title = '';
      } else {
        this.upgradeBtn.textContent = `⬆️ Tramo → ${ROAD_LEVEL_NAME[info.level + 1]} ($${info.upgradeCost})`;
        this.upgradeBtn.disabled = !affordable;
        this.upgradeBtn.title = affordable ? 'Mejora todo el tramo conectado de una' : 'Dinero insuficiente';
      }
      return;
    }

    // Zona R/C/I.
    if (info.level >= MAX_LEVEL) {
      this.upgradeBtn.textContent = '⬆️ Nivel máximo';
      this.upgradeBtn.disabled = true;
      this.upgradeBtn.title = '';
    } else {
      this.upgradeBtn.textContent = `⬆️ Mejorar ($${info.upgradeCost})`;
      this.upgradeBtn.disabled = !(info.canUpgrade && affordable);
      this.upgradeBtn.title = !info.hasRoad
        ? 'Necesita una carretera al lado'
        : info.level + 1 > info.maxLevel
          ? 'Necesita servicios cerca'
          : !affordable
            ? 'Dinero insuficiente'
            : '';
    }
  }
}
