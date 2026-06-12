import { City } from './City';
import {
  TileType,
  TILE_DEF,
  Influence,
  isZone,
  capacityOf,
  maxLevelOf,
  repairCostOf,
  RES_STYLE,
  Material,
  MaterialBag,
  TerrainKind,
  ResidentialStyle,
  MAX_LEVEL,
  ROAD_MAX_LEVEL,
  ROAD_CAPACITY,
} from './types';
import { TECHS, BASE_UNLOCKED, TechDef, TechMetric, METRIC_LABEL } from './Tech';
import { MaterialSystem, MaterialsSave } from './Materials';
import { DisasterSystem, DisasterSave } from './Disasters';

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
    produced: Record<Material, number>; // producido el último mes (ritmo)
    consumed: Record<Material, number>; // consumido el último mes (insumos + ventas)
    idleProducers: number;
    corralones: number; // cuántos corralones hay (capacidad de almacenamiento)
  };
  // Cobertura de servicios por población (0..1), para los medidores del HUD.
  coverage: {
    security: number;
    health: number;
    education: number;
    food: number;
  };
  science: { total: number; rate: number }; // puntos de ciencia acumulados + ritmo/mes
  hero: { active: boolean }; // ¿la ciudad tiene héroe (cuartel sano)?
  race: { active: boolean; tracks: number }; // ¿hay carrera en curso? + cuántos circuitos
  territory: {
    tokens: number;
    unlocked: number;
    total: number;
    nextCost: number; // costo de la próxima parcela
    sources: { tech: number; disasters: number; population: number }; // desglose de fichas ganadas
  }; // fichas + parcelas abiertas/total
}

/** Detalle de UNA casilla, para el panel inspector. */
export interface TileInfo {
  type: TileType;
  level: number;
  size: number; // lado del footprint (1 = una casilla)
  terrainKind: TerrainKind; // tierra / agua / montaña
  style: ResidentialStyle; // estilo del barrio (solo residencial)
  damaged: boolean; // ruina por catástrofe (se puede reparar)
  repairCost: number; // costo de repararla (si está dañada)
  locked: boolean; // territorio bloqueado (hay que desbloquear la parcela)
  unlockCost: number; // fichas 🗝️ para abrir esta parcela
  territoryTokens: number; // fichas disponibles
  tokenSources: { tech: number; disasters: number; population: number }; // de dónde salen las fichas
  canUnlock: boolean; // ¿se puede abrir ya? (contigua a lo abierto + fichas suficientes)
  capacity: number;
  hasRoad: boolean;
  value: number; // valor del suelo (amenidades)
  pollution: number; // contaminación recibida en esta casilla (0..n)
  coverage: number; // cobertura de seguridad (global, por población)
  education: number; // cobertura educativa (global, por población)
  health: number; // cobertura de salud (global, por población)
  food: number; // cobertura de comida (global, por población)
  transit: number; // cobertura de transporte público (alivia el tráfico, espacial)
  cityHasPower: boolean; // ¿la ciudad produce suficiente energía?
  cityHasWater: boolean;
  cityHasGas: boolean;
  storedMaterials?: Record<Material, number>; // (corralón) materiales que tiene guardados
  producer?: { active: boolean; reason: string }; // (productoras) si está produciendo y por qué no
  exportKeep?: number; // (terminal) stock mínimo a conservar antes de exportar
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
  needs?: MaterialBag; // materiales que cuesta construirlo (receta)
  have?: Record<Material, number>; // materiales disponibles en la red para esta obra
  needsYard?: boolean; // requiere un corralón conectado por calle
}

