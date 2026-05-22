import { City } from './City';
import {
  TileType,
  TILE_DEF,
  Influence,
  isZone,
  capacityOf,
  Material,
  MAX_LEVEL,
  ROAD_MAX_LEVEL,
  ROAD_CAPACITY,
} from './types';
import { TECHS, BASE_UNLOCKED, TechDef, TechMetric, METRIC_LABEL } from './Tech';
import { MaterialSystem, MaterialsSave } from './Materials';

export interface Demand {
  residential: number;
  commercial: number;
  industrial: number;
}

export interface CityStats {
  month: number;
  money: number;
  population: number;
  children: number;
  adults: number;
  jobs: number;
  employed: number;
  unemployed: number;
  unemploymentRate: number;
  demand: Demand;
  utilities: {
    power: { supply: number; demand: number };
    water: { supply: number; demand: number };
    gas: { supply: number; demand: number };
  };
  materials: {
    totals: Record<Material, number>;
    idleProducers: number;
  };
}

/** Detalle de UNA casilla, para el panel inspector. */
export interface TileInfo {
  type: TileType;
  level: number;
  size: number; // lado del footprint (1 = una casilla)
  capacity: number;
  hasRoad: boolean;
  value: number; // valor del suelo (amenidades)
  coverage: number; // cobertura de servicios recibida
  education: number; // cobertura educativa recibida
  health: number; // cobertura de salud recibida
  cityHasPower: boolean; // ¿la ciudad produce suficiente energía?
  cityHasWater: boolean;
  cityHasGas: boolean;
  storedMaterials?: Record<Material, number>; // (corralón) materiales que tiene guardados
  construction?: ConstructionInfo; // (obra) datos de la construcción en curso
  maxLevel: number; // nivel máximo alcanzable con la cobertura actual
  canUpgrade: boolean;
  upgradeCost: number; // (carreteras) costo de mejorar TODO el tramo conectado
  // Solo carreteras:
  traffic: number;
  roadCapacity: number;
  congestion: number;
  roadSegmentSize: number; // cuántas casillas tiene el tramo a mejorar
  // Solo servicios:
  serviceServed: number; // habitantes que atiende
  serviceCapacity: number; // habitantes que puede atender
}

export type GameMode = 'auto' | 'manual';

/** Una obra en curso: ocupa el terreno hasta completarse y volverse el edificio real. */
export interface Construction {
  x: number;
  z: number;
  size: number;
  target: TileType; // qué edificio será al terminar
  targetLevel?: number; // (obra de zona in situ) nivel al que se amplía; ausente = edificio nuevo
  status: 'planned' | 'building'; // 'planned' = esperando el OK; 'building' = en obra
  progress: number; // meses de obra transcurridos
  duration: number; // meses totales de la obra
}

/** Datos de una obra para el inspector (incluye si se puede iniciar y por qué no). */
export interface ConstructionInfo {
  target: TileType;
  targetLevel?: number;
  status: 'planned' | 'building';
  progress: number;
  duration: number;
  cost: number;
  canStart: boolean;
  reason: string;
}

/** Marcador flotante sobre una casilla (nube de sugerencia / obra en curso). */
export interface Marker {
  x: number;
  z: number;
  kind: 'build' | 'upgrade';
}

/** Un aviso para el jugador (algo falta o se puede mejorar). */
export interface Alert {
  id: string;
  icon: string;
  text: string;
  level: 'warn' | 'info';
}

/** Estado de la simulación para guardar (lo derivado se recalcula al cargar). */
export interface SimSave {
  money: number;
  month: number;
  mode: GameMode;
  unlocked: string[]; // ids de tecnologías ya desbloqueadas
  materials?: MaterialsSave; // stock de materiales (opcional: partidas viejas no lo tienen)
  construction?: Construction[]; // obras en curso (opcional)
}

/** Progreso tecnológico para el HUD: cuánto se desbloqueó y el próximo hito. */
export interface TechStatus {
  unlocked: number;
  total: number;
  next: {
    icon: string;
    name: string;
    desc: string;
    metricLabel: string;
    current: number;
    target: number;
    progress: number; // 0..1
    isMoney: boolean;
  } | null;
}

// --- Parámetros de la simulación ---
const CHILD_RATIO = 0.25;
const BASE_HOUSING_DEMAND = 12;
const COMMERCE_PER_CAPITA = 0.3;
const INDUSTRY_PER_CAPITA = 0.2;
const INDUSTRY_PER_COMMERCE = 0.6;
const DEMAND_SCALE = 30;
const DEMAND_THRESHOLD = 0.05;
const GROW_CHANCE = 0.25;
const MERGE_CHANCE = 0.2; // prob. por mes de que un bloque 2×2 de industria se fusione
const COVERAGE_FOR_L2 = 0.4;
const COVERAGE_FOR_L3 = 0.9;
const WELLBEING_GROWTH = 0.5; // cuánto acelera el crecimiento el bienestar (educación + salud)

