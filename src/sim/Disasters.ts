import { City } from './City';
import { TileType, TILE_DEF, isZone } from './types';

/** Tipo de catástrofe. */
export type DisasterKind = 'fire' | 'meteor' | 'tornado' | 'hurricane';

/** Una casilla (resultado de una catástrofe: arrasada o incendiada). */
export interface Cell {
  x: number;
  z: number;
}

/** Resumen de lo que provocó una catástrofe instantánea (para FX + avisos). */
export interface StrikeResult {
  destroyed: Cell[]; // edificios arrasados (anclas)
  ignited: Cell[]; // focos de incendio nuevos
  path?: Cell[]; // recorrido (tornado), para animar la trompa
}

/** Estado de una casilla en llamas. */
interface Burning {
  heat: number; // 0..1: qué tan intenso es el fuego
  hot: number; // ticks seguidos al rojo vivo (para propagar)
  dmg: number; // ticks acumulados dañando el edificio (para destruirlo)
}

/** Una chimenea/foco de incendio guardado. */
export interface FireSave {
  x: number;
  z: number;
  heat: number;
  hot: number;
  dmg: number;
}
export interface DisasterSave {
  fires: FireSave[];
}

// --- Parámetros del fuego (por mes/tick) ---
const INITIAL_HEAT = 0.4;
const BURN_GROWTH = 0.2; // cuánto sube el fuego solo (sin bomberos)
const SUPPRESS_TOTAL = 0.6; // cuánto lo baja la cobertura TOTAL de bomberos
const DAMAGE_HEAT = 0.7; // por encima de esto, daña el edificio
const DESTROY_TICKS = 3; // ticks de daño para destruir el edificio
const SPREAD_HEAT = 0.9; // por encima de esto, puede prender vecinos
const SPREAD_AFTER = 1; // ticks al rojo vivo antes de propagarse

// --- Catástrofes instantáneas (meteorito / tornado / huracán) ---
const METEOR_DESTROY_R = 1; // radio (Chebyshev) de destrucción total en el cráter
const METEOR_FIRE_R = 2; // radio donde el impacto prende fuegos alrededor
const TORNADO_LEN = 12; // casillas que recorre la trompa
const TORNADO_DESTROY = 0.7; // prob. de arrasar el edificio de cada casilla del camino
const TORNADO_IGNITE = 0.25; // prob. de prender fuego en una casilla del camino
const TORNADO_WOBBLE = 0.45; // prob. de desviarse de lado en cada paso (serpentea)
const HURRICANE_DESTROY = 0.18; // prob. por edificio de ser arrasado por el huracán
const HURRICANE_IGNITE = 0.1; // prob. por edificio de incendiarse
const HERO_SUPPRESS = 0.5; // cuánto baja el fuego de CADA casilla el héroe (apaga incendios él solo)

/**
 * Sistema de catástrofes (engine-agnostic, sin Three.js). Hoy: INCENDIOS.
 *
 * Un incendio es un conjunto de casillas "en llamas" con un `heat` 0..1. Cada
 * mes el fuego crece solo, pero la cobertura de los BOMBEROS cercanos lo apaga.
 * Si queda desatendido: daña el edificio hasta destruirlo y se PROPAGA a las
 * casillas combustibles vecinas (determinista, como una ola — así es testeable;
 * la ignición al azar la decide quien llame, inyectando la función random).
 */
export class DisasterSystem {
  private w: number;
  private fires = new Map<number, Burning>();
  private destroyed: Array<{ x: number; z: number }> = []; // edificios destruidos (para avisar)
  private ignitedCount = 0; // focos nuevos desde el último drain
  heroActive = false; // si la ciudad tiene héroe, apaga incendios en toda la ciudad

  constructor(private city: City) {
    this.w = city.width;
  }

  private idx(x: number, z: number): number {
    return z * this.w + x;
  }

  /** ¿Hay fuego en esta casilla? */
  isBurning(x: number, z: number): boolean {
    return this.fires.has(this.idx(x, z));
  }

  /** Cantidad de casillas en llamas. */
  get burningCount(): number {
    return this.fires.size;
  }

