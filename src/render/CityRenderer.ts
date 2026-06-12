import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { City } from '../sim/City';
import { TileType, Tile, TerrainKind, ResidentialStyle, TILE_DEF, isZone, MAX_LEVEL } from '../sim/types';
import { GridSpec, tileCenterX, tileCenterZ } from '../grid';
import { SmokeSystem } from './SmokeSystem';
import { FireSystem } from './FireSystem';
import { DisasterFx } from './DisasterFx';
import { HeroFx } from './HeroFx';
import { RaceFx } from './RaceFx';
import { AirFx } from './AirFx';
import { TrafficFx } from './TrafficFx';

// Edificios con chimenea: emiten humo (fábricas, centrales e industria pesada).
const SMOKING: Set<TileType> = new Set([
  TileType.FactorySmall,
  TileType.FactoryMedium,
  TileType.FactoryLarge,
  TileType.PowerPlant,
  TileType.GasPlant,
  TileType.CementPlant,
  TileType.BrickKiln,
  TileType.SteelMill,
  TileType.ElectronicsFactory,
]);

const ROAD_HEIGHTS = [0.06, 0.1, 0.14]; // calle / avenida / autopista
const LOT_HEIGHT = 0.08; // solar zonificado sin construir
const HEIGHT_PER_LEVEL = 0.7; // crecimiento de edificios de zona por nivel (solo fallback)

// --- Mapeo TileType → archivo .glb (en public/models/) -----------------------
// Las zonas (residencial/comercial/industrial) eligen el modelo según su nivel
// y las calles según sus vecinos; el resto es fijo y vive en esta tabla.
const MODEL_FILE: Partial<Record<TileType, string>> = {
  [TileType.FactorySmall]: 'factory_s',
  [TileType.FactoryMedium]: 'factory_m',
  [TileType.FactoryLarge]: 'factory_l',
  [TileType.Park]: 'park',
  [TileType.Plaza]: 'plaza',
  [TileType.Stadium]: 'stadium',
  [TileType.Museum]: 'museum',
  [TileType.Police]: 'police',
  [TileType.Fire]: 'fire',
  [TileType.Government]: 'government',
  [TileType.PowerPlant]: 'power',
  [TileType.WaterTower]: 'water',
  [TileType.GasPlant]: 'gas',
  [TileType.SolarPlant]: 'solar',
  [TileType.WindTurbine]: 'wind',
  [TileType.HydroPlant]: 'hydro',
  [TileType.ShoppingMall]: 'mall',
  [TileType.Hotel]: 'hotel',
  [TileType.OfficeTower]: 'office',
  [TileType.TechPark]: 'techpark',
  [TileType.ResearchLab]: 'research_lab',
  [TileType.Observatory]: 'observatory',
  [TileType.SciencePark]: 'science_park',
  [TileType.SpaceCenter]: 'space_center',
  [TileType.HeroHQ]: 'hero_hq',
  [TileType.HeroBeacon]: 'hero_beacon',
  [TileType.HeroStatue]: 'hero_statue',
  [TileType.SandPit]: 'sandpit',
  [TileType.CementPlant]: 'cement',
  [TileType.BrickKiln]: 'brickkiln',
  [TileType.BuildYard]: 'buildyard',
  [TileType.TechCompany]: 'techco',
  [TileType.School]: 'school',
  [TileType.University]: 'university',
  [TileType.Hospital]: 'hospital',
  [TileType.Clinic]: 'clinic',
  [TileType.Casino]: 'casino',
  [TileType.Cinema]: 'cinema',
  [TileType.AmusementPark]: 'amusement',
  [TileType.RaceTrack]: 'race_track',
  [TileType.BalloonPort]: 'balloon_port',
  [TileType.AirshipDock]: 'airship_dock',
  [TileType.Bush]: 'bush',
  [TileType.Flowers]: 'flowers',
  [TileType.Church]: 'church',
  [TileType.Library]: 'library',
  [TileType.Monument]: 'monument',
  [TileType.Airport]: 'airport',
  [TileType.BusStop]: 'busstop',
  [TileType.TramStop]: 'tramstop',
  [TileType.MetroStation]: 'metro',
  [TileType.Hardware]: 'hardware',
  [TileType.ExportTerminal]: 'export',
  [TileType.Cafe]: 'cafe',
  [TileType.Diner]: 'diner',
  [TileType.Restaurant]: 'restaurant',
  [TileType.Market]: 'market',
  [TileType.Pizzeria]: 'pizzeria',
  [TileType.Burger]: 'burger',
  [TileType.HotDog]: 'hotdog',
  [TileType.IceCream]: 'icecream',
  [TileType.Bakery]: 'bakery',
  [TileType.SawMill]: 'sawmill',
  [TileType.SteelMill]: 'steelmill',
  [TileType.ElectronicsFactory]: 'electronics',
  [TileType.Kiosk]: 'kiosk',
  [TileType.Boutique]: 'boutique',
  [TileType.Pharmacy]: 'pharmacy',
  [TileType.Bank]: 'bank',
  [TileType.GasStation]: 'gasstation',
  [TileType.Dealership]: 'dealership',
};

// Modelos por nivel de las zonas comercial/industrial (el residencial va por estilo).
const ZONE_MODELS: Partial<Record<TileType, string[]>> = {
  [TileType.Commercial]: ['commercial_1', 'commercial_2', 'commercial_3'],
  [TileType.Industrial]: ['industrial_1', 'industrial_2', 'industrial_3'],
};

// Escalera de modelos del residencial según su ESTILO (cada estilo, su look).
const RES_STYLE_MODELS: Record<ResidentialStyle, string[]> = {
  default: ['residential_1', 'residential_2', 'residential_3', 'residential_4', 'residential_5'],
  eco: ['res_eco_1', 'res_eco_2', 'res_eco_3'],
  luxury: ['res_luxury_1', 'res_luxury_2', 'res_luxury_3'],
  suburb: ['res_suburb_1', 'res_suburb_2', 'res_suburb_3'],
};

const ROAD_MODELS = ['road_straight', 'road_corner', 'road_tee', 'road_cross', 'road_end'];

// Variantes de paisaje: el árbol y la roca eligen un modelo según la casilla (variedad).
const TREE_MODELS = ['tree_oak', 'tree_pine'];
const ROCK_MODELS = ['rock_large', 'rock_small'];
const DECO_MODELS = [...TREE_MODELS, ...ROCK_MODELS, 'tree_palm'];

