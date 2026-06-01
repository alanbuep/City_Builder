// ---------------------------------------------------------------------------
// Tipos y constantes de la SIMULACIÓN. Nada de Three.js aquí.
// ---------------------------------------------------------------------------

/** Qué hay en una casilla. */
export enum TileType {
  Empty = 'empty',
  Road = 'road',
  Residential = 'residential',
  Commercial = 'commercial',
  Industrial = 'industrial',
  // Fábricas: dan empleos industriales, no crecen por nivel. Las prefabricadas
  // se plopean; la mediana también surge al fusionarse zonas industriales.
  FactorySmall = 'factory_s',
  FactoryMedium = 'factory_m',
  FactoryLarge = 'factory_l',
  // Amenidades (suben el valor del suelo):
  Park = 'park',
  Plaza = 'plaza',
  Stadium = 'stadium',
  Museum = 'museum',
  // Servicios (dan cobertura; las zonas la necesitan para crecer):
  Police = 'police',
  Fire = 'fire',
  Government = 'government',
  // Servicios básicos (luz/agua/gas): hacen falta para que las zonas crezcan alto:
  PowerPlant = 'power',
  WaterTower = 'water',
  GasPlant = 'gas',
  // Energías renovables (NO contaminan):
  SolarPlant = 'solar', // Planta solar
  WindTurbine = 'wind', // Parque eólico
  HydroPlant = 'hydro', // Represa hidroeléctrica (hay que ponerla junto al agua)
  // Comercios especializados (se desbloquean con tecnología): dan empleos comerciales.
  ShoppingMall = 'mall',
  Hotel = 'hotel',
  OfficeTower = 'office',
  // Industria especializada (empleo limpio):
  TechPark = 'techpark',
  // Ciencia e investigación: generan "puntos de ciencia" que desbloquean lo más avanzado.
  ResearchLab = 'research_lab', // Laboratorio de investigación
  Observatory = 'observatory', // Observatorio
  SciencePark = 'science_park', // Parque científico
  SpaceCenter = 'space_center', // Centro espacial (el hito científico máximo)
  // El héroe (estilo Superman): se desbloquea al final y mitiga catástrofes.
  HeroHQ = 'hero_hq', // Cuartel del héroe (mientras esté en pie, la ciudad tiene héroe)
  HeroBeacon = 'hero_beacon', // Señal para llamar al héroe (prestigio)
  HeroStatue = 'hero_statue', // Estatua del héroe (gran prestigio / valor del suelo)
  // Cadena de materiales: productoras + almacén (corralón) + capstone tecnológico.
  SandPit = 'sandpit', // Arenera (arena)
  CementPlant = 'cement', // Cementera (arena → cemento)
  BrickKiln = 'brickkiln', // Ladrillería (arena → ladrillo)
  BuildYard = 'buildyard', // Corralón (almacena materiales)
  TechCompany = 'techco', // Empresa tecnológica (requiere materiales + corralón)
  // Bienestar (cobertura de educación / salud):
  School = 'school',
  University = 'university',
  Hospital = 'hospital',
  Clinic = 'clinic',
  // Ocio (empleos comerciales + valor del suelo; el casino además renta):
  Casino = 'casino',
  Cinema = 'cinema',
  AmusementPark = 'amusement',
  RaceTrack = 'race_track', // Circuito de carreras (gran atracción + días de evento)
  BalloonPort = 'balloon_port', // Globopuerto: de acá salen los globos aerostáticos
  AirshipDock = 'airship_dock', // Hangar de dirigibles: de acá sale el dirigible
  // Comunidad / hitos / transporte:
  Church = 'church',
  Library = 'library',
  Monument = 'monument',
  Airport = 'airport',
  // Transporte público: alivian el tráfico de las calles cercanas.
  BusStop = 'busstop', // Parada de colectivo
  TramStop = 'tramstop', // Parada de tranvía
  MetroStation = 'metro', // Estación de metro
  // Comercio de materiales / exportación:
  Hardware = 'hardware', // Ferretería (vende materiales del corralón a la ciudad)
  ExportTerminal = 'export', // Terminal de exportación (vende el excedente al exterior)
  // Casas de comida (comercio + cobertura de comida, una necesidad de la población):
  Cafe = 'cafe',
  Diner = 'diner',
  Restaurant = 'restaurant',
  Market = 'market',
  // Locales de comida temáticos (bien identificables; reemplazan a la vieja "zona comercial"):
  Pizzeria = 'pizzeria',
  Burger = 'burger', // Hamburguesería
  HotDog = 'hotdog', // Panchería
  IceCream = 'icecream', // Heladería
  Bakery = 'bakery', // Panadería
  // Negocios variados (comercio: empleos, algunos con renta o cobertura):
  Kiosk = 'kiosk',
  Boutique = 'boutique',
  Pharmacy = 'pharmacy',
  Bank = 'bank',
  GasStation = 'gasstation',
  Dealership = 'dealership',
  // Cadena profunda de producción (alimenta la empresa tecnológica):
  SawMill = 'sawmill', // Aserradero (madera)
  SteelMill = 'steelmill', // Acería (acero)
  ElectronicsFactory = 'electronics', // Fábrica de electrónica (acero → electrónica)
  // Decoración / paisaje (se plopean al instante, sin calle; suben un poco el valor del suelo):
  Tree = 'tree',
  Rock = 'rock',
  Bush = 'bush',
  Flowers = 'flowers',
  // Obra en construcción: ocupa el terreno hasta que se completa y aparece el edificio real.
  Construction = 'construction',
}

