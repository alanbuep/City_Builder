import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { City } from '../sim/City';
import { TileType } from '../sim/types';
import { GridSpec, tileCenterX, tileCenterZ } from '../grid';

/**
 * Vida en las calles: autitos que circulan por la red vial (doblan en los
 * cruces, manejan por la derecha) y peatones que pasean por las veredas.
 * Todo con DOS InstancedMesh (uno autos, otro peatones) para que el costo de
 * dibujado sea mínimo aunque haya decenas de agentes. La cantidad escala con
 * el tamaño de la red y la población.
 */

const MAX_CARS = 48;
const MAX_PEDS = 32;
const CAR_SPEED = 1.5; // casillas por segundo
const PED_SPEED = 0.3;
const CAR_Y = 0.12;
const PED_Y = 0.1;
const LANE = 0.17; // mano derecha (distancia al eje de la calle)
const SIDEWALK = 0.36; // vereda (borde de la casilla)
const RESCAN_S = 2; // cada cuánto re-escanear la red de calles
const KEEP_STRAIGHT = 0.65; // probabilidad de seguir derecho en un cruce

const CAR_COLORS = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xf4511e, 0x8e24aa, 0xeceff1, 0x37474f];
const PED_COLORS = [0xffcc80, 0x90caf9, 0xa5d6a7, 0xf48fb1, 0xfff59d, 0xb39ddb, 0xffab91];

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

interface Agent {
  active: boolean;
  x: number; // casilla actual
  z: number;
  dx: number; // dirección (eje)
  dz: number;
  t: number; // avance 0..1 dentro de la casilla
  speed: number;
  side: number; // peatones: de qué lado de la calle caminan (±1)
  color: THREE.Color; // se asigna al aparecer (estable mientras circula)
}

export class TrafficFx {
  private cars: THREE.InstancedMesh;
  private peds: THREE.InstancedMesh;
  private carAgents: Agent[] = [];
  private pedAgents: Agent[] = [];
  private roads: Array<{ x: number; z: number }> = [];
  private rescanIn = 0;
  private population = 0;
  private dummy = new THREE.Object3D();

  constructor(
    private scene: THREE.Scene,
    private city: City,
    private grid: GridSpec,
  ) {
    const carGeo = new THREE.BoxGeometry(0.34, 0.1, 0.17);
    carGeo.translate(0, 0.05, 0);
    this.cars = new THREE.InstancedMesh(carGeo, new THREE.MeshLambertMaterial(), MAX_CARS);
    this.cars.count = 0;
    this.cars.frustumCulled = false;
    scene.add(this.cars);

    const pedGeo = new THREE.BoxGeometry(0.07, 0.17, 0.07);
    pedGeo.translate(0, 0.085, 0);
    this.peds = new THREE.InstancedMesh(pedGeo, new THREE.MeshLambertMaterial(), MAX_PEDS);
    this.peds.count = 0;
    this.peds.frustumCulled = false;
    scene.add(this.peds);

    for (let i = 0; i < MAX_CARS; i++) this.carAgents.push(this.blank(CAR_SPEED));
    for (let i = 0; i < MAX_PEDS; i++) this.pedAgents.push(this.blank(PED_SPEED));

    // Modelos lindos (si existen): reemplazan a las cajas apenas cargan.
    const loader = new GLTFLoader();
    this.upgradeMesh(loader, 'car_small', 0.34, 'x', MAX_CARS, (m) => (this.cars = m), () => this.cars);
    this.upgradeMesh(loader, 'person', 0.22, 'y', MAX_PEDS, (m) => (this.peds = m), () => this.peds);
  }

  /**
   * Carga `models/<file>.glb`, lo normaliza (centrado, base en y=0, tamaño objetivo
   * sobre el eje dado — el frente es +X por convención) y reemplaza el InstancedMesh
   * de cajas conservando el pool y el teñido por instancia. Si falta, quedan las cajas.
   */
  private upgradeMesh(
    loader: GLTFLoader,
    file: string,
    targetSize: number,
    axis: 'x' | 'y',
    max: number,
    apply: (m: THREE.InstancedMesh) => void,
    current: () => THREE.InstancedMesh,
  ): void {
    loader.load(
      `models/${file}.glb`,
      (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        let src: THREE.Mesh | undefined;
        gltf.scene.traverse((o) => {
          if (!src && o instanceof THREE.Mesh) src = o;
        });
        if (!src) return;
        const geo = (src.geometry as THREE.BufferGeometry).clone().applyMatrix4(src.matrixWorld);
        geo.computeBoundingBox();
        const size = new THREE.Vector3();
        geo.boundingBox!.getSize(size);
        const s = targetSize / Math.max(1e-3, axis === 'x' ? size.x : size.y);
        geo.scale(s, s, s);
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        const center = new THREE.Vector3();
        bb.getCenter(center);
        geo.translate(-center.x, -bb.min.y, -center.z);
        const mat = (Array.isArray(src.material) ? src.material[0] : src.material).clone();
        const mesh = new THREE.InstancedMesh(geo, mat, max);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        const old = current();
        this.scene.remove(old);
        old.dispose();
        this.scene.add(mesh);
        apply(mesh);
      },
      undefined,
      () => {
        /* sin modelo: quedan las cajas */
      },
    );
  }

  /** Game la actualiza cada frame: más gente = más autos y peatones. */
  setPopulation(pop: number): void {
    this.population = pop;
  }

