import { City } from './City';
import { TileType, TILE_DEF, isZone } from './types';

/** Tipo de catástrofe. Por ahora solo incendios; luego meteoritos/tornados/huracanes. */
export type DisasterKind = 'fire';

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

  /** ¿Es combustible? edificios y zonas con nivel>0 (no agua/calle/vacío/solar/montaña). */
  private flammable(x: number, z: number): boolean {
    if (!this.city.inBounds(x, z)) return false;
    if (this.city.getTerrain(x, z) !== 'land') return false;
    const t = this.city.getTile(x, z);
    if (t.type === TileType.Empty || t.type === TileType.Road || t.type === TileType.Construction) return false;
    if (isZone(t.type) && t.level <= 0) return false; // solar zonificado sin construir
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

  /** Destruye el edificio de (x,z): se quema por completo (queda el terreno libre). */
  private destroy(x: number, z: number): void {
    this.city.setType(x, z, TileType.Empty); // limpia el edificio entero (incl. multi-casilla)
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
      b.heat += BURN_GROWTH - SUPPRESS_TOTAL * s;
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