/**
 * Tipo de terreno de una casilla (independiente de lo construido):
 *  - 'land' = tierra normal, edificable.
 *  - 'water' = lago/río: NO se puede construir; sube el valor del suelo cercano.
 *  - 'mountain' = montaña: NO se puede construir.
 */
export type TerrainKind = 'land' | 'water' | 'mountain' | 'beach';

/**
 * Estilo de un barrio residencial. Cada uno usa su propia escalera de modelos y
 * tiene un sesgo de jugabilidad (densidad, tope de nivel, sensibilidad a la
 * contaminación). `default` es la torre clásica que llega a rascacielos.
 */
export type ResidentialStyle = 'default' | 'eco' | 'luxury' | 'suburb';

/** Materiales de construcción (cadena de producción). */
export type Material = 'arena' | 'cemento' | 'ladrillo' | 'madera' | 'acero' | 'electronica';
export const MATERIALS: Material[] = ['arena', 'cemento', 'ladrillo', 'madera', 'acero', 'electronica'];
/** Una cantidad de materiales (los ausentes valen 0). */
export type MaterialBag = Partial<Record<Material, number>>;
export const MATERIAL_LABEL: Record<Material, string> = {
  arena: 'Arena',
  cemento: 'Cemento',
  ladrillo: 'Ladrillo',
  madera: 'Madera',
  acero: 'Acero',
  electronica: 'Electrónica',
};
export const MATERIAL_ICON: Record<Material, string> = {
  arena: '⏳',
  cemento: '🪨',
  ladrillo: '🧱',
  madera: '🪵',
  acero: '⚙️',
  electronica: '🔌',
};
/** Capacidad de almacenamiento por material de cada corralón. */
export const CORRALON_CAP = 300;

/** Precio de mercado de cada material (venta local / exportación). */
export const MATERIAL_PRICE: Record<Material, number> = {
  arena: 4,
  cemento: 9,
  ladrillo: 8,
  madera: 6,
  acero: 14,
  electronica: 25,
};

/** Nivel máximo de una zona comercial/industrial. */
export const MAX_LEVEL = 3;
/** Las zonas residenciales pueden seguir creciendo hasta rascacielos (niveles 4-5). */
export const RES_MAX_LEVEL = 5;

/** Carreteras: niveles, capacidad de tráfico y nombres. */
export const ROAD_MAX_LEVEL = 2;
export const ROAD_CAPACITY = [40, 100, 220]; // por nivel: calle / avenida / autopista
export const ROAD_LEVEL_NAME = ['Calle', 'Avenida', 'Autopista'];

/**
 * Estado de una casilla.
 * - Zonas R/C/I: `level` 0 = solar vacío, 1..MAX_LEVEL = edificio.
 * - Carreteras: `level` 0..ROAD_MAX_LEVEL = calle/avenida/autopista.
 */