// --- Economía ---
const START_MONEY = 10000;
const TAX_WORKER = 1.4; // impuesto por adulto EMPLEADO
const TAX_COMMERCE = 1.1; // impuesto por empleo comercial
const TAX_INDUSTRY = 1.0; // impuesto por empleo industrial
const SERVICE_COST_PER_CITIZEN = 0.35; // costo de atender a cada habitante
const UPGRADE_BASE_COST = 150; // mejorar zona (× nivel destino)
const ROAD_UPGRADE_COST = 120; // mejorar carretera (× nivel destino, × casillas del tramo)

export class Simulation {
  mode: GameMode = 'auto';
  money = START_MONEY;
  month = 0;
  demand: Demand = { residential: 0, commercial: 0, industrial: 0 };

  population = 0;
  commercialJobs = 0;
  industrialJobs = 0;
  children = 0;
  adults = 0;
  employed = 0;
  unemployed = 0;

  private totalUpkeep = 0;

  // Servicios básicos: producción de toda la ciudad vs su consumo (= población).
  powerSupply = 0;
  waterSupply = 0;
  gasSupply = 0;
  hasPower = false;
  hasWater = false;
  hasGas = false;
  worstCongestion = 0; // peor congestión de carretera (para avisos)

  private desirability: number[];
  private coverage: number[];
  private education: number[];
  private health: number[];
  private traffic: number[];
  private bonusIncome = 0; // renta fija de edificios (casino, etc.)
  eduCoverageAvg = 0; // cobertura educativa media sobre las zonas residenciales
  healthCoverageAvg = 0;

  // Tecnología: hitos ya logrados + cola de los recién desbloqueados (para avisar).
  private unlocked = new Set<string>();
  private justUnlocked: TechDef[] = [];

  // Cadena de materiales (inventario por corralón + logística por calles).
  readonly materials: MaterialSystem;

  // Obras en construcción (clave "x,z" del ancla) + cola de las recién terminadas.
  private sites = new Map<string, Construction>();
  private justBuilt: TileType[] = [];

  constructor(private city: City) {
    const n = city.width * city.height;
    this.desirability = new Array(n).fill(0);
    this.coverage = new Array(n).fill(0);
    this.education = new Array(n).fill(0);
    this.health = new Array(n).fill(0);
    this.traffic = new Array(n).fill(0);
    this.materials = new MaterialSystem(city.width, city.height);
  }

  get jobs(): number {
    return this.commercialJobs + this.industrialJobs;
  }

  get unemploymentRate(): number {
    return this.adults > 0 ? this.unemployed / this.adults : 0;
  }

  tick(): void {
    this.advanceConstruction();
    this.recount();
    this.computeDemographics();
    this.computeDemand();
    this.computeInfluence();
    this.computeTraffic();
    if (this.mode === 'auto') this.develop();
    this.recount();
    this.computeDemographics();
    this.materials.tick(this.city, this.hasPower);
    this.applyEconomy();
    this.evaluateTech(false);
    this.month++;
  }

  // --- Obras en construcción ---

  private siteKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  /** Registra una obra (cartel) en (x,z). El terreno ya debe estar ocupado por Construction. */
  addSite(x: number, z: number, size: number, target: TileType): void {
    const duration = 1 + size * 2; // 1×1 = 3 meses, 2×2 = 5, 3×3 = 7
    this.sites.set(this.siteKey(x, z), { x, z, size, target, status: 'planned', progress: 0, duration });
  }

  /**
   * Abre (y arranca) una obra de AMPLIACIÓN de una zona R/C/I in situ: la casilla
   * sigue mostrando su nivel actual y, al terminar, sube un nivel. En modo auto se
   * llama gratis (crecimiento orgánico); a mano cobra el costo de mejora.
   * Devuelve false si no se pudo (ya hay obra, nivel máximo, sin plata...).
   */
  beginZoneConstruction(x: number, z: number, free: boolean): boolean {
    const key = this.siteKey(x, z);
    if (this.sites.has(key)) return false; // ya hay una obra en esta casilla
    const tile = this.city.getTile(x, z);
    if (!isZone(tile.type) || tile.level >= MAX_LEVEL) return false;
    const targetLevel = tile.level + 1;
    if (!free) {
      const cost = UPGRADE_BASE_COST * targetLevel;
      if (this.money < cost) return false;
      this.money -= cost;
    }
    this.sites.set(key, { x, z, size: 1, target: tile.type, targetLevel, status: 'building', progress: 0, duration: 2 });
    return true;
  }

