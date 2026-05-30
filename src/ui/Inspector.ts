import { TileInfo } from '../sim/Simulation';
import {
  TileType,
  TILE_DEF,
  isZone,
  maxLevelOf,
  MAX_LEVEL,
  ROAD_MAX_LEVEL,
  ROAD_LEVEL_NAME,
  MATERIALS,
  MATERIAL_ICON,
  MaterialBag,
  CORRALON_CAP,
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
  [TileType.BusStop]: 'Parada de colectivo 🚏',
  [TileType.TramStop]: 'Parada de tranvía 🚋',
  [TileType.MetroStation]: 'Estación de metro 🚇',
  [TileType.Hardware]: 'Ferretería 🔧',
  [TileType.ExportTerminal]: 'Terminal de exportación 🚢',
  [TileType.Cafe]: 'Café ☕',
  [TileType.Diner]: 'Casa de comidas 🍴',
  [TileType.Restaurant]: 'Restaurante 🍽️',
  [TileType.Market]: 'Mercado 🛒',
  [TileType.Pizzeria]: 'Pizzería 🍕',
  [TileType.Burger]: 'Hamburguesería 🍔',
  [TileType.HotDog]: 'Panchería 🌭',
  [TileType.IceCream]: 'Heladería 🍦',
  [TileType.Bakery]: 'Panadería 🥖',
  [TileType.Kiosk]: 'Kiosco 🏪',
  [TileType.Boutique]: 'Boutique 👗',
  [TileType.Pharmacy]: 'Farmacia 💊',
  [TileType.Bank]: 'Banco 💰',
  [TileType.GasStation]: 'Estación de servicio ⛽',
  [TileType.Dealership]: 'Concesionaria 🚗',
  [TileType.SawMill]: 'Aserradero 🪵',
  [TileType.SteelMill]: 'Acería ⚙️',
  [TileType.ElectronicsFactory]: 'Fábrica de electrónica 🔌',
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
      if (info.terrainKind === 'water') {
        this.titleEl.textContent = 'Agua 🌊';
        lines.push('Lago / río. No se puede construir acá.');
        lines.push('<i style="opacity:.8">💧 Las casillas cercanas valen más (vista al agua).</i>');
      } else if (info.terrainKind === 'mountain') {
        this.titleEl.textContent = 'Montaña ⛰️';
        lines.push('Terreno montañoso. No se puede construir acá.');
      } else {
        lines.push('Terreno libre. Construí algo aquí.');
      }
    } else if (info.type === TileType.Road) {
      lines.push(`Tipo: ${ROAD_LEVEL_NAME[info.level]}`);
      lines.push(`Tráfico: ${Math.round(info.traffic)} / ${info.roadCapacity}`);
      const pct = Math.round(info.congestion * 100);
      const col = pct >= 100 ? '#ff6b6b' : pct >= 70 ? '#ffb74d' : '#7CFC9A';
      lines.push(`Congestión: <b style="color:${col}">${pct}%</b>`);
      const stretch = this.roadStretch?.cells ?? info.roadSegmentSize;
      if (stretch > 1) lines.push(`Tramo elegido: ${stretch} casillas (arrastrá para elegir)`);
      if (info.transit > 0.001) lines.push('<i style="opacity:.8">🚌 El transporte público cercano le quita tráfico</i>');
    } else if (def.storesMaterials) {
      lines.push(`Corralón: almacena hasta <b>${CORRALON_CAP}</b> de cada material y los distribuye por su red de calles. 🏬`);
      const s = info.storedMaterials;
      if (s) {
        lines.push('Guardado (de ' + CORRALON_CAP + ' c/u):');
        lines.push(MATERIALS.map((m) => {
          const v = Math.round(s[m]);
          const col = v >= CORRALON_CAP ? '#ff6b6b' : v > 0 ? '#7CFC9A' : '#888';
          return `<span style="color:${col}">${v}/${CORRALON_CAP} ${MATERIAL_ICON[m]}</span>`;
        }).join(' · '));
      } else {
        lines.push('Sin stock todavía.');
      }
      lines.push('<i style="opacity:.8">Las productoras conectadas lo llenan; lo avanzado se construye desde acá.</i>');
    } else if (def.makes || def.needsMaterial) {
      lines.push('Productora de materiales. 🏗️');
      if (def.needsMaterial) lines.push(`Consume: ${def.needsMaterial.amount} ${MATERIAL_ICON[def.needsMaterial.material]} /mes`);
      if (def.makes) lines.push(`Produce: ${def.makes.amount} ${MATERIAL_ICON[def.makes.material]} /mes`);
      const p = info.producer;
      if (p?.active) {
        lines.push('<b style="color:#7CFC9A">✅ Produciendo</b>');
      } else if (p) {
        lines.push(`<b style="color:#ff6b6b">⏸️ Inactiva</b> — ${p.reason}`);
      }
      lines.push('<i style="opacity:.8">Necesita energía y un corralón conectado por calle. El insumo sale del corralón o de la reserva.</i>');
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
    } else if (def.service || def.education || def.health || def.food || def.transit) {
      const isTransit = !!def.transit && !def.service && !def.education && !def.health && !def.food;
      const label = def.education
        ? 'cobertura educativa 🎓'
        : def.health
          ? 'cobertura de salud 🏥'
          : def.food
            ? 'comida 🍽️'
            : def.service
              ? 'seguridad 🛡️'
              : 'transporte público 🚌';
      lines.push(`Brinda ${label}.`);
      const over = info.serviceServed > info.serviceCapacity;
      const col = over ? '#ff6b6b' : '#7CFC9A';
      if (isTransit) {
        lines.push(`Atiende cerca: <b style="color:${col}">${info.serviceServed} / ${info.serviceCapacity}</b> hab.`);
      } else {
        // Servicios por población: capacidad de TODA la categoría vs habitantes de la ciudad.
        lines.push(`Ciudad: <b style="color:${col}">${info.serviceServed} / ${info.serviceCapacity}</b> hab. atendidos`);
      }
      if (def.shopJobs) lines.push(`Empleos comerciales: ${def.shopJobs}`);
      lines.push(
        isTransit
          ? over
            ? '<i style="opacity:.8">⚠️ Saturada: poné otra cerca</i>'
            : 'Descongestiona las calles cercanas. 🚌'
          : over
            ? '<i style="opacity:.8">⚠️ No alcanza para la población: construí más</i>'
            : '<i style="opacity:.8">Suma a la cobertura de toda la ciudad (mirá el HUD).</i>',
      );
    } else if (def.produces) {
      const KIND: Record<string, string> = { power: 'energía ⚡', water: 'agua 💧', gas: 'gas 🔥' };
      lines.push(`Produce <b>${def.produces.amount}</b> de ${KIND[def.produces.kind]} para toda la ciudad.`);
      lines.push('Las zonas la necesitan para crecer a niveles altos.');
      if (def.pollution) lines.push(`<i style="opacity:.85; color:#ff8a80">🏭 Contamina (radio ${def.pollution.radius}): alejá las viviendas.</i>`);
    } else if (def.jobs) {
      lines.push('Industria (empleos industriales). 🏭');
      lines.push(`Empleos: ${def.jobs}`);
      if (def.amenity) lines.push('Empleo limpio: también sube el valor del suelo cercano. ✨');
      if (def.pollution) lines.push(`<i style="opacity:.85; color:#ff8a80">🏭 Contamina (radio ${def.pollution.radius}): frena el crecimiento y molesta a los vecinos. Alejá las casas.</i>`);
    } else if (def.shopJobs) {
      lines.push('Negocio especializado (empleos comerciales). 🛍️');
      lines.push(`Empleos: ${def.shopJobs}`);
      if (def.income) lines.push(`Renta: <b style="color:#7CFC9A">+$${def.income}/mes</b> 💰`);
      if (def.amenity) lines.push('También sube el valor del suelo cercano. ✨');
    } else if (def.amenity) {
      lines.push('Sube el valor del suelo de las zonas cercanas. ✨');
    } else {
      const capLabel = info.type === TileType.Residential ? 'Habitantes' : 'Empleos';
      const typeMax = maxLevelOf(info.type);
      const isTower = info.type === TileType.Residential && info.level > MAX_LEVEL;
      lines.push(`Nivel: ${info.level} / ${typeMax}${isTower ? ' — 🏙️ Rascacielos' : ''}`);
      lines.push(`${capLabel}: ${info.capacity}`);
      lines.push(`Acceso a calle: ${info.hasRoad ? 'Sí ✅' : 'No ⚠️'}`);
      if (!info.cityHasPower) {
        lines.push('<i style="opacity:.8">⚡ La ciudad necesita más energía para pasar de nivel 1</i>');
      } else if (info.maxLevel < typeMax) {
        lines.push(`Máx. actual: nivel ${info.maxLevel}`);
        const faltan = [
          info.maxLevel < 2 ? 'servicios (policía/etc.)' : '',
          !info.cityHasWater ? 'agua' : '',
          !info.cityHasGas ? 'gas' : '',
          info.type === TileType.Residential && info.maxLevel >= MAX_LEVEL
            ? 'más valor del suelo y bienestar (parques, escuelas, salud, comida) para rascacielos'
            : '',
        ].filter(Boolean);
        if (faltan.length) lines.push(`<i style="opacity:.8">Para crecer más: ${faltan.join(', ')}</i>`);
      }
      if (info.value > 0.001) lines.push(`Valor del suelo: +${info.value.toFixed(2)}`);
      if (info.pollution > 0.01) {
        const col = info.pollution >= 0.6 ? '#ff6b6b' : '#ffb74d';
        lines.push(`<span style="color:${col}">🏭 Contaminación: ${Math.round(info.pollution * 100)}%${info.pollution >= 0.6 ? ' (frena el crecimiento)' : ''}</span>`);
      }
      if (info.type === TileType.Residential) {
        const pct = (v: number) => `${Math.round(Math.min(1, v) * 100)}%`;
        lines.push('<i style="opacity:.7; font-size:11px">Cobertura de la ciudad:</i>');
        lines.push(`🛡️ ${pct(info.coverage)} · 🎓 ${pct(info.education)} · 🏥 ${pct(info.health)} · 🍽️ ${pct(info.food)} · 🚌 ${pct(info.transit)}`);
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
    this.titleEl.textContent = '🚧 Obra';

    const lines: string[] = [];
    if (c.targetLevel !== undefined) {
      lines.push(`Ampliando ${NAME[c.target]} a <b>nivel ${c.targetLevel}</b>`);
    } else {
      lines.push(`Construirá: <b>${NAME[c.target]}</b>`);
      lines.push(`💰 Costo: <b>$${c.cost}</b>`);
      // Materiales de la receta. Si está esperando el OK, muestro "tenés / necesitás"
      // (verde si alcanza, rojo si falta); ya en obra, solo la receta.
      const needs = c.needs;
      if (needs && MATERIALS.some((m) => (needs[m] ?? 0) > 0)) {
        if (c.status === 'planned') {
          const parts = MATERIALS.filter((m) => (needs[m] ?? 0) > 0).map((m) => {
            const need = needs[m]!;
            const have = Math.floor(c.have?.[m] ?? 0);
            const col = have >= need ? '#7CFC9A' : '#ff6b6b';
            return `<span style="color:${col}">${have}/${need} ${MATERIAL_ICON[m]}</span>`;
          });
          lines.push(`🧱 Materiales (tenés/necesitás): ${parts.join(' · ')}`);
          if (c.needsYard) lines.push('<i style="opacity:.8">Se toman de un corralón conectado por calle.</i>');
        } else {
          lines.push(`🧱 Materiales: ${formatBag(needs)}`);
        }
      }
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
    if (info.level >= maxLevelOf(info.type)) {
      this.upgradeBtn.textContent = '⬆️ Nivel máximo';
      this.upgradeBtn.disabled = true;
      this.upgradeBtn.title = '';
    } else {
      const toTower = info.type === TileType.Residential && info.level >= MAX_LEVEL;
      this.upgradeBtn.textContent = `⬆️ ${toTower ? 'Levantar rascacielos' : 'Mejorar'} ($${info.upgradeCost})`;
      this.upgradeBtn.disabled = !(info.canUpgrade && affordable);
      this.upgradeBtn.title = !info.hasRoad
        ? 'Necesita una carretera al lado'
        : info.level + 1 > info.maxLevel
          ? toTower
            ? 'Para rascacielos: más valor del suelo y bienestar cerca (parques, escuelas, salud, comida)'
            : 'Necesita servicios cerca'
          : !affordable
            ? 'Dinero insuficiente'
            : '';
    }
  }
}