export interface Tile {
  type: TileType;
  level: number;
  // Edificios multi-casilla: si esta celda pertenece a uno, `anchor` apunta a
  // la celda "ancla" (esquina superior-izquierda) que guarda los datos. `size`
  // es el lado del footprint (válido en el ancla). 1×1 normal: anchor=null, size=1.
  anchor: { x: number; z: number } | null;
  size: number;
  // Dañado por una catástrofe: el edificio sigue en pie como ruina (no funciona,
  // no aporta nada) hasta que el jugador lo REPARE o lo demuela. Vive en el ancla.
  damaged: boolean;
  // Estilo del barrio (solo aplica a Residential): cambia densidad, tope y modelos.
  style: ResidentialStyle;
}

/** Influencia radial que emite un edificio (amenidad o servicio). */
export interface Influence {
  radius: number;
  strength: number;
  capacity?: number; // (servicios) cuántos habitantes puede atender antes de saturarse
}

/** Servicios básicos que la ciudad produce/consume de forma global. */
export type UtilityKind = 'power' | 'water' | 'gas';

/** Lo que produce un edificio de servicios básicos (central, torre de agua...). */
export interface Production {
  kind: UtilityKind;
  amount: number;
}

/** Definición de cada tipo: lo que cuesta, cómo se ve y qué efecto tiene. */
export interface TileDef {
  cost: number; // costo de colocar
  color: number; // color base para el render
  height?: number; // altura fija (amenidades/servicios; zonas y calles se calculan aparte)
  upkeep?: number; // mantenimiento mensual
  size?: number; // lado del footprint (1 = una casilla; 2 = 2×2; etc.)
  jobs?: number; // empleos industriales que aporta (fábricas)
  shopJobs?: number; // empleos comerciales que aporta (negocios ploppables)
  amenity?: Influence; // suma "valor del suelo"
  service?: Influence; // suma "cobertura de servicios" (policía/bomberos/gobierno)
  education?: Influence; // suma "cobertura educativa" (escuela/universidad)
  health?: Influence; // suma "cobertura de salud" (hospital/clínica)
  food?: Influence; // suma "cobertura de comida" (cafés/restaurantes/mercados)
  transit?: Influence; // alivia el tráfico de las calles cercanas (transporte público)
  pollution?: { radius: number; strength: number }; // contaminación: baja el valor del suelo y frena el crecimiento en su área cuadrada
  research?: number; // puntos de ciencia que produce por mes (laboratorios/observatorios/etc.) — necesita energía
  hero?: boolean; // mientras este edificio esté en pie (sano), la ciudad tiene héroe (mitiga catástrofes)
  needsWater?: boolean; // solo se puede colocar junto al agua (represas, puertos)
  decoration?: boolean; // paisaje: se plopea al instante, sin calle ni obra (árboles, rocas…)
  raceTrack?: boolean; // circuito de carreras: organiza "días de evento" que dan renta extra
  launchesBalloons?: boolean; // globopuerto: de acá salen los globos aerostáticos (ambiente)
  launchesBlimp?: boolean; // hangar: de acá sale el dirigible (ambiente)
  income?: number; // renta fija mensual que genera (p. ej. casino)
  produces?: Production; // genera un servicio básico para toda la ciudad (luz/agua/gas)
  // --- Cadena de materiales ---
  makes?: { material: Material; amount: number }; // produce este material por mes (necesita energía + corralón conectado)
  needsMaterial?: { material: Material; amount: number }; // insumo que consume por mes (lo toma del corralón conectado)
  storesMaterials?: boolean; // corralón: almacena materiales y es el centro de distribución
  sellsMaterials?: boolean; // ferretería: vende materiales del corralón conectado a la población (renta)
  exportsMaterials?: boolean; // terminal: exporta el excedente del corralón conectado (renta)
  build?: MaterialBag; // materiales que cuesta CONSTRUIRLO (una vez, al colocarlo)
  needsYard?: boolean; // requiere un corralón conectado por calle (y saca de él los materiales)
}