  /** Da el OK a una obra: cobra dinero + materiales y la pone en construcción. */
  startConstruction(x: number, z: number): boolean {
    const s = this.sites.get(this.siteKey(x, z));
    if (!s || s.status !== 'planned') return false;
    const cost = TILE_DEF[s.target].cost;
    if (this.money < cost) return false;
    if (!this.buildMaterialsOk(s.x, s.z, s.size, s.target)) return false;
    this.money -= cost;
    this.payBuildMaterials(s.x, s.z, s.size, s.target);
    s.status = 'building';
    s.progress = 0;
    return true;
  }

  /** Obras terminadas desde la última llamada (para avisar y vaciar la cola). */
  drainBuilt(): TileType[] {
    const out = this.justBuilt;
    this.justBuilt = [];
    return out;
  }

  /** Avanza las obras un mes; al completarse, aparece el edificio (o sube el nivel). */
  private advanceConstruction(): void {
    for (const [k, s] of [...this.sites]) {
      if (s.targetLevel !== undefined) {
        // Obra de zona (in situ): la casilla sigue siendo la zona; al terminar sube de nivel.
        if (this.city.getTile(s.x, s.z).type !== s.target) {
          this.sites.delete(k); // la zona fue demolida o cambiada
          continue;
        }
        if (s.status !== 'building') continue;
        if (++s.progress >= s.duration) {
          this.city.setLevel(s.x, s.z, s.targetLevel);
          this.sites.delete(k); // (sin aviso: el crecimiento de zonas sería spam)
        }
        continue;
      }
      // Obra de edificio nuevo (cartel sobre el terreno).
      if (this.city.getTile(s.x, s.z).type !== TileType.Construction) {
        this.sites.delete(k); // la obra fue demolida
        continue;
      }
      if (s.status !== 'building') continue;
      if (++s.progress >= s.duration) {
        this.city.setType(s.x, s.z, TileType.Empty); // limpia el cartel (toda la obra)
        this.city.placeBuilding(s.x, s.z, s.target, s.size);
        this.sites.delete(k);
        this.justBuilt.push(s.target);
      }
    }
  }

  // --- Construcción con materiales ---

  /** ¿Se cumplen los requisitos de materiales para construir `type` (S×S) en (x,z)? */
  buildMaterialsOk(x: number, z: number, size: number, type: TileType): boolean {
    const def = TILE_DEF[type];
    if (!def.build && !def.needsYard) return true; // no usa materiales
    this.materials.refreshNetwork(this.city); // la red de calles pudo cambiar desde el último mes
    if (def.needsYard && !this.materials.hasYardConnected(this.city, x, z, size)) return false;
    if (def.build && !this.materials.canAffordBuild(this.city, x, z, size, def.build, !!def.needsYard)) return false;
    return true;
  }

  /** Descuenta los materiales de la receta tras colocar el edificio. */
  payBuildMaterials(x: number, z: number, size: number, type: TileType): void {
    const def = TILE_DEF[type];
    if (def.build) this.materials.payBuild(this.city, x, z, size, def.build, !!def.needsYard);
  }

  spend(amount: number): boolean {
    if (amount > this.money) return false;
    this.money -= amount;
    return true;
  }

  /**
   * Mejora una zona, o TODO el tramo de carretera conectado (mismo nivel) de
   * una sola vez — así no hay que ir casilla por casilla.
   */
  tryUpgrade(x: number, z: number): boolean {
    const tile = this.city.getTile(x, z);

    if (tile.type === TileType.Road) {
      if (tile.level >= ROAD_MAX_LEVEL) return false;
      const targetLevel = tile.level + 1; // capturar ANTES del bucle (tile.level muta al actualizar)
      const segment = this.roadSegment(x, z);
      const cost = segment.length * ROAD_UPGRADE_COST * targetLevel;
      if (!this.spend(cost)) return false;
      for (const c of segment) this.city.setLevel(c.x, c.z, targetLevel);
      return true;
    }

    if (!isZone(tile.type) || tile.level >= MAX_LEVEL) return false;
    if (!this.city.hasRoadAccess(x, z)) return false;
    if (tile.level + 1 > this.maxLevelFor(x, z)) return false;
    // Mejorar a mano = abrir una obra de ampliación (cobra y construye con progreso).
    return this.beginZoneConstruction(x, z, false);
  }

