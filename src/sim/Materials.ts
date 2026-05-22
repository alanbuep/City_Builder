// ---------------------------------------------------------------------------
// Cadena de materiales con LOGÍSTICA por red de calles. Engine-agnóstico.
//
// Modelo (v1):
//  - Cada CORRALÓN tiene su propio inventario de materiales (arena/cemento/ladrillo).
//  - Las PRODUCTORAS (arenera/cementera/ladrillería) producen hacia —y consumen
//    insumos de— los corralones conectados por CALLE (misma red). Sin corralón
//    conectado o sin energía, una productora queda inactiva.
//  - Construir un edificio con receta descuenta materiales de los corralones de
//    su red (y, para no trabar el arranque, de una RESERVA inicial de la ciudad,
//    salvo los edificios que exigen corralón —`needsYard`— que solo usan corralón).
// ---------------------------------------------------------------------------
import { City } from './City';
import { Material, MATERIALS, MaterialBag, TileType, TILE_DEF } from './types';

const START_RESERVE: Record<Material, number> = { arena: 80, cemento: 60, ladrillo: 60 };
const CORRALON_CAP = 300; // capacidad por material de cada corralón

export interface MaterialsSave {
  reserve: Record<Material, number>;
  corralones: Array<{ key: string; bag: Record<Material, number> }>;
}

function emptyBag(): Record<Material, number> {
  return { arena: 0, cemento: 0, ladrillo: 0 };
}

const keyOf = (x: number, z: number) => `${x},${z}`;

/**
 * Lleva el stock de materiales de la ciudad. Recalcula la red de calles cada
 * mes (flood-fill) para saber qué corralones/productoras están conectados.
 */
export class MaterialSystem {
  reserve: Record<Material, number> = { ...START_RESERVE };
  totals: Record<Material, number> = emptyBag(); // reserva + todos los corralones (para el HUD)
  idleProducers = 0; // productoras sin energía o sin corralón conectado

