import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface Plane {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
}

/** Un globo aerostático anclado a su globopuerto (deriva cerca y sube/baja). */
interface Balloon {
  obj: THREE.Object3D;
  home: { x: number; z: number };
  angle: number;
}

interface Pt {
  x: number;
  z: number;
}

/**
 * Tráfico aéreo de ambiente: aviones que despegan de los AEROPUERTOS, el dirigible
 * que ronda sobre su HANGAR y globos que flotan sobre su GLOBOPUERTO. Cada aeronave
 * "sale" de su edificio (nada aparece de la nada). Render puro y procedural; los
 * vehículos miran a +Z, así que se orientan con `atan2(velX, velZ)`.
 */
export class AirFx {
  private group = new THREE.Group();
  private airports: Pt[] = []; // despegan aviones
  private docks: Pt[] = []; // hangar(es) del dirigible
  private ports: Pt[] = []; // globopuerto(s)
  private planes: Plane[] = [];
  private blimp: THREE.Object3D;
  private blimpAngle = 0;
  private spawnTimer = 4;
  private balloonTemplate: THREE.Object3D | null = null;
  private planeTemplate: THREE.Object3D | null = null;
  private balloons: Balloon[] = [];

  constructor(
    scene: THREE.Scene,
    private extent: number,
  ) {
    scene.add(this.group);
    this.blimp = this.makeBlimp();
    this.blimp.visible = false;
    this.group.add(this.blimp);
    const loader = new GLTFLoader();
    loader.load(
      'models/balloon.glb',
      (gltf) => {
        this.balloonTemplate = this.normalize(gltf.scene);
        this.balloonTemplate.scale.setScalar(2.4);
      },
      undefined,
      () => {
        /* sin modelo de globo → no se dibujan */
      },
    );
    // Avión y dirigible glTF (nariz a −Z): se envuelven girados 180° porque la
    // lógica de vuelo orienta el objeto con el frente a +Z. Sin modelo, quedan
    // los procedurales de cajas.
    loader.load(
      'models/plane.glb',
      (gltf) => {
        const t = this.flipped(this.normalize(gltf.scene));
        t.traverse((o) => {
          if (o instanceof THREE.Mesh) o.castShadow = true;
        });
        t.scale.setScalar(1.7);
        this.planeTemplate = t;
      },
      undefined,
      () => {},
    );
    loader.load(
      'models/blimp.glb',
      (gltf) => {
        const t = this.flipped(this.normalize(gltf.scene));
        t.scale.setScalar(3.0);
        const wasVisible = this.blimp.visible;
        this.group.remove(this.blimp);
        this.blimp = t;
        this.blimp.visible = wasVisible;
        this.group.add(this.blimp);
      },
      undefined,
      () => {},
    );
  }

  /** Gira el contenido 180° (modelos con nariz a −Z → la lógica usa frente +Z). */
  private flipped(t: THREE.Object3D): THREE.Group {
    const inner = new THREE.Group();
    inner.rotation.y = Math.PI;
    inner.add(t);
    const outer = new THREE.Group();
    outer.add(inner);
    return outer;
  }

  /** Define de qué edificios sale cada aeronave (posiciones en el mundo). */
  setSources(airports: Pt[], docks: Pt[], ports: Pt[]): void {
    this.airports = airports;
    this.docks = docks;
    this.ports = ports;
  }

  private normalize(scene: THREE.Object3D): THREE.Group {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = 1 / Math.max(size.x, size.y, size.z, 1e-3);
    scene.scale.setScalar(s);
    scene.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const pivot = new THREE.Group();
    pivot.add(scene);
    return pivot;
  }