  inspect(x: number, z: number): TileInfo {
    const tile = this.city.getTile(x, z);
    const def = TILE_DEF[tile.type];
    // Cobertura que atiende población: servicios, educación o salud.
    const serviceInf = def.service ?? def.education ?? def.health;
    const w = this.city.width;
    const i = z * w + x;
    const hasRoad = this.city.hasRoadAccess(x, z);
    const maxLevel = this.maxLevelFor(x, z);

    const isRoad = tile.type === TileType.Road;
    const roadCapacity = ROAD_CAPACITY[Math.min(tile.level, ROAD_CAPACITY.length - 1)];
    const segmentSize = isRoad ? this.roadSegment(x, z).length : 0;

    let canUpgrade = false;
    let upgradeCost = 0;
    if (isRoad) {
      canUpgrade = tile.level < ROAD_MAX_LEVEL;
      upgradeCost = segmentSize * ROAD_UPGRADE_COST * (tile.level + 1);
    } else if (isZone(tile.type)) {
      canUpgrade = tile.level < MAX_LEVEL && hasRoad && tile.level + 1 <= maxLevel;
      upgradeCost = UPGRADE_BASE_COST * (tile.level + 1);
    }

    return {
      type: tile.type,
      level: tile.level,
      size: tile.size,
      capacity: capacityOf(tile.type, tile.level),
      hasRoad,
      value: this.desirability[i],
      coverage: this.coverage[i],
      education: this.education[i],
      health: this.health[i],
      cityHasPower: this.hasPower,
      cityHasWater: this.hasWater,
      cityHasGas: this.hasGas,
      maxLevel,
      canUpgrade,
      upgradeCost,
      traffic: this.traffic[i],
      roadCapacity,
      congestion: isRoad ? this.traffic[i] / roadCapacity : 0,
      roadSegmentSize: segmentSize,
      // Para el panel, las plantas (servicios básicos) se muestran como servicios.
      serviceServed: serviceInf ? this.populationInRadius(x, z, serviceInf.radius) : 0,
      serviceCapacity: serviceInf?.capacity ?? 0,
      storedMaterials: tile.type === TileType.BuildYard ? this.materials.stockAt(x, z) : undefined,
      construction: this.constructionInfo(x, z),
    };
  }

  /** Datos de la obra en (x,z), o undefined si no hay ninguna. */
  private constructionInfo(x: number, z: number): ConstructionInfo | undefined {
    const s = this.sites.get(this.siteKey(x, z));
    if (!s) return undefined;
    const cost = TILE_DEF[s.target].cost;
    const okMoney = this.money >= cost;
    const okMaterials = this.buildMaterialsOk(s.x, s.z, s.size, s.target);
    return {
      target: s.target,
      targetLevel: s.targetLevel,
      status: s.status,
      progress: s.progress,
      duration: s.duration,
      cost,
      canStart: s.status === 'planned' && okMoney && okMaterials,
      reason: !okMoney ? 'Falta dinero' : !okMaterials ? 'Faltan materiales o un corralón conectado' : '',
    };
  }

  /** Marcadores flotantes: obras de zona en curso (🏗️) y sugerencias de mejora (💡). */
  getMarkers(): Marker[] {
    const out: Marker[] = [];
    // Obras de ampliación de zona en curso.
    for (const s of this.sites.values()) {
      if (s.targetLevel !== undefined) out.push({ x: s.x, z: s.z, kind: 'build' });
    }
    // Sugerencias de mejora.
    this.city.forEach((tile, x, z) => {
      if (this.sites.has(this.siteKey(x, z))) return; // ya hay obra
      if (tile.type === TileType.Road) {
        // Calle congestionada que se puede mejorar (en cualquier modo).
        if (tile.level < ROAD_MAX_LEVEL && this.getCongestion(x, z) > 0.8) {
          out.push({ x, z, kind: 'upgrade' });
        }
        return;
      }
      // Zonas que podrían subir de nivel: sugerir solo en modo Constructor (en auto crecen solas).
      if (this.mode === 'manual' && isZone(tile.type) && tile.level > 0 && tile.level < MAX_LEVEL) {
        if (this.city.hasRoadAccess(x, z) && tile.level < this.maxLevelFor(x, z)) {
          out.push({ x, z, kind: 'upgrade' });
        }
      }
    });
    return out.slice(0, 80); // tope para no saturar
  }

  getCongestion(x: number, z: number): number {
    const tile = this.city.getTile(x, z);
    if (tile.type !== TileType.Road) return 0;
    const cap = ROAD_CAPACITY[Math.min(tile.level, ROAD_CAPACITY.length - 1)];
    return this.traffic[z * this.city.width + x] / cap;
  }

  /** Casillas del tramo recto de carretera que pasa por (x,z) (para el resaltado). */
  roadSegmentCells(x: number, z: number): Array<{ x: number; z: number }> {
    return this.roadSegment(x, z);
  }

  // --- Guardado / avisos ---