  private width: number;
  private height: number;
  private stock = new Map<string, Record<Material, number>>(); // por ancla de corralón
  private comp: Int32Array; // id de componente de red por casilla (-1 si no es calle)
  private byComp = new Map<number, string[]>(); // componente → corralones (claves de ancla)

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.comp = new Int32Array(width * height).fill(-1);
  }

  // --- Ciclo mensual ---

  tick(city: City, hasPower: boolean): void {
    this.labelRoads(city);
    this.syncCorralones(city);
    this.idleProducers = 0;

    city.forEach((tile, x, z) => {
      if (city.isSubCell(x, z)) return;
      const def = TILE_DEF[tile.type];
      if (!def.makes && !def.needsMaterial) return; // solo productoras

      const comp = this.componentOfFootprint(city, x, z, tile.size);
      if (comp < 0 || !hasPower) {
        this.idleProducers++;
        return;
      }
      // Consumir insumo (de los corralones de su red).
      if (def.needsMaterial) {
        if (!this.drawFromComp(comp, def.needsMaterial.material, def.needsMaterial.amount)) {
          this.idleProducers++;
          return;
        }
      }
      // Producir hacia los corralones de su red (lo que no entra, se pierde).
      if (def.makes) this.depositToComp(comp, def.makes.material, def.makes.amount);
    });

    this.recomputeTotals();
  }

  // --- Construcción ---

  /** Recalcula la red de calles y los corralones (para chequeos entre meses). */
  refreshNetwork(city: City): void {
    this.labelRoads(city);
    this.syncCorralones(city);
  }

  /** ¿Hay un corralón conectado por calle al footprint en (x,z)? */
  hasYardConnected(city: City, x: number, z: number, size: number): boolean {
    const comp = this.componentOfFootprint(city, x, z, size);
    return comp >= 0 && (this.byComp.get(comp)?.length ?? 0) > 0;
  }

  /** ¿Alcanzan los materiales para construir `recipe` en (x,z)? */
  canAffordBuild(city: City, x: number, z: number, size: number, recipe: MaterialBag, needsYard: boolean): boolean {
    const comp = this.componentOfFootprint(city, x, z, size);
    for (const m of MATERIALS) {
      const need = recipe[m] ?? 0;
      if (need <= 0) continue;
      const inYards = comp >= 0 ? this.compStock(comp, m) : 0;
      const avail = needsYard ? inYards : inYards + this.reserve[m];
      if (avail < need) return false;
    }
    return true;
  }

  /** Descuenta los materiales de la receta (corralones de la red; reserva si se permite). */
  payBuild(city: City, x: number, z: number, size: number, recipe: MaterialBag, needsYard: boolean): void {
    const comp = this.componentOfFootprint(city, x, z, size);
    for (const m of MATERIALS) {
      let need = recipe[m] ?? 0;
      if (need <= 0) continue;
      if (comp >= 0) need = this.takeFromComp(comp, m, need);
      if (!needsYard && need > 0) {
        const take = Math.min(this.reserve[m], need);
        this.reserve[m] -= take;
        need -= take;
      }
    }
    this.recomputeTotals();
  }

  /** Inventario almacenado en un corralón concreto (para el inspector). */
  stockAt(x: number, z: number): Record<Material, number> {
    return this.stock.get(keyOf(x, z)) ?? emptyBag();
  }

  // --- Guardado ---

  serialize(): MaterialsSave {
    return {
      reserve: { ...this.reserve },
      corralones: [...this.stock.entries()].map(([key, bag]) => ({ key, bag: { ...bag } })),
    };
  }

  load(data: MaterialsSave | undefined): void {
    this.reserve = data?.reserve ? { ...emptyBag(), ...data.reserve } : { ...START_RESERVE };
    this.stock.clear();
    for (const c of data?.corralones ?? []) this.stock.set(c.key, { ...emptyBag(), ...c.bag });
    this.recomputeTotals();
  }

  reset(): void {
    this.reserve = { ...START_RESERVE };
    this.stock.clear();
    this.recomputeTotals();
  }

  // --- Internos: red de calles e inventario ---

  /** Etiqueta cada calle con un id de componente conexo (flood-fill 4-vecinos). */
  private labelRoads(city: City): void {
    this.comp.fill(-1);
    let next = 0;
    const stack: number[] = [];
    for (let z = 0; z < this.height; z++) {
      for (let x = 0; x < this.width; x++) {
        const i = z * this.width + x;
        if (this.comp[i] !== -1) continue;
        if (city.getTile(x, z).type !== TileType.Road) continue;
        this.comp[i] = next;
        stack.push(i);
        while (stack.length) {
          const cur = stack.pop()!;
          const cx = cur % this.width;
          const cz = Math.floor(cur / this.width);
          const visit = (nx: number, nz: number) => {
            if (!city.inBounds(nx, nz)) return;
            const ni = nz * this.width + nx;
            if (this.comp[ni] !== -1) return;
            if (city.getTile(nx, nz).type !== TileType.Road) return;
            this.comp[ni] = next;
            stack.push(ni);
          };
          visit(cx + 1, cz);
          visit(cx - 1, cz);
          visit(cx, cz + 1);
          visit(cx, cz - 1);
        }
        next++;
      }
    }
  }

  /** Componente de calle al que toca el footprint S×S (−1 si no toca ninguna). */
  private componentOfFootprint(city: City, x: number, z: number, size: number): number {
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = x + dx;
        const cz = z + dz;
        const around = [
          [cx + 1, cz],
          [cx - 1, cz],
          [cx, cz + 1],
          [cx, cz - 1],
        ];
        for (const [nx, nz] of around) {
          if (!city.inBounds(nx, nz)) continue;
          const id = this.comp[nz * this.width + nx];
          if (id >= 0) return id;
        }
      }
    }
    return -1;
  }

  /** Asegura un inventario por cada corralón presente y descarta los demolidos. */
  private syncCorralones(city: City): void {
    const present = new Set<string>();
    this.byComp.clear();
    city.forEach((tile, x, z) => {
      if (tile.type !== TileType.BuildYard || city.isSubCell(x, z)) return;
      const k = keyOf(x, z);
      present.add(k);
      if (!this.stock.has(k)) this.stock.set(k, emptyBag());
      const comp = this.componentOfFootprint(city, x, z, tile.size);
      if (comp < 0) return;
      const list = this.byComp.get(comp) ?? [];
      list.push(k);
      this.byComp.set(comp, list);
    });
    for (const k of [...this.stock.keys()]) if (!present.has(k)) this.stock.delete(k);
  }

  private compStock(comp: number, m: Material): number {
    let sum = 0;
    for (const k of this.byComp.get(comp) ?? []) sum += this.stock.get(k)?.[m] ?? 0;
    return sum;
  }

  /** Quita hasta `amt` de un material repartido entre los corralones de la red; devuelve lo que faltó cubrir. */
  private takeFromComp(comp: number, m: Material, amt: number): number {
    for (const k of this.byComp.get(comp) ?? []) {
      if (amt <= 0) break;
      const bag = this.stock.get(k)!;
      const take = Math.min(bag[m], amt);
      bag[m] -= take;
      amt -= take;
    }
    return amt; // lo que NO se pudo sacar
  }

  /** Para productoras: consume `amt` solo si hay suficiente en la red. */
  private drawFromComp(comp: number, m: Material, amt: number): boolean {
    if (this.compStock(comp, m) < amt) return false;
    this.takeFromComp(comp, m, amt);
    return true;
  }

  /** Reparte `amt` producido entre los corralones de la red (respeta capacidad). */
  private depositToComp(comp: number, m: Material, amt: number): void {
    for (const k of this.byComp.get(comp) ?? []) {
      if (amt <= 0) break;
      const bag = this.stock.get(k)!;
      const room = CORRALON_CAP - bag[m];
      const put = Math.min(room, amt);
      bag[m] += put;
      amt -= put;
    }
  }

  private recomputeTotals(): void {
    const t = emptyBag();
    for (const m of MATERIALS) t[m] = this.reserve[m];
    for (const bag of this.stock.values()) for (const m of MATERIALS) t[m] += bag[m];
    this.totals = t;
  }
}