export const TILE_DEF: Record<TileType, TileDef> = {
  [TileType.Empty]: { cost: 0, color: 0x000000 },
  [TileType.Road]: { cost: 10, color: 0x555555, upkeep: 0.5 },
  [TileType.Residential]: { cost: 20, color: 0x4caf50 },
  [TileType.Commercial]: { cost: 20, color: 0x2196f3 },
  [TileType.Industrial]: { cost: 20, color: 0xffc107 },

  [TileType.FactorySmall]: { cost: 80, color: 0xe65100, height: 0.8, upkeep: 1, jobs: 20, pollution: { radius: 2, strength: 0.4 }, build: { ladrillo: 10, cemento: 6 } },
  [TileType.FactoryMedium]: { cost: 300, color: 0xe65100, height: 1.2, upkeep: 3, size: 2, jobs: 90, pollution: { radius: 3, strength: 0.6 }, build: { ladrillo: 28, cemento: 18, madera: 8 } },
  [TileType.FactoryLarge]: { cost: 700, color: 0xbf360c, height: 1.7, upkeep: 6, size: 3, jobs: 220, pollution: { radius: 4, strength: 0.9 }, build: { ladrillo: 45, cemento: 35, acero: 15 } },

  [TileType.Park]: { cost: 50, color: 0x2e7d32, height: 0.28, amenity: { radius: 3, strength: 0.6 }, build: { madera: 6 } },
  [TileType.Plaza]: { cost: 30, color: 0x66bb6a, height: 0.2, amenity: { radius: 2, strength: 0.4 }, build: { ladrillo: 4 } },
  [TileType.Stadium]: { cost: 400, color: 0x8e24aa, height: 1.6, upkeep: 5, size: 2, amenity: { radius: 5, strength: 1.0 }, build: { cemento: 45, ladrillo: 30 } },
  [TileType.Museum]: { cost: 250, color: 0xab47bc, height: 1.0, upkeep: 3, amenity: { radius: 4, strength: 0.8 }, build: { ladrillo: 15, cemento: 10 } },

  [TileType.Police]: { cost: 200, color: 0x1565c0, height: 0.9, upkeep: 4, service: { radius: 5, strength: 1.0, capacity: 250 }, build: { ladrillo: 12, cemento: 8 } },
  [TileType.Fire]: { cost: 200, color: 0xc62828, height: 0.9, upkeep: 4, service: { radius: 5, strength: 1.0, capacity: 250 }, build: { ladrillo: 12, cemento: 8 } },
  [TileType.Government]: { cost: 500, color: 0x546e7a, height: 1.4, upkeep: 8, size: 2, service: { radius: 7, strength: 1.5, capacity: 600 }, build: { cemento: 40, ladrillo: 28 } },

  [TileType.PowerPlant]: { cost: 500, color: 0xfdd835, height: 1.5, upkeep: 6, size: 2, produces: { kind: 'power', amount: 400 }, pollution: { radius: 4, strength: 0.8 }, build: { cemento: 30, ladrillo: 20 } },
  [TileType.WaterTower]: { cost: 300, color: 0x29b6f6, height: 1.3, upkeep: 4, produces: { kind: 'water', amount: 350 }, build: { cemento: 14, ladrillo: 8 } },
  [TileType.GasPlant]: { cost: 350, color: 0xff7043, height: 1.2, upkeep: 4, produces: { kind: 'gas', amount: 320 }, pollution: { radius: 3, strength: 0.6 }, build: { cemento: 14, ladrillo: 10 } },

  // Renovables: energía limpia (NO contaminan). La hidro necesita agua al lado.
  [TileType.SolarPlant]: { cost: 450, color: 0x42a5f5, height: 0.4, upkeep: 5, size: 2, produces: { kind: 'power', amount: 220 }, build: { cemento: 18, acero: 12, electronica: 8 } },
  [TileType.WindTurbine]: { cost: 250, color: 0xeceff1, height: 2.4, upkeep: 3, produces: { kind: 'power', amount: 150 }, build: { acero: 10, electronica: 4 } },
  [TileType.HydroPlant]: { cost: 600, color: 0x4fc3f7, height: 1.4, upkeep: 6, size: 2, produces: { kind: 'power', amount: 380 }, needsWater: true, build: { cemento: 40, acero: 20 } },

  [TileType.ShoppingMall]: { cost: 400, color: 0x00897b, height: 1.1, upkeep: 5, size: 2, shopJobs: 70, amenity: { radius: 3, strength: 0.4 }, build: { ladrillo: 30, cemento: 20 } },
  [TileType.Hotel]: { cost: 450, color: 0xd81b60, height: 1.8, upkeep: 5, size: 2, shopJobs: 50, amenity: { radius: 5, strength: 0.8 }, build: { ladrillo: 28, cemento: 20, madera: 12 } },
  [TileType.OfficeTower]: { cost: 500, color: 0x3949ab, height: 2.6, upkeep: 6, shopJobs: 100, build: { cemento: 25, ladrillo: 18, madera: 8 } },
  [TileType.TechPark]: { cost: 700, color: 0x00acc1, height: 1.0, upkeep: 7, size: 2, jobs: 150, amenity: { radius: 3, strength: 0.5 }, build: { ladrillo: 28, cemento: 20, madera: 12 } },

  // Ciencia e investigación: producen puntos de ciencia (con energía). Algunos dan empleo limpio + valor del suelo.
  [TileType.ResearchLab]: { cost: 300, color: 0x26c6da, height: 1.0, upkeep: 4, jobs: 30, research: 4, amenity: { radius: 2, strength: 0.3 }, build: { cemento: 12, ladrillo: 10 } },
  [TileType.Observatory]: { cost: 350, color: 0x5c6bc0, height: 1.3, upkeep: 4, research: 5, amenity: { radius: 3, strength: 0.5 }, build: { cemento: 10, ladrillo: 8, acero: 4 } },
  [TileType.SciencePark]: { cost: 700, color: 0x7e57c2, height: 1.1, upkeep: 7, size: 2, jobs: 100, research: 12, amenity: { radius: 3, strength: 0.5 }, build: { cemento: 24, ladrillo: 18, electronica: 6 } },
  [TileType.SpaceCenter]: { cost: 1500, color: 0xeceff1, height: 1.8, upkeep: 14, size: 3, jobs: 150, research: 30, amenity: { radius: 6, strength: 1.2 }, build: { cemento: 60, acero: 40, electronica: 25 } },

  // El héroe: el cuartel (HeroHQ) le da a la ciudad un héroe que apaga incendios solo.
  [TileType.HeroHQ]: { cost: 2000, color: 0x1e88e5, height: 1.8, upkeep: 12, size: 2, hero: true, amenity: { radius: 5, strength: 1.0 }, build: { cemento: 50, acero: 30, electronica: 20 } },
  [TileType.HeroBeacon]: { cost: 400, color: 0xffd54f, height: 1.2, upkeep: 3, amenity: { radius: 3, strength: 0.5 }, build: { acero: 8, electronica: 4 } },
  [TileType.HeroStatue]: { cost: 800, color: 0xb0bec5, height: 2.0, upkeep: 4, amenity: { radius: 5, strength: 1.2 }, build: { cemento: 30, acero: 10 } },

  [TileType.SandPit]: { cost: 150, color: 0xd2b48c, height: 0.6, upkeep: 2, jobs: 10, makes: { material: 'arena', amount: 16 } },
  [TileType.CementPlant]: { cost: 250, color: 0x90a4ae, height: 1.1, upkeep: 3, jobs: 15, pollution: { radius: 3, strength: 0.6 }, needsMaterial: { material: 'arena', amount: 6 }, makes: { material: 'cemento', amount: 4 } },
  [TileType.BrickKiln]: { cost: 250, color: 0xb24a3a, height: 1.0, upkeep: 3, jobs: 15, pollution: { radius: 2, strength: 0.5 }, needsMaterial: { material: 'arena', amount: 6 }, makes: { material: 'ladrillo', amount: 5 } },
  [TileType.BuildYard]: { cost: 300, color: 0x8d6e63, height: 0.8, upkeep: 3, size: 2, shopJobs: 20, storesMaterials: true },
  [TileType.TechCompany]: { cost: 800, color: 0x00bcd4, height: 1.5, upkeep: 8, size: 2, jobs: 200, amenity: { radius: 3, strength: 0.4 }, build: { ladrillo: 30, acero: 30, electronica: 15 }, needsYard: true },

  [TileType.School]: { cost: 200, color: 0xffb300, height: 0.9, upkeep: 4, education: { radius: 5, strength: 1.0, capacity: 300 }, build: { ladrillo: 10, madera: 8 } },
  [TileType.University]: { cost: 500, color: 0x6d4c41, height: 1.3, upkeep: 8, size: 2, education: { radius: 7, strength: 1.6, capacity: 800 }, build: { ladrillo: 30, cemento: 18, madera: 14 } },
  [TileType.Hospital]: { cost: 500, color: 0xe57373, height: 1.3, upkeep: 8, size: 2, health: { radius: 7, strength: 1.6, capacity: 800 }, build: { ladrillo: 30, cemento: 24 } },
  [TileType.Clinic]: { cost: 200, color: 0xffab91, height: 0.9, upkeep: 4, health: { radius: 5, strength: 1.0, capacity: 300 }, build: { ladrillo: 10, cemento: 5 } },

  [TileType.Casino]: { cost: 600, color: 0xffca28, height: 1.2, upkeep: 8, size: 2, shopJobs: 60, amenity: { radius: 3, strength: 0.5 }, income: 40, build: { cemento: 28, ladrillo: 24 } },
  [TileType.Cinema]: { cost: 200, color: 0x5c6bc0, height: 0.9, upkeep: 3, shopJobs: 25, amenity: { radius: 3, strength: 0.5 }, build: { ladrillo: 12, cemento: 6 } },
  [TileType.AmusementPark]: { cost: 500, color: 0xec407a, height: 1.1, upkeep: 6, size: 2, shopJobs: 40, amenity: { radius: 6, strength: 1.2 }, build: { ladrillo: 30, madera: 18 } },
  [TileType.RaceTrack]: { cost: 900, color: 0x37474f, height: 0.4, upkeep: 8, size: 3, shopJobs: 40, raceTrack: true, amenity: { radius: 6, strength: 1.0 }, build: { cemento: 50, acero: 20 } },
  [TileType.BalloonPort]: { cost: 220, color: 0xff8a65, height: 0.8, upkeep: 3, shopJobs: 8, launchesBalloons: true, amenity: { radius: 3, strength: 0.5 }, build: { cemento: 8, ladrillo: 6 } },
  [TileType.AirshipDock]: { cost: 450, color: 0x90a4ae, height: 1.9, upkeep: 4, size: 2, shopJobs: 10, launchesBlimp: true, amenity: { radius: 4, strength: 0.6 }, build: { cemento: 18, acero: 10 } },

  [TileType.Church]: { cost: 250, color: 0xefebe9, height: 1.3, upkeep: 3, amenity: { radius: 4, strength: 0.7 }, build: { ladrillo: 15, madera: 10 } },
  [TileType.Library]: { cost: 300, color: 0x795548, height: 1.0, upkeep: 4, education: { radius: 6, strength: 1.2, capacity: 500 }, build: { ladrillo: 15, madera: 8 } },
  [TileType.Monument]: { cost: 800, color: 0xd4af37, height: 2.2, upkeep: 6, size: 2, amenity: { radius: 6, strength: 1.4 }, build: { cemento: 40, ladrillo: 30, madera: 20 } },
  [TileType.Airport]: { cost: 1200, color: 0x546e7a, height: 1.0, upkeep: 12, size: 3, shopJobs: 80, amenity: { radius: 6, strength: 1.0 }, income: 60, build: { cemento: 55, ladrillo: 45, madera: 30 } },

  [TileType.BusStop]: { cost: 130, color: 0x607d8b, height: 0.5, upkeep: 2, transit: { radius: 4, strength: 0.6, capacity: 250 }, build: { cemento: 4, ladrillo: 2 } },
  [TileType.TramStop]: { cost: 280, color: 0x00838f, height: 0.7, upkeep: 4, transit: { radius: 5, strength: 0.9, capacity: 500 }, build: { cemento: 10, ladrillo: 8, acero: 4 } },
  [TileType.MetroStation]: { cost: 650, color: 0x283593, height: 1.0, upkeep: 7, size: 2, transit: { radius: 8, strength: 1.4, capacity: 1200 }, build: { cemento: 35, ladrillo: 25, acero: 12 } },

  [TileType.Hardware]: { cost: 250, color: 0xff8f00, height: 0.9, upkeep: 3, shopJobs: 20, sellsMaterials: true },
  [TileType.ExportTerminal]: { cost: 500, color: 0x455a64, height: 0.9, upkeep: 5, size: 2, shopJobs: 15, exportsMaterials: true, needsWater: true },

  [TileType.Cafe]: { cost: 120, color: 0x6d4c41, height: 0.7, upkeep: 2, shopJobs: 8, food: { radius: 4, strength: 0.6, capacity: 250 }, amenity: { radius: 2, strength: 0.3 }, build: { ladrillo: 4, madera: 6 } },
  [TileType.Diner]: { cost: 180, color: 0xf4511e, height: 0.8, upkeep: 3, shopJobs: 15, food: { radius: 5, strength: 0.9, capacity: 400 }, amenity: { radius: 2, strength: 0.3 }, build: { ladrillo: 8, madera: 5 } },
  [TileType.Restaurant]: { cost: 300, color: 0xc2185b, height: 1.0, upkeep: 4, shopJobs: 25, food: { radius: 5, strength: 1.0, capacity: 400 }, amenity: { radius: 3, strength: 0.6 }, build: { ladrillo: 12, madera: 8 } },
  [TileType.Market]: { cost: 400, color: 0x43a047, height: 1.0, upkeep: 5, size: 2, shopJobs: 40, food: { radius: 7, strength: 1.2, capacity: 800 }, amenity: { radius: 2, strength: 0.2 }, build: { ladrillo: 26, cemento: 16, madera: 8 } },

  // Locales de comida temáticos (1×1, bien identificables). Cobertura de comida + empleos.
  [TileType.Pizzeria]: { cost: 160, color: 0xd84315, height: 0.8, upkeep: 2, shopJobs: 14, food: { radius: 4, strength: 0.8, capacity: 350 }, amenity: { radius: 2, strength: 0.3 }, build: { ladrillo: 6, madera: 4 } },
  [TileType.Burger]: { cost: 170, color: 0xfbc02d, height: 0.8, upkeep: 2, shopJobs: 14, food: { radius: 4, strength: 0.8, capacity: 350 }, build: { ladrillo: 6, madera: 4 } },
  [TileType.HotDog]: { cost: 90, color: 0xef6c00, height: 0.5, upkeep: 1, shopJobs: 7, food: { radius: 3, strength: 0.6, capacity: 200 }, build: { madera: 4 } },
  [TileType.IceCream]: { cost: 120, color: 0xf48fb1, height: 0.6, upkeep: 1, shopJobs: 8, food: { radius: 3, strength: 0.6, capacity: 200 }, amenity: { radius: 2, strength: 0.3 }, build: { ladrillo: 4, madera: 4 } },
  [TileType.Bakery]: { cost: 140, color: 0xa1887f, height: 0.7, upkeep: 2, shopJobs: 10, food: { radius: 4, strength: 0.7, capacity: 300 }, build: { ladrillo: 6, madera: 4 } },

  [TileType.SawMill]: { cost: 200, color: 0x8d6e63, height: 0.9, upkeep: 3, jobs: 12, makes: { material: 'madera', amount: 6 } },
  [TileType.SteelMill]: { cost: 350, color: 0x607d8a, height: 1.3, upkeep: 5, size: 2, jobs: 30, pollution: { radius: 3, strength: 0.7 }, makes: { material: 'acero', amount: 4 } },
  [TileType.ElectronicsFactory]: { cost: 400, color: 0x5e35b1, height: 1.2, upkeep: 5, size: 2, jobs: 40, pollution: { radius: 2, strength: 0.4 }, needsMaterial: { material: 'acero', amount: 3 }, makes: { material: 'electronica', amount: 2 } },

  [TileType.Kiosk]: { cost: 80, color: 0x26a69a, height: 0.5, upkeep: 1, shopJobs: 6, build: { madera: 4, ladrillo: 2 } },
  [TileType.Boutique]: { cost: 200, color: 0xba68c8, height: 0.8, upkeep: 2, shopJobs: 18, amenity: { radius: 2, strength: 0.3 }, build: { ladrillo: 8, madera: 5 } },
  [TileType.Pharmacy]: { cost: 220, color: 0x4dd0e1, height: 0.8, upkeep: 3, shopJobs: 12, health: { radius: 4, strength: 0.6, capacity: 250 }, build: { ladrillo: 8, cemento: 4 } },
  [TileType.Bank]: { cost: 400, color: 0xc9b037, height: 1.2, upkeep: 4, shopJobs: 30, income: 30, build: { cemento: 15, ladrillo: 10 } },
  [TileType.GasStation]: { cost: 250, color: 0xef5350, height: 0.5, upkeep: 3, shopJobs: 12, income: 20, build: { cemento: 8, ladrillo: 5 } },
  [TileType.Dealership]: { cost: 450, color: 0x7986cb, height: 0.9, upkeep: 5, size: 2, shopJobs: 50, amenity: { radius: 2, strength: 0.2 }, build: { cemento: 20, ladrillo: 18, madera: 10 } },

  // Paisaje (decoración): barato, instantáneo, sin calle. Sube un poco el valor del suelo.
  [TileType.Tree]: { cost: 20, color: 0x2e7d32, height: 0.6, decoration: true, amenity: { radius: 1, strength: 0.15 } },
  [TileType.Rock]: { cost: 10, color: 0x9e9e9e, height: 0.4, decoration: true },
  [TileType.Bush]: { cost: 12, color: 0x66bb6a, height: 0.3, decoration: true, amenity: { radius: 1, strength: 0.1 } },
  [TileType.Flowers]: { cost: 10, color: 0xec407a, height: 0.15, decoration: true, amenity: { radius: 1, strength: 0.1 } },

  [TileType.Construction]: { cost: 0, color: 0xffb74d, height: 0.3 }, // cartel/andamio de obra
};

