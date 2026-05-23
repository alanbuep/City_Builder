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
import { Material, MATERIALS, MATERIAL_LABEL, MATERIAL_PRICE, MaterialBag, TileType, TILE_DEF, CORRALON_CAP } from './types';

// Reserva inicial ("empezar de cero"): alcanza para el kit básico y para levantar
// la propia cadena de materiales (arenera/cementera/ladrillería/corralón, que NO
// cuestan materiales). Después, todo se construye con lo que producen los corralones.
const START_RESERVE: Record<Material, number> = { arena: 80, cemento: 140, ladrillo: 160, madera: 80, acero: 0, electronica: 0 };
const RETAIL_RATE = 4; // cuánto vende una ferretería de cada material por mes
const EXPORT_MARGIN = 0.7; // exportar paga menos que la venta local
const DEFAULT_EXPORT_KEEP = 100; // stock mínimo a conservar antes de exportar

export interface MaterialsSave {
  reserve: Record<Material, number>;
  corralones: Array<{ key: string; bag: Record<Material, number> }>;
  exportKeep?: number;
}

function emptyBag(): Record<Material, number> {
  const bag = {} as Record<Material, number>;
  for (const m of MATERIALS) bag[m] = 0;
  return bag;
}

const keyOf = (x: number, z: number) => `${x},${z}`;

/**
 * Lleva el stock de materiales de la ciudad. Recalcula la red de calles cada
 * mes (flood-fill) para saber qué corralones/productoras están conectados.
 */
export class MaterialSystem {
  reserve: Record<Material, number> = { ...START_RESERVE };
  totals: Record<Material, number> = emptyBag(); // reserva + todos los corralones (para el HUD)
  produced: Record<Material, number> = emptyBag(); // producido este mes (ritmo, para el HUD)
  consumed: Record<Material, number> = emptyBag(); // consumido este mes: insumos de productoras + ventas/exportación
  idleProducers = 0; // productoras sin energía o sin corralón conectado
  tradeIncome = 0; // renta del mes por ventas (ferreterías) + exportación (terminales)
  exportKeep = DEFAULT_EXPORT_KEEP; // stock mínimo que la terminal conserva antes de exportar

