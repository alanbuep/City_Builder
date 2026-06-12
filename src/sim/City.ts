import { TileType, Tile, TerrainKind, ResidentialStyle, RES_STYLE, maxLevelOf } from './types';

/** Una casilla construida, para guardar. Las vacías no se guardan. */
export interface TileSave {
  x: number;
  z: number;
  type: TileType;
  level: number;
  size: number;
  anchor: { x: number; z: number } | null;
  damaged?: boolean; // ruina por catástrofe (opcional: partidas viejas no lo tienen)
  style?: ResidentialStyle; // estilo del barrio residencial (opcional)
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
  parcels?: boolean[]; // territorio desbloqueado por parcela (opcional: viejas = todo abierto)
}

/** Lado (en casillas) de cada "parcela" de territorio que se desbloquea de a una. */
export const PARCEL = 8;

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
  // Territorio por parcelas: empieza con el centro abierto; el resto se desbloquea.
  private parcelUnlocked: boolean[] = [];

  constructor(width = 32, height = 32) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: width * height }, () => ({
      type: TileType.Empty,
      level: 0,
      anchor: null,
      size: 1,
      damaged: false,
      style: 'default',
    }));
    this.terrain = new Array(width * height).fill('land');
    this.initParcels();
  }

  // --- Territorio por parcelas (se desbloquea de a una) ---

  get parcelCols(): number {
    return Math.ceil(this.width / PARCEL);
  }
  get parcelRows(): number {
    return Math.ceil(this.height / PARCEL);
  }

  /**
   * Estado inicial: la MITAD izquierda del mapa abierta, con una FRANJA de parcelas
   * bloqueadas TODA HACIA UN COSTADO (el lado derecho/este) — el territorio a
   * conquistar. Vas expandiendo hacia ahí gastando fichas. Se bloquea ~la mitad de
   * las columnas (mín. 1). En grillas chicas (< 3 columnas) queda todo abierto.
   */
  private initParcels(): void {
    const cols = this.parcelCols;
    const rows = this.parcelRows;
    this.parcelUnlocked = new Array(cols * rows).fill(true);
    if (cols >= 3) {
      const lockedCols = Math.max(1, Math.floor(cols / 2));
      for (let pz = 0; pz < rows; pz++) {
        for (let px = cols - lockedCols; px < cols; px++) {
          this.parcelUnlocked[pz * cols + px] = false;
        }
      }
    }
  }

  private unlockAllParcels(): void {
    this.parcelUnlocked.fill(true);
  }

  /** La parcela (px,pz) a la que pertenece una casilla. */
  tileParcel(x: number, z: number): { px: number; pz: number } {
    return { px: Math.floor(x / PARCEL), pz: Math.floor(z / PARCEL) };
  }

  /** ¿La casilla está en territorio desbloqueado (se puede construir)? */
  isUnlocked(x: number, z: number): boolean {
    if (!this.inBounds(x, z)) return false;
    const { px, pz } = this.tileParcel(x, z);
    return this.parcelUnlocked[pz * this.parcelCols + px];
  }

  isParcelUnlocked(px: number, pz: number): boolean {
    if (px < 0 || pz < 0 || px >= this.parcelCols || pz >= this.parcelRows) return false;
    return this.parcelUnlocked[pz * this.parcelCols + px];
  }

  /** ¿Se puede desbloquear esta parcela? (bloqueada y pegada a una ya abierta). */
  parcelCanUnlock(px: number, pz: number): boolean {
    if (this.isParcelUnlocked(px, pz)) return false;
    if (px < 0 || pz < 0 || px >= this.parcelCols || pz >= this.parcelRows) return false;
    return (
      this.isParcelUnlocked(px - 1, pz) ||
      this.isParcelUnlocked(px + 1, pz) ||
      this.isParcelUnlocked(px, pz - 1) ||
      this.isParcelUnlocked(px, pz + 1)
    );
  }

  /** Abre una parcela y marca sus casillas para redibujar. */
  unlockParcel(px: number, pz: number): void {
    if (px < 0 || pz < 0 || px >= this.parcelCols || pz >= this.parcelRows) return;
    this.parcelUnlocked[pz * this.parcelCols + px] = true;
    const r = this.parcelRegion(px, pz);
    for (let z = r.z; z < r.z + r.h; z++) {
      for (let x = r.x; x < r.x + r.w; x++) this.dirty.add(this.index(x, z));
    }
  }

  unlockedParcelCount(): number {
    return this.parcelUnlocked.reduce((n, u) => n + (u ? 1 : 0), 0);
  }

  /** Región de casillas (clampeada al mapa) que ocupa una parcela. */
  parcelRegion(px: number, pz: number): { x: number; z: number; w: number; h: number } {
    const x = px * PARCEL;
    const z = pz * PARCEL;
    return { x, z, w: Math.min(PARCEL, this.width - x), h: Math.min(PARCEL, this.height - z) };
  }

  /** Regiones (de casillas) de todas las parcelas bloqueadas (para el render). */
  lockedRegions(): Array<{ x: number; z: number; w: number; h: number }> {
    const out: Array<{ x: number; z: number; w: number; h: number }> = [];
    for (let pz = 0; pz < this.parcelRows; pz++) {
      for (let px = 0; px < this.parcelCols; px++) {
        if (!this.isParcelUnlocked(px, pz)) out.push(this.parcelRegion(px, pz));
      }
    }
    return out;
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

  /** ¿Se puede construir en esta casilla? (sí en tierra y playa; no en agua ni montaña). */
  isBuildable(x: number, z: number): boolean {
    if (!this.inBounds(x, z)) return false;
    const t = this.terrain[this.index(x, z)];
    return t === 'land' || t === 'beach';
  }

  /** ¿El footprint S×S toca agua en algún borde? (para represas/puertos que exigen mar). */
  isNextToWater(x: number, z: number, size = 1): boolean {
    for (let dz = -1; dz <= size; dz++) {
      for (let dx = -1; dx <= size; dx++) {
        const inFootprint = dx >= 0 && dx < size && dz >= 0 && dz < size;
        if (inFootprint) continue; // solo el anillo de alrededor
        const cx = x + dx;
        const cz = z + dz;
        if (this.inBounds(cx, cz) && this.terrain[this.index(cx, cz)] === 'water') return true;
      }
    }
    return false;
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
    tile.damaged = false;
    tile.style = 'default';
    this.dirty.add(this.index(x, z));
    return true;
  }

  /** Cambia el estilo de un barrio residencial (recortando el nivel al tope del estilo). */
  setResidentialStyle(x: number, z: number, style: ResidentialStyle): void {
    if (!this.inBounds(x, z)) return;
    const tile = this.tiles[this.index(x, z)];
    if (tile.type !== TileType.Residential) return;
    if (tile.style === style) return;
    tile.style = style;
    if (tile.level > RES_STYLE[style].maxLevel) tile.level = RES_STYLE[style].maxLevel;
    this.dirty.add(this.index(x, z));
  }

  /**
   * Marca (o cura) como DAÑADO el edificio que ocupa (x,z) — lo resuelve a su
   * ancla, así un edificio multi-casilla queda dañado entero. Redibuja todo su
   * footprint. Un edificio dañado no funciona hasta repararlo o demolerlo.
   */
  setDamaged(x: number, z: number, damaged: boolean): void {
    if (!this.inBounds(x, z)) return;
    const t = this.getTile(x, z);
    const ax = t.anchor ? t.anchor.x : x;
    const az = t.anchor ? t.anchor.z : z;
    const anchor = this.getTile(ax, az);
    if (anchor.type === TileType.Empty || anchor.damaged === damaged) return;
    anchor.damaged = damaged;
    const size = anchor.size;
    for (let dz = 0; dz < size; dz++) {
      for (let dx = 0; dx < size; dx++) {
        if (this.inBounds(ax + dx, az + dz)) this.dirty.add(this.index(ax + dx, az + dz));
      }
    }
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
        tile.damaged = false;
        tile.style = 'default';
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
        t.damaged = false;
        t.style = 'default';
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
        tiles.push({ x, z, type: tile.type, level: tile.level, size: tile.size, anchor: tile.anchor, damaged: tile.damaged, style: tile.style });
      }
      const k = this.terrain[this.index(x, z)];
      if (k !== 'land') terrain.push({ x, z, kind: k });
    });
    return { width: this.width, height: this.height, tiles, terrain, parcels: [...this.parcelUnlocked] };
  }

  /** Vacía toda la grilla y el terreno (y marca todo para redibujar). */
  clear(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      t.type = TileType.Empty;
      t.level = 0;
      t.anchor = null;
      t.size = 1;
      t.damaged = false;
      t.style = 'default';
      this.terrain[i] = 'land';
      this.dirty.add(i);
    }
    this.initParcels(); // ciudad nueva: solo el centro abierto
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
      tile.damaged = t.damaged ?? false;
      tile.style = t.style ?? 'default';
      this.dirty.add(this.index(t.x, t.z));
    }
    for (const t of data.terrain ?? []) {
      if (!this.inBounds(t.x, t.z)) continue;
      this.terrain[this.index(t.x, t.z)] = t.kind;
      this.dirty.add(this.index(t.x, t.z));
    }
    if (data.parcels && data.parcels.length === this.parcelUnlocked.length) {
      this.parcelUnlocked = [...data.parcels];
    } else {
      this.unlockAllParcels(); // partidas viejas (sin parcelas) = todo abierto
    }
  }
}