  /** Casillas en llamas (para el render del fuego). */
  burningCells(): Array<{ x: number; z: number; heat: number }> {
    const out: Array<{ x: number; z: number; heat: number }> = [];
    for (const [i, b] of this.fires) {
      out.push({ x: i % this.w, z: Math.floor(i / this.w), heat: b.heat });
    }
    return out;
  }

  /** Edificios destruidos desde la última llamada (para toasts / contadores). */
  drainDestroyed(): Array<{ x: number; z: number }> {
    const out = this.destroyed;
    this.destroyed = [];
    return out;
  }

  /** Focos de incendio nuevos desde la última llamada. */
  drainIgnitions(): number {
    const n = this.ignitedCount;
    this.ignitedCount = 0;
    return n;
  }

  /** ¿Es combustible? edificios y zonas con nivel>0 (no agua/calle/vacío/solar/montaña/ruina). */
  private flammable(x: number, z: number): boolean {
    if (!this.city.inBounds(x, z)) return false;
    const ter = this.city.getTerrain(x, z);
    if (ter === 'water' || ter === 'mountain') return false; // tierra y playa sí arden
    const t = this.city.getTile(x, z);
    if (t.type === TileType.Empty || t.type === TileType.Road || t.type === TileType.Construction) return false;
    if (isZone(t.type) && t.level <= 0) return false; // solar zonificado sin construir
    // Una ruina (edificio ya dañado) no vuelve a arder ni a ser arrasada (el dato vive en el ancla).
    const ax = t.anchor ? t.anchor.x : x;
    const az = t.anchor ? t.anchor.z : z;
    if (this.city.getTile(ax, az).damaged) return false;
    return true;
  }

  /** Prende fuego en (x,z) si es combustible y no está ya ardiendo. */
  igniteAt(x: number, z: number): boolean {
    if (!this.flammable(x, z)) return false;
    const i = this.idx(x, z);
    if (this.fires.has(i)) return false;
    this.fires.set(i, { heat: INITIAL_HEAT, hot: 0, dmg: 0 });
    this.ignitedCount++;
    return true;
  }