  private width: number;
  private height: number;
  private stock = new Map<string, Record<Material, number>>(); // por ancla de corralón
  private comp: Int32Array; // id de componente de red por casilla (-1 si no es calle)
  private byComp = new Map<number, string[]>(); // componente → corralones (claves de ancla)

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.comp = new Int32Array(width * height).fill(-1);
    this.recomputeTotals(); // totales = reserva inicial (si no, el HUD muestra 0 hasta el primer mes)
  }

  // --- Ciclo mensual ---

  tick(city: City, hasPower: boolean): void {
    this.labelRoads(city);
    this.syncCorralones(city);
    this.idleProducers = 0;
    this.produced = emptyBag();
    this.consumed = emptyBag();

    city.forEach((tile, x, z) => {
      if (city.isSubCell(x, z)) return;
      const def = TILE_DEF[tile.type];
      if (!def.makes && !def.needsMaterial) return; // solo productoras

      const comp = this.componentOfFootprint(city, x, z, tile.size);
      const hasYard = comp >= 0 && (this.byComp.get(comp)?.length ?? 0) > 0;
      // Una productora necesita energía y un corralón conectado (dónde depositar).
      if (!hasYard || !hasPower) {
        this.idleProducers++;
        return;
      }
      // Consumir insumo: de los corralones de su red y, si falta, de la reserva.
      if (def.needsMaterial) {
        if (!this.drawInput(comp, def.needsMaterial.material, def.needsMaterial.amount)) {
          this.idleProducers++;
          return;
        }
        this.consumed[def.needsMaterial.material] += def.needsMaterial.amount;
      }
      // Producir hacia los corralones de su red (lo que no entra por falta de espacio, se pierde).
      if (def.makes) this.produced[def.makes.material] += this.depositToComp(comp, def.makes.material, def.makes.amount);
    });

    this.processTrade(city);
    this.recomputeTotals();
  }

  /** Define cuánto stock conservar antes de exportar (no baja de 0). */
  setExportKeep(value: number): void {
    this.exportKeep = Math.max(0, Math.round(value));
  }

  /**
   * Ventas y exportación del mes (consumen del corralón de la red, dan renta):
   *  1) Ferreterías: venden a la población (precio local).
   *  2) Terminales: exportan el excedente sobre `exportKeep` (precio de exportación).
   * Se procesa retail primero (la ciudad tiene prioridad), luego el excedente se exporta.
   */
  private processTrade(city: City): void {
    this.tradeIncome = 0;
    city.forEach((tile, x, z) => {
      if (city.isSubCell(x, z) || !TILE_DEF[tile.type].sellsMaterials) return;
      const comp = this.componentOfFootprint(city, x, z, tile.size);
      if (comp < 0) return;
      for (const m of MATERIALS) {
        const sold = Math.min(RETAIL_RATE, this.compStock(comp, m));
        if (sold > 0) {
          this.takeFromComp(comp, m, sold);
          this.consumed[m] += sold;
          this.tradeIncome += sold * MATERIAL_PRICE[m];
        }
      }
    });
    city.forEach((tile, x, z) => {
      if (city.isSubCell(x, z) || !TILE_DEF[tile.type].exportsMaterials) return;
      const comp = this.componentOfFootprint(city, x, z, tile.size);
      if (comp < 0) return;
      for (const m of MATERIALS) {
        const surplus = this.compStock(comp, m) - this.exportKeep;
        if (surplus > 0) {
          this.takeFromComp(comp, m, surplus);
          this.consumed[m] += surplus;
          this.tradeIncome += surplus * MATERIAL_PRICE[m] * EXPORT_MARGIN;
        }
      }
    });
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

  /** Cuánto hay disponible de cada material para construir en (x,z): corralones de la red (+ reserva si no exige corralón). */
  availableForBuild(city: City, x: number, z: number, size: number, needsYard: boolean): Record<Material, number> {
    const comp = this.componentOfFootprint(city, x, z, size);
    const out = emptyBag();
    for (const m of MATERIALS) {
      const inYards = comp >= 0 ? this.compStock(comp, m) : 0;
      out[m] = needsYard ? inYards : inYards + this.reserve[m];
    }
    return out;
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

  /** Cantidad de corralones de la ciudad (para mostrar capacidad de almacenamiento). */
  get corralonCount(): number {
    return this.stock.size;
  }

  /**
   * Estado de una productora en (x,z) para el inspector: si está produciendo y,
   * si no, por qué (sin corralón / sin energía / sin insumo).
   */
  producerStatusAt(city: City, x: number, z: number, hasPower: boolean): { active: boolean; reason: string } {
    const tile = city.getTile(x, z);
    const def = TILE_DEF[tile.type];
    if (!def.makes && !def.needsMaterial) return { active: false, reason: '' };
    this.refreshNetwork(city);
    const comp = this.componentOfFootprint(city, x, z, tile.size);
    const hasYard = comp >= 0 && (this.byComp.get(comp)?.length ?? 0) > 0;
    if (!hasYard) return { active: false, reason: 'Conectá un corralón por calle (ahí guarda lo que produce)' };
    if (!hasPower) return { active: false, reason: 'La ciudad no tiene suficiente energía' };
    if (def.needsMaterial) {
      const avail = this.compStock(comp, def.needsMaterial.material) + this.reserve[def.needsMaterial.material];
      if (avail < def.needsMaterial.amount) {
        return { active: false, reason: `Falta ${MATERIAL_LABEL[def.needsMaterial.material]}: sumá su productora` };
      }
    }
    // Produce pero el almacén está lleno de ese material → lo que fabrica se pierde.
    if (def.makes) {
      const keys = this.byComp.get(comp) ?? [];
      const room = keys.reduce((s, k) => s + (CORRALON_CAP - (this.stock.get(k)?.[def.makes!.material] ?? 0)), 0);
      if (room <= 0) {
        return { active: false, reason: `Almacén lleno de ${MATERIAL_LABEL[def.makes.material]}: se desperdicia (sumá un corralón o usá/vendé el material)` };
      }
    }
    return { active: true, reason: '' };
  }

  // --- Guardado ---

  serialize(): MaterialsSave {
    return {
      reserve: { ...this.reserve },
      corralones: [...this.stock.entries()].map(([key, bag]) => ({ key, bag: { ...bag } })),
      exportKeep: this.exportKeep,
    };
  }

  load(data: MaterialsSave | undefined): void {
    this.reserve = data?.reserve ? { ...emptyBag(), ...data.reserve } : { ...START_RESERVE };
    this.stock.clear();
    for (const c of data?.corralones ?? []) this.stock.set(c.key, { ...emptyBag(), ...c.bag });
    this.exportKeep = data?.exportKeep ?? DEFAULT_EXPORT_KEEP;
    this.recomputeTotals();
  }

  reset(): void {
    this.reserve = { ...START_RESERVE };
    this.stock.clear();
    this.exportKeep = DEFAULT_EXPORT_KEEP;
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

  /** Quita hasta `amt` de un material; del corralón MÁS lleno primero (mantiene el balance). Devuelve lo que faltó. */
  private takeFromComp(comp: number, m: Material, amt: number): number {
    const keys = [...(this.byComp.get(comp) ?? [])].sort((a, b) => this.stock.get(b)![m] - this.stock.get(a)![m]);
    for (const k of keys) {
      if (amt <= 0) break;
      const bag = this.stock.get(k)!;
      const take = Math.min(bag[m], amt);
      bag[m] -= take;
      amt -= take;
    }
    return amt; // lo que NO se pudo sacar
  }

  /**
   * Para productoras: consume `amt` de un insumo, de la red (corralón) y, si no
   * alcanza, de la reserva de la ciudad. Devuelve true solo si se cubrió el total.
   */
  private drawInput(comp: number, m: Material, amt: number): boolean {
    const fromYards = comp >= 0 ? this.compStock(comp, m) : 0;
    if (fromYards + this.reserve[m] < amt) return false;
    let need = comp >= 0 ? this.takeFromComp(comp, m, amt) : amt;
    if (need > 0) this.reserve[m] -= need;
    return true;
  }

  /** Reparte `amt` producido entre los corralones (el MÁS vacío primero, para llenarlos parejo). Devuelve cuánto entró. */
  private depositToComp(comp: number, m: Material, amt: number): number {
    const keys = [...(this.byComp.get(comp) ?? [])].sort((a, b) => this.stock.get(a)![m] - this.stock.get(b)![m]);
    let deposited = 0;
    for (const k of keys) {
      if (amt <= 0) break;
      const bag = this.stock.get(k)!;
      const room = CORRALON_CAP - bag[m];
      const put = Math.min(room, amt);
      bag[m] += put;
      amt -= put;
      deposited += put;
    }
    return deposited;
  }

  private recomputeTotals(): void {
    const t = emptyBag();
    for (const m of MATERIALS) t[m] = this.reserve[m];
    for (const bag of this.stock.values()) for (const m of MATERIALS) t[m] += bag[m];
    this.totals = t;
  }
}
