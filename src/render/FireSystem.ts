import * as THREE from 'three';

/** Un foco de incendio: base de la llama (en el mundo) y su intensidad 0..1. */
interface FireEmitter {
  x: number;
  y: number;
  z: number;
  heat: number;
}

const MAX_PARTICLES = 700; // tope global del pool (varias llamas comparten)
const PER_EMITTER_PER_SEC = 34; // ritmo de emisión por foco (llama densa)
const LIFE = 0.7; // segundos que vive cada partícula (corta: se queda cerca de la base)
const RISE = 1.7; // velocidad de ascenso (unidades/seg)
const SPREAD = 0.16; // radio de la base de la llama
const START_SIZE = 20; // grande abajo
const END_SIZE = 5; // afina al subir (lengüeta de fuego)

/**
 * Textura de llama: núcleo blanco-amarillo que pasa a naranja y se desvanece en
 * rojo. Con mezcla ADITIVA, el apilado de partículas da el brillo del fuego.
 */
function flameTexture(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(0.35, 'rgba(255,170,40,0.9)');
  g.addColorStop(0.7, 'rgba(220,60,10,0.5)');
  g.addColorStop(1, 'rgba(120,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Fuego de incendios con partículas (mezcla aditiva): lenguas de llama que suben
 * desde cada casilla en llamas, titilan y se afinan al ascender. Un único
 * THREE.Points (una draw call) con un pool repartido entre todos los focos.
 * Reemplaza al viejo sprite de emoji 🔥 por algo que parece fuego de verdad.
 */
export class FireSystem {
  private emitters: FireEmitter[] = [];
  private points: THREE.Points;
  private positions: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private life: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;

  private spawnAccumulator = 0;
  private cursor = 0;

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
      uniforms: { uTex: { value: flameTexture() } },
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
          vec4 t = texture2D(uTex, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(t.rgb, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
  }

  /** Define los focos de incendio activos (base en el mundo + intensidad). */
  setFires(emitters: FireEmitter[]): void {
    this.emitters = emitters;
  }

  /** Avanza las partículas y vuelca el estado a los buffers (cada frame). */
  update(dt: number): void {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.05); // evita saltos enormes tras un freeze

    const list = this.emitters;
    // Ritmo de emisión: proporcional a la cantidad de focos y a su intensidad.
    if (list.length > 0) {
      let heatSum = 0;
      for (const e of list) heatSum += 0.5 + e.heat;
      this.spawnAccumulator += heatSum * PER_EMITTER_PER_SEC * dt;
    } else {
      this.spawnAccumulator = 0;
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.positions[i * 3] += this.vx[i] * dt;
        this.positions[i * 3 + 1] += this.vy[i] * dt;
        this.positions[i * 3 + 2] += this.vz[i] * dt;
        const t = 1 - Math.max(0, this.life[i]) / LIFE; // 0 = recién nacida, 1 = al morir
        this.sizes[i] = START_SIZE + (END_SIZE - START_SIZE) * t; // grande abajo, fina arriba
        // Brilla fuerte al nacer y se apaga al subir.
        this.alphas[i] = Math.min(1, t * 5) * (1 - t);
      } else if (this.spawnAccumulator >= 1 && list.length > 0) {
        this.spawnAccumulator -= 1;
        const e = list[this.cursor % list.length];
        this.cursor++;
        this.life[i] = LIFE * (0.7 + Math.random() * 0.5);
        this.positions[i * 3] = e.x + (Math.random() - 0.5) * SPREAD * 2;
        this.positions[i * 3 + 1] = e.y + Math.random() * 0.1;
        this.positions[i * 3 + 2] = e.z + (Math.random() - 0.5) * SPREAD * 2;
        this.vx[i] = (Math.random() - 0.5) * 0.4;
        this.vy[i] = RISE * (0.7 + Math.random() * 0.6) * (0.7 + e.heat * 0.5);
        this.vz[i] = (Math.random() - 0.5) * 0.4;
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