  serialize(): SimSave {
    return {
      money: this.money,
      month: this.month,
      mode: this.mode,
      unlocked: [...this.unlocked],
      materials: this.materials.serialize(),
      construction: [...this.sites.values()],
    };
  }

  load(data: SimSave): void {
    this.money = data.money;
    this.month = data.month;
    this.mode = data.mode;
    this.unlocked = new Set(data.unlocked ?? []);
    this.materials.load(data.materials);
    this.sites.clear();
    for (const s of data.construction ?? []) this.sites.set(this.siteKey(s.x, s.z), s);
    this.refresh();
  }

  /** Reinicia a una ciudad nueva (mantiene el modo de juego). */
  reset(): void {
    this.money = START_MONEY;
    this.month = 0;
    this.unlocked.clear();
    this.materials.reset();
    this.sites.clear();
    this.refresh();
  }

  /** Recalcula todo el estado derivado (tras cargar o limpiar la ciudad). */
  refresh(): void {
    this.recount();
    this.computeDemographics();
    this.computeDemand();
    this.computeInfluence();
    this.computeTraffic();
    this.evaluateTech(true); // re-deriva los desbloqueos del estado actual, sin avisos
  }

  // --- Tecnología / desbloqueos ---

  private metricValue(metric: TechMetric): number {
    switch (metric) {
      case 'population':
        return this.population;
      case 'industrialJobs':
        return this.industrialJobs;
      case 'money':
        return this.money;
    }
  }

  /** Desbloquea los hitos cuya meta ya se alcanzó. `silent` evita encolar avisos. */
  private evaluateTech(silent: boolean): void {
    for (const tech of TECHS) {
      if (this.unlocked.has(tech.id)) continue;
      if (this.metricValue(tech.metric) >= tech.target) {
        this.unlocked.add(tech.id);
        if (!silent) this.justUnlocked.push(tech);
      }
    }
  }

  /** Edificios disponibles ahora mismo (base + lo desbloqueado por tecnología). */
  unlockedTypes(): Set<TileType> {
    const set = new Set<TileType>(BASE_UNLOCKED);
    for (const tech of TECHS) {
      if (this.unlocked.has(tech.id)) for (const t of tech.unlocks) set.add(t);
    }
    return set;
  }

  /** Hitos desbloqueados desde la última llamada (para mostrar un aviso y vaciar). */
  drainUnlocks(): TechDef[] {
    const out = this.justUnlocked;
    this.justUnlocked = [];
    return out;
  }

  /** Progreso para el HUD: cuántos hitos van y cuál es el próximo. */
  getTechStatus(): TechStatus {
    const unlocked = this.unlocked.size;
    const total = TECHS.length;
    const next = TECHS.find((t) => !this.unlocked.has(t.id));
    if (!next) return { unlocked, total, next: null };
    const current = Math.max(0, this.metricValue(next.metric));
    return {
      unlocked,
      total,
      next: {
        icon: next.icon,
        name: next.name,
        desc: next.desc,
        metricLabel: METRIC_LABEL[next.metric],
        current: Math.round(current),
        target: next.target,
        progress: Math.max(0, Math.min(1, current / next.target)),
        isMoney: next.metric === 'money',
      },
    };
  }

  /** Avisos activos: qué le falta o conviene a la ciudad ahora mismo. */
  getAlerts(): Alert[] {
    const alerts: Alert[] = [];
    const pop = this.population;
    if (this.money < 0) {
      alerts.push({ id: 'debt', icon: '💸', text: 'Déficit: estás perdiendo dinero', level: 'warn' });
    }
    if (pop > 0 && !this.hasPower) {
      alerts.push({ id: 'power', icon: '⚡', text: 'Falta energía: las zonas no crecen', level: 'warn' });
    }
    if (pop > 0 && !this.hasWater) {
      alerts.push({ id: 'water', icon: '💧', text: 'Falta agua para edificios altos', level: 'info' });
    }
    if (pop > 0 && !this.hasGas) {
      alerts.push({ id: 'gas', icon: '🔥', text: 'Falta gas para edificios altos', level: 'info' });
    }
    if (this.adults > 0 && this.unemploymentRate > 0.3) {
      alerts.push({ id: 'unemp', icon: '📉', text: 'Desempleo alto: hacen falta empleos', level: 'warn' });
    }
    if (this.worstCongestion > 1) {
      alerts.push({ id: 'traffic', icon: '🚗', text: 'Tráfico congestionado: mejorá las calles', level: 'warn' });
    }
    if (this.materials.idleProducers > 0) {
      alerts.push({ id: 'materials', icon: '🧱', text: 'Productoras inactivas: conectá un corralón por calle o falta energía', level: 'info' });
    }
    if (pop > 40 && this.eduCoverageAvg < 0.3) {
      alerts.push({ id: 'edu', icon: '🏫', text: 'Faltan escuelas: poca cobertura educativa', level: 'info' });
    }
    if (pop > 40 && this.healthCoverageAvg < 0.3) {
      alerts.push({ id: 'health', icon: '🏥', text: 'Falta salud: construí hospitales o clínicas', level: 'info' });
    }
    if (this.demand.residential > 0.6) {
      alerts.push({ id: 'dr', icon: '🏠', text: 'Alta demanda residencial', level: 'info' });
    }
    if (this.demand.commercial > 0.6) {
      alerts.push({ id: 'dc', icon: '🏢', text: 'Alta demanda comercial', level: 'info' });
    }
    if (this.demand.industrial > 0.6) {
      alerts.push({ id: 'di', icon: '🏭', text: 'Alta demanda industrial', level: 'info' });
    }
    return alerts;
  }

