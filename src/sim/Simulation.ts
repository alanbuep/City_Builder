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

// --- Parámetros de la simulación ---
const CHILD_RATIO = 0.25;
const BASE_HOUSING_DEMAND = 12;
const COMMERCE_PER_CAPITA = 0.3;
const INDUSTRY_PER_CAPITA = 0.2;
const INDUSTRY_PER_COMMERCE = 0.6;
const DEMAND_SCALE = 30;
const DEMAND_THRESHOLD = 0.05;
const GROW_CHANCE = 0.25;
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
      maxLevel,
      canUpgrade,
      upgradeCost,
      traffic: this.traffic[i],
      roadCapacity,
      congestion: isRoad ? this.traffic[i] / roadCapacity : 0,
      roadSegmentSize: segmentSize,
      serviceServed: def.service ? this.populationInRadius(x, z, def.service.radius) : 0,
      serviceCapacity: def.service?.capacity ?? 0,
    };
  }

  getCongestion(x: number, z: number): number {
    const tile = this.city.getTile(x, z);
    if (tile.type !== TileType.Road) return 0;
    const cap = ROAD_CAPACITY[Math.min(tile.level, ROAD_CAPACITY.length - 1)];
    return this.traffic[z * this.city.width + x] / cap;
  }

  // --- Cálculos internos ---

  private recount(): void {
    let pop = 0;
    let commercial = 0;
    let industrial = 0;
    let upkeep = 0;

    this.city.forEach((tile, x, z) => {
      if (this.city.isSubCell(x, z)) return; // no contar dos veces un edificio multi-casilla
      upkeep += TILE_DEF[tile.type].upkeep ?? 0;
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
    });
  }

  private maxLevelFor(x: number, z: number): number {
    const cov = this.coverage[z * this.city.width + x];
    let max = 1;
    if (cov >= COVERAGE_FOR_L2) max = 2;
    if (cov >= COVERAGE_FOR_L3) max = 3;
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

  /** Casillas de carretera conectadas (ortogonalmente) del MISMO nivel. */
  private roadSegment(x: number, z: number): Array<{ x: number; z: number }> {
    const start = this.city.getTile(x, z);
    if (start.type !== TileType.Road) return [];
    const level = start.level;
    const w = this.city.width;
    const out: Array<{ x: number; z: number }> = [];
    const seen = new Set<number>([z * w + x]);
    const stack: Array<{ x: number; z: number }> = [{ x, z }];

    while (stack.length) {
      const c = stack.pop()!;
      out.push(c);
      const neighbors = [
        { x: c.x + 1, z: c.z },
        { x: c.x - 1, z: c.z },
        { x: c.x, z: c.z + 1 },
        { x: c.x, z: c.z - 1 },
      ];
      for (const n of neighbors) {
        if (!this.city.inBounds(n.x, n.z)) continue;
        const key = n.z * w + n.x;
        if (seen.has(key)) continue;
        const t = this.city.getTile(n.x, n.z);
        if (t.type === TileType.Road && t.level === level) {
          seen.add(key);
          stack.push(n);
        }
      }
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
    };
  }
}