/** Marcador flotante sobre una casilla (obra por iniciar / en curso / sugerencia). */
export interface Marker {
  x: number;
  z: number;
  kind: 'plan' | 'build' | 'upgrade';
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
  science?: number; // puntos de ciencia acumulados (opcional: partidas viejas no lo tienen)
  disastersSurvived?: number; // catástrofes superadas (fichas de territorio)
  territorySpent?: number; // fichas de territorio ya gastadas
  territoryUnlocks?: number; // parcelas que abrió el jugador (encarece la próxima)
  materials?: MaterialsSave; // stock de materiales (opcional: partidas viejas no lo tienen)
  construction?: Construction[]; // obras en curso (opcional)
  disasters?: DisasterSave; // catástrofes en curso (opcional)
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
const TRANSIT_MAX_RELIEF = 0.7; // el transporte público puede quitar hasta este % del tráfico de una zona
const POLLUTION_BLOCK = 0.6; // contaminación a partir de la cual una casilla no sube de nivel 1
const RACE_DURATION = 2; // meses que dura un fin de semana de carreras
const RACE_INTERVAL = 10; // meses entre eventos de carrera
const RACE_INCOME = 150; // renta extra por mes (× circuitos) mientras hay carrera
const WATER_AMENITY_RADIUS = 2; // las casillas junto al agua suben de valor (vista al lago/río)
const WATER_AMENITY_STRENGTH = 0.35;
// Rascacielos residenciales (niveles 4-5): además del nivel 3, exigen barrio
// deseable (valor del suelo por amenidades) y buen bienestar (educación+salud+comida).
const DESIRABILITY_FOR_L4 = 0.5;
const WELLBEING_FOR_L4 = 0.5;
const DESIRABILITY_FOR_L5 = 1.0;
const WELLBEING_FOR_L5 = 0.75;

// --- Economía ---
const START_MONEY = 10000;
const TAX_WORKER = 1.4; // impuesto por adulto EMPLEADO
const TAX_COMMERCE = 1.1; // impuesto por empleo comercial
const TAX_INDUSTRY = 1.0; // impuesto por empleo industrial
const SERVICE_COST_PER_CITIZEN = 0.35; // costo de atender a cada habitante
const UPGRADE_BASE_COST = 150; // mejorar zona (× nivel destino)
const ROAD_UPGRADE_COST = 120; // mejorar carretera (× nivel destino, × casillas del tramo)

// Economía de territorio (fichas 🗝️). Las fichas salen de TRES fuentes:
//  • cada hito tecnológico desbloqueado (1 c/u),
//  • cada catástrofe superada (vale DOBLE: sobrevivir es difícil),
//  • cada HITO DE POBLACIÓN alcanzado (el motor del crecimiento de la ciudad).
// Abrir parcelas cuesta cada vez más (rampa suave), así expandir es un logro.
const DISASTER_TOKEN_VALUE = 2; // fichas por catástrofe superada
const TERRITORY_BASE_COST = 1; // costo de la 1ª parcela (sube +1 por cada expansión)
// Umbrales de población; cada uno alcanzado otorga 1 ficha. Suben rápido para que
// las fichas acompañen el crecimiento sin regalarse.
const POP_MILESTONES = [50, 150, 350, 700, 1200, 2000, 3200, 5000, 7500, 11000, 16000, 23000, 32000, 45000, 60000];

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
  utilityDemand = 0; // consumo de servicios básicos = casas + comercios + industria
  hasPower = false;
  hasWater = false;
  hasGas = false;
  worstCongestion = 0; // peor congestión de carretera (para avisos)

  private desirability: number[]; // valor del suelo (amenidades + vista al agua) — espacial
  private transit: number[]; // alivio de tráfico del transporte público — espacial
  private pollution: number[]; // contaminación de fábricas/centrales — espacial (cuadrada)
  private traffic: number[];
  private bonusIncome = 0; // renta fija de edificios (casino, etc.)

  // Cobertura POR POBLACIÓN (global, como luz/agua/gas): capacidad total / población (0..1).
  securityCoverage = 0; // policía / bomberos / gobierno
  healthCoverage = 0; // hospital / clínica / farmacia
  educationCoverage = 0; // escuela / universidad / biblioteca
  foodCoverage = 0; // cafés / restaurantes / locales de comida

  // Ciencia: puntos acumulados (desbloquean lo más avanzado) + ritmo por mes.
  science = 0;
  researchRate = 0; // puntos de ciencia que la ciudad genera por mes (con energía)

  // El héroe: true si hay un cuartel (HeroHQ) sano. Mientras tanto, mitiga catástrofes.
  hasHero = false;

  // Territorio: fichas 🗝️ (hitos tecnológicos + desastres superados + hitos de población).
  disastersSurvived = 0; // catástrofes que atravesó la ciudad
  private territorySpent = 0; // fichas ya gastadas abriendo territorio
  private territoryUnlocks = 0; // parcelas que abrió el jugador (encarece la próxima)

  // Circuitos de carrera: organizan "días de evento" que dan renta extra y atraen gente.
  raceTracks = 0; // circuitos sanos en la ciudad
  raceActive = false; // ¿hay una carrera en curso este mes?
  private raceMonthsLeft = 0; // meses que dura el evento actual
  private raceCooldown = 0; // meses hasta el próximo evento
  private justStartedRace = false; // para avisar (toast) cuando arranca una carrera
  private securityCap = 0; // capacidad total instalada de cada categoría (para el inspector)
  private healthCap = 0;
  private educationCap = 0;
  private foodCap = 0;

  // Tecnología: hitos ya logrados + cola de los recién desbloqueados (para avisar).
  private unlocked = new Set<string>();
  private justUnlocked: TechDef[] = [];

  // Cadena de materiales (inventario por corralón + logística por calles).
  readonly materials: MaterialSystem;

  // Catástrofes (incendios; luego meteoritos/tornados/huracanes).
  readonly disasters: DisasterSystem;

  // Obras en construcción (clave "x,z" del ancla) + cola de las recién terminadas.
  private sites = new Map<string, Construction>();
  private justBuilt: TileType[] = [];