/** ¿Es una zona desarrollable (R/C/I)? */
export function isZone(type: TileType): boolean {
  return (
    type === TileType.Residential ||
    type === TileType.Commercial ||
    type === TileType.Industrial
  );
}

/**
 * Nivel estructural máximo que puede alcanzar un tipo de casilla:
 * - Residencial: hasta rascacielos (RES_MAX_LEVEL).
 * - Carreteras: ROAD_MAX_LEVEL.
 * - El resto (comercio/industria): MAX_LEVEL.
 */
export function maxLevelOf(type: TileType): number {
  if (type === TileType.Residential) return RES_MAX_LEVEL;
  if (type === TileType.Road) return ROAD_MAX_LEVEL;
  return MAX_LEVEL;
}

/**
 * Habitantes por nivel de una zona residencial. Los niveles altos (rascacielos)
 * concentran mucha más gente que un edificio bajo — son las "torres gigantes".
 */
export const RES_CAPACITY = [0, 10, 22, 40, 75, 130];

/**
 * Sesgo de cada estilo residencial:
 *  - `capMul`: multiplica los habitantes por nivel (densidad).
 *  - `maxLevel`: tope estructural (solo `default` llega a rascacielos).
 *  - `pollutionMul`: cuánto le afecta la contaminación (eco = casi inmune).
 *  - `landValue`: valor del suelo que IRRADIA a los vecinos (lujo = barrio premium).
 */
