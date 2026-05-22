import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Todo lo relacionado con Three.js "puro": el renderer, la escena, la cámara,
 * las luces y los controles de cámara. No sabe nada de la ciudad ni de zonas.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  constructor(container: HTMLElement) {
    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    // --- Escena ---
    this.scene.background = new THREE.Color(0x9fc9e8); // cielo

    // --- Cámara (perspectiva, vista en diagonal hacia el suelo) ---
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(22, 26, 22);

    // --- Controles: orbitar / zoom / desplazar ---
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.2; // no bajar por debajo del suelo
    this.controls.minDistance = 5;
    this.controls.maxDistance = 90;
    // El click izquierdo lo reservamos para construir, así que la rotación va
    // al botón derecho y el desplazamiento al botón central.
    this.controls.mouseButtons = {
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.update();

    // --- Luces ---
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    const s = 40;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    this.scene.add(sun);

    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Se llama una vez por frame. */
  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