  constructor(private city: City) {
    const n = city.width * city.height;
    this.desirability = new Array(n).fill(0);
    this.transit = new Array(n).fill(0);
    this.pollution = new Array(n).fill(0);
    this.traffic = new Array(n).fill(0);
    this.materials = new MaterialSystem(city.width, city.height);
    this.disasters = new DisasterSystem(city);
  }

  get jobs(): number {
    return this.commercialJobs + this.industrialJobs;
  }

  get unemploymentRate(): number {
    return this.adults > 0 ? this.unemployed / this.adults : 0;
  }

  tick(): void {
    this.advanceConstruction();
    this.disasters.heroActive = this.hasHero; // el héroe (si lo hay) ayuda a apagar incendios
    this.disasters.tick(); // los incendios crecen/se propagan/destruyen antes de recontar
    this.recount();
    this.computeDemographics();
    this.computeDemand();
    this.computeInfluence();
    this.computeTraffic();
    if (this.mode === 'auto') this.develop();
    this.recount();
    this.computeDemographics();
    this.materials.tick(this.city, this.hasPower);
    this.science += this.researchRate; // la ciencia se acumula (mueve los hitos científicos)
    this.advanceRaces(); // días de evento de carrera (renta extra mientras dura)
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
    if (!isZone(tile.type) || tile.level >= maxLevelOf(tile.type)) return false;
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

  /** Inicia todas las obras pendientes que se puedan pagar. Devuelve cuántas arrancaron. */
  startAllConstruction(): number {
    let n = 0;
    for (const s of [...this.sites.values()]) {
      if (s.status === 'planned' && this.startConstruction(s.x, s.z)) n++;
    }
    return n;
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

    if (!isZone(tile.type) || tile.level >= maxLevelOf(tile.type)) return false;
    if (!this.city.hasRoadAccess(x, z)) return false;
    if (tile.level + 1 > this.maxLevelFor(x, z)) return false;
    // Mejorar a mano = abrir una obra de ampliación (cobra y construye con progreso).
    return this.beginZoneConstruction(x, z, false);
  }

  /**
   * Repara un edificio dañado por una catástrofe: cobra el costo de reparación y
   * lo vuelve a poner en funcionamiento. Devuelve false si no está dañado o si no
   * alcanza el dinero.
   */
  repair(x: number, z: number): boolean {
    const tile = this.city.getTile(x, z);
    const ax = tile.anchor ? tile.anchor.x : x;
    const az = tile.anchor ? tile.anchor.z : z;
    const anchor = this.city.getTile(ax, az);
    if (!anchor.damaged) return false;
    const cost = repairCostOf(anchor.type);
    if (this.money < cost) return false;
    this.money -= cost;
    this.city.setDamaged(ax, az, false);
    return true;
  }

  // --- Territorio (parcelas que se desbloquean con fichas) ---

  /** Registra que ocurrió una catástrofe (suma una ficha de territorio por superarla). */
  recordDisaster(): void {
    this.disastersSurvived++;
  }

  /** ¿Cuántos hitos de población alcanzó la ciudad? (cada uno da 1 ficha). */
  private populationMilestones(): number {
    let n = 0;
    for (const m of POP_MILESTONES) if (this.population >= m) n++;
    return n;
  }

  /** Desglose de fichas 🗝️ GANADAS por fuente (para mostrarlo en la UI). */
  territoryTokenSources(): { tech: number; disasters: number; population: number } {
    return {
      tech: this.unlocked.size,
      disasters: this.disastersSurvived * DISASTER_TOKEN_VALUE,
      population: this.populationMilestones(),
    };
  }

  /** Total de fichas 🗝️ ganadas (las tres fuentes sumadas). */
  private territoryTokensEarned(): number {
    const s = this.territoryTokenSources();
    return s.tech + s.disasters + s.population;
  }

  /** Fichas 🗝️ DISPONIBLES: las ganadas menos las ya gastadas en expandir. */
  territoryTokens(): number {
    return this.territoryTokensEarned() - this.territorySpent;
  }

  /** Costo (en fichas) de abrir la próxima parcela: sube +1 por cada expansión hecha. */
  territoryUnlockCost(): number {
    return TERRITORY_BASE_COST + this.territoryUnlocks;
  }

  /** Abre la parcela de (x,z) si es contigua a lo abierto y alcanzan las fichas. */
  unlockTerritory(x: number, z: number): boolean {
    const { px, pz } = this.city.tileParcel(x, z);
    if (!this.city.parcelCanUnlock(px, pz)) return false;
    const cost = this.territoryUnlockCost();
    if (this.territoryTokens() < cost) return false;
    this.city.unlockParcel(px, pz);
    this.territorySpent += cost;
    this.territoryUnlocks++; // la próxima parcela costará una ficha más
    return true;
  }

  inspect(x: number, z: number): TileInfo {
    const tile = this.city.getTile(x, z);
    const def = TILE_DEF[tile.type];
    // Servicios "por población" (global): atienden a toda la ciudad → población vs capacidad
    // total de su categoría. El transporte sigue siendo espacial (atiende su área).
    let served = 0;
    let serviceCap = 0;
    if (def.service) { served = this.population; serviceCap = this.securityCap; }
    else if (def.health) { served = this.population; serviceCap = this.healthCap; }
    else if (def.education) { served = this.population; serviceCap = this.educationCap; }
    else if (def.food) { served = this.population; serviceCap = this.foodCap; }
    else if (def.transit) { served = this.populationInRadius(x, z, def.transit.radius); serviceCap = def.transit.capacity ?? 0; }
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
      canUpgrade = tile.level < maxLevelOf(tile.type) && hasRoad && tile.level + 1 <= maxLevel;
      upgradeCost = UPGRADE_BASE_COST * (tile.level + 1);
    }
    if (tile.damaged) canUpgrade = false; // una ruina se repara, no se mejora

    return {
      type: tile.type,
      level: tile.level,
      size: tile.size,
      terrainKind: this.city.getTerrain(x, z),
      style: tile.style,
      damaged: tile.damaged,
      repairCost: repairCostOf(tile.type),
      locked: !this.city.isUnlocked(x, z),
      unlockCost: this.territoryUnlockCost(),
      territoryTokens: this.territoryTokens(),
      tokenSources: this.territoryTokenSources(),
      canUnlock:
        !this.city.isUnlocked(x, z) &&
        this.city.parcelCanUnlock(this.city.tileParcel(x, z).px, this.city.tileParcel(x, z).pz) &&
        this.territoryTokens() >= this.territoryUnlockCost(),
      capacity: capacityOf(tile.type, tile.level, tile.style),
      hasRoad,
      value: this.desirability[i],
      pollution: this.pollution[i],
      coverage: this.securityCoverage,
      education: this.educationCoverage,
      health: this.healthCoverage,
      food: this.foodCoverage,
      transit: this.transit[i],
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
      serviceServed: served,
      serviceCapacity: serviceCap,
      storedMaterials: tile.type === TileType.BuildYard ? this.materials.stockAt(x, z) : undefined,
      producer: def.makes || def.needsMaterial ? this.materials.producerStatusAt(this.city, x, z, this.hasPower) : undefined,
      exportKeep: tile.type === TileType.ExportTerminal ? this.materials.exportKeep : undefined,
      construction: this.constructionInfo(x, z),
    };
  }

