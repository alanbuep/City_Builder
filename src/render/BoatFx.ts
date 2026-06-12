import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { City } from '../sim/City';
import { TileType } from '../sim/types';
import { GridSpec } from '../grid';

/**
 * Barcos navegando el mar: veleros y una lancha de ambiente que pasean por la
 * franja de océano del lado de la costa, y un CARGUERO que cruza de largo cuando
 * la ciudad tiene una terminal de exportación (el comercio "se ve"). Solo aparece
 * si el mapa tiene una costa de verdad (un borde con mucha agua). Convención de
 * los modelos: proa hacia +Z → se orientan con atan2(vx, vz). Sin modelos .glb
 * no se dibuja nada (no hay fallback procedural: el mar vacío no molesta).
 */

const RESCAN_S = 5; // cada cuánto re-mirar costa y terminales
const AMBIENT_BOATS: Array<{ file: string; scale: number; speed: number }> = [
  { file: 'sailboat', scale: 1.5, speed: 0.7 },
  { file: 'sailboat', scale: 1.2, speed: 0.55 },
  { file: 'boat', scale: 1.1, speed: 1.4 },
];
const CARGO_SPEED = 1.1; // unidades/seg (lento, pesado)
const CARGO_REST_S = 18; // pausa entre cruces del carguero

interface Boat {
  obj: THREE.Object3D;
  heading: number;
  speed: number;
  phase: number; // para el bamboleo y el zigzag
  placed: boolean; // ya se lo ubicó en el mar (recién al conocer la costa)
}

type Side = 'N' | 'S' | 'W' | 'E';

export class BoatFx {
  private group = new THREE.Group();
  private boats: Boat[] = [];
  private cargoObj: THREE.Object3D | null = null;
  private cargoT = -1; // -1 = descansando; 0..1 = cruzando
  private cargoRest = 6;
  private side: Side | null = null;
  private hasTerminal = false;
  private rescanIn = 0;
  private waterY = 0.04; // CityRenderer lo baja si el paisaje trae su propio mar
  private t = 0;
  private half: number;

  constructor(
    scene: THREE.Scene,
    private city: City,
    grid: GridSpec,
  ) {
    scene.add(this.group);
    const loader = new GLTFLoader();
    for (const spec of AMBIENT_BOATS) {
      loader.load(
        `models/${spec.file}.glb`,
        (gltf) => {
          const obj = this.normalize(gltf.scene, spec.scale);
          obj.visible = false;
          this.group.add(obj);
          this.boats.push({
            obj,
            heading: Math.random() * Math.PI * 2,
            speed: spec.speed,
            phase: Math.random() * 9,
            placed: false,
          });
        },
        undefined,
        () => {},
      );
    }
    loader.load(
      'models/cargo_ship.glb',
      (gltf) => {
        this.cargoObj = this.normalize(gltf.scene, 4.2);
        this.cargoObj.visible = false;
        this.group.add(this.cargoObj);
      },
      undefined,
      () => {},
    );
    this.half = (Math.max(city.width, city.height) * grid.tileSize) / 2;
  }

  /** Altura del agua donde flotan (el paisaje glTF trae su mar más abajo). */
  setWaterY(y: number): void {
    this.waterY = y;
  }

  private normalize(scene: THREE.Object3D, scale: number): THREE.Group {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = scale / Math.max(size.x, size.y, size.z, 1e-3);
    scene.scale.setScalar(s);
    scene.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const pivot = new THREE.Group();
    pivot.add(scene);
    return pivot;
  }

  /** ¿Qué borde del mapa es costa? (mismo criterio que el océano del renderer). */
  private rescan(): void {
    const w = this.city.width;
    const h = this.city.height;
    let cN = 0;
    let cS = 0;
    let cW = 0;
    let cE = 0;
    for (let x = 0; x < w; x++) {
      if (this.city.getTerrain(x, 0) === 'water') cN++;
      if (this.city.getTerrain(x, h - 1) === 'water') cS++;
    }
    for (let z = 0; z < h; z++) {
      if (this.city.getTerrain(0, z) === 'water') cW++;
      if (this.city.getTerrain(w - 1, z) === 'water') cE++;
    }
    const max = Math.max(cN, cS, cW, cE);
    if (max < Math.max(8, Math.round(Math.min(w, h) * 0.35))) {
      this.side = null;
    } else {
      this.side = max === cN ? 'N' : max === cS ? 'S' : max === cW ? 'W' : 'E';
    }

    this.hasTerminal = false;
    this.city.forEach((tile, x, z) => {
      if (tile.type === TileType.ExportTerminal && !this.city.isSubCell(x, z)) this.hasTerminal = true;
    });
  }