// Puentes: una calle sobre agua se dibuja con la pieza de puente (corre N-S como road_straight).
const BRIDGE_MODELS = ['bridge_straight', 'bridge_ramp'];

// Modelo propio de cada terreno. `beach_sand` ya existe; `mountain`/`sea` cargan
// en silencio y, hasta que existan, el terreno cae al cubo de color de respaldo.
const TERRAIN_MODEL: Partial<Record<TerrainKind, string>> = { beach: 'beach_sand', mountain: 'mountain', water: 'sea' };

// Modelo genérico de edificio dañado (ruina) que se muestra sobre cualquier
// edificio arrasado por una catástrofe hasta que se repara o demuele.
const DAMAGED_MODEL = 'building_burnt';

// --- Auto-tiling de calles ---------------------------------------------------
// Máscara de conexiones a calles vecinas. Bits: N=1, E=2, S=4, W=8.
const N = 1, E = 2, S = 4, W = 8;

/** Rota una máscara de conexiones 90° en sentido horario (N→E→S→W→N). */
function rotateMaskCW(mask: number): number {
  let r = 0;
  if (mask & N) r |= E;
  if (mask & E) r |= S;
  if (mask & S) r |= W;
  if (mask & W) r |= N;
  return r;
}

function popcount(mask: number): number {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
}

/**
 * Elige el modelo de calle y los cuartos de giro (k) para que sus conexiones
 * coincidan con `mask`. Convención de los modelos en su orientación base:
 *  - road_straight: conecta N+S (corre norte-sur).
 *  - road_corner:   conecta N+E.
 *  - road_tee:      conecta N+E+S (le falta W).
 *  - road_end:      la punta abierta mira al NORTE → conecta al N (base = N).
 *  - road_cross:    las cuatro.
 * Si visualmente quedan giradas, ajustar estas bases o ROAD_ROT_SIGN.
 */
function roadModel(mask: number): { file: string; k: number } {
  const count = popcount(mask);
  if (count === 0) return { file: 'road_straight', k: 0 };
  if (count === 4) return { file: 'road_cross', k: 0 };

  let file: string;
  let base: number;
  if (count === 1) {
    file = 'road_end';
    base = N; // la boca abierta del modelo mira al norte (conecta con la calle del norte)
  } else if (count === 3) {
    file = 'road_tee';
    base = N | E | S;
  } else if (mask === (N | S) || mask === (E | W)) {
    file = 'road_straight';
    base = N | S;
  } else {
    file = 'road_corner';
    base = N | E;
  }

  let m = base;
  for (let k = 0; k < 4; k++) {
    if (m === mask) return { file, k };
    m = rotateMaskCW(m);
  }
  return { file, k: 0 };
}

// Signo del giro: la máscara gira en sentido horario; en Three.js (Y arriba) eso
// es una rotación negativa alrededor de Y. Si quedan al revés, cambiar el signo.
const ROAD_ROT_SIGN = -1;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

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