  /** Dirigible: cuerpo alargado en Z (su "frente"), aleta atrás y góndola debajo. */
  private makeBlimp(): THREE.Object3D {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.6 }),
    );
    body.scale.set(1, 1, 2.6);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xef5350 }));
    fin.position.set(0, 0, -1.4);
    const gondola = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x455a64 }));
    gondola.position.y = -0.6;
    g.add(body, fin, gondola);
    return g;
  }

  /** Avión: fuselaje a lo largo de Z (frente), alas en X, cola atrás. */
  private makePlane(): THREE.Object3D {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 });
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.1), white);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.28), white);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), white);
    tail.position.z = -0.5;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.2), new THREE.MeshStandardMaterial({ color: 0x1e88e5 }));
    fin.position.set(0, 0.16, -0.5);
    g.add(fuselage, wing, tail, fin);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    g.scale.setScalar(0.9);
    return g;
  }

  private spawnPlane(): void {
    if (this.airports.length === 0) return;
    const a = this.airports[Math.floor(Math.random() * this.airports.length)];
    const dir = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 2;
    const vx = Math.cos(dir) * speed;
    const vz = Math.sin(dir) * speed;
    const obj = this.planeTemplate ? this.planeTemplate.clone(true) : this.makePlane();
    obj.position.set(a.x, 1.5, a.z);
    obj.rotation.y = Math.atan2(vx, vz);
    this.planes.push({ obj, vel: new THREE.Vector3(vx, 1.1, vz), life: 12 });
    this.group.add(obj);
  }

  /** Mueve dirigible, globos y aviones; despega aviones cada tanto. Cada frame. */
  update(dt: number): void {
    dt = Math.min(dt, 0.05);

    // Dirigible: sale del hangar (ronda sobre el primero). Sin hangar, no hay.
    if (this.docks.length === 0) {
      this.blimp.visible = false;
    } else {
      this.blimp.visible = true;
      const home = this.docks[0];
      this.blimpAngle += dt * 0.18;
      const r = Math.max(4, this.extent * 0.14);
      const vx = -Math.sin(this.blimpAngle) * r;
      const vz = Math.cos(this.blimpAngle) * r;
      this.blimp.position.set(
        home.x + Math.cos(this.blimpAngle) * r,
        9 + Math.sin(this.blimpAngle * 2) * 0.5,
        home.z + Math.sin(this.blimpAngle) * r,
      );
      this.blimp.rotation.y = Math.atan2(vx, vz);
    }

    // Globos: uno por globopuerto, flotando cerca de su edificio.
    if (this.balloonTemplate) {
      while (this.balloons.length < this.ports.length) {
        const obj = this.balloonTemplate.clone(true);
        this.group.add(obj);
        this.balloons.push({ obj, home: { x: 0, z: 0 }, angle: this.balloons.length * 1.7 });
      }
      while (this.balloons.length > this.ports.length) {
        const b = this.balloons.pop();
        if (b) this.group.remove(b.obj);
      }
      for (let i = 0; i < this.balloons.length; i++) {
        const b = this.balloons[i];
        b.home = this.ports[i];
        b.angle += dt * 0.12;
        b.obj.position.set(
          b.home.x + Math.cos(b.angle) * 3,
          6 + Math.sin(b.angle * 2.5) * 1.2,
          b.home.z + Math.sin(b.angle) * 3,
        );
        b.obj.rotation.y += dt * 0.25;
      }
    }

    // Aviones: despegan de los aeropuertos cada tanto.
    if (this.airports.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 5 + Math.random() * 6;
        this.spawnPlane();
      }
    }
    const limit = this.extent * 0.9;
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const p = this.planes[i];
      p.obj.position.addScaledVector(p.vel, dt);
      if (p.obj.position.y > 7) p.vel.y = 0;
      p.life -= dt;
      const far = Math.abs(p.obj.position.x) > limit || Math.abs(p.obj.position.z) > limit;
      if (p.life <= 0 || far) {
        this.group.remove(p.obj);
        // Los clones del modelo COMPARTEN geometría/material con el template:
        // solo se libera lo procedural (que crea geometría propia por avión).
        if (!this.planeTemplate) {
          p.obj.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              (o.material as THREE.Material).dispose();
            }
          });
        }
        this.planes.splice(i, 1);
      }
    }
  }
}
