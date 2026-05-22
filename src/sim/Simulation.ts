import { City } from './City';
import {
  TileType,
  TILE_DEF,
  Influence,
  isZone,
  capacityOf,
  MAX_LEVEL,
  ROAD_MAX_LEVEL,
  ROAD_CAPACITY,
} from './types';

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
  cityHasPower: boolean; // ¿la ciudad produce suficiente energía?
  cityHasWater: boolean;
  cityHasGas: boolean;
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
  private traffic: number[];

  constructor(private city: City) {
    const n = city.width * city.height;
    this.desirability = new Array(n).fill(0);
    this.coverage = new Array(n).fill(0);
    this.traffic = new Array(n).fill(0);
  }

  get jobs(): number {
    return this.commercialJobs + this.industrialJobs;
  }

  get unemploymentRate(): number {
    return this.adults > 0 ? this.unemployed / this.adults : 0;
  }

  tick(): void {
    this.recount();
    this.computeDemographics();
    this.computeDemand();
    this.computeInfluence();
    this.computeTraffic();
    if (this.mode === 'auto') this.develop();
    this.recount();
    this.computeDemographics();
    this.applyEconomy();
    this.month++;
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
    if (!this.spend(UPGRADE_BASE_COST * (tile.level + 1))) return false;

    this.city.setLevel(x, z, tile.level + 1);
    this.recount();
    this.computeDemographics();
    return true;
  }

  inspect(x: number, z: number): TileInfo {
    const tile = this.city.getTile(x, z);
    const def = TILE_DEF[tile.type];
    const serviceInf = def.service; // policía/bomberos/gobierno atienden población
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
    };
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
    return { money: this.money, month: this.month, mode: this.mode };
  }

  load(data: SimSave): void {
    this.money = data.money;
    this.month = data.month;
    this.mode = data.mode;
    this.refresh();
  }

  /** Reinicia a una ciudad nueva (mantiene el modo de juego). */
  reset(): void {
    this.money = START_MONEY;
    this.month = 0;
    this.refresh();
  }

  /** Recalcula todo el estado derivado (tras cargar o limpiar la ciudad). */
  refresh(): void {
    this.recount();
    this.computeDemographics();
    this.computeDemand();
    this.computeInfluence();
    this.computeTraffic();
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
    let power = 0;
    let water = 0;
    let gas = 0;

    this.city.forEach((tile, x, z) => {
      if (this.city.isSubCell(x, z)) return; // no contar dos veces un edificio multi-casilla
      const def = TILE_DEF[tile.type];
      upkeep += def.upkeep ?? 0;
      industrial += def.jobs ?? 0; // empleos de las fábricas
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

  /** Valor del suelo (amenidades) y cobertura de servicios (área + población). */
  private computeInfluence(): void {
    this.desirability.fill(0);
    this.coverage.fill(0);
    this.city.forEach((tile, x, z) => {
      if (this.city.isSubCell(x, z)) return; // la influencia emana solo del ancla
      const def = TILE_DEF[tile.type];
      if (def.amenity) {
        this.spread(this.desirability, x, z, def.amenity.radius, def.amenity.strength);
      }
      if (def.service) {
        const factor = this.serviceLoadFactor(x, z, def.service);
        this.spread(this.coverage, x, z, def.service.radius, def.service.strength * factor);
      }
    });
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
        if (tile.level < maxLv && Math.random() < GROW_CHANCE * dem * (1 + value) * tf) {
          this.city.setLevel(x, z, tile.level + 1);
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
    // Ingresos: impuesto a la renta (empleados) + impuesto a las empresas.
    const income =
      this.employed * TAX_WORKER +
      this.commercialJobs * TAX_COMMERCE +
      this.industrialJobs * TAX_INDUSTRY;
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
    };
  }
}
