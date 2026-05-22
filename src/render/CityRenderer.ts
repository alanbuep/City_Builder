import * as THREE from 'three';
import { City } from '../sim/City';
import { TileType, Tile, TILE_DEF, isZone } from '../sim/types';
import { GridSpec, tileCenterX, tileCenterZ } from '../grid';

const ROAD_HEIGHTS = [0.06, 0.1, 0.14]; // calle / avenida / autopista
const LOT_HEIGHT = 0.08; // solar zonificado sin construir
const HEIGHT_PER_LEVEL = 0.7; // crecimiento de edificios de zona por nivel

/**
 * Traduce el estado de la `City` a objetos 3D: un mesh por casilla visible,
 * más el suelo, la cuadrícula y los resaltados. Las carreteras se recolorean
 * en vivo según el tráfico (ver `refreshTraffic`).
 */
export class CityRenderer {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private hover: THREE.Mesh;
  private selected: THREE.Mesh;

  private cube = new THREE.BoxGeometry(1, 1, 1);
  private white = new THREE.Color(0xffffff);
  private roadLow = new THREE.Color(0x555555);
  private roadHigh = new THREE.Color(0xd32f2f);

  constructor(
    scene: THREE.Scene,
    private city: City,
    private grid: GridSpec,
  ) {
    scene.add(this.group);

    const groundSize = Math.max(city.width, city.height) * grid.tileSize;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({ color: 0x7cb342 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(city.width * grid.tileSize, city.width, 0x224422, 0x224422);
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.opacity = 0.25;
    gridMat.transparent = true;
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    this.hover = new THREE.Mesh(
      new THREE.BoxGeometry(grid.tileSize, 0.04, grid.tileSize),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
    );
    this.hover.visible = false;
    scene.add(this.hover);

    this.selected = new THREE.Mesh(
      new THREE.BoxGeometry(grid.tileSize, 0.05, grid.tileSize),
      new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.45 }),
    );
    this.selected.visible = false;
    scene.add(this.selected);
  }

  private key(x: number, z: number): string {
    return `${x},${z}`;
  }

  private appearance(tile: Tile): { color: THREE.Color; height: number; opacity: number } | null {
    if (tile.type === TileType.Empty) return null;

    if (tile.type === TileType.Road) {
      const h = ROAD_HEIGHTS[Math.min(tile.level, ROAD_HEIGHTS.length - 1)];
      return { color: new THREE.Color(TILE_DEF[TileType.Road].color), height: h, opacity: 1 };
    }

    if (isZone(tile.type)) {
      const base = new THREE.Color(TILE_DEF[tile.type].color);
      if (tile.level <= 0) {
        return { color: base.clone().lerp(this.white, 0.55), height: LOT_HEIGHT, opacity: 0.6 };
      }
      return { color: base, height: tile.level * HEIGHT_PER_LEVEL, opacity: 1 };
    }

    // Amenidades / servicios: altura fija definida en TILE_DEF.
    const def = TILE_DEF[tile.type];
    return { color: new THREE.Color(def.color), height: def.height ?? 0.5, opacity: 1 };
  }

  updateTile(x: number, z: number): void {
    const k = this.key(x, z);

    const old = this.meshes.get(k);
    if (old) {
      this.group.remove(old);
      (old.material as THREE.Material).dispose();
      this.meshes.delete(k);
    }

    // Las sub-celdas de un edificio multi-casilla no dibujan nada: solo el ancla.
    if (this.city.isSubCell(x, z)) return;

    const tile = this.city.getTile(x, z);
    const look = this.appearance(tile);
    if (!look) return;

    const size = tile.size;
    const base = tile.type === TileType.Road ? this.grid.tileSize : this.grid.tileSize * 0.9;
    const footprint = base + (size - 1) * this.grid.tileSize; // 1×1 = base; más grande crece por casilla

    const mesh = new THREE.Mesh(
      this.cube,
      new THREE.MeshStandardMaterial({
        color: look.color,
        transparent: look.opacity < 1,
        opacity: look.opacity,
      }),
    );
    mesh.scale.set(footprint, look.height, footprint);
    // Centro del footprint (para 1×1 es el centro de la casilla).
    const cx = (tileCenterX(x, this.grid) + tileCenterX(x + size - 1, this.grid)) / 2;
    const cz = (tileCenterZ(z, this.grid) + tileCenterZ(z + size - 1, this.grid)) / 2;
    mesh.position.set(cx, look.height / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.group.add(mesh);
    this.meshes.set(k, mesh);
  }

  /** Recolorea las carreteras según su congestión (gris = libre, rojo = saturada). */
  refreshTraffic(getCongestion: (x: number, z: number) => number): void {
    for (const [k, mesh] of this.meshes) {
      const comma = k.indexOf(',');
      const x = Number(k.slice(0, comma));
      const z = Number(k.slice(comma + 1));
      if (this.city.getTile(x, z).type !== TileType.Road) continue;
      const t = Math.min(1, getCongestion(x, z) / 1.5);
      (mesh.material as THREE.MeshStandardMaterial).color.copy(this.roadLow).lerp(this.roadHigh, t);
    }
  }

  setHover(coord: { x: number; z: number } | null): void {
    if (!coord) {
      this.hover.visible = false;
      return;
    }
    this.hover.position.set(tileCenterX(coord.x, this.grid), 0.02, tileCenterZ(coord.z, this.grid));
    this.hover.visible = true;
  }

  setSelected(coord: { x: number; z: number } | null): void {
    if (!coord) {
      this.selected.visible = false;
      return;
    }
    const size = this.city.getTile(coord.x, coord.z).size;
    this.selected.scale.set(size, 1, size);
    const cx = (tileCenterX(coord.x, this.grid) + tileCenterX(coord.x + size - 1, this.grid)) / 2;
    const cz = (tileCenterZ(coord.z, this.grid) + tileCenterZ(coord.z + size - 1, this.grid)) / 2;
    this.selected.position.set(cx, 0.03, cz);
    this.selected.visible = true;
  }
}