  // --- Cálculos internos ---

  private recount(): void {
    let pop = 0;
    let commercial = 0;
    let industrial = 0;
    let upkeep = 0;
    let income = 0;
    let power = 0;
    let water = 0;
    let gas = 0;

    this.city.forEach((tile, x, z) => {
      if (this.city.isSubCell(x, z)) return; // no contar dos veces un edificio multi-casilla
      const def = TILE_DEF[tile.type];
      upkeep += def.upkeep ?? 0;
      income += def.income ?? 0; // renta fija (casino, etc.)
      industrial += def.jobs ?? 0; // empleos de las fábricas
      commercial += def.shopJobs ?? 0; // empleos de negocios especializados
      if (def.produces) {
        if (def.produces.kind === 'power') power += def.produces.amount;
        else if (def.produces.kind === 'water') water += def.produces.amount;
        else gas += def.produces.amount;
      }
      switch (tile.type) {
        case TileType.Residential:
          pop += capacityOf(tile.type, tile.level);
          break;
        case TileType.Commercial:
          commercial += capacityOf(tile.type, tile.level);
          break;
        case TileType.Industrial:
          industrial += capacityOf(tile.type, tile.level);
          break;
      }
    });

    this.population = pop;
    this.commercialJobs = commercial;
    this.industrialJobs = industrial;
    this.totalUpkeep = upkeep;
    this.bonusIncome = income;

    // Servicios básicos: hace falta producir al menos tanto como la población
    // (y tener al menos una planta, si no la ciudad no tiene ese suministro).
    this.powerSupply = power;
    this.waterSupply = water;
    this.gasSupply = gas;
    const need = Math.max(1, pop);
    this.hasPower = power >= need;
    this.hasWater = water >= need;
    this.hasGas = gas >= need;
  }

  private computeDemographics(): void {
    this.children = Math.round(this.population * CHILD_RATIO);
    this.adults = this.population - this.children;
    this.employed = Math.min(this.adults, this.jobs);
    this.unemployed = this.adults - this.employed;
  }

  private computeDemand(): void {
    const rawR = BASE_HOUSING_DEMAND + (this.jobs - this.adults);
    const rawC = this.population * COMMERCE_PER_CAPITA - this.commercialJobs;
    const desiredIndustry =
      this.population * INDUSTRY_PER_CAPITA + this.commercialJobs * INDUSTRY_PER_COMMERCE;
    const rawI = desiredIndustry - this.industrialJobs;

    const norm = (v: number) => Math.max(-1, Math.min(1, v / DEMAND_SCALE));
    this.demand = { residential: norm(rawR), commercial: norm(rawC), industrial: norm(rawI) };
  }