  /** Ajusta el stock mínimo que la terminal conserva antes de exportar. */
  setExportKeep(value: number): void {
    this.materials.setExportKeep(value);
  }

  get exportKeep(): number {
    return this.materials.exportKeep;
  }

  /** Datos de la obra en (x,z), o undefined si no hay ninguna. */
  private constructionInfo(x: number, z: number): ConstructionInfo | undefined {
    const s = this.sites.get(this.siteKey(x, z));
    if (!s) return undefined;
    const def = TILE_DEF[s.target];
    const cost = def.cost;
    const okMoney = this.money >= cost;
    const okMaterials = this.buildMaterialsOk(s.x, s.z, s.size, s.target);
    // Para edificios con receta, expongo cuánto pide y cuánto hay disponible en
    // la red (corralones [+ reserva si no exige corralón]) → "tenés / necesitás".
    let have: Record<Material, number> | undefined;
    if (def.build) {
      have = this.materials.availableForBuild(this.city, s.x, s.z, s.size, !!def.needsYard);
    }
    return {
      target: s.target,
      targetLevel: s.targetLevel,
      status: s.status,
      progress: s.progress,
      duration: s.duration,
      cost,
      canStart: s.status === 'planned' && okMoney && okMaterials,
      reason: !okMoney ? 'Falta dinero' : !okMaterials ? 'Faltan materiales o un corralón conectado' : '',
      needs: def.build,
      have,
      needsYard: !!def.needsYard,
    };
  }