/** Globito de diálogo con una frase corta (opinión de un vecino). `mood` tiñe el borde. */
function bubbleMaterial(text: string, mood: 'good' | 'bad'): THREE.SpriteMaterial {
  const S = 2; // supersampling para que el texto quede nítido
  const font = 26 * S;
  const padX = 18 * S;
  const padY = 12 * S;
  const tail = 12 * S;
  const radius = 14 * S;

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `600 ${font}px system-ui, sans-serif`;
  const textW = Math.ceil(measure.measureText(text).width);

  const boxW = textW + padX * 2;
  const boxH = font + padY * 2;
  const c = document.createElement('canvas');
  c.width = boxW;
  c.height = boxH + tail;
  const ctx = c.getContext('2d')!;

  // Globito redondeado.
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(boxW, 0, boxW, boxH, radius);
  ctx.arcTo(boxW, boxH, 0, boxH, radius);
  ctx.arcTo(0, boxH, 0, 0, radius);
  ctx.arcTo(0, 0, boxW, 0, radius);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fill();
  ctx.lineWidth = 3 * S;
  ctx.strokeStyle = mood === 'good' ? '#3ba55d' : '#e23b3b';
  ctx.stroke();

  // Colita del globito (hacia abajo).
  ctx.beginPath();
  ctx.moveTo(boxW / 2 - tail, boxH - 1);
  ctx.lineTo(boxW / 2, boxH + tail);
  ctx.lineTo(boxW / 2 + tail, boxH - 1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fill();

  ctx.font = `600 ${font}px system-ui, sans-serif`;
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, boxW / 2, boxH / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  mat.userData = { aspect: c.width / c.height };
  return mat;
}

/**
 * Traduce el estado de la `City` a objetos 3D. Cada casilla visible es un modelo
 * glTF (cargado de public/models/) o, mientras los modelos cargan / para casos
 * sin modelo (solares, obra, terreno natural), un cubo de color de respaldo.
 * Las carreteras se recolorean en vivo según el tráfico (ver `refreshTraffic`).
 */
export class CityRenderer {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Object3D>();
  private hover: THREE.Mesh;
  private selected: THREE.Mesh;
  private coverageFill: THREE.Mesh; // área de influencia (relleno) del edificio seleccionado
  private coverageEdge: THREE.LineLoop; // borde del área de influencia
  // Carcasas de color sobre los edificios dentro del área (para que se note bien).
  private coverageAreaGroup = new THREE.Group();
  private coverageAreaPool: THREE.Mesh[] = [];
  private coverageBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  private coverageBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.34, depthWrite: false });
  private coverageKey = ''; // evita reconstruir las carcasas cada frame si no cambió la selección

  // Plantillas de modelos cargadas (normalizadas a 1×1 y apoyadas en el piso).
  private models = new Map<string, THREE.Group>();
  private modelsReady = false;

  // Humo de fábricas/centrales y reloj para animarlo con dt real.
  private smoke: SmokeSystem;
  private fx: DisasterFx; // efectos de catástrofes (meteorito/tornado/huracán/escombros)
  private heroFx: HeroFx; // el héroe volador (cuando la ciudad tiene cuartel)
  private raceFx: RaceFx; // autos de carrera durante los días de evento
  private airFx: AirFx; // aviones desde aeropuertos + dirigible de ambiente
  private trafficFx: TrafficFx; // autitos por las calles + peatones en las veredas
  private lastAnim = 0;

  // Marcadores flotantes (nubes de sugerencia / obras de zona).
  private markerGroup = new THREE.Group();
  private markerPool: THREE.Sprite[] = [];
  private markerMats: Record<'plan' | 'build' | 'upgrade', THREE.SpriteMaterial>;

  // Fuego de incendios: sistema de partículas (llamas que suben y titilan).
  private fire: FireSystem;

  // Burbujas de opinión de los vecinos (globitos de diálogo sobre las casas).
  private bubbleGroup = new THREE.Group();
  private bubblePool: THREE.Sprite[] = [];
  private bubbleCache = new Map<string, THREE.SpriteMaterial>();

  // Territorio bloqueado: velo oscuro + candado sobre las parcelas cerradas.
  private lockedGroup = new THREE.Group();
  private lockedPool: THREE.Mesh[] = [];
  private lockLabelPool: THREE.Sprite[] = [];
  private lockPlaneGeo = new THREE.PlaneGeometry(1, 1);
  private lockMat = new THREE.MeshBasicMaterial({ color: 0x1a2535, transparent: true, opacity: 0.22, depthWrite: false });
  private lockLabelMat!: THREE.SpriteMaterial;

  private ocean!: THREE.Mesh; // plano de océano infinito (se ubica del lado del mar)
  private ground!: THREE.Mesh; // pasto decorativo infinito (se oculta si hay paisaje)
  private sceneRef!: THREE.Scene; // para agregar el paisaje al cargarlo

  // Paisaje completo de la ciudad: UN solo .glb gigante (cordillera, mar, colinas).
  // Si existe, reemplaza el pasto/océano/terreno por-casilla. Ver docs/MODELS.md ★★★.
  private hasLandscape = false;

  private cube = new THREE.BoxGeometry(1, 1, 1);
  private white = new THREE.Color(0xffffff);
  private roadLow = new THREE.Color(0x555555);
  private roadHigh = new THREE.Color(0xd32f2f);

  // Resaltado de hover: ilumina el modelo bajo el cursor en modo selección.
  private highlightKey: string | null = null;
  private highlightSaved: Array<{ mesh: THREE.Mesh; orig: THREE.Material | THREE.Material[]; clones: THREE.Material[] }> = [];
  private highlightColor = new THREE.Color(0xffd54f);

  constructor(
    scene: THREE.Scene,
    private city: City,
    private grid: GridSpec,
  ) {
    scene.add(this.group);
    this.sceneRef = scene;

    // Pasto que se extiende MUCHO más allá del área jugable (terreno "infinito":
    // así no se ve el plano flotando). El área donde se construye la marca la
    // grilla + las parcelas; este pasto es solo decorado hasta el horizonte.
    const play = Math.max(city.width, city.height) * grid.tileSize;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(play + 2000, play + 2000), // pasto hasta el horizonte (tierra "infinita")
      new THREE.MeshStandardMaterial({ color: 0x7cb342 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02; // apenas por debajo, para no competir con el terreno jugable
    ground.receiveShadow = true;
    scene.add(ground);
    this.ground = ground;

    // Océano infinito: un plano de agua enorme que arranca en la costa y se va al
    // horizonte (así el mar no "se corta"). Se ubica del lado donde está el mar.
    this.ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      // Iluminado igual que el agua jugable; el color se toma del propio sea.glb (ver refreshOcean).
      new THREE.MeshStandardMaterial({ color: 0x4d86b0 }),
    );
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = 0.04; // a la altura del agua jugable
    this.ocean.visible = false;
    scene.add(this.ocean);

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

    // Área cuadrada de influencia (cobertura) del edificio seleccionado: relleno + borde.
    // Cuadrado unidad en el plano XZ (centrado en el origen), se escala/posiciona al usar.
    this.coverageFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x66bb6a, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.coverageFill.rotation.x = -Math.PI / 2;
    this.coverageFill.position.y = 0.03;
    this.coverageFill.visible = false;
    this.coverageFill.renderOrder = 1;
    scene.add(this.coverageFill);

    const edgeGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, 0.04, -0.5),
      new THREE.Vector3(0.5, 0.04, -0.5),
      new THREE.Vector3(0.5, 0.04, 0.5),
      new THREE.Vector3(-0.5, 0.04, 0.5),
    ]);
    this.coverageEdge = new THREE.LineLoop(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: 0x66bb6a, transparent: true, opacity: 0.9 }),
    );
    this.coverageEdge.visible = false;
    this.coverageEdge.renderOrder = 2;
    scene.add(this.coverageEdge);

    scene.add(this.coverageAreaGroup);

    this.markerMats = { plan: emojiMaterial('▶️'), build: emojiMaterial('🏗️'), upgrade: emojiMaterial('💡') };
    scene.add(this.markerGroup);

    scene.add(this.bubbleGroup);

    this.lockLabelMat = emojiMaterial('🔒');
    scene.add(this.lockedGroup);

    this.smoke = new SmokeSystem(scene);
    this.fire = new FireSystem(scene);
    this.fx = new DisasterFx(scene);
    const extent = Math.max(city.width, city.height) * grid.tileSize;
    this.heroFx = new HeroFx(scene, extent);
    this.raceFx = new RaceFx(scene);
    this.airFx = new AirFx(scene, extent);
    this.trafficFx = new TrafficFx(scene, city, grid);

    this.loadModels();
  }

  // --- Carga de modelos ------------------------------------------------------

  /**
   * Carga todos los .glb en paralelo; al terminar redibuja la ciudad entera.
   * Los REQUERIDOS avisan si faltan; los OPCIONALES (variantes de calle por nivel
   * y ruinas por tamaño) cargan en silencio: si todavía no se dibujaron, el motor
   * cae al modelo base, y aparecen solos cuando se agreguen los .glb.
   */
  private loadModels(): void {
    const loader = new GLTFLoader();
    // Opcionales: calle por nivel (avenida _1 / autopista _2), ruinas 2×2/3×3 y
    // modelos todavía no dibujados (renovables) → cargan en silencio si faltan.
    const optional = [
      ...ROAD_MODELS.flatMap((r) => [`${r}_1`, `${r}_2`]),
      `${DAMAGED_MODEL}_2`,
      `${DAMAGED_MODEL}_3`,
      'solar',
      'wind',
      'hydro',
      'race_track',
      'balloon_port',
      'airship_dock',
      'mountain',
      'sea',
    ];
    const optionalSet = new Set(optional);
    const required = [
      ...new Set([
        ...Object.values(MODEL_FILE),
        ...Object.values(ZONE_MODELS).flat(),
        ...Object.values(RES_STYLE_MODELS).flat(),
        ...ROAD_MODELS,
        ...DECO_MODELS,
        ...BRIDGE_MODELS,
        ...Object.values(TERRAIN_MODEL),
        DAMAGED_MODEL,
      ]),
    ].filter((f) => !optionalSet.has(f));
    let pending = required.length + optional.length;
    const done = () => {
      if (--pending <= 0) {
        this.modelsReady = true;
        this.redrawAll();
        this.refreshOcean(); // ya cargó sea.glb → toma su color y se ubica
      }
    };
    const load = (f: string, silent: boolean) =>
      loader.load(
        `models/${f}.glb`,
        (gltf) => {
          this.models.set(f, this.normalizeTemplate(gltf.scene));
          done();
        },
        undefined,
        (err) => {
          if (!silent) console.warn(`No se pudo cargar el modelo ${f}.glb`, err);
          done();
        },
      );
    for (const f of required) load(f, false);
    for (const f of optional) load(f, true);
    this.loadLandscape(loader);
  }

  /**
   * Carga el PAISAJE completo (`landscape.glb`): un único modelo gigante con la
   * cordillera, el mar, las colinas y la meseta plana central. NO se normaliza a
   * 1×1 (respeta sus unidades 1:1) y se coloca en el origen. Si existe, oculta el
   * pasto/océano decorativos y el terreno por-casilla (lo provee el paisaje). Si
   * no está, el motor sigue con el terreno viejo sin avisar.
   */
  private loadLandscape(loader: GLTFLoader): void {
    loader.load(
      'models/landscape.glb',
      (gltf) => {
        const land = gltf.scene;
        land.traverse((o) => {
          if (o instanceof THREE.Mesh) o.receiveShadow = true;
        });
        land.position.set(0, 0, 0);
        this.sceneRef.add(land);
        this.hasLandscape = true;
        this.ground.visible = false; // el paisaje ya trae su propio pasto
        this.ocean.visible = false; // y su propio mar
        if (this.modelsReady) this.redrawAll(); // saca los cubos de terreno por-casilla
      },
      undefined,
      () => {
        /* sin paisaje: el motor sigue con el terreno por-casilla (sin avisar) */
      },
    );
  }

  /**
   * Normaliza un modelo recién cargado a una plantilla reutilizable: ocupa una
   * casilla de 1×1 en planta (manteniendo proporciones de alto), centrado en el
   * origen y apoyado en y=0. Al colocarlo se escala por el footprint real.
   */
  private normalizeTemplate(scene: THREE.Object3D): THREE.Group {
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

  /** Redibuja todas las casillas (tras cargar los modelos). */
  redrawAll(): void {
    for (let z = 0; z < this.city.height; z++) {
      for (let x = 0; x < this.city.width; x++) {
        this.updateTile(x, z, false);
      }
    }
  }

  /**
   * Ubica el océano infinito del lado del mapa que tenga más agua en el borde, y
   * lo extiende hacia afuera hasta el horizonte. Si ningún borde toca agua, lo oculta.
   */
  refreshOcean(): void {
    if (this.hasLandscape) {
      this.ocean.visible = false; // el mar lo trae el paisaje
      return;
    }
    const w = this.city.width;
    const h = this.city.height;
    const t = this.grid.tileSize;
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
    // Solo hay océano infinito si un borde es una COSTA de verdad (mucho agua en
    // ese lado). Un laguito o un río interior NO disparan el océano (quedaba feo).
    if (max < Math.max(8, Math.round(Math.min(w, h) * 0.35))) {
      this.ocean.visible = false;
      return;
    }
    // El océano toma el MISMO color que el agua jugable (sea.glb), para que no se note el corte.
    const seaTmpl = this.models.get('sea');
    if (seaTmpl) {
      seaTmpl.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial;
          if (m && m.color) (this.ocean.material as THREE.MeshStandardMaterial).color.copy(m.color);
        }
      });
    }
    const play = Math.max(w, h) * t;
    const half = play / 2;
    const margin = 1200; // se va bien lejos (mar "infinito")
    const long = play + 2 * margin;
    if (max === cN) {
      this.ocean.scale.set(long, margin, 1);
      this.ocean.position.set(0, 0.04, -half - margin / 2);
    } else if (max === cS) {
      this.ocean.scale.set(long, margin, 1);
      this.ocean.position.set(0, 0.04, half + margin / 2);
    } else if (max === cW) {
      this.ocean.scale.set(margin, long, 1);
      this.ocean.position.set(-half - margin / 2, 0.04, 0);
    } else {
      this.ocean.scale.set(margin, long, 1);
      this.ocean.position.set(half + margin / 2, 0.04, 0);
    }
    this.ocean.visible = true;
  }

  /** Dibuja el velo oscuro + candado sobre las parcelas de territorio bloqueado. */
  setLockedRegions(regions: Array<{ x: number; z: number; w: number; h: number }>): void {
    while (this.lockedPool.length < regions.length) {
      const plane = new THREE.Mesh(this.lockPlaneGeo, this.lockMat);
      plane.rotation.x = -Math.PI / 2;
      plane.renderOrder = 4;
      plane.visible = false;
      this.lockedGroup.add(plane);
      this.lockedPool.push(plane);
      const label = new THREE.Sprite(this.lockLabelMat);
      label.scale.set(1.1, 1.1, 1.1);
      label.renderOrder = 5;
      label.visible = false;
      this.lockedGroup.add(label);
      this.lockLabelPool.push(label);
    }
    for (let i = 0; i < this.lockedPool.length; i++) {
      const r = regions[i];
      const plane = this.lockedPool[i];
      const label = this.lockLabelPool[i];
      if (!r) {
        plane.visible = false;
        label.visible = false;
        continue;
      }
      const cx = (tileCenterX(r.x, this.grid) + tileCenterX(r.x + r.w - 1, this.grid)) / 2;
      const cz = (tileCenterZ(r.z, this.grid) + tileCenterZ(r.z + r.h - 1, this.grid)) / 2;
      plane.scale.set(r.w * this.grid.tileSize, r.h * this.grid.tileSize, 1);
      plane.position.set(cx, 0.12, cz); // bajo, casi sobre el piso (no tapa lo construido)
      plane.visible = true;
      label.position.set(cx, 1.2, cz);
      label.visible = true;
    }
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

  /** Actualiza los focos de incendio (llamas de partículas sobre las casillas en llamas). */
  setFires(cells: Array<{ x: number; z: number; heat: number }>): void {
    this.fire.setFires(
      cells.map((c) => ({ x: tileCenterX(c.x, this.grid), y: 0.15, z: tileCenterZ(c.z, this.grid), heat: c.heat })),
    );
  }

  /** Coloca/actualiza las burbujas de opinión sobre las casas (pool de sprites). */
  setBubbles(bubbles: Array<{ x: number; z: number; text: string; mood: 'good' | 'bad' }>): void {
    while (this.bubblePool.length < bubbles.length) {
      const sprite = new THREE.Sprite();
      sprite.renderOrder = 7;
      sprite.visible = false;
      this.bubbleGroup.add(sprite);
      this.bubblePool.push(sprite);
    }
    for (let i = 0; i < this.bubblePool.length; i++) {
      const sprite = this.bubblePool[i];
      const b = bubbles[i];
      if (!b) {
        sprite.visible = false;
        continue;
      }
      const cacheKey = `${b.mood}|${b.text}`;
      let mat = this.bubbleCache.get(cacheKey);
      if (!mat) {
        mat = bubbleMaterial(b.text, b.mood);
        this.bubbleCache.set(cacheKey, mat);
      }
      sprite.material = mat;
      const aspect = (mat.userData.aspect as number) ?? 2.5;
      const h = 0.62;
      sprite.scale.set(h * aspect, h, 1);
      // Posición: justo encima del edificio (usa la altura real del modelo si está).
      let topY = 1.4;
      const obj = this.meshes.get(this.key(b.x, b.z));
      if (obj) topY = new THREE.Box3().setFromObject(obj).max.y;
      sprite.position.set(tileCenterX(b.x, this.grid), topY + 0.55, tileCenterZ(b.z, this.grid));
      sprite.visible = true;
    }
  }

  /**
   * Muestra (o oculta) el disco del área de influencia de un edificio: `center` =
   * casilla ancla desde donde emana, `radius` en casillas, `color` por categoría.
   */
  setCoverage(center: { x: number; z: number } | null, radius: number, color: number): void {
    const key = center && radius > 0 ? `${center.x},${center.z},${radius},${color}` : '';
    if (key === this.coverageKey) return; // sin cambios → no reconstruir
    this.coverageKey = key;

    if (!center || radius <= 0) {
      this.coverageFill.visible = false;
      this.coverageEdge.visible = false;
      for (const box of this.coverageAreaPool) box.visible = false;
      return;
    }
    // Lado del cuadrado = (2·radio + 1) casillas (el área cuadrada de la influencia).
    const side = (2 * radius + 1) * this.grid.tileSize;
    const cx = tileCenterX(center.x, this.grid);
    const cz = tileCenterZ(center.z, this.grid);

    (this.coverageFill.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.coverageFill.scale.set(side, side, 1); // tras rotar X, el eje Y local cae sobre Z del mundo
    this.coverageFill.position.set(cx, 0.03, cz);
    this.coverageFill.visible = true;

    (this.coverageEdge.material as THREE.LineBasicMaterial).color.setHex(color);
    this.coverageEdge.scale.set(side, 1, side);
    this.coverageEdge.position.set(cx, 0, cz);
    this.coverageEdge.visible = true;

    // Carcasa translúcida del color sobre cada edificio dentro del cuadrado.
    this.coverageBoxMat.color.setHex(color);
    let used = 0;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = center.x + dx;
        const tz = center.z + dz;
        if (!this.city.inBounds(tx, tz) || this.city.isSubCell(tx, tz)) continue;
        const t = this.city.getTile(tx, tz);
        if (t.type === TileType.Empty || t.type === TileType.Road) continue; // solo edificios/zonas
        const obj = this.meshes.get(this.key(tx, tz));
        if (!obj) continue;
        const h = new THREE.Box3().setFromObject(obj).max.y;
        if (h <= 0.01) continue;
        const box = this.coverageBox(used++);
        const fp = t.size * this.grid.tileSize * 0.98;
        box.scale.set(fp, h * 1.04, fp);
        const bx = (tileCenterX(tx, this.grid) + tileCenterX(tx + t.size - 1, this.grid)) / 2;
        const bz = (tileCenterZ(tz, this.grid) + tileCenterZ(tz + t.size - 1, this.grid)) / 2;
        box.position.set(bx, (h * 1.04) / 2, bz);
        box.visible = true;
      }
    }
    for (let i = used; i < this.coverageAreaPool.length; i++) this.coverageAreaPool[i].visible = false;
  }

  /** Devuelve (creando si hace falta) la i-ésima carcasa del pool de cobertura. */
  private coverageBox(i: number): THREE.Mesh {
    while (this.coverageAreaPool.length <= i) {
      const m = new THREE.Mesh(this.coverageBoxGeo, this.coverageBoxMat);
      m.renderOrder = 1;
      m.visible = false;
      this.coverageAreaGroup.add(m);
      this.coverageAreaPool.push(m);
    }
    return this.coverageAreaPool[i];
  }

  /** ¿El rayo toca alguna burbuja visible? Devuelve su índice (= índice en el array), o -1. */
  pickBubble(raycaster: THREE.Raycaster): number {
    const visible = this.bubblePool.filter((s) => s.visible);
    if (visible.length === 0) return -1;
    const hits = raycaster.intersectObjects(visible, false);
    if (hits.length === 0) return -1;
    return this.bubblePool.indexOf(hits[0].object as THREE.Sprite);
  }

  /** Anima los resaltados (pulso de la selección), el fuego y el humo. Cada frame. */
  animate(timeMs: number): void {
    if (this.selected.visible) {
      const pulse = 0.45 + 0.3 * Math.sin(timeMs * 0.006);
      (this.selected.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
    const dt = this.lastAnim ? (timeMs - this.lastAnim) / 1000 : 0;
    this.lastAnim = timeMs;
    this.smoke.update(dt);
    this.fire.update(dt);
    this.fx.update(dt);
    this.heroFx.update(dt);
    this.raceFx.update(dt);
    this.airFx.update(dt);
    this.trafficFx.update(dt);
  }

  /** Más población = más autos y peatones en la calle. */
  setCrowd(population: number): void {
    this.trafficFx.setPopulation(population);
  }

  /** Carrera en curso + circuitos (anclas en casillas) por donde corren los autos. */
  setRace(active: boolean, tracks: Array<{ x: number; z: number; size: number }>): void {
    this.raceFx.setRace(
      active,
      tracks.map((t) => ({
        x: (tileCenterX(t.x, this.grid) + tileCenterX(t.x + t.size - 1, this.grid)) / 2,
        z: (tileCenterZ(t.z, this.grid) + tileCenterZ(t.z + t.size - 1, this.grid)) / 2,
        r: t.size * this.grid.tileSize * 0.4,
      })),
    );
  }

  /** Edificios de origen de las aeronaves (anclas en casillas): aviones/dirigible/globos. */
  setAirSources(
    airports: Array<{ x: number; z: number; size: number }>,
    docks: Array<{ x: number; z: number; size: number }>,
    ports: Array<{ x: number; z: number; size: number }>,
  ): void {
    const toWorld = (a: { x: number; z: number; size: number }) => ({
      x: (tileCenterX(a.x, this.grid) + tileCenterX(a.x + a.size - 1, this.grid)) / 2,
      z: (tileCenterZ(a.z, this.grid) + tileCenterZ(a.z + a.size - 1, this.grid)) / 2,
    });
    this.airFx.setSources(airports.map(toWorld), docks.map(toWorld), ports.map(toWorld));
  }

  /** Estado del héroe volador: activo + a qué incendio acudir (en casillas), o null. */
  setHero(active: boolean, target: { x: number; z: number } | null): void {
    this.heroFx.setState(
      active,
      target ? { x: tileCenterX(target.x, this.grid), z: tileCenterZ(target.z, this.grid) } : null,
    );
  }

  // --- Catástrofes (efectos visuales; reciben coordenadas de casilla) ---------

  /** Lanza un meteorito sobre la casilla (x,z); al impactar dispara `onImpact`. */
  playMeteor(x: number, z: number, onImpact: () => void): void {
    this.fx.meteor(tileCenterX(x, this.grid), tileCenterZ(z, this.grid), onImpact);
  }

  /** Anima la trompa de un tornado a lo largo del recorrido (en casillas). */
  playTornado(path: Array<{ x: number; z: number }>): void {
    this.fx.tornado(path.map((c) => ({ x: tileCenterX(c.x, this.grid), z: tileCenterZ(c.z, this.grid) })));
  }

  /** Anima el remolino de un huracán sobre toda la ciudad. */
  playHurricane(): void {
    const extent = Math.max(this.city.width, this.city.height) * this.grid.tileSize;
    this.fx.hurricane(0, 0, extent);
  }

  private key(x: number, z: number): string {
    return `${x},${z}`;
  }

  /** Aspecto de un cubo de respaldo (cuando no hay modelo cargado/disponible). */
  private appearance(tile: Tile): { color: THREE.Color; height: number; opacity: number } | null {
    if (tile.type === TileType.Empty) return null;

    // Ruina (sin el modelo de edificio dañado cargado): un montículo gris oscuro.
    if (tile.damaged) return { color: new THREE.Color(0x4a4038), height: 0.3, opacity: 1 };

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
      if (tile.type === TileType.Residential && tile.level > MAX_LEVEL) {
        const extra = tile.level - MAX_LEVEL;
        height = MAX_LEVEL * HEIGHT_PER_LEVEL + extra * HEIGHT_PER_LEVEL * 1.9;
        color = base.clone().lerp(this.white, 0.2 * extra);
      }
      return { color, height, opacity: 1 };
    }

    if (tile.type === TileType.Construction) {
      return { color: new THREE.Color(TILE_DEF[TileType.Construction].color), height: 0.3, opacity: 0.7 };
    }

    const def = TILE_DEF[tile.type];
    return { color: new THREE.Color(def.color), height: def.height ?? 0.5, opacity: 1 };
  }

  /** Aspecto del terreno natural (agua/montaña) de una casilla vacía. null = tierra normal. */
  private terrainAppearance(kind: TerrainKind, x: number, z: number): { color: THREE.Color; height: number; opacity: number } | null {
    if (this.hasLandscape) return null; // el paisaje único reemplaza los cubos de terreno
    if (kind === 'water') {
      return { color: new THREE.Color(0x1565c0), height: 0.06, opacity: 0.78 };
    }
    if (kind === 'mountain') {
      const h = 1.0 + ((x * 7 + z * 13) % 5) * 0.28;
      return { color: new THREE.Color(0x6d6052), height: h, opacity: 1 };
    }
    if (kind === 'beach') {
      return { color: new THREE.Color(0xe6d29a), height: 0.05, opacity: 1 }; // arena
    }
    return null;
  }

  /** ¿Es calle la casilla en (x,z)? (con chequeo de límites) */
  private isRoad(x: number, z: number): boolean {
    return this.city.inBounds(x, z) && this.city.getTile(x, z).type === TileType.Road;
  }

  /** Máscara de calles vecinas (N/E/S/W) para el auto-tiling. */
  private roadMask(x: number, z: number): number {
    let m = 0;
    if (this.isRoad(x, z - 1)) m |= N;
    if (this.isRoad(x + 1, z)) m |= E;
    if (this.isRoad(x, z + 1)) m |= S;
    if (this.isRoad(x - 1, z)) m |= W;
    return m;
  }

  /** Nombre del modelo (y rotación) para un tile, o null si no corresponde modelo. */
  private modelFor(tile: Tile, x: number, z: number): { file: string; rotY: number } | null {
    if (tile.type === TileType.Road) {
      const mask = this.roadMask(x, z);
      // Sobre agua, la calle es un PUENTE: pieza recta orientada según el cruce.
      if (this.city.getTerrain(x, z) === 'water' && this.models.has('bridge_straight')) {
        const horizontal = (mask & E) !== 0 || (mask & W) !== 0;
        return { file: 'bridge_straight', rotY: horizontal ? ROAD_ROT_SIGN * (Math.PI / 2) : 0 };
      }
      const { file, k } = roadModel(mask);
      // Avenida/autopista usan un modelo propio (`X_1` / `X_2`) si existe; si no, la calle base.
      const variant = tile.level > 0 ? `${file}_${tile.level}` : file;
      const chosen = this.models.has(variant) ? variant : file;
      return { file: chosen, rotY: ROAD_ROT_SIGN * k * (Math.PI / 2) };
    }
    if (tile.type === TileType.Residential) {
      if (tile.level <= 0) return null; // solar vacío → cubo plano
      const ladder = RES_STYLE_MODELS[tile.style] ?? RES_STYLE_MODELS.default;
      return { file: ladder[clamp(tile.level, 1, ladder.length) - 1], rotY: 0 };
    }
    // Paisaje: árbol/roca eligen variante por casilla y rotan para no verse clonados.
    if (tile.type === TileType.Tree) {
      const file = this.city.getTerrain(x, z) === 'beach' ? 'tree_palm' : TREE_MODELS[(x * 3 + z) % TREE_MODELS.length];
      return { file, rotY: ((x + z) % 4) * (Math.PI / 2) };
    }
    if (tile.type === TileType.Rock) {
      return { file: ROCK_MODELS[(x * 2 + z) % ROCK_MODELS.length], rotY: ((x * 5 + z) % 4) * (Math.PI / 2) };
    }
    const zoneModels = ZONE_MODELS[tile.type];
    if (zoneModels) {
      if (tile.level <= 0) return null; // solar vacío → cubo plano
      return { file: zoneModels[clamp(tile.level, 1, zoneModels.length) - 1], rotY: 0 };
    }
    const file = MODEL_FILE[tile.type];
    return file ? { file, rotY: 0 } : null;
  }

  /** Instancia el modelo de un tile (clon de la plantilla), o null si no está disponible. */
  private buildModel(tile: Tile, x: number, z: number): THREE.Object3D | null {
    // Edificio dañado: se muestra la ruina genérica (si su modelo cargó).
    let file: string;
    let rotY = 0;
    if (tile.damaged) {
      // Ruina por tamaño (`building_burnt_2/_3`) si existe; si no, escala la de 1×1.
      const sized = `${DAMAGED_MODEL}_${tile.size}`;
      file = tile.size > 1 && this.models.has(sized) ? sized : DAMAGED_MODEL;
    } else {
      const spec = this.modelFor(tile, x, z);
      if (!spec) return null;
      file = spec.file;
      rotY = spec.rotY;
    }
    const tmpl = this.models.get(file);
    if (!tmpl) return null; // todavía no cargó → cubo de respaldo

    const inst = tmpl.clone(true);
    const size = tile.size;
    const fullTile = !tile.damaged && tile.type === TileType.Road; // las calles cubren toda la casilla
    const base = fullTile ? this.grid.tileSize : this.grid.tileSize * 0.9;
    const footprint = base + (size - 1) * this.grid.tileSize;
    inst.scale.setScalar(footprint);
    inst.rotation.y = rotY;

    const cx = (tileCenterX(x, this.grid) + tileCenterX(x + size - 1, this.grid)) / 2;
    const cz = (tileCenterZ(z, this.grid) + tileCenterZ(z + size - 1, this.grid)) / 2;
    inst.position.set(cx, 0, cz);

    const isRoad = tile.type === TileType.Road;
    const roadMats: THREE.Material[] = [];
    const roadBase: THREE.Color[] = [];
    inst.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (isRoad) {
        // Clona los materiales de la calle para teñirlos por tráfico sin afectar otros clones.
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const cloned = mats.map((m) => m.clone());
        o.material = Array.isArray(o.material) ? cloned : cloned[0];
        for (const m of cloned) {
          roadMats.push(m);
          roadBase.push(((m as THREE.MeshStandardMaterial).color ?? this.roadLow).clone());
        }
      }
    });
    if (isRoad) inst.userData = { roadMats, roadBase };
    return inst;
  }

  /** Instancia el modelo de un terreno (playa), cubriendo la casilla. null si no aplica. */
  private buildTerrainModel(terrain: TerrainKind, x: number, z: number): THREE.Object3D | null {
    if (this.hasLandscape) return null; // el paisaje único ya dibuja montaña/mar/playa
    const file = TERRAIN_MODEL[terrain];
    if (!file) return null;
    const tmpl = this.models.get(file);
    if (!tmpl) return null;
    const inst = tmpl.clone(true);
    if (terrain === 'mountain') {
      // Más grandes que la casilla (se solapan → cadena continua) y con picos de
      // distinta altura y rotación, para que parezca una cordillera y no cubos 1×1.
      const h = (x * 7 + z * 13) % 5; // 0..4
      const w = 1.5 * this.grid.tileSize;
      inst.scale.set(w, (1.5 + h * 0.35) * this.grid.tileSize, w);
      inst.rotation.y = ((x * 3 + z) % 4) * (Math.PI / 2);
    } else {
      inst.scale.setScalar(this.grid.tileSize);
    }
    inst.position.set(tileCenterX(x, this.grid), 0, tileCenterZ(z, this.grid));
    inst.userData = { terrain: true }; // no es edificio: no recibe glow de selección
    inst.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.receiveShadow = true;
        if (terrain === 'mountain') o.castShadow = true;
      }
    });
    return inst;
  }

  /** Cubo de color de respaldo (solares, obra, terreno, o mientras cargan los modelos). */
  private buildCube(
    look: { color: THREE.Color; height: number; opacity: number },
    tile: Tile,
    x: number,
    z: number,
    fullTile: boolean,
  ): THREE.Mesh {
    const size = tile.size;
    const base = fullTile ? this.grid.tileSize : this.grid.tileSize * 0.9;
    const footprint = base + (size - 1) * this.grid.tileSize;
    const mesh = new THREE.Mesh(
      this.cube,
      new THREE.MeshStandardMaterial({
        color: look.color,
        transparent: look.opacity < 1,
        opacity: look.opacity,
      }),
    );
    mesh.scale.set(footprint, look.height, footprint);
    const cx = (tileCenterX(x, this.grid) + tileCenterX(x + size - 1, this.grid)) / 2;
    const cz = (tileCenterZ(z, this.grid) + tileCenterZ(z + size - 1, this.grid)) / 2;
    mesh.position.set(cx, look.height / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { cube: true };
    return mesh;
  }

  /** Libera los recursos propios de un objeto al quitarlo (no toca los compartidos). */
  private disposeObject(o: THREE.Object3D): void {
    const ud = o.userData as { cube?: boolean; roadMats?: THREE.Material[] };
    if (ud.roadMats) {
      for (const m of ud.roadMats) m.dispose();
    } else if (o instanceof THREE.Mesh && ud.cube) {
      (o.material as THREE.Material).dispose(); // geometría (this.cube) es compartida: no se libera
    }
  }

  updateTile(x: number, z: number, cascade = true): void {
    const k = this.key(x, z);

    const old = this.meshes.get(k);
    if (old) {
      if (k === this.highlightKey) this.clearHighlight(); // restaura el material antes de descartar el modelo
      this.group.remove(old);
      this.disposeObject(old);
      this.meshes.delete(k);
    }
    this.smoke.removeEmitter(k); // si había chimenea acá, se reevalúa abajo

    // Las sub-celdas de un edificio multi-casilla no dibujan nada: solo el ancla.
    if (this.city.isSubCell(x, z)) {
      this.cascadeRoads(x, z, cascade);
      return;
    }

    const tile = this.city.getTile(x, z);
    const terrain = this.city.getTerrain(x, z);

    // 1) Modelo glTF, si hay uno disponible para este tile.
    const model = this.buildModel(tile, x, z);
    if (model) {
      this.group.add(model);
      this.meshes.set(k, model);
      if (SMOKING.has(tile.type) && !tile.damaged) {
        // Chimenea en la cima del modelo (un toque adentro del borde superior).
        const top = new THREE.Box3().setFromObject(model).max.y;
        this.smoke.setEmitter(k, model.position.x, top * 0.92, model.position.z);
      }
      this.cascadeRoads(x, z, cascade);
      return;
    }

    // 1b) Terreno con modelo propio (playa con beach_sand).
    if (tile.type === TileType.Empty) {
      const terrModel = this.buildTerrainModel(terrain, x, z);
      if (terrModel) {
        this.group.add(terrModel);
        this.meshes.set(k, terrModel);
        this.cascadeRoads(x, z, cascade);
        return;
      }
    }

    // 2) Cubo de respaldo (terreno natural, solares, obra, o modelo aún sin cargar).
    const look = this.appearance(tile) ?? (tile.type === TileType.Empty ? this.terrainAppearance(terrain, x, z) : null);
    if (look) {
      const fullTile = tile.type === TileType.Road || (tile.type === TileType.Empty && terrain !== 'land');
      const mesh = this.buildCube(look, tile, x, z, fullTile);
      this.group.add(mesh);
      this.meshes.set(k, mesh);
    }
    this.cascadeRoads(x, z, cascade);
  }

  /** Re-teja las calles vecinas (cambió esta casilla → puede alterar su forma). */
  private cascadeRoads(x: number, z: number, cascade: boolean): void {
    if (!cascade || !this.modelsReady) return;
    const neigh: Array<[number, number]> = [[x, z - 1], [x + 1, z], [x, z + 1], [x - 1, z]];
    for (const [nx, nz] of neigh) {
      if (this.isRoad(nx, nz)) this.updateTile(nx, nz, false);
    }
  }

  /** Recolorea las carreteras según su congestión (gris = libre, rojo = saturada). */
  refreshTraffic(getCongestion: (x: number, z: number) => number): void {
    for (const [k, obj] of this.meshes) {
      const comma = k.indexOf(',');
      const x = Number(k.slice(0, comma));
      const z = Number(k.slice(comma + 1));
      if (this.city.getTile(x, z).type !== TileType.Road) continue;
      const t = Math.min(1, getCongestion(x, z) / 1.5);
      const ud = obj.userData as { roadMats?: THREE.Material[]; roadBase?: THREE.Color[] };
      if (ud.roadMats && ud.roadBase) {
        for (let i = 0; i < ud.roadMats.length; i++) {
          const m = ud.roadMats[i] as THREE.MeshStandardMaterial;
          if (m.color) m.color.copy(ud.roadBase[i]).lerp(this.roadHigh, t);
        }
      } else if (obj instanceof THREE.Mesh) {
        (obj.material as THREE.MeshStandardMaterial).color.copy(this.roadLow).lerp(this.roadHigh, t);
      }
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

  /**
   * Ilumina el modelo del edificio bajo el cursor (glow dorado) para previsualizar
   * qué se va a seleccionar. Devuelve true si efectivamente iluminó un edificio
   * (así el llamador puede ocultar el resaltado del piso). Para solares vacíos,
   * calles y terreno natural devuelve false (no hay edificio que iluminar).
   */
  setHighlight(coord: { x: number; z: number } | null): boolean {
    const target = this.resolveHighlight(coord);
    if (target && target.key === this.highlightKey) return true; // sin cambios
    this.clearHighlight();
    if (!target) return false;

    target.obj.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const orig = o.material;
      const clones = (Array.isArray(orig) ? orig : [orig]).map((m) => {
        const c = m.clone();
        const std = c as THREE.MeshStandardMaterial;
        if (std.emissive) {
          std.emissive.copy(this.highlightColor);
          std.emissiveIntensity = 0.45;
        }
        return c;
      });
      o.material = Array.isArray(orig) ? clones : clones[0];
      this.highlightSaved.push({ mesh: o, orig, clones });
    });
    this.highlightKey = target.key;
    return true;
  }

  /** Restaura los materiales originales del modelo resaltado (si hay alguno). */
  private clearHighlight(): void {
    for (const s of this.highlightSaved) {
      s.mesh.material = s.orig;
      for (const c of s.clones) c.dispose();
    }
    this.highlightSaved = [];
    this.highlightKey = null;
  }

  /** Resuelve el modelo de edificio bajo `coord` (vía su ancla), o null si no aplica. */
  private resolveHighlight(coord: { x: number; z: number } | null): { key: string; obj: THREE.Object3D } | null {
    if (!coord || !this.city.inBounds(coord.x, coord.z)) return null;
    const tile = this.city.getTile(coord.x, coord.z);
    const ax = tile.anchor ? tile.anchor.x : coord.x;
    const az = tile.anchor ? tile.anchor.z : coord.z;
    const key = this.key(ax, az);
    const obj = this.meshes.get(key);
    if (!obj) return null;
    const ud = obj.userData as { cube?: boolean; roadMats?: THREE.Material[]; terrain?: boolean };
    if (ud.cube || ud.roadMats || ud.terrain) return null; // cubo plano / calle / terreno → sin glow
    return { key, obj };
  }
}
