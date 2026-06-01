import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Un efecto activo: se actualiza cada frame y, cuando termina (`update` devuelve
 * false), se descarta liberando sus recursos.
 */
interface Effect {
  update(dt: number): boolean;
  dispose(): void;
}

/** Modelos opcionales para las catástrofes (si faltan, se usa geometría procedural). */
const FX_MODELS = ['meteor'];

/**
 * Efectos visuales de las catástrofes (engine de render, sobre la escena Three).
 * Vive aparte del CityRenderer: maneja un meteorito que cae y deja cráter, la
 * trompa de un tornado que recorre el mapa, el remolino de un huracán y los
 * escombros que quedan donde un edificio fue arrasado. Todo es eye-candy: la
 * destrucción real la decide la simulación (DisasterSystem).
 */
export class DisasterFx {
  private group = new THREE.Group();
  private effects: Effect[] = [];
  private models = new Map<string, THREE.Group>();

  constructor(private scene: THREE.Scene) {
    scene.add(this.group);
    this.loadModels();
  }

  private loadModels(): void {
    const loader = new GLTFLoader();
    for (const f of FX_MODELS) {
      loader.load(
        `models/${f}.glb`,
        (gltf) => this.models.set(f, this.normalize(gltf.scene)),
        undefined,
        () => {
          /* sin modelo → geometría procedural */
        },
      );
    }
  }

  /** Normaliza un modelo a una casilla de 1×1 apoyada en y=0 (igual que CityRenderer). */
  private normalize(scene: THREE.Object3D): THREE.Group {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = 1 / Math.max(size.x, size.z, 1e-3);
    scene.scale.setScalar(s);
    scene.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const pivot = new THREE.Group();
    pivot.add(scene);
    return pivot;
  }

