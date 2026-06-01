import * as THREE from 'three';

/** Un circuito en coordenadas del mundo: centro + radio del óvalo por donde corren. */
interface Track {
  x: number;
  z: number;
  r: number;
}

const CAR_COLORS = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0x8e24aa, 0xff6f00];
const CARS_PER_TRACK = 6;

/**
 * Autos de carrera dando vueltas a los circuitos durante un "día de evento".
 * Render puro (los autos son low-poly procedurales, así andan aunque no haya
 * modelo `race_car`). Solo se muestran mientras hay una carrera en curso.
 */
export class RaceFx {
  private group = new THREE.Group();
  private cars: THREE.Object3D[] = [];
  private active = false;
  private tracks: Track[] = [];
  private t = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  /** Define si hay carrera y en qué circuitos (centro + radio en el mundo). */
  setRace(active: boolean, tracks: Track[]): void {
    this.active = active;
    this.tracks = tracks;
  }

  private makeCar(color: number): THREE.Object3D {
    const g = new THREE.Group();
    // El auto "mira" hacia +Z (su largo está sobre Z), para orientarlo con atan2(tx,tz).
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.16, 0.5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    body.position.y = 0.12;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }),
    );
    cabin.position.set(0, 0.24, -0.02);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.04, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    wing.position.set(0, 0.16, -0.24);
    g.add(body, cabin, wing);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return g;
  }

  /** Avanza los autos por el óvalo de cada circuito (cada frame). */
  update(dt: number): void {
    this.t += dt;
    const need = this.active ? this.tracks.length * CARS_PER_TRACK : 0;
    while (this.cars.length < need) {
      const car = this.makeCar(CAR_COLORS[this.cars.length % CAR_COLORS.length]);
      this.group.add(car);
      this.cars.push(car);
    }

    let idx = 0;
    if (this.active) {
      for (const tr of this.tracks) {
        for (let k = 0; k < CARS_PER_TRACK; k++) {
          const car = this.cars[idx++];
          car.visible = true;
          // Cada auto a su fase, con una pizca de variación de velocidad por carril.
          const a = this.t * (1.7 + (k % 3) * 0.12) + (k / CARS_PER_TRACK) * Math.PI * 2;
          const rx = tr.r;
          const rz = tr.r * 0.6; // óvalo (pista alargada)
          car.position.set(tr.x + Math.cos(a) * rx, 0.12, tr.z + Math.sin(a) * rz);
          // Orientar según la tangente del óvalo.
          const tx = -Math.sin(a) * rx;
          const tz = Math.cos(a) * rz;
          car.rotation.y = Math.atan2(tx, tz);
        }
      }
    }
    for (let i = idx; i < this.cars.length; i++) this.cars[i].visible = false;
  }
}