export const RES_STYLE: Record<
  ResidentialStyle,
  { capMul: number; maxLevel: number; pollutionMul: number; landValue: number; label: string; icon: string }
> = {
  default: { capMul: 1.0, maxLevel: RES_MAX_LEVEL, pollutionMul: 1.0, landValue: 0, label: 'Estándar', icon: '🏠' },
  eco: { capMul: 0.85, maxLevel: 3, pollutionMul: 0.4, landValue: 0.2, label: 'Eco', icon: '🌿' },
  luxury: { capMul: 1.3, maxLevel: 3, pollutionMul: 1.0, landValue: 0.5, label: 'Lujo', icon: '💎' },
  suburb: { capMul: 0.6, maxLevel: 2, pollutionMul: 1.0, landValue: 0.1, label: 'Suburbio', icon: '🏡' },
};

/**
 * Capacidad de una casilla: habitantes (residencial) o empleos (comercial /
 * industrial), según su nivel. El resto no aporta.
 */
export function capacityOf(type: TileType, level: number, style: ResidentialStyle = 'default'): number {
  if (level <= 0) return 0;
  switch (type) {
    case TileType.Residential:
      return Math.round(RES_CAPACITY[Math.min(level, RES_CAPACITY.length - 1)] * RES_STYLE[style].capMul);
    case TileType.Commercial:
      return level * 6;
    case TileType.Industrial:
      return level * 8;
    default:
      return 0;
  }
}

/** Costo de reparar un edificio dañado por una catástrofe (fracción de su costo). */
export function repairCostOf(type: TileType): number {
  return Math.max(10, Math.round(TILE_DEF[type].cost * 0.4));
}
