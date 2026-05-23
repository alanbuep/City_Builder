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
  // Comercios especializados (se desbloquean con tecnología): dan empleos comerciales.
  ShoppingMall = 'mall',
  Hotel = 'hotel',
  OfficeTower = 'office',
  // Industria especializada (empleo limpio):
  TechPark = 'techpark',
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
  // Comunidad / hitos / transporte:
  Church = 'church',
  Library = 'library',
  Monument = 'monument',
  Airport = 'airport',
  // Comercio de materiales / exportación:
  Hardware = 'hardware', // Ferretería (vende materiales del corralón a la ciudad)
  ExportTerminal = 'export', // Terminal de exportación (vende el excedente al exterior)
  // Casas de comida (comercio + cobertura de comida, una necesidad de la población):
  Cafe = 'cafe',
  Diner = 'diner',
  Restaurant = 'restaurant',
  Market = 'market',
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
  // Obra en construcción: ocupa el terreno hasta que se completa y aparece el edificio real.
  Construction = 'construction',
}

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

  [TileType.FactorySmall]: { cost: 80, color: 0xe65100, height: 0.8, upkeep: 1, jobs: 20 },
  [TileType.FactoryMedium]: { cost: 300, color: 0xe65100, height: 1.2, upkeep: 3, size: 2, jobs: 90 },
  [TileType.FactoryLarge]: { cost: 700, color: 0xbf360c, height: 1.7, upkeep: 6, size: 3, jobs: 220, build: { ladrillo: 30, cemento: 20 } },

  [TileType.Park]: { cost: 50, color: 0x2e7d32, height: 0.28, amenity: { radius: 3, strength: 0.6 } },
  [TileType.Plaza]: { cost: 30, color: 0x66bb6a, height: 0.2, amenity: { radius: 2, strength: 0.4 } },
  [TileType.Stadium]: { cost: 400, color: 0x8e24aa, height: 1.6, upkeep: 5, size: 2, amenity: { radius: 5, strength: 1.0 }, build: { cemento: 40, ladrillo: 20 } },
  [TileType.Museum]: { cost: 250, color: 0xab47bc, height: 1.0, upkeep: 3, amenity: { radius: 4, strength: 0.8 } },

  [TileType.Police]: { cost: 200, color: 0x1565c0, height: 0.9, upkeep: 4, service: { radius: 5, strength: 1.0, capacity: 250 } },
  [TileType.Fire]: { cost: 200, color: 0xc62828, height: 0.9, upkeep: 4, service: { radius: 5, strength: 1.0, capacity: 250 } },
  [TileType.Government]: { cost: 500, color: 0x546e7a, height: 1.4, upkeep: 8, size: 2, service: { radius: 7, strength: 1.5, capacity: 600 }, build: { cemento: 30, ladrillo: 20 } },

  [TileType.PowerPlant]: { cost: 500, color: 0xfdd835, height: 1.5, upkeep: 6, size: 2, produces: { kind: 'power', amount: 400 } },
  [TileType.WaterTower]: { cost: 300, color: 0x29b6f6, height: 1.3, upkeep: 4, produces: { kind: 'water', amount: 350 } },
  [TileType.GasPlant]: { cost: 350, color: 0xff7043, height: 1.2, upkeep: 4, produces: { kind: 'gas', amount: 320 } },

  [TileType.ShoppingMall]: { cost: 400, color: 0x00897b, height: 1.1, upkeep: 5, size: 2, shopJobs: 70, amenity: { radius: 3, strength: 0.4 } },
  [TileType.Hotel]: { cost: 450, color: 0xd81b60, height: 1.8, upkeep: 5, size: 2, shopJobs: 50, amenity: { radius: 5, strength: 0.8 } },
  [TileType.OfficeTower]: { cost: 500, color: 0x3949ab, height: 2.6, upkeep: 6, shopJobs: 100 },
  [TileType.TechPark]: { cost: 700, color: 0x00acc1, height: 1.0, upkeep: 7, size: 2, jobs: 150, amenity: { radius: 3, strength: 0.5 } },

  [TileType.SandPit]: { cost: 150, color: 0xd2b48c, height: 0.6, upkeep: 2, jobs: 10, makes: { material: 'arena', amount: 8 } },
  [TileType.CementPlant]: { cost: 250, color: 0x90a4ae, height: 1.1, upkeep: 3, jobs: 15, needsMaterial: { material: 'arena', amount: 6 }, makes: { material: 'cemento', amount: 4 } },
  [TileType.BrickKiln]: { cost: 250, color: 0xb24a3a, height: 1.0, upkeep: 3, jobs: 15, needsMaterial: { material: 'arena', amount: 6 }, makes: { material: 'ladrillo', amount: 5 } },
  [TileType.BuildYard]: { cost: 300, color: 0x8d6e63, height: 0.8, upkeep: 3, size: 2, shopJobs: 20, storesMaterials: true },
  [TileType.TechCompany]: { cost: 800, color: 0x00bcd4, height: 1.5, upkeep: 8, size: 2, jobs: 200, amenity: { radius: 3, strength: 0.4 }, build: { ladrillo: 30, acero: 30, electronica: 15 }, needsYard: true },

  [TileType.School]: { cost: 200, color: 0xffb300, height: 0.9, upkeep: 4, education: { radius: 5, strength: 1.0, capacity: 300 } },
  [TileType.University]: { cost: 500, color: 0x6d4c41, height: 1.3, upkeep: 8, size: 2, education: { radius: 7, strength: 1.6, capacity: 800 } },
  [TileType.Hospital]: { cost: 500, color: 0xe57373, height: 1.3, upkeep: 8, size: 2, health: { radius: 7, strength: 1.6, capacity: 800 } },
  [TileType.Clinic]: { cost: 200, color: 0xffab91, height: 0.9, upkeep: 4, health: { radius: 5, strength: 1.0, capacity: 300 } },

  [TileType.Casino]: { cost: 600, color: 0xffca28, height: 1.2, upkeep: 8, size: 2, shopJobs: 60, amenity: { radius: 3, strength: 0.5 }, income: 40, build: { cemento: 20, ladrillo: 20 } },
  [TileType.Cinema]: { cost: 200, color: 0x5c6bc0, height: 0.9, upkeep: 3, shopJobs: 25, amenity: { radius: 3, strength: 0.5 } },
  [TileType.AmusementPark]: { cost: 500, color: 0xec407a, height: 1.1, upkeep: 6, size: 2, shopJobs: 40, amenity: { radius: 6, strength: 1.2 }, build: { ladrillo: 30 } },

  [TileType.Church]: { cost: 250, color: 0xefebe9, height: 1.3, upkeep: 3, amenity: { radius: 4, strength: 0.7 } },
  [TileType.Library]: { cost: 300, color: 0x795548, height: 1.0, upkeep: 4, education: { radius: 6, strength: 1.2, capacity: 500 } },
  [TileType.Monument]: { cost: 800, color: 0xd4af37, height: 2.2, upkeep: 6, size: 2, amenity: { radius: 6, strength: 1.4 }, build: { cemento: 40, ladrillo: 30, madera: 20 } },
  [TileType.Airport]: { cost: 1200, color: 0x546e7a, height: 1.0, upkeep: 12, size: 3, shopJobs: 80, amenity: { radius: 6, strength: 1.0 }, income: 60, build: { cemento: 50, ladrillo: 40, madera: 30 } },

  [TileType.Hardware]: { cost: 250, color: 0xff8f00, height: 0.9, upkeep: 3, shopJobs: 20, sellsMaterials: true },
  [TileType.ExportTerminal]: { cost: 500, color: 0x455a64, height: 0.9, upkeep: 5, size: 2, shopJobs: 15, exportsMaterials: true },

  [TileType.Cafe]: { cost: 120, color: 0x6d4c41, height: 0.7, upkeep: 2, shopJobs: 8, food: { radius: 4, strength: 0.6, capacity: 250 }, amenity: { radius: 2, strength: 0.3 } },
  [TileType.Diner]: { cost: 180, color: 0xf4511e, height: 0.8, upkeep: 3, shopJobs: 15, food: { radius: 5, strength: 0.9, capacity: 400 }, amenity: { radius: 2, strength: 0.3 } },
  [TileType.Restaurant]: { cost: 300, color: 0xc2185b, height: 1.0, upkeep: 4, shopJobs: 25, food: { radius: 5, strength: 1.0, capacity: 400 }, amenity: { radius: 3, strength: 0.6 } },
  [TileType.Market]: { cost: 400, color: 0x43a047, height: 1.0, upkeep: 5, size: 2, shopJobs: 40, food: { radius: 7, strength: 1.2, capacity: 800 }, amenity: { radius: 2, strength: 0.2 } },

  [TileType.SawMill]: { cost: 200, color: 0x8d6e63, height: 0.9, upkeep: 3, jobs: 12, makes: { material: 'madera', amount: 6 } },
  [TileType.SteelMill]: { cost: 350, color: 0x607d8a, height: 1.3, upkeep: 5, size: 2, jobs: 30, makes: { material: 'acero', amount: 4 } },
  [TileType.ElectronicsFactory]: { cost: 400, color: 0x5e35b1, height: 1.2, upkeep: 5, size: 2, jobs: 40, needsMaterial: { material: 'acero', amount: 3 }, makes: { material: 'electronica', amount: 2 } },

  [TileType.Kiosk]: { cost: 80, color: 0x26a69a, height: 0.5, upkeep: 1, shopJobs: 6 },
  [TileType.Boutique]: { cost: 200, color: 0xba68c8, height: 0.8, upkeep: 2, shopJobs: 18, amenity: { radius: 2, strength: 0.3 } },
  [TileType.Pharmacy]: { cost: 220, color: 0x4dd0e1, height: 0.8, upkeep: 3, shopJobs: 12, health: { radius: 4, strength: 0.6, capacity: 250 } },
  [TileType.Bank]: { cost: 400, color: 0xc9b037, height: 1.2, upkeep: 4, shopJobs: 30, income: 30 },
  [TileType.GasStation]: { cost: 250, color: 0xef5350, height: 0.5, upkeep: 3, shopJobs: 12, income: 20 },
  [TileType.Dealership]: { cost: 450, color: 0x7986cb, height: 0.9, upkeep: 5, size: 2, shopJobs: 50, amenity: { radius: 2, strength: 0.2 } },

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
 * Capacidad de una casilla: habitantes (residencial) o empleos (comercial /
 * industrial), según su nivel. El resto no aporta.
 */
export function capacityOf(type: TileType, level: number): number {
  if (level <= 0) return 0;
  switch (type) {
    case TileType.Residential:
      return RES_CAPACITY[Math.min(level, RES_CAPACITY.length - 1)];
    case TileType.Commercial:
      return level * 6;
    case TileType.Industrial:
      return level * 8;
    default:
      return 0;
  }
}
