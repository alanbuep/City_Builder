import * as THREE from 'three';
import { City } from '../sim/City';
import { TileType, Tile, TILE_DEF, isZone, MAX_LEVEL } from '../sim/types';
import { GridSpec, tileCenterX, tileCenterZ } from '../grid';

const ROAD_HEIGHTS = [0.06, 0.1, 0.14]; // calle / avenida / autopista
const LOT_HEIGHT = 0.08; // solar zonificado sin construir
const HEIGHT_PER_LEVEL = 0.7; // crecimiento de edificios de zona por nivel

/** Crea un material de sprite con un emoji dentro de un círculo (para los marcadores). */
function emojiMaterial(emoji: string): THREE.SpriteMaterial {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '72px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 + 6);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
}

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

  // Marcadores flotantes (nubes de sugerencia / obras de zona).
  private markerGroup = new THREE.Group();
  private markerPool: THREE.Sprite[] = [];
  private markerMats: Record<'plan' | 'build' | 'upgrade', THREE.SpriteMaterial>;

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
      new THREE.BoxGeometry(grid.tileSize, 0.16, grid.tileSize),
      new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.6 }),
    );
    this.selected.visible = false;
    this.selected.renderOrder = 2;
    scene.add(this.selected);

    this.markerMats = { plan: emojiMaterial('▶️'), build: emojiMaterial('🏗️'), upgrade: emojiMaterial('💡') };
    scene.add(this.markerGroup);
  }

  /** Coloca/actualiza los marcadores flotantes (reutiliza un pool de sprites). */
  setMarkers(markers: Array<{ x: number; z: number; kind: 'plan' | 'build' | 'upgrade' }>): void {
    while (this.markerPool.length < markers.length) {
      const sprite = new THREE.Sprite(this.markerMats.upgrade);
      sprite.scale.set(0.8, 0.8, 0.8);
      sprite.renderOrder = 5;
      sprite.visible = false;
      this.markerGroup.add(sprite);
      this.markerPool.push(sprite);
    }
    for (let i = 0; i < this.markerPool.length; i++) {
      const sprite = this.markerPool[i];
      const m = markers[i];
      if (m) {
        sprite.material = this.markerMats[m.kind];
        sprite.position.set(tileCenterX(m.x, this.grid), 1.9, tileCenterZ(m.z, this.grid));
        sprite.visible = true;
      } else {
        sprite.visible = false;
      }
    }
  }

  /** Anima los resaltados (pulso de la selección). Se llama cada frame. */
  animate(timeMs: number): void {
    if (this.selected.visible) {
      const pulse = 0.45 + 0.3 * Math.sin(timeMs * 0.006);
      (this.selected.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
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
      let height = tile.level * HEIGHT_PER_LEVEL;
      let color = base;
      // Rascacielos residenciales: por encima del nivel base crecen mucho más por
      // nivel y se aclaran (efecto "torre de vidrio") para distinguirse a la vista.
      if (tile.type === TileType.Residential && tile.level > MAX_LEVEL) {
        const extra = tile.level - MAX_LEVEL;
        height = MAX_LEVEL * HEIGHT_PER_LEVEL + extra * HEIGHT_PER_LEVEL * 1.9;
        color = base.clone().lerp(this.white, 0.2 * extra);
      }
      return { color, height, opacity: 1 };
    }

    // Obra en construcción: cartel/andamio bajo y translúcido.
    if (tile.type === TileType.Construction) {
      return { color: new THREE.Color(TILE_DEF[TileType.Construction].color), height: 0.3, opacity: 0.7 };
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

  /**
   * Muestra el resaltado bajo el cursor. `size` = footprint del edificio a
   * colocar (para ver el área que ocupará); `mode` lo pinta verde (válido),
   * rojo (no se puede) o blanco (normal).
   */
  setHover(
    coord: { x: number; z: number } | null,
    size = 1,
    mode: 'normal' | 'valid' | 'invalid' = 'normal',
  ): void {
    if (!coord) {
      this.hover.visible = false;
      return;
    }
    const mat = this.hover.material as THREE.MeshBasicMaterial;
    mat.color.setHex(mode === 'valid' ? 0x66bb6a : mode === 'invalid' ? 0xef5350 : 0xffffff);
    mat.opacity = mode === 'normal' ? 0.35 : 0.5;
    this.hover.scale.set(size, 1, size);
    const cx = (tileCenterX(coord.x, this.grid) + tileCenterX(coord.x + size - 1, this.grid)) / 2;
    const cz = (tileCenterZ(coord.z, this.grid) + tileCenterZ(coord.z + size - 1, this.grid)) / 2;
    this.hover.position.set(cx, 0.02, cz);
    this.hover.visible = true;
  }

  /** Resalta una región rectangular (footprint de un edificio o tramo de calle). */
  setSelected(region: { x: number; z: number; w: number; h: number } | null): void {
    if (!region) {
      this.selected.visible = false;
      return;
    }
    this.selected.scale.set(region.w, 1, region.h);
    const cx = (tileCenterX(region.x, this.grid) + tileCenterX(region.x + region.w - 1, this.grid)) / 2;
    const cz = (tileCenterZ(region.z, this.grid) + tileCenterZ(region.z + region.h - 1, this.grid)) / 2;
    this.selected.position.set(cx, 0.08, cz);
    this.selected.visible = true;
  }
}
