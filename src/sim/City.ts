import { TileType, Tile, TerrainKind, maxLevelOf } from './types';

/** Una casilla construida, para guardar. Las vacías no se guardan. */
export interface TileSave {
  x: number;
  z: number;
  type: TileType;
  level: number;
  size: number;
  anchor: { x: number; z: number } | null;
}

/** Una casilla con terreno no normal (agua/montaña), para guardar. */
export interface TerrainSave {
  x: number;
  z: number;
  kind: TerrainKind;
}

/** La ciudad serializada (solo las casillas no vacías + el terreno no normal). */
export interface CitySave {
  width: number;
  height: number;
  tiles: TileSave[];
  terrain?: TerrainSave[]; // opcional: las partidas viejas no lo tienen (todo 'land')
}

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
  private terrain: TerrainKind[];
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
    this.terrain = new Array(width * height).fill('land');
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

  /** Tipo de terreno de la casilla ('land' por defecto). */
  getTerrain(x: number, z: number): TerrainKind {
    return this.terrain[this.index(x, z)];
  }

  /** ¿Se puede construir en esta casilla? (no en agua ni montaña). */
  isBuildable(x: number, z: number): boolean {
    return this.inBounds(x, z) && this.terrain[this.index(x, z)] === 'land';
  }

  /** Cambia el terreno de una casilla (y la marca para redibujar). */
  setTerrain(x: number, z: number, kind: TerrainKind): void {
    if (!this.inBounds(x, z)) return;
    const i = this.index(x, z);
    if (this.terrain[i] === kind) return;
    this.terrain[i] = kind;
    this.dirty.add(i);
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
    const clamped = Math.max(0, Math.min(maxLevelOf(tile.type), level));
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

  // --- Guardado / carga ---

  /** Guarda solo las casillas no vacías + el terreno no normal (agua/montaña). */
  serialize(): CitySave {
    const tiles: TileSave[] = [];
    const terrain: TerrainSave[] = [];
    this.forEach((tile, x, z) => {
      if (tile.type !== TileType.Empty) {
        tiles.push({ x, z, type: tile.type, level: tile.level, size: tile.size, anchor: tile.anchor });
      }
      const k = this.terrain[this.index(x, z)];
      if (k !== 'land') terrain.push({ x, z, kind: k });
    });
    return { width: this.width, height: this.height, tiles, terrain };
  }

  /** Vacía toda la grilla y el terreno (y marca todo para redibujar). */
  clear(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      t.type = TileType.Empty;
      t.level = 0;
      t.anchor = null;
      t.size = 1;
      this.terrain[i] = 'land';
      this.dirty.add(i);
    }
  }

  /** Reemplaza el contenido por una ciudad guardada. */
  load(data: CitySave): void {
    this.clear();
    for (const t of data.tiles) {
      if (!this.inBounds(t.x, t.z)) continue;
      const tile = this.tiles[this.index(t.x, t.z)];
      tile.type = t.type;
      tile.level = t.level;
      tile.size = t.size ?? 1;
      tile.anchor = t.anchor ?? null;
      this.dirty.add(this.index(t.x, t.z));
    }
    for (const t of data.terrain ?? []) {
      if (!this.inBounds(t.x, t.z)) continue;
      this.terrain[this.index(t.x, t.z)] = t.kind;
      this.dirty.add(this.index(t.x, t.z));
    }
  }
}