  /**
   * Prende un incendio en una casilla combustible al azar. `rand` es la fuente de
   * aleatoriedad inyectada (Math.random en el juego; determinista en los tests).
   * Devuelve la casilla incendiada, o null si no había nada combustible.
   */
  igniteRandom(rand: () => number): { x: number; z: number } | null {
    const candidates: number[] = [];
    this.city.forEach((_t, x, z) => {
      if (this.flammable(x, z) && !this.fires.has(this.idx(x, z))) candidates.push(this.idx(x, z));
    });
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(rand() * candidates.length) % candidates.length];
    const x = pick % this.w;
    const z = Math.floor(pick / this.w);
    this.igniteAt(x, z);
    return { x, z };
  }

  /**
   * Arrasa el edificio que ocupa (x,z) si es combustible: lo resuelve a su ancla
   * (edificios multi-casilla), lo borra y lo agrega a `out`. `keys` evita destruir
   * dos veces el mismo edificio. No toca `this.destroyed` (eso es para el fuego).
   */
  private wreck(x: number, z: number, out: Cell[], keys: Set<number>): void {
    if (!this.flammable(x, z)) return;
    const t = this.city.getTile(x, z);
    const ax = t.anchor ? t.anchor.x : x;
    const az = t.anchor ? t.anchor.z : z;
    const key = this.idx(ax, az);
    if (keys.has(key)) return;
    keys.add(key);
    this.fires.delete(this.idx(x, z)); // apaga el fuego que hubiera (el resto lo limpia tick)
    this.city.setDamaged(ax, az, true); // queda como ruina reparable (no desaparece)
    out.push({ x: ax, z: az });
  }

  /**
   * Elige dónde caería un meteorito: preferentemente sobre un edificio (impacto
   * dramático); si no hay, sobre tierra al azar; en última instancia, el centro.
   */
  pickMeteorTarget(rand: () => number): Cell {
    const buildings: number[] = [];
    const land: number[] = [];
    this.city.forEach((_t, x, z) => {
      if (this.city.isSubCell(x, z)) return;
      if (this.flammable(x, z)) buildings.push(this.idx(x, z));
      else if (this.city.getTerrain(x, z) === 'land') land.push(this.idx(x, z));
    });
    const pool = buildings.length ? buildings : land;
    if (pool.length === 0) return { x: this.w >> 1, z: Math.floor(this.city.height / 2) };
    const pick = pool[Math.floor(rand() * pool.length) % pool.length];
    return { x: pick % this.w, z: Math.floor(pick / this.w) };
  }

  /**
   * METEORITO: destrucción total en el cráter (radio Chebyshev METEOR_DESTROY_R)
   * y un anillo de incendios alrededor (lo combustible que sobrevivió al borde).
   */
  strikeMeteor(x: number, z: number): StrikeResult {
    const destroyed: Cell[] = [];
    const ignited: Cell[] = [];
    const keys = new Set<number>();
    for (let dz = -METEOR_DESTROY_R; dz <= METEOR_DESTROY_R; dz++) {
      for (let dx = -METEOR_DESTROY_R; dx <= METEOR_DESTROY_R; dx++) {
        this.wreck(x + dx, z + dz, destroyed, keys);
      }
    }
    for (let dz = -METEOR_FIRE_R; dz <= METEOR_FIRE_R; dz++) {
      for (let dx = -METEOR_FIRE_R; dx <= METEOR_FIRE_R; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) <= METEOR_DESTROY_R) continue; // ya está arrasado
        if (this.igniteAt(x + dx, z + dz)) ignited.push({ x: x + dx, z: z + dz });
      }
    }
    return { destroyed, ignited };
  }

  /**
   * TORNADO: nace en un borde al azar y cruza el mapa serpenteando. En cada
   * casilla del camino arrasa el edificio (TORNADO_DESTROY) o, si no, lo incendia
   * (TORNADO_IGNITE). Devuelve el recorrido (para animar la trompa) + lo afectado.
   */
  spawnTornado(rand: () => number): StrikeResult {
    const W = this.w;
    const H = this.city.height;
    const horiz = rand() < 0.5;
    const dir = rand() < 0.5 ? 1 : -1;
    let cx: number;
    let cz: number;
    if (horiz) {
      cx = dir > 0 ? 0 : W - 1;
      cz = Math.floor(rand() * H) % H;
    } else {
      cz = dir > 0 ? 0 : H - 1;
      cx = Math.floor(rand() * W) % W;
    }

    const path: Cell[] = [];
    const destroyed: Cell[] = [];
    const ignited: Cell[] = [];
    const keys = new Set<number>();
    for (let i = 0; i < TORNADO_LEN; i++) {
      if (!this.city.inBounds(cx, cz)) break;
      path.push({ x: cx, z: cz });
      if (rand() < TORNADO_DESTROY) {
        this.wreck(cx, cz, destroyed, keys);
      } else if (rand() < TORNADO_IGNITE) {
        if (this.igniteAt(cx, cz)) ignited.push({ x: cx, z: cz });
      }
      // Avanza en el eje principal y, a veces, se desvía de lado.
      if (horiz) cx += dir;
      else cz += dir;
      if (rand() < TORNADO_WOBBLE) {
        if (horiz) cz += rand() < 0.5 ? 1 : -1;
        else cx += rand() < 0.5 ? 1 : -1;
      }
    }
    return { destroyed, ignited, path };
  }

  /**
   * HURACÁN: barre toda la ciudad. Cada edificio tiene una probabilidad de ser
   * arrasado y otra de incendiarse. Junta las anclas primero para no alterar el
   * recorrido al ir borrando edificios.
   */
  spawnHurricane(rand: () => number): StrikeResult {
    const targets: Cell[] = [];
    this.city.forEach((_t, x, z) => {
      if (!this.city.isSubCell(x, z) && this.flammable(x, z)) targets.push({ x, z });
    });
    const destroyed: Cell[] = [];
    const ignited: Cell[] = [];
    const keys = new Set<number>();
    for (const c of targets) {
      if (rand() < HURRICANE_DESTROY) {
        this.wreck(c.x, c.z, destroyed, keys);
      } else if (rand() < HURRICANE_IGNITE) {
        if (this.igniteAt(c.x, c.z)) ignited.push(c);
      }
    }
    return { destroyed, ignited };
  }

  /** Estaciones de bomberos activas (ancla + radio/fuerza de su cobertura). */
  private fireStations(): Array<{ x: number; z: number; radius: number; strength: number }> {
    const out: Array<{ x: number; z: number; radius: number; strength: number }> = [];
    const inf = TILE_DEF[TileType.Fire].service;
    if (!inf) return out;
    this.city.forEach((tile, x, z) => {
      if (tile.type === TileType.Fire && !this.city.isSubCell(x, z)) {
        out.push({ x, z, radius: inf.radius, strength: inf.strength });
      }
    });
    return out;
  }

  /** Cobertura de bomberos en (x,z): 0 (nada) .. 1 (apagado rápido). */
  private suppressionAt(
    stations: Array<{ x: number; z: number; radius: number; strength: number }>,
    x: number,
    z: number,
  ): number {
    let s = 0;
    for (const st of stations) {
      const d = Math.hypot(x - st.x, z - st.z);
      if (d <= st.radius) s = Math.max(s, st.strength * (1 - d / (st.radius + 1)));
    }
    return Math.min(1, s);
  }

  /** El fuego consume el edificio de (x,z): queda como ruina quemada (reparable). */
  private destroy(x: number, z: number): void {
    this.city.setDamaged(x, z, true); // ruina reparable, no se borra (incl. multi-casilla, vía ancla)
    this.destroyed.push({ x, z });
  }

  /** Avanza los incendios un mes: crecen, los apagan los bomberos, dañan y se propagan. */
  tick(): void {
    if (this.fires.size === 0) return;
    const stations = this.fireStations();
    const toIgnite: number[] = [];

    for (const [i, b] of this.fires) {
      const x = i % this.w;
      const z = Math.floor(i / this.w);

      // Si la casilla dejó de ser combustible (demolida/cambiada), se apaga.
      if (!this.flammable(x, z)) {
        this.fires.delete(i);
        continue;
      }

      const s = this.suppressionAt(stations, x, z);
      b.heat += BURN_GROWTH - SUPPRESS_TOTAL * s - (this.heroActive ? HERO_SUPPRESS : 0);
      if (b.heat <= 0) {
        this.fires.delete(i); // los bomberos lo apagaron
        continue;
      }
      if (b.heat > 1) b.heat = 1;

      // Daño: al rojo vivo, va destruyendo el edificio.
      if (b.heat >= DAMAGE_HEAT) {
        if (++b.dmg >= DESTROY_TICKS) {
          this.destroy(x, z);
          this.fires.delete(i);
          continue;
        }
      }

      // Propagación: si lleva suficiente al rojo vivo, prende los vecinos combustibles.
      if (b.heat >= SPREAD_HEAT) {
        if (++b.hot >= SPREAD_AFTER) {
          b.hot = 0;
          const neigh: Array<[number, number]> = [[x, z - 1], [x + 1, z], [x, z + 1], [x - 1, z]];
          for (const [nx, nz] of neigh) {
            if (this.flammable(nx, nz) && !this.fires.has(this.idx(nx, nz))) toIgnite.push(this.idx(nx, nz));
          }
        }
      } else {
        b.hot = 0;
      }
    }

    for (const i of toIgnite) {
      if (!this.fires.has(i)) {
        this.fires.set(i, { heat: INITIAL_HEAT, hot: 0, dmg: 0 });
        this.ignitedCount++;
      }
    }
  }

  /** Apaga todos los incendios (p. ej. al usar el héroe, o cheat de prueba). */
  extinguishAll(): void {
    this.fires.clear();
  }

  // --- Guardado / carga ---

  serialize(): DisasterSave {
    const fires: FireSave[] = [];
    for (const [i, b] of this.fires) {
      fires.push({ x: i % this.w, z: Math.floor(i / this.w), heat: b.heat, hot: b.hot, dmg: b.dmg });
    }
    return { fires };
  }

  load(data: DisasterSave | undefined): void {
    this.fires.clear();
    this.destroyed = [];
    this.ignitedCount = 0;
    for (const f of data?.fires ?? []) {
      if (this.city.inBounds(f.x, f.z)) this.fires.set(this.idx(f.x, f.z), { heat: f.heat, hot: f.hot, dmg: f.dmg });
    }
  }

  reset(): void {
    this.fires.clear();
    this.destroyed = [];
    this.ignitedCount = 0;
  }
}