  private blank(speed: number): Agent {
    return {
      active: false,
      x: 0,
      z: 0,
      dx: 1,
      dz: 0,
      t: 0,
      speed,
      side: Math.random() < 0.5 ? 1 : -1,
      color: new THREE.Color(0xffffff),
    };
  }

  private isRoad(x: number, z: number): boolean {
    if (x < 0 || z < 0 || x >= this.city.width || z >= this.city.height) return false;
    return this.city.getTile(x, z).type === TileType.Road;
  }

  private rescan(): void {
    this.roads = [];
    this.city.forEach((tile, x, z) => {
      if (tile.type === TileType.Road) this.roads.push({ x, z });
    });
  }

  /** Aparece en una calle al azar mirando hacia una vecina; si no hay red, queda inactivo. */
  private respawn(a: Agent, colors: number[] = CAR_COLORS): void {
    a.active = false;
    a.color.setHex(colors[(Math.random() * colors.length) | 0]);
    if (!this.roads.length) return;
    for (let tries = 0; tries < 5; tries++) {
      const r = this.roads[(Math.random() * this.roads.length) | 0];
      if (!this.isRoad(r.x, r.z)) continue; // la lista puede estar vieja hasta el rescan
      const options = DIRS.filter(([dx, dz]) => this.isRoad(r.x + dx, r.z + dz));
      if (!options.length) continue; // calle aislada
      const [dx, dz] = options[(Math.random() * options.length) | 0];
      a.x = r.x;
      a.z = r.z;
      a.dx = dx;
      a.dz = dz;
      a.t = Math.random();
      a.active = true;
      return;
    }
  }

  /** Al terminar la casilla pasa a la siguiente y elige rumbo en el cruce. */
  private advance(a: Agent): void {
    const nx = a.x + a.dx;
    const nz = a.z + a.dz;
    if (!this.isRoad(nx, nz)) {
      // La calle se cortó (demolida o punta muerta justo delante): media vuelta o respawn.
      if (this.isRoad(a.x - a.dx, a.z - a.dz)) {
        a.dx = -a.dx;
        a.dz = -a.dz;
      } else {
        this.respawn(a);
      }
      return;
    }
    a.x = nx;
    a.z = nz;
    const options = DIRS.filter(([dx, dz]) => (dx !== -a.dx || dz !== -a.dz) && this.isRoad(nx + dx, nz + dz));
    if (!options.length) {
      a.dx = -a.dx; // punta muerta: vuelve
      a.dz = -a.dz;
      return;
    }
    const straight = options.some(([dx, dz]) => dx === a.dx && dz === a.dz);
    if (!(straight && Math.random() < KEEP_STRAIGHT)) {
      const [dx, dz] = options[(Math.random() * options.length) | 0];
      a.dx = dx;
      a.dz = dz;
    }
  }

  /** Mantiene activos exactamente `target` agentes del pool. */
  private syncPool(pool: Agent[], target: number, colors: number[]): void {
    let active = 0;
    for (const a of pool) if (a.active) active++;
    for (const a of pool) {
      if (active === target) break;
      if (active < target && !a.active) {
        this.respawn(a, colors);
        if (a.active) active++;
        else break; // no hay dónde aparecer
      } else if (active > target && a.active) {
        a.active = false;
        active--;
      }
    }
  }

  private writeInstances(mesh: THREE.InstancedMesh, pool: Agent[], y: number, lane: number): void {
    let i = 0;
    for (const a of pool) {
      if (!a.active) continue;
      // posición: centro de la casilla + avance en la dirección + corrimiento a la derecha
      const along = (a.t - 0.5) * this.grid.tileSize;
      const off = lane * (lane === SIDEWALK ? a.side : 1);
      const px = tileCenterX(a.x, this.grid) + a.dx * along + -a.dz * off;
      const pz = tileCenterZ(a.z, this.grid) + a.dz * along + a.dx * off;
      this.dummy.position.set(px, y, pz);
      this.dummy.rotation.set(0, Math.atan2(-a.dz, a.dx), 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      mesh.setColorAt(i, a.color);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    if (dt <= 0 || dt > 1) return; // pestaña congelada: no teletransportar
    this.rescanIn -= dt;
    if (this.rescanIn <= 0) {
      this.rescan();
      this.rescanIn = RESCAN_S;
    }

    // Cuántos agentes "merece" la ciudad: sin habitantes no hay quién maneje
    // (las calles vacías recién pintadas no generan tráfico).
    const carTarget =
      this.roads.length >= 4 && this.population > 0
        ? Math.min(MAX_CARS, Math.floor(this.roads.length / 4), 2 + Math.floor(this.population / 30))
        : 0;
    const pedTarget = this.roads.length >= 4 ? Math.min(MAX_PEDS, Math.floor(this.population / 12)) : 0;
    this.syncPool(this.carAgents, carTarget, CAR_COLORS);
    this.syncPool(this.pedAgents, pedTarget, PED_COLORS);

    for (const a of this.carAgents) {
      if (!a.active) continue;
      a.t += dt * a.speed;
      while (a.t >= 1 && a.active) {
        a.t -= 1;
        this.advance(a);
      }
    }
    for (const a of this.pedAgents) {
      if (!a.active) continue;
      a.t += dt * a.speed;
      while (a.t >= 1 && a.active) {
        a.t -= 1;
        this.advance(a);
      }
    }

    this.writeInstances(this.cars, this.carAgents, CAR_Y, LANE);
    this.writeInstances(this.peds, this.pedAgents, PED_Y, SIDEWALK);
  }
}