  /** Marcadores flotantes: obras por iniciar (▶️), en curso (🏗️) y sugerencias (💡). */
  getMarkers(): Marker[] {
    const out: Marker[] = [];
    // Toda obra: ▶️ si espera el OK, 🏗️ si está en construcción.
    for (const s of this.sites.values()) {
      out.push({ x: s.x, z: s.z, kind: s.status === 'planned' ? 'plan' : 'build' });
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
      if (this.mode === 'manual' && isZone(tile.type) && !tile.damaged && tile.level > 0 && tile.level < maxLevelOf(tile.type)) {
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

  /** Costo de mejorar un conjunto de casillas de carretera (solo las mejorables). */
  roadUpgradeCost(cells: Array<{ x: number; z: number }>): number {
    let cost = 0;
    for (const c of cells) {
      const t = this.city.getTile(c.x, c.z);
      if (t.type === TileType.Road && t.level < ROAD_MAX_LEVEL) cost += ROAD_UPGRADE_COST * (t.level + 1);
    }
    return cost;
  }

  /** Mejora SOLO las casillas de carretera dadas (tramo elegido a mano). */
  upgradeRoadCells(cells: Array<{ x: number; z: number }>): boolean {
    const cost = this.roadUpgradeCost(cells);
    if (cost <= 0 || this.money < cost) return false;
    this.money -= cost;
    for (const c of cells) {
      const t = this.city.getTile(c.x, c.z);
      if (t.type === TileType.Road && t.level < ROAD_MAX_LEVEL) this.city.setLevel(c.x, c.z, t.level + 1);
    }
    return true;
  }

  // --- Guardado / avisos ---

  serialize(): SimSave {
    return {
      money: this.money,
      month: this.month,
      mode: this.mode,
      unlocked: [...this.unlocked],
      science: this.science,
      disastersSurvived: this.disastersSurvived,
      territorySpent: this.territorySpent,
      territoryUnlocks: this.territoryUnlocks,
      materials: this.materials.serialize(),
      construction: [...this.sites.values()],
      disasters: this.disasters.serialize(),
    };
  }

  load(data: SimSave): void {
    this.money = data.money;
    this.month = data.month;
    this.mode = data.mode;
    this.unlocked = new Set(data.unlocked ?? []);
    this.science = data.science ?? 0;
    this.disastersSurvived = data.disastersSurvived ?? 0;
    this.territorySpent = data.territorySpent ?? 0;
    this.territoryUnlocks = data.territoryUnlocks ?? 0;
    this.materials.load(data.materials);
    this.sites.clear();
    for (const s of data.construction ?? []) this.sites.set(this.siteKey(s.x, s.z), s);
    this.disasters.load(data.disasters);
    this.refresh();
  }

  /** Reinicia a una ciudad nueva (mantiene el modo de juego). */
  reset(): void {
    this.money = START_MONEY;
    this.month = 0;
    this.science = 0;
    this.disastersSurvived = 0;
    this.territorySpent = 0;
    this.territoryUnlocks = 0;
    this.unlocked.clear();
    this.materials.reset();
    this.sites.clear();
    this.disasters.reset();
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
      case 'science':
        return this.science;
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
    if (this.disasters.burningCount > 0) {
      alerts.push({
        id: 'fire',
        icon: '🔥',
        text: `¡Incendio! ${this.disasters.burningCount} casilla(s) en llamas — hacen falta bomberos`,
        level: 'warn',
      });
    }
    // Lo contextual (productoras inactivas, falta de educación/salud/comida, demanda
    // RCI) ya se ve en la card del edificio o en las barras del HUD, así que NO se
    // repite acá: estos avisos quedan solo para lo crítico de toda la ciudad.
    return alerts;
  }

  /**
   * Qué "opina" el vecino de una casilla residencial habitada, según su entorno
   * (luz, tráfico, comida, salud, educación, seguridad, valor del suelo). Devuelve
   * el ánimo + una frase corta para mostrar en una burbuja; null si no aplica.
   */
  opinionAt(x: number, z: number): { mood: 'good' | 'bad'; text: string } | null {
    const tile = this.city.getTile(x, z);
    if (tile.type !== TileType.Residential || tile.level <= 0) return null;
    const i = z * this.city.width + x;
    const pollution = this.pollution[i] * RES_STYLE[tile.style].pollutionMul; // eco siente menos la contaminación
    const value = this.desirability[i] - pollution; // la contaminación baja el valor percibido
    const edu = this.educationCoverage; // coberturas globales (por población)
    const hea = this.healthCoverage;
    const foo = this.foodCoverage;
    const cov = this.securityCoverage;

    // Quejas (en orden de prioridad: lo más crítico primero).
    if (pollution >= POLLUTION_BLOCK) return { mood: 'bad', text: '¡Mucha contaminación! 🏭🤢' };
    if (!this.hasPower) return { mood: 'bad', text: '¡Necesitamos luz! ⚡' };
    let nearbyTraffic = 0;
    for (const [nx, nz] of [[x, z - 1], [x + 1, z], [x, z + 1], [x - 1, z]] as Array<[number, number]>) {
      if (this.city.inBounds(nx, nz)) nearbyTraffic = Math.max(nearbyTraffic, this.getCongestion(nx, nz));
    }
    if (nearbyTraffic > 1) return { mood: 'bad', text: '¡Hay mucho tráfico! 🚗' };
    if (foo < 0.25) return { mood: 'bad', text: 'Falta dónde comer 🍔' };
    if (hea < 0.25) return { mood: 'bad', text: 'Falta un hospital 🏥' };
    if (edu < 0.25) return { mood: 'bad', text: 'Falta una escuela 🎓' };
    if (cov < 0.25) return { mood: 'bad', text: 'Inseguro por acá 🚓' };
    if (pollution > 0.2) return { mood: 'bad', text: 'Hay olor a fábrica 😷' };
    if (value < 0.15) return { mood: 'bad', text: 'El barrio es aburrido 😕' };

    // Contento.
    const happy = value + (edu + hea + foo) / 3;
    if (happy > 1.1) return { mood: 'good', text: '¡Qué lindo vivir acá! 😍' };
    if (value > 0.5) return { mood: 'good', text: 'Me encanta el barrio 🌳' };
    return { mood: 'good', text: 'Todo bien por acá 🙂' };
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
    // Capacidad instalada de los servicios "por población" (seguridad/salud/educación/comida).
    let secCap = 0;
    let healthCap = 0;
    let eduCap = 0;
    let foodCap = 0;
    let research = 0; // ritmo de ciencia (puntos/mes) de laboratorios/observatorios/etc.
    let hero = false; // ¿hay un cuartel del héroe sano?
    let races = 0; // circuitos de carrera sanos

    this.city.forEach((tile, x, z) => {
      if (this.city.isSubCell(x, z)) return; // no contar dos veces un edificio multi-casilla
      if (tile.damaged) return; // una ruina no aporta nada hasta repararla
      const def = TILE_DEF[tile.type];
      upkeep += def.upkeep ?? 0;
      research += def.research ?? 0;
      if (def.hero) hero = true;
      if (def.raceTrack) races++;
      income += def.income ?? 0; // renta fija (casino, etc.)
      industrial += def.jobs ?? 0; // empleos de las fábricas
      commercial += def.shopJobs ?? 0; // empleos de negocios especializados
      secCap += def.service?.capacity ?? 0;
      healthCap += def.health?.capacity ?? 0;
      eduCap += def.education?.capacity ?? 0;
      foodCap += def.food?.capacity ?? 0;
      if (def.produces) {
        if (def.produces.kind === 'power') power += def.produces.amount;
        else if (def.produces.kind === 'water') water += def.produces.amount;
        else gas += def.produces.amount;
      }
      switch (tile.type) {
        case TileType.Residential:
          pop += capacityOf(tile.type, tile.level, tile.style);
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

    // Servicios básicos: los consumen las CASAS + los COMERCIOS + la INDUSTRIA
    // (no solo la población). Así, demoler edificios baja el consumo y libera red.
    // Las plantas hace falta tenerlas (si no, la ciudad no tiene ese suministro).
    this.powerSupply = power;
    this.waterSupply = water;
    this.gasSupply = gas;
    this.utilityDemand = pop + Math.round(0.5 * (commercial + industrial));
    const utilNeed = Math.max(1, this.utilityDemand);
    this.hasPower = power >= utilNeed;
    this.hasWater = water >= utilNeed;
    this.hasGas = gas >= utilNeed;

    // Cobertura por población: capacidad instalada / habitantes (toda la ciudad).
    const popNeed = Math.max(1, pop);
    this.securityCap = secCap;
    this.healthCap = healthCap;
    this.educationCap = eduCap;
    this.foodCap = foodCap;
    this.securityCoverage = Math.min(1, secCap / popNeed);
    this.healthCoverage = Math.min(1, healthCap / popNeed);
    this.educationCoverage = Math.min(1, eduCap / popNeed);
    this.foodCoverage = Math.min(1, foodCap / popNeed);

    // La investigación necesita energía: sin luz suficiente, los laboratorios no producen.
    this.researchRate = this.hasPower ? research : 0;
    this.hasHero = hero;
    this.raceTracks = races;
  }

  /**
   * Avanza los "días de evento" de carrera: si hay circuito, cada tanto se organiza
   * una carrera que dura unos meses (renta extra + ambiente). Se llama una vez por mes.
   */
  private advanceRaces(): void {
    if (this.raceTracks <= 0) {
      this.raceActive = false;
      this.raceMonthsLeft = 0;
      this.raceCooldown = 0;
      return;
    }
    if (this.raceActive) {
      if (--this.raceMonthsLeft <= 0) {
        this.raceActive = false;
        this.raceCooldown = RACE_INTERVAL;
      }
    } else if (--this.raceCooldown <= 0) {
      this.raceActive = true;
      this.raceMonthsLeft = RACE_DURATION;
      this.justStartedRace = true;
    }
  }

  /** ¿Arrancó una carrera desde la última llamada? (para el toast). */
  drainRaceStart(): boolean {
    const v = this.justStartedRace;
    this.justStartedRace = false;
    return v;
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

  /**
   * Reparte una influencia CUADRADA (con caída lineal) sobre un campo. Usa
   * distancia de Chebyshev (max de |dx|,|dz|) en vez de radial: así el área es un
   * cuadrado de lado 2·radio+1, que se puede teselar para cubrir zonas enteras.
   */
  private spread(field: number[], x: number, z: number, radius: number, strength: number): void {
    const w = this.city.width;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.city.inBounds(nx, nz)) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dz)); // Chebyshev → cobertura cuadrada
        field[nz * w + nx] += strength * (1 - dist / (radius + 1));
      }
    }
  }

  /** Habitantes que viven dentro del área cuadrada de un servicio (para saturarlo). */
  private populationInRadius(x: number, z: number, radius: number): number {
    let pop = 0;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.city.inBounds(nx, nz)) continue;
        const t = this.city.getTile(nx, nz);
        if (t.type === TileType.Residential && !t.damaged) pop += capacityOf(t.type, t.level, t.style);
      }
    }
    return pop;
  }

  /**
   * Campos ESPACIALES: valor del suelo (amenidades + vista al agua), alivio del
   * transporte público y contaminación de fábricas/centrales. Los servicios
   * (seguridad/salud/educación/comida) ya NO son espaciales: son por población
   * (se calculan en recount como capacidad/habitantes).
   */
  private computeInfluence(): void {
    this.desirability.fill(0);
    this.transit.fill(0);
    this.pollution.fill(0);
    this.city.forEach((tile, x, z) => {
      if (this.city.isSubCell(x, z)) return; // la influencia emana solo del ancla
      if (tile.damaged) return; // una ruina no emite influencia (ni contaminación)
      // Vista al agua: las casillas junto a un lago/río valen más (barrio premium).
      if (this.city.getTerrain(x, z) === 'water') {
        this.spread(this.desirability, x, z, WATER_AMENITY_RADIUS, WATER_AMENITY_STRENGTH);
      }
      const def = TILE_DEF[tile.type];
      if (def.amenity) {
        this.spread(this.desirability, x, z, def.amenity.radius, def.amenity.strength);
      }
      // Barrios premium (lujo/eco) irradian algo de valor del suelo a su alrededor.
      if (tile.type === TileType.Residential && tile.level > 0) {
        const lv = RES_STYLE[tile.style].landValue;
        if (lv > 0) this.spread(this.desirability, x, z, 2, lv);
      }
      // Transporte público: alivia el tráfico cercano (espacial, se satura por población).
      if (def.transit) {
        const factor = this.serviceLoadFactor(x, z, def.transit);
        this.spread(this.transit, x, z, def.transit.radius, def.transit.strength * factor);
      }
      // Contaminación: ensucia su área cuadrada (baja el valor del suelo y frena el crecimiento).
      if (def.pollution) {
        this.spread(this.pollution, x, z, def.pollution.radius, def.pollution.strength);
      }
    });
  }

  /** Bienestar global (promedio de educación, salud y comida por población). */
  private wellbeing(): number {
    return (this.educationCoverage + this.healthCoverage + this.foodCoverage) / 3;
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
        if (t.damaged) return; // una ruina no genera viajes
        // El transporte público cercano a la zona quita parte de sus viajes en auto.
        const relief = Math.min(TRANSIT_MAX_RELIEF, this.transit[cz * w + cx]);
        load += capacityOf(t.type, t.level, t.style) * (1 - relief);
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
    const i = z * this.city.width + x;
    const sec = this.securityCoverage; // cobertura de seguridad por población (global)
    let max = 1;
    // Nivel 2: la ciudad necesita energía + seguridad suficiente (policía/etc.).
    // Nivel 3: además agua y gas suficientes.
    if (this.hasPower && sec >= COVERAGE_FOR_L2) max = 2;
    if (this.hasPower && this.hasWater && this.hasGas && sec >= COVERAGE_FOR_L3) max = 3;
    const tile = this.city.getTile(x, z);
    const type = tile.type;
    // El estilo del barrio modula la contaminación percibida (eco resiste mucho mejor).
    const styleMul = type === TileType.Residential ? RES_STYLE[tile.style].pollutionMul : 1;
    const pollutionEff = this.pollution[i] * styleMul;
    // Rascacielos residenciales (niveles 4-5): partiendo del nivel 3, suben solo
    // donde el barrio es deseable (amenidades, descontando contaminación) y hay buen bienestar.
    if (type === TileType.Residential && max >= 3) {
      const value = this.desirability[i] - pollutionEff;
      const wb = this.wellbeing();
      if (value >= DESIRABILITY_FOR_L4 && wb >= WELLBEING_FOR_L4) max = 4;
      if (value >= DESIRABILITY_FOR_L5 && wb >= WELLBEING_FOR_L5) max = 5;
    }
    // Contaminación fuerte: frena el crecimiento (no se sube de nivel 1 en zona muy sucia).
    if (pollutionEff >= POLLUTION_BLOCK) max = 1;
    // Tope estructural del estilo (suburbio y eco/lujo no llegan a rascacielos).
    if (type === TileType.Residential) max = Math.min(max, RES_STYLE[tile.style].maxLevel);
    return Math.min(max, maxLevelOf(type));
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
      if (!isZone(tile.type) || tile.damaged) return; // las ruinas no crecen ni decaen
      if (this.sites.has(this.siteKey(x, z))) return; // ya hay una obra en curso acá

      const dem =
        tile.type === TileType.Residential
          ? residential
          : tile.type === TileType.Commercial
            ? commercial
            : industrial;

      // La contaminación resta valor; el estilo eco la siente mucho menos.
      const styleMul = tile.type === TileType.Residential ? RES_STYLE[tile.style].pollutionMul : 1;
      const value = this.desirability[z * w + x] - this.pollution[z * w + x] * styleMul;

      if (dem > DEMAND_THRESHOLD && this.city.hasRoadAccess(x, z)) {
        const maxLv = this.maxLevelFor(x, z);
        const tf = this.trafficFactor(x, z);
        // El bienestar (educación + salud + comida, por población) acelera el crecimiento.
        const wb = 1 + WELLBEING_GROWTH * this.wellbeing();
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

  /** ¿El bloque S×S con esquina (x,z) es todo industria a nivel máximo y con alguna calle al lado? */
  private isMergeableBlock(x: number, z: number, size = 2): boolean {
    let road = false;
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = x + dx;
        const cz = z + dz;
        if (!this.city.inBounds(cx, cz)) return false;
        const t = this.city.getTile(cx, cz);
        if (t.type !== TileType.Industrial || t.level < MAX_LEVEL || t.damaged) return false;
        if (this.city.hasRoadAccess(cx, cz)) road = true;
      }
    }
    return road;
  }

  /**
   * Crecimiento "a lo ancho": un bloque de industria a nivel máximo (con calle)
   * se consolida solo en una fábrica. Primero busca complejos 3×3 → fábrica
   * GRANDE; con lo que quede, bloques 2×2 → fábrica mediana. Reúno candidatos y
   * los aplico re-chequeando, porque una fusión cambia las casillas vecinas.
   */
  private mergeIndustry(): void {
    this.mergeBlocks(3, TileType.FactoryLarge);
    this.mergeBlocks(2, TileType.FactoryMedium);
  }

  /** Fusiona los bloques S×S de industria a nivel máximo en `factory` (S×S). */
  private mergeBlocks(size: number, factory: TileType): void {
    const candidates: Array<{ x: number; z: number }> = [];
    for (let z = 0; z < this.city.height - (size - 1); z++) {
      for (let x = 0; x < this.city.width - (size - 1); x++) {
        if (this.isMergeableBlock(x, z, size)) candidates.push({ x, z });
      }
    }
    for (const c of candidates) {
      if (!this.isMergeableBlock(c.x, c.z, size)) continue; // pudo haber cambiado por otra fusión
      if (Math.random() >= MERGE_CHANCE) continue;
      for (let dz = 0; dz < size; dz++) {
        for (let dx = 0; dx < size; dx++) this.city.setType(c.x + dx, c.z + dz, TileType.Empty);
      }
      this.city.placeBuilding(c.x, c.z, factory, size);
    }
  }

  private applyEconomy(): void {
    // Ingresos: impuesto a la renta (empleados) + impuesto a las empresas + rentas fijas.
    const income =
      this.employed * TAX_WORKER +
      this.commercialJobs * TAX_COMMERCE +
      this.industrialJobs * TAX_INDUSTRY +
      this.bonusIncome +
      this.materials.tradeIncome + // ventas + exportación de materiales
      (this.raceActive ? RACE_INCOME * this.raceTracks : 0); // renta de los días de carrera
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
        power: { supply: this.powerSupply, demand: this.utilityDemand },
        water: { supply: this.waterSupply, demand: this.utilityDemand },
        gas: { supply: this.gasSupply, demand: this.utilityDemand },
      },
      materials: {
        totals: this.materials.totals,
        produced: this.materials.produced,
        consumed: this.materials.consumed,
        idleProducers: this.materials.idleProducers,
        corralones: this.materials.corralonCount,
      },
      coverage: {
        security: this.securityCoverage,
        health: this.healthCoverage,
        education: this.educationCoverage,
        food: this.foodCoverage,
      },
      science: { total: Math.round(this.science), rate: this.researchRate },
      hero: { active: this.hasHero },
      race: { active: this.raceActive, tracks: this.raceTracks },
      territory: {
        tokens: this.territoryTokens(),
        unlocked: this.city.unlockedParcelCount(),
        total: this.city.parcelCols * this.city.parcelRows,
        nextCost: this.territoryUnlockCost(),
        sources: this.territoryTokenSources(),
      },
    };
  }
}
