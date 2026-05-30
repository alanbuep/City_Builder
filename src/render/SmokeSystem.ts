import * as THREE from 'three';

/** Una columna de humo: posición del foco emisor (cima de la chimenea). */
interface Emitter {
  x: number;
  y: number;
  z: number;
}

const MAX_PARTICLES = 500; // tope global del pool (varias chimeneas comparten)
const PER_EMITTER_PER_SEC = 6; // ritmo de emisión por chimenea (penacho discreto)
const LIFE = 1.7; // segundos que vive cada partícula (corta = se queda cerca de la chimenea)
const RISE = 0.5; // velocidad de ascenso (unidades/seg; tileSize = 1)
const DRIFT = 0.07; // deriva horizontal mínima (no se expande por toda la ciudad)
const START_SIZE = 8;
const END_SIZE = 20;
const PEAK_ALPHA = 0.14; // opacidad máxima: muy transparente (solo marca la zona de contaminación)

/** Textura suave (círculo difuminado) para que cada partícula sea una bocanada. */
function puffTexture(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Sistema de humo para fábricas, centrales e industria pesada. Un único objeto
 * THREE.Points (una sola draw call) con un pool de partículas que se reciclan
 * entre todas las chimeneas registradas. Estilo low-poly: bocanadas grises que
 * suben, se agrandan y se desvanecen. Pensado para el look de SimCity BuildIt.
 */
export class SmokeSystem {
  private emitters = new Map<string, Emitter>();
  private points: THREE.Points;
  private positions: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;

  // Estado por partícula (en arrays paralelos, índice = id de partícula).
  private life: Float32Array; // tiempo de vida restante (<=0 = muerta)
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;

  private spawnAccumulator = 0;
  private cursor = 0; // para repartir partículas nuevas entre chimeneas

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);
    this.life = new Float32Array(MAX_PARTICLES);
    this.vx = new Float32Array(MAX_PARTICLES);
    this.vy = new Float32Array(MAX_PARTICLES);
    this.vz = new Float32Array(MAX_PARTICLES);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: puffTexture() } },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        varying float vAlpha;
        void main() {
          float a = texture2D(uTex, gl_PointCoord).a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(0.62), a);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
  }

  /** Registra/actualiza una chimenea en la casilla `key` (cima en x,y,z). */
  setEmitter(key: string, x: number, y: number, z: number): void {
    this.emitters.set(key, { x, y, z });
  }

  /** Quita la chimenea de la casilla `key` (las partículas vivas terminan de subir). */
  removeEmitter(key: string): void {
    this.emitters.delete(key);
  }

  /** Avanza la simulación de partículas y vuelca el estado a los buffers (cada frame). */
  update(dt: number): void {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.05); // evita saltos enormes tras un freeze

    const emitterList = [...this.emitters.values()];

    // Cuántas partículas nuevas emitir este frame (repartidas entre chimeneas).
    if (emitterList.length > 0) {
      this.spawnAccumulator += emitterList.length * PER_EMITTER_PER_SEC * dt;
    } else {
      this.spawnAccumulator = 0;
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] > 0) {
        // Partícula viva: avanza, frena un poco, sube y se desvanece.
        this.life[i] -= dt;
        this.positions[i * 3] += this.vx[i] * dt;
        this.positions[i * 3 + 1] += this.vy[i] * dt;
        this.positions[i * 3 + 2] += this.vz[i] * dt;
        const t = 1 - Math.max(0, this.life[i]) / LIFE; // 0 = recién nacida, 1 = al morir
        this.sizes[i] = START_SIZE + (END_SIZE - START_SIZE) * t;
        // Aparece rápido y se apaga gradualmente (muy tenue: solo insinúa la contaminación).
        this.alphas[i] = Math.min(1, t * 6) * (1 - t) * PEAK_ALPHA;
      } else if (this.spawnAccumulator >= 1 && emitterList.length > 0) {
        // Partícula muerta: la revivimos en la próxima chimenea del reparto.
        this.spawnAccumulator -= 1;
        const e = emitterList[this.cursor % emitterList.length];
        this.cursor++;
        this.life[i] = LIFE;
        this.positions[i * 3] = e.x + (Math.random() - 0.5) * 0.12;
        this.positions[i * 3 + 1] = e.y + 0.05;
        this.positions[i * 3 + 2] = e.z + (Math.random() - 0.5) * 0.12;
        this.vx[i] = (Math.random() - 0.5) * DRIFT + DRIFT * 0.5;
        this.vy[i] = RISE * (0.8 + Math.random() * 0.4);
        this.vz[i] = (Math.random() - 0.5) * DRIFT;
        this.sizes[i] = START_SIZE;
        this.alphas[i] = 0;
      } else {
        this.alphas[i] = 0;
      }
    }

    const geo = this.points.geometry;
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }
}