  /**
   * Clona el modelo `name` escalado a `footprint` casillas, o null si no cargó.
   * `clone(true)` comparte geometrías y materiales con la plantilla, así que clono
   * los materiales (para teñir/atenuar sin afectar otros) y marco las geometrías
   * como compartidas (`sharedGeo`) para no liberarlas al descartar la instancia.
   */
  private modelInstance(name: string, footprint: number): THREE.Object3D | null {
    const tmpl = this.models.get(name);
    if (!tmpl) return null;
    const inst = tmpl.clone(true);
    inst.scale.setScalar(footprint);
    inst.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.userData.sharedGeo = true;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    });
    return inst;
  }

  // --- Efectos públicos ------------------------------------------------------

  /** Meteorito que cae sobre (wx,wz) del mundo; al impactar dispara `onImpact`. */
  meteor(wx: number, wz: number, onImpact: () => void): void {
    const FALL = 0.85; // segundos de caída

    // El meteorito: modelo si existe, si no una roca incandescente.
    const rock = this.modelInstance('meteor', 1.1) ?? this.fallbackMeteor();
    const start = new THREE.Vector3(wx - 7, 17, wz - 7);
    const end = new THREE.Vector3(wx, 0.4, wz);
    rock.position.copy(start);
    this.group.add(rock);

    // Estela: un cono naranja translúcido tras el meteorito.
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 3.2, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff7a18, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    rock.add(trail);
    const fallDir = end.clone().sub(start).normalize();
    trail.position.copy(fallDir.clone().multiplyScalar(-1.7)); // detrás del meteorito
    trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fallDir.clone().multiplyScalar(-1));

    let t = 0;
    let impacted = false;
    this.effects.push({
      update: (dt) => {
        t += dt;
        const u = Math.min(1, t / FALL);
        rock.position.lerpVectors(start, end, u);
        rock.rotation.x += dt * 6;
        rock.rotation.y += dt * 4;
        if (u >= 1 && !impacted) {
          impacted = true;
          onImpact();
          this.impactBlast(end.x, end.z);
        }
        return u < 1;
      },
      dispose: () => {
        this.group.remove(rock);
        disposeTree(rock);
      },
    });
  }

  /** Tornado: una trompa que recorre `path` (puntos del mundo) y se disipa. */
  tornado(path: Array<{ x: number; z: number }>): void {
    if (path.length === 0) return;
    const dur = Math.max(1.5, path.length * 0.22);

    const funnel = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.18, 4.2, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x4a4a55, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    body.position.y = 2.1;
    funnel.add(body);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0x3a3a44, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    cap.position.y = 4.2;
    cap.scale.y = 0.5;
    funnel.add(cap);
    funnel.position.set(path[0].x, 0, path[0].z);
    this.group.add(funnel);

    let t = 0;
    this.effects.push({
      update: (dt) => {
        t += dt;
        const u = Math.min(1, t / dur);
        const f = u * (path.length - 1);
        const i = Math.min(path.length - 2, Math.floor(f));
        const frac = f - i;
        const a = path[i];
        const b = path[Math.min(path.length - 1, i + 1)];
        funnel.position.x = a.x + (b.x - a.x) * frac;
        funnel.position.z = a.z + (b.z - a.z) * frac;
        funnel.rotation.y += dt * 9;
        // Crece al aparecer y encoge al final.
        const grow = Math.min(1, u * 5) * Math.min(1, (1 - u) * 5);
        funnel.scale.set(0.5 + grow * 0.6, 0.6 + grow * 0.5, 0.5 + grow * 0.6);
        return u < 1;
      },
      dispose: () => {
        this.group.remove(funnel);
        disposeTree(funnel);
      },
    });
  }

  /** Huracán: un gran remolino de nubes que gira sobre la ciudad + ráfagas. */
  hurricane(cx: number, cz: number, extent: number): void {
    const dur = 4.5;
    const swirl = new THREE.Group();

    // Disco de nubes oscuras girando alto sobre la ciudad.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(extent * 0.65, 48),
      new THREE.MeshBasicMaterial({ color: 0x39414d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 9;
    swirl.add(disc);

    // Brazos espirales (toroides parciales) para sugerir la rotación.
    for (let k = 0; k < 3; k++) {
      const arm = new THREE.Mesh(
        new THREE.TorusGeometry(extent * (0.2 + k * 0.16), 0.5, 8, 32, Math.PI * 1.4),
        new THREE.MeshBasicMaterial({ color: 0x2d343f, transparent: true, opacity: 0, depthWrite: false }),
      );
      arm.rotation.x = -Math.PI / 2;
      arm.rotation.z = k * 1.3;
      arm.position.y = 8.6;
      swirl.add(arm);
    }
    swirl.position.set(cx, 0, cz);
    this.scene.add(swirl);

    let t = 0;
    this.effects.push({
      update: (dt) => {
        t += dt;
        const u = Math.min(1, t / dur);
        swirl.rotation.y += dt * 1.6;
        const fade = Math.min(1, u * 4) * Math.min(1, (1 - u) * 4); // entra y sale
        (disc.material as THREE.MeshBasicMaterial).opacity = 0.5 * fade;
        for (const arm of swirl.children) {
          if (arm !== disc) (arm as THREE.Mesh).rotation.z += dt * 2.2;
          const m = (arm as THREE.Mesh).material as THREE.MeshBasicMaterial;
          if (arm !== disc) m.opacity = 0.6 * fade;
        }
        return u < 1;
      },
      dispose: () => {
        this.scene.remove(swirl);
        disposeTree(swirl);
      },
    });
  }

  // --- Piezas internas -------------------------------------------------------

  /** Onda expansiva del impacto: un anillo que crece y se desvanece. */
  private impactBlast(x: number, z: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.6, 32),
      new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.1, z);
    this.group.add(ring);
    const DUR = 0.55;
    let t = 0;
    this.effects.push({
      update: (dt) => {
        t += dt;
        const u = Math.min(1, t / DUR);
        const s = 1 + u * 6;
        ring.scale.set(s, s, s);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u);
        return u < 1;
      },
      dispose: () => {
        this.group.remove(ring);
        disposeTree(ring);
      },
    });
  }

  private fallbackMeteor(): THREE.Object3D {
    return new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x4a2a1a, emissive: 0xff4500, emissiveIntensity: 1.2, roughness: 1 }),
    );
  }

  /** Avanza todos los efectos activos; descarta los que terminaron. Cada frame. */
  update(dt: number): void {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.05); // evita saltos enormes tras un freeze
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (!this.effects[i].update(dt)) {
        this.effects[i].dispose();
        this.effects.splice(i, 1);
      }
    }
  }
}

/**
 * Libera los recursos propios de un objeto: siempre los materiales (los de los
 * modelos se clonan por instancia), y la geometría salvo que sea compartida con
 * una plantilla de modelo (`sharedGeo`), en cuyo caso se conserva.
 */
function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (!o.userData.sharedGeo) o.geometry.dispose();
    const arr = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of arr) m.dispose();
  });
}