  /** Reparte una influencia radial (con caída lineal) sobre un campo. */
  private spread(field: number[], x: number, z: number, radius: number, strength: number): void {
    const w = this.city.width;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.city.inBounds(nx, nz)) continue;
        const dist = Math.hypot(dx, dz);
        if (dist > radius) continue;
        field[nz * w + nx] += strength * (1 - dist / radius);
      }
    }
  }

  /** Habitantes que viven dentro de un radio (para saturar servicios). */
  private populationInRadius(x: number, z: number, radius: number): number {
    let pop = 0;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.city.inBounds(nx, nz)) continue;
        if (Math.hypot(dx, dz) > radius) continue;
        const t = this.city.getTile(nx, nz);
        if (t.type === TileType.Residential) pop += capacityOf(t.type, t.level);
      }
    }
    return pop;
  }

  /** Valor del suelo (amenidades), cobertura de servicios, educación y salud. */
  private computeInfluence(): void {
    this.desirability.fill(0);
    this.coverage.fill(0);
    this.education.fill(0);
    this.health.fill(0);
    this.city.forEach((tile, x, z) => {
      if (this.city.isSubCell(x, z)) return; // la influencia emana solo del ancla
      const def = TILE_DEF[tile.type];
      if (def.amenity) {
        this.spread(this.desirability, x, z, def.amenity.radius, def.amenity.strength);
      }
      // Servicios, educación y salud: cobertura radial que se diluye si se satura.
      for (const [inf, field] of [
        [def.service, this.coverage],
        [def.education, this.education],
        [def.health, this.health],
      ] as const) {
        if (!inf) continue;
        const factor = this.serviceLoadFactor(x, z, inf);
        this.spread(field, x, z, inf.radius, inf.strength * factor);
      }
    });
    this.computeWellbeing();
  }

  /** Promedia educación y salud sobre las zonas residenciales (para avisos). */
  private computeWellbeing(): void {
    const w = this.city.width;
    let edu = 0;
    let hea = 0;
    let homes = 0;
    this.city.forEach((tile, x, z) => {
      if (tile.type !== TileType.Residential || tile.level <= 0) return;
      homes++;
      edu += Math.min(1, this.education[z * w + x]);
      hea += Math.min(1, this.health[z * w + x]);
    });
    this.eduCoverageAvg = homes > 0 ? edu / homes : 0;
    this.healthCoverageAvg = homes > 0 ? hea / homes : 0;
  }

  /** Bono de crecimiento por bienestar (educación + salud) en una casilla. */
  private wellbeingAt(x: number, z: number): number {
    const i = z * this.city.width + x;
    return (Math.min(1, this.education[i]) + Math.min(1, this.health[i])) / 2;
  }

  /** Eficacia de un servicio: 1 si no está saturado, menos si sobra población. */
  private serviceLoadFactor(x: number, z: number, svc: Influence): number {
    const cap = svc.capacity ?? Infinity;
    const served = this.populationInRadius(x, z, svc.radius);
    return Math.min(1, cap / Math.max(1, served));
  }

  private computeTraffic(): void {
    this.traffic.fill(0);
    const w = this.city.width;
    let worst = 0;
    this.city.forEach((tile, x, z) => {
      if (tile.type !== TileType.Road) return;
      let load = 0;
      const add = (cx: number, cz: number) => {
        if (!this.city.inBounds(cx, cz)) return;
        const t = this.city.getTile(cx, cz);
        load += capacityOf(t.type, t.level);
      };
      add(x + 1, z);
      add(x - 1, z);
      add(x, z + 1);
      add(x, z - 1);
      this.traffic[z * w + x] = load;
      const cap = ROAD_CAPACITY[Math.min(tile.level, ROAD_CAPACITY.length - 1)];
      worst = Math.max(worst, load / cap);
    });
    this.worstCongestion = worst;
  }

  private maxLevelFor(x: number, z: number): number {
    const cov = this.coverage[z * this.city.width + x];
    let max = 1;
    // Nivel 2: la ciudad necesita energía + servicios (policía/etc.) cerca.
    // Nivel 3: además agua y gas suficientes.
    if (this.hasPower && cov >= COVERAGE_FOR_L2) max = 2;
    if (this.hasPower && this.hasWater && this.hasGas && cov >= COVERAGE_FOR_L3) max = 3;
    return Math.min(max, MAX_LEVEL);
  }

  private trafficFactor(x: number, z: number): number {
    let worst = 0;
    const check = (cx: number, cz: number) => {
      if (this.city.inBounds(cx, cz)) worst = Math.max(worst, this.getCongestion(cx, cz));
    };
    check(x + 1, z);
    check(x - 1, z);
    check(x, z + 1);
    check(x, z - 1);
    const over = Math.max(0, worst - 1);
    return 1 / (1 + over);
  }

  /**
   * El TRAMO RECTO de carretera (mismo nivel) que pasa por (x,z): avanza por el
   * eje del clic (horizontal si conecta E/O, si no vertical) sin ramificarse en
   * los cruces. Así mejorar una calle afecta solo esa línea recta, no toda la red.
   */
  private roadSegment(x: number, z: number): Array<{ x: number; z: number }> {
    const start = this.city.getTile(x, z);
    if (start.type !== TileType.Road) return [];
    const level = start.level;
    const sameRoad = (cx: number, cz: number) =>
      this.city.inBounds(cx, cz) &&
      this.city.getTile(cx, cz).type === TileType.Road &&
      this.city.getTile(cx, cz).level === level;

    const out: Array<{ x: number; z: number }> = [{ x, z }];
    const horizontal = sameRoad(x + 1, z) || sameRoad(x - 1, z);

    if (horizontal) {
      for (let cx = x + 1; sameRoad(cx, z); cx++) out.push({ x: cx, z });
      for (let cx = x - 1; sameRoad(cx, z); cx--) out.push({ x: cx, z });
    } else {
      for (let cz = z + 1; sameRoad(x, cz); cz++) out.push({ x, z: cz });
      for (let cz = z - 1; sameRoad(x, cz); cz--) out.push({ x, z: cz });
    }
    return out;
  }

  private develop(): void {
    const { residential, commercial, industrial } = this.demand;
    const w = this.city.width;

    this.city.forEach((tile, x, z) => {
      if (!isZone(tile.type)) return;
      if (this.sites.has(this.siteKey(x, z))) return; // ya hay una obra en curso acá

      const dem =
        tile.type === TileType.Residential
          ? residential
          : tile.type === TileType.Commercial
            ? commercial
            : industrial;

      const value = this.desirability[z * w + x];

      if (dem > DEMAND_THRESHOLD && this.city.hasRoadAccess(x, z)) {
        const maxLv = this.maxLevelFor(x, z);
        const tf = this.trafficFactor(x, z);
        // El bienestar (educación + salud) acelera el crecimiento donde hay cobertura.
        const wb = 1 + WELLBEING_GROWTH * this.wellbeingAt(x, z);
        if (tile.level < maxLv && Math.random() < GROW_CHANCE * dem * (1 + value) * tf * wb) {
          this.beginZoneConstruction(x, z, true); // crecimiento orgánico = obra gratis con progreso
        }
      } else if (dem < -DEMAND_THRESHOLD) {
        const resist = 1 - Math.min(0.9, value);
        if (tile.level > 0 && Math.random() < GROW_CHANCE * -dem * resist) {
          this.city.setLevel(x, z, tile.level - 1);
        }
      }
    });

    this.mergeIndustry();
  }

  /** ¿Las 4 casillas (x,z)..(x+1,z+1) son industria nivel máximo con acceso a calle? */
  private isMergeableBlock(x: number, z: number): boolean {
    let road = false;
    for (let dz = 0; dz < 2; dz++) {
      for (let dx = 0; dx < 2; dx++) {
        const cx = x + dx;
        const cz = z + dz;
        if (!this.city.inBounds(cx, cz)) return false;
        const t = this.city.getTile(cx, cz);
        if (t.type !== TileType.Industrial || t.level < MAX_LEVEL) return false;
        if (this.city.hasRoadAccess(cx, cz)) road = true;
      }
    }
    return road;
  }

  /**
   * Crecimiento "a lo ancho": un bloque 2×2 de industria a nivel máximo (con
   * calle) se consolida solo en una fábrica mediana. Reúno candidatos y luego
   * los aplico (re-chequeando, porque una fusión cambia las casillas vecinas).
   */
  private mergeIndustry(): void {
    const candidates: Array<{ x: number; z: number }> = [];
    for (let z = 0; z < this.city.height - 1; z++) {
      for (let x = 0; x < this.city.width - 1; x++) {
        if (this.isMergeableBlock(x, z)) candidates.push({ x, z });
      }
    }
    for (const c of candidates) {
      if (!this.isMergeableBlock(c.x, c.z)) continue; // pudo haber cambiado por otra fusión
      if (Math.random() >= MERGE_CHANCE) continue;
      this.city.setType(c.x, c.z, TileType.Empty);
      this.city.setType(c.x + 1, c.z, TileType.Empty);
      this.city.setType(c.x, c.z + 1, TileType.Empty);
      this.city.setType(c.x + 1, c.z + 1, TileType.Empty);
      this.city.placeBuilding(c.x, c.z, TileType.FactoryMedium, 2);
    }
  }

  private applyEconomy(): void {
    // Ingresos: impuesto a la renta (empleados) + impuesto a las empresas + rentas fijas.
    const income =
      this.employed * TAX_WORKER +
      this.commercialJobs * TAX_COMMERCE +
      this.industrialJobs * TAX_INDUSTRY +
      this.bonusIncome;
    // Gastos: mantenimiento + costo de atender a cada habitante.
    const expenses = this.totalUpkeep + this.population * SERVICE_COST_PER_CITIZEN;
    this.money += income - expenses;
  }

  getStats(): CityStats {
    return {
      month: this.month,
      money: Math.round(this.money),
      population: this.population,
      children: this.children,
      adults: this.adults,
      jobs: this.jobs,
      employed: this.employed,
      unemployed: this.unemployed,
      unemploymentRate: this.unemploymentRate,
      demand: this.demand,
      utilities: {
        power: { supply: this.powerSupply, demand: this.population },
        water: { supply: this.waterSupply, demand: this.population },
        gas: { supply: this.gasSupply, demand: this.population },
      },
      materials: {
        totals: this.materials.totals,
        idleProducers: this.materials.idleProducers,
      },
    };
  }
}
