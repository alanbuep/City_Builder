import { TileInfo } from '../sim/Simulation';
import {
  TileType,
  TILE_DEF,
  isZone,
  MAX_LEVEL,
  ROAD_MAX_LEVEL,
  ROAD_LEVEL_NAME,
  MATERIALS,
  MATERIAL_ICON,
  MaterialBag,
} from '../sim/types';

/** "40 🧱 + 30 🪨" a partir de una receta de materiales. */
function formatBag(bag: MaterialBag): string {
  return MATERIALS.filter((m) => (bag[m] ?? 0) > 0)
    .map((m) => `${bag[m]} ${MATERIAL_ICON[m]}`)
    .join(' + ');
}

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
  [TileType.ShoppingMall]: 'Centro comercial 🛒',
  [TileType.Hotel]: 'Hotel 🏨',
  [TileType.OfficeTower]: 'Torre de oficinas 🏦',
  [TileType.TechPark]: 'Parque tecnológico 🔬',
  [TileType.SandPit]: 'Arenera ⏳',
  [TileType.CementPlant]: 'Cementera 🪨',
  [TileType.BrickKiln]: 'Ladrillería 🧱',
  [TileType.BuildYard]: 'Corralón 🏬',
  [TileType.TechCompany]: 'Empresa tecnológica 🔬',
  [TileType.School]: 'Escuela 🏫',
  [TileType.University]: 'Universidad 🎓',
  [TileType.Hospital]: 'Hospital 🏥',
  [TileType.Clinic]: 'Clínica ⛑️',
  [TileType.Casino]: 'Casino 🎰',
  [TileType.Cinema]: 'Cine 🎬',
  [TileType.AmusementPark]: 'Parque de diversiones 🎡',
  [TileType.Church]: 'Iglesia ⛪',
  [TileType.Library]: 'Biblioteca 📚',
  [TileType.Monument]: 'Monumento 🗽',
  [TileType.Airport]: 'Aeropuerto ✈️',
  [TileType.Hardware]: 'Ferretería 🔧',
  [TileType.ExportTerminal]: 'Terminal de exportación 🚢',
  [TileType.Construction]: 'Obra 🚧',
};

