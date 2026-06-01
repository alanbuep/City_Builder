import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * El héroe volador (estilo Superman). Cuando la ciudad tiene un cuartel sano, el
 * héroe aparece y sobrevuela la ciudad; si hay un incendio, vuela hacia él (es la
 * fantasía de "el héroe acude al rescate"). Es solo visual: la mitigación real de
 * catástrofes la hace la simulación (DisasterSystem.heroActive).
 */
export class HeroFx {
  private model: THREE.Object3D | null = null;
  private active = false;
  private target: THREE.Vector3 | null = null;
  private pos = new THREE.Vector3(0, 7, 0);
  private angle = 0;
  private fade = 0; // 0..1, aparición/desaparición suave

  private readonly cruiseH = 7; // altura de crucero
  private readonly radius: number; // radio del sobrevuelo en reposo

  constructor(scene: THREE.Scene, extent: number) {
    this.radius = extent * 0.32;
    new GLTFLoader().load(
      'models/hero_figure.glb',
      (gltf) => {
        this.model = this.normalize(gltf.scene);
        this.model.scale.setScalar(1.6);
        this.model.visible = false;
        scene.add(this.model);
      },
      undefined,
      () => {
        /* sin modelo del héroe → no se dibuja (es solo visual) */
      },
    );
  }

  private normalize(scene: THREE.Object3D): THREE.Group {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = 1 / Math.max(size.x, size.y, size.z, 1e-3);
    scene.scale.setScalar(s);
    scene.position.set(-center.x * s, -center.y * s, -center.z * s);
    const pivot = new THREE.Group();
    pivot.add(scene);
    return pivot;
  }

  /** Activa/desactiva al héroe y le indica a dónde acudir (foco de incendio o null). */
  setState(active: boolean, target: { x: number; z: number } | null): void {
    this.active = active;
    this.target = target ? new THREE.Vector3(target.x, this.cruiseH * 0.6, target.z) : null;
  }

  /** Mueve al héroe cada frame: vuela hacia el incendio, o ronda la ciudad. */
  update(dt: number): void {
    if (!this.model) return;
    dt = Math.min(dt, 0.05);
    // Aparición/desaparición suave.
    this.fade += (this.active ? 1 : -1) * dt * 1.5;
    this.fade = Math.max(0, Math.min(1, this.fade));
    if (this.fade <= 0) {
      this.model.visible = false;
      return;
    }
    this.model.visible = true;

    let desired: THREE.Vector3;
    if (this.target) {
      // Orbita cerca del incendio (sobrevuelo de rescate).
      this.angle += dt * 1.6;
      desired = new THREE.Vector3(
        this.target.x + Math.cos(this.angle) * 1.6,
        this.target.y + 1.2,
        this.target.z + Math.sin(this.angle) * 1.6,
      );
    } else {
      // Ronda lenta sobre el centro de la ciudad.
      this.angle += dt * 0.5;
      desired = new THREE.Vector3(
        Math.cos(this.angle) * this.radius,
        this.cruiseH + Math.sin(this.angle * 2) * 0.6,
        Math.sin(this.angle) * this.radius,
      );
    }

    const prev = this.pos.clone();
    this.pos.lerp(desired, Math.min(1, dt * 2.2));
    this.model.position.copy(this.pos);
    // Mira hacia donde se mueve.
    const vel = this.pos.clone().sub(prev);
    if (vel.lengthSq() > 1e-5) this.model.rotation.y = Math.atan2(vel.x, vel.z);
    this.model.scale.setScalar(1.6 * (0.4 + 0.6 * this.fade));
  }
}
