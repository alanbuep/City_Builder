import { TileType, Tile, MAX_LEVEL } from './types';

/**
 * El estado lógico de la ciudad: una cuadrícula de casillas.
 *
 * Casillas en un array plano; índice de (x, z) = `z*width + x`.
 * Convención: X = columnas, Z = filas (Y es la altura en el mundo 3D).
 *
 * Edificios multi-casilla: un edificio de tamaño S ocupa S×S casillas. La
 * casilla "ancla" (esquina sup-izq) guarda el tamaño; todas las casillas del
 * footprint apuntan al ancla vía `anchor`. Las consultas de simulación cuentan
 * solo el ancla (ver `isSubCell`) para no contar un edificio varias veces.
 */
export class City {
  readonly width: number;
  readonly height: number;
  private tiles: Tile[];
  private dirty = new Set<number>();

  constructor(width = 32, height = 32) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: width * height }, () => ({
      type: TileType.Empty,
      level: 0,
      anchor: null,
      size: 1,
    }));
  }

  inBounds(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.width && z < this.height;
  }

  private index(x: number, z: number): number {
    return z * this.width + x;
  }

  getTile(x: number, z: number): Tile {
    return this.tiles[this.index(x, z)];
  }

  /** ¿Es una casilla "secundaria" de un edificio multi-casilla (no el ancla)? */
  isSubCell(x: number, z: number): boolean {
    const t = this.getTile(x, z);
    return t.anchor !== null && (t.anchor.x !== x || t.anchor.z !== z);
  }

  /**
   * Coloca una casilla 1×1 (zonas, calles, demoler). Si la casilla pertenecía a
   * un edificio multi-casilla, primero demuele TODO ese edificio. Devuelve true
   * si hubo algún cambio.
   */
  setType(x: number, z: number, type: TileType): boolean {
    if (!this.inBounds(x, z)) return false;
    const cleared = this.clearBuildingAt(x, z);
    const tile = this.tiles[this.index(x, z)];
    if (tile.type === type && tile.anchor === null) return cleared;
    tile.type = type;
    tile.level = 0;
    tile.anchor = null;
    tile.size = 1;
    this.dirty.add(this.index(x, z));
    return true;
  }

  /**
   * Coloca un edificio de S×S con ancla en (x, z). Falla (devuelve false) si el
   * área se sale de la grilla o alguna casilla está ocupada.
   */
  placeBuilding(x: number, z: number, type: TileType, size: number): boolean {
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        if (!this.inBounds(x + dx, z + dz)) return false;
        if (this.getTile(x + dx, z + dz).type !== TileType.Empty) return false;
      }
    }
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = x + dx;
        const cz = z + dz;
        const tile = this.tiles[this.index(cx, cz)];
        tile.type = type;
        tile.level = 0;
        tile.anchor = { x, z };
        tile.size = size;
        this.dirty.add(this.index(cx, cz));
      }
    }
    return true;
  }

  /** Si (x,z) pertenece a un edificio multi-casilla, lo borra entero. */
  private clearBuildingAt(x: number, z: number): boolean {
    const tile = this.getTile(x, z);
    if (tile.anchor === null) return false;
    const { x: ax, z: az } = tile.anchor;
    const size = this.getTile(ax, az).size;
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        if (!this.inBounds(ax + dx, az + dz)) continue;
        const t = this.tiles[this.index(ax + dx, az + dz)];
        t.type = TileType.Empty;
        t.level = 0;
        t.anchor = null;
        t.size = 1;
        this.dirty.add(this.index(ax + dx, az + dz));
      }
    }
    return true;
  }

  setLevel(x: number, z: number, level: number): void {
    const tile = this.tiles[this.index(x, z)];
    const clamped = Math.max(0, Math.min(MAX_LEVEL, level));
    if (tile.level === clamped) return;
    tile.level = clamped;
    this.dirty.add(this.index(x, z));
  }

  hasRoadAccess(x: number, z: number): boolean {
    const isRoad = (cx: number, cz: number) =>
      this.inBounds(cx, cz) && this.getTile(cx, cz).type === TileType.Road;
    return isRoad(x + 1, z) || isRoad(x - 1, z) || isRoad(x, z + 1) || isRoad(x, z - 1);
  }

  forEach(callback: (tile: Tile, x: number, z: number) => void): void {
    for (let z = 0; z < this.height; z++) {
      for (let x = 0; x < this.width; x++) {
        callback(this.tiles[this.index(x, z)], x, z);
      }
    }
  }

  drainDirty(): Array<{ x: number; z: number }> {
    const result: Array<{ x: number; z: number }> = [];
    for (const i of this.dirty) {
      result.push({ x: i % this.width, z: Math.floor(i / this.width) });
    }
    this.dirty.clear();
    return result;
  }
}