export interface InspectorCallbacks {
  onUpgrade: () => void;
  onDemolish: () => void;
  onStart: () => void; // dar el OK a una obra
  onExportKeep: (delta: number) => void; // ajustar el stock mínimo de exportación
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
  private startBtn: HTMLButtonElement;
  private upgradeBtn: HTMLButtonElement;
  private demolishBtn: HTMLButtonElement;
  private exMinusBtn: HTMLButtonElement;
  private exPlusBtn: HTMLButtonElement;
  private roadStretch?: { cells: number; cost: number }; // tramo de carretera elegido a mano

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
        <button class="ctrl insp-exminus" title="Conservar menos (exportar más)">➖</button>
        <button class="ctrl insp-explus" title="Conservar más (exportar menos)">➕</button>
        <button class="ctrl insp-start"></button>
        <button class="ctrl insp-upgrade"></button>
        <button class="ctrl insp-demolish">🧨 Demoler</button>
      </div>
    `;
    container.appendChild(this.root);

    this.titleEl = this.root.querySelector('.insp-title')!;
    this.bodyEl = this.root.querySelector('.insp-body')!;
    this.startBtn = this.root.querySelector('.insp-start')!;
    this.upgradeBtn = this.root.querySelector('.insp-upgrade')!;
    this.demolishBtn = this.root.querySelector('.insp-demolish')!;
    this.exMinusBtn = this.root.querySelector('.insp-exminus')!;
    this.exPlusBtn = this.root.querySelector('.insp-explus')!;

    this.root.querySelector('.insp-close')!.addEventListener('click', () => callbacks.onClose());
    this.startBtn.addEventListener('click', () => callbacks.onStart());
    this.upgradeBtn.addEventListener('click', () => callbacks.onUpgrade());
    this.demolishBtn.addEventListener('click', () => callbacks.onDemolish());
    this.exMinusBtn.addEventListener('click', () => callbacks.onExportKeep(-20));
    this.exPlusBtn.addEventListener('click', () => callbacks.onExportKeep(20));
  }

  show(): void {
    this.root.style.display = '';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  update(info: TileInfo, money: number, roadStretch?: { cells: number; cost: number }): void {
    if (info.construction) {
      this.renderConstruction(info);
      return;
    }
    this.roadStretch = roadStretch;
    this.startBtn.style.display = 'none'; // solo aparece en las obras
    this.exMinusBtn.style.display = 'none'; // solo en la terminal de exportación
    this.exPlusBtn.style.display = 'none';

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
      const stretch = this.roadStretch?.cells ?? info.roadSegmentSize;
      if (stretch > 1) lines.push(`Tramo elegido: ${stretch} casillas (arrastrá para elegir)`);
    } else if (def.storesMaterials) {
      lines.push('Corralón: almacena y distribuye materiales por su red de calles. 🏬');
      const s = info.storedMaterials;
      lines.push(
        s
          ? `Guardado: ${MATERIALS.map((m) => `${Math.round(s[m])} ${MATERIAL_ICON[m]}`).join(' · ')}`
          : 'Sin stock todavía.',
      );
      lines.push('<i style="opacity:.8">Las productoras conectadas lo llenan; lo avanzado se construye desde acá.</i>');
    } else if (def.makes || def.needsMaterial) {
      lines.push('Productora de materiales. 🏗️');
      if (def.needsMaterial) lines.push(`Consume: ${def.needsMaterial.amount} ${MATERIAL_ICON[def.needsMaterial.material]} /mes`);
      if (def.makes) lines.push(`Produce: ${def.makes.amount} ${MATERIAL_ICON[def.makes.material]} /mes`);
      lines.push('<i style="opacity:.8">Necesita energía y un corralón conectado por calle.</i>');
    } else if (def.sellsMaterials) {
      lines.push('Ferretería: vende materiales del corralón a la ciudad → renta. 🔧');
      lines.push(`Empleos comerciales: ${def.shopJobs ?? 0}`);
      lines.push('<i style="opacity:.8">Vende arena/cemento/ladrillo. Necesita un corralón conectado por calle.</i>');
    } else if (def.exportsMaterials) {
      lines.push('Terminal de exportación: vende el excedente al exterior → renta. 🚢');
      lines.push(`Conserva <b>${info.exportKeep ?? 0}</b> de cada material; exporta el resto cada mes.`);
      lines.push('<i style="opacity:.8">Ajustá con ➖/➕. Necesita un corralón conectado por calle.</i>');
      this.exMinusBtn.style.display = '';
      this.exPlusBtn.style.display = '';
    } else if (def.service || def.education || def.health) {
      const label = def.education ? 'cobertura educativa 🎓' : def.health ? 'cobertura de salud 🏥' : 'cobertura de servicios 🛡️';
      lines.push(`Brinda ${label}.`);
      const over = info.serviceServed > info.serviceCapacity;
      const col = over ? '#ff6b6b' : '#7CFC9A';
      lines.push(`Atiende: <b style="color:${col}">${info.serviceServed} / ${info.serviceCapacity}</b> hab.`);
      lines.push(
        over
          ? '<i style="opacity:.8">⚠️ Saturada: construí otra cerca</i>'
          : def.service
            ? 'Las zonas cercanas pueden crecer más alto.'
            : 'Las zonas cercanas crecen más rápido. ✨',
      );
    } else if (def.produces) {
      const KIND: Record<string, string> = { power: 'energía ⚡', water: 'agua 💧', gas: 'gas 🔥' };
      lines.push(`Produce <b>${def.produces.amount}</b> de ${KIND[def.produces.kind]} para toda la ciudad.`);
      lines.push('Las zonas la necesitan para crecer a niveles altos.');
    } else if (def.jobs) {
      lines.push('Industria (empleos industriales). 🏭');
      lines.push(`Empleos: ${def.jobs}`);
      if (def.amenity) lines.push('Empleo limpio: también sube el valor del suelo cercano. ✨');
    } else if (def.shopJobs) {
      lines.push('Negocio especializado (empleos comerciales). 🛍️');
      lines.push(`Empleos: ${def.shopJobs}`);
      if (def.income) lines.push(`Renta: <b style="color:#7CFC9A">+$${def.income}/mes</b> 💰`);
      if (def.amenity) lines.push('También sube el valor del suelo cercano. ✨');
    } else if (def.amenity) {
      lines.push('Sube el valor del suelo de las zonas cercanas. ✨');
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
      if (info.type === TileType.Residential) {
        const pct = (v: number) => `${Math.round(Math.min(1, v) * 100)}%`;
        lines.push(`🎓 Educación: ${pct(info.education)} · 🏥 Salud: ${pct(info.health)}`);
      }
    }
    if (def.build) {
      lines.push(`🧱 Construido con: ${formatBag(def.build)}${def.needsYard ? ' (de un corralón)' : ''}`);
    }
    if (info.size > 1 && info.type !== TileType.Empty) {
      lines.push(`Ocupa ${info.size}×${info.size} casillas`);
    }
    this.bodyEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');

    this.updateUpgradeButton(info, money);
    this.demolishBtn.style.display = info.type === TileType.Empty ? 'none' : '';
  }

  /** Panel de una obra en construcción: qué será, costo, progreso y botón Iniciar. */
  private renderConstruction(info: TileInfo): void {
    const c = info.construction!;
    const def = TILE_DEF[c.target];
    this.titleEl.textContent = '🚧 Obra';

    const lines: string[] = [];
    if (c.targetLevel !== undefined) {
      lines.push(`Ampliando ${NAME[c.target]} a <b>nivel ${c.targetLevel}</b>`);
    } else {
      lines.push(`Construirá: <b>${NAME[c.target]}</b>`);
      lines.push(`Costo: $${c.cost}${def.build ? ` + ${formatBag(def.build)}` : ''}`);
    }
    if (c.status === 'building') {
      const pct = Math.round((c.progress / c.duration) * 100);
      lines.push(`🏗️ Construyendo… <b>${pct}%</b> (${c.progress}/${c.duration} meses)`);
      lines.push(`<div class="tech-bar"><div class="tech-fill" style="width:${pct}%"></div></div>`);
    } else {
      lines.push('<i style="opacity:.8">Esperando el OK. Iniciá cuando tengas el dinero y los materiales.</i>');
    }
    this.bodyEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');

    this.upgradeBtn.style.display = 'none';
    this.exMinusBtn.style.display = 'none';
    this.exPlusBtn.style.display = 'none';
    this.demolishBtn.style.display = '';
    if (c.status === 'planned') {
      this.startBtn.style.display = '';
      this.startBtn.disabled = !c.canStart;
      this.startBtn.textContent = `▶️ Iniciar ($${c.cost})`;
      this.startBtn.title = c.canStart ? 'Cobra dinero + materiales y arranca la obra' : c.reason;
    } else {
      this.startBtn.style.display = 'none';
    }
  }

  private updateUpgradeButton(info: TileInfo, money: number): void {
    const isRoad = info.type === TileType.Road;
    if (!isRoad && !isZone(info.type)) {
      this.upgradeBtn.style.display = 'none';
      return;
    }
    this.upgradeBtn.style.display = '';
    const roadCost = this.roadStretch?.cost ?? info.upgradeCost;
    const cost = isRoad ? roadCost : info.upgradeCost;
    const affordable = money >= cost;

    if (isRoad) {
      if (info.level >= ROAD_MAX_LEVEL) {
        this.upgradeBtn.textContent = '⬆️ Nivel máximo';
        this.upgradeBtn.disabled = true;
        this.upgradeBtn.title = '';
      } else {
        this.upgradeBtn.textContent = `⬆️ Mejorar tramo → ${ROAD_LEVEL_NAME[info.level + 1]} ($${cost})`;
        this.upgradeBtn.disabled = !affordable;
        this.upgradeBtn.title = affordable ? 'Mejora solo el tramo elegido (arrastrá para elegirlo)' : 'Dinero insuficiente';
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