  /** Posición mundial dentro de la franja de mar: u = a lo largo de la costa, v = mar adentro. */
  private seaPos(u: number, v: number): { x: number; z: number } {
    switch (this.side) {
      case 'N':
        return { x: u, z: -this.half - v };
      case 'S':
        return { x: u, z: this.half + v };
      case 'W':
        return { x: -this.half - v, z: u };
      default:
        return { x: this.half + v, z: u };
    }
  }

  /** Y al revés: de mundo a (u, v) para chequear límites. */
  private seaUV(x: number, z: number): { u: number; v: number } {
    switch (this.side) {
      case 'N':
        return { u: x, v: -z - this.half };
      case 'S':
        return { u: x, v: z - this.half };
      case 'W':
        return { u: z, v: -x - this.half };
      default:
        return { u: z, v: x - this.half };
    }
  }

  update(dt: number): void {
    if (dt <= 0 || dt > 1) return;
    this.t += dt;
    this.rescanIn -= dt;
    if (this.rescanIn <= 0) {
      this.rescan();
      this.rescanIn = RESCAN_S;
    }

    if (!this.side) {
      for (const b of this.boats) b.obj.visible = false;
      if (this.cargoObj) this.cargoObj.visible = false;
      return;
    }

    // Franja navegable: pegada a la costa pero fuera del cuadro jugable.
    const U = this.half + 14; // a lo largo de la costa
    const V0 = 4; // qué tan cerca de la orilla
    const V1 = 26; // qué tan mar adentro

    for (const b of this.boats) {
      if (!b.placed) {
        // Recién ahora se sabe dónde está el mar: ubicarlo en la franja.
        const start = this.seaPos((Math.random() * 2 - 1) * U * 0.8, V0 + Math.random() * (V1 - V0));
        b.obj.position.set(start.x, this.waterY, start.z);
        b.placed = true;
      }
      b.obj.visible = true;
      // Rumbo que serpentea + rebote suave en los límites de la franja.
      b.heading += Math.sin(this.t * 0.25 + b.phase) * dt * 0.35;
      const vx = Math.sin(b.heading) * b.speed;
      const vz = Math.cos(b.heading) * b.speed;
      let px = b.obj.position.x + vx * dt;
      let pz = b.obj.position.z + vz * dt;
      const { u, v } = this.seaUV(px, pz);
      if (u < -U || u > U || v < V0 || v > V1) {
        // Se fue de la franja: apuntar de nuevo hacia el medio del mar navegable.
        const back = this.seaPos(Math.max(-U, Math.min(U, u)) * 0.5, (V0 + V1) / 2);
        b.heading = Math.atan2(back.x - px, back.z - pz);
        px = b.obj.position.x;
        pz = b.obj.position.z;
      }
      b.obj.position.set(px, this.waterY + Math.sin(this.t * 1.3 + b.phase) * 0.04, pz);
      b.obj.rotation.y = Math.atan2(vx, vz);
      b.obj.rotation.z = Math.sin(this.t * 1.1 + b.phase) * 0.04; // bamboleo
    }

    // Carguero: cruza la costa de punta a punta cuando hay terminal de exportación.
    if (this.cargoObj) {
      if (this.cargoT < 0) {
        this.cargoObj.visible = false;
        if (this.hasTerminal) {
          this.cargoRest -= dt;
          if (this.cargoRest <= 0) {
            this.cargoT = 0;
            this.cargoRest = CARGO_REST_S;
          }
        }
      } else {
        this.cargoObj.visible = true;
        this.cargoT += (dt * CARGO_SPEED) / (2 * U);
        const u = -U + this.cargoT * 2 * U;
        const v = 16;
        const p = this.seaPos(u, v);
        const ahead = this.seaPos(u + 1, v);
        this.cargoObj.position.set(p.x, this.waterY + Math.sin(this.t * 0.9) * 0.03, p.z);
        this.cargoObj.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z);
        if (this.cargoT >= 1) this.cargoT = -1; // llegó: descansa y vuelve a salir
      }
    }
  }
}
