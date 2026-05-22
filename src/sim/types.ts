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
}

/** Nivel máximo de un edificio de zona (R/C/I). */
export const MAX_LEVEL = 3;

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
  amenity?: Influence; // suma "valor del suelo"
  service?: Influence; // suma "cobertura de servicios" (policía/bomberos/gobierno)
  produces?: Production; // genera un servicio básico para toda la ciudad (luz/agua/gas)
}

export const TILE_DEF: Record<TileType, TileDef> = {
  [TileType.Empty]: { cost: 0, color: 0x000000 },
  [TileType.Road]: { cost: 10, color: 0x555555, upkeep: 0.5 },
  [TileType.Residential]: { cost: 20, color: 0x4caf50 },
  [TileType.Commercial]: { cost: 20, color: 0x2196f3 },
  [TileType.Industrial]: { cost: 20, color: 0xffc107 },

  [TileType.FactorySmall]: { cost: 80, color: 0xe65100, height: 0.8, upkeep: 1, jobs: 20 },
  [TileType.FactoryMedium]: { cost: 300, color: 0xe65100, height: 1.2, upkeep: 3, size: 2, jobs: 90 },
  [TileType.FactoryLarge]: { cost: 700, color: 0xbf360c, height: 1.7, upkeep: 6, size: 3, jobs: 220 },

  [TileType.Park]: { cost: 50, color: 0x2e7d32, height: 0.28, amenity: { radius: 3, strength: 0.6 } },
  [TileType.Plaza]: { cost: 30, color: 0x66bb6a, height: 0.2, amenity: { radius: 2, strength: 0.4 } },
  [TileType.Stadium]: { cost: 400, color: 0x8e24aa, height: 1.6, upkeep: 5, size: 2, amenity: { radius: 5, strength: 1.0 } },
  [TileType.Museum]: { cost: 250, color: 0xab47bc, height: 1.0, upkeep: 3, amenity: { radius: 4, strength: 0.8 } },

  [TileType.Police]: { cost: 200, color: 0x1565c0, height: 0.9, upkeep: 4, service: { radius: 5, strength: 1.0, capacity: 250 } },
  [TileType.Fire]: { cost: 200, color: 0xc62828, height: 0.9, upkeep: 4, service: { radius: 5, strength: 1.0, capacity: 250 } },
  [TileType.Government]: { cost: 500, color: 0x546e7a, height: 1.4, upkeep: 8, size: 2, service: { radius: 7, strength: 1.5, capacity: 600 } },

  [TileType.PowerPlant]: { cost: 500, color: 0xfdd835, height: 1.5, upkeep: 6, size: 2, produces: { kind: 'power', amount: 400 } },
  [TileType.WaterTower]: { cost: 300, color: 0x29b6f6, height: 1.3, upkeep: 4, produces: { kind: 'water', amount: 350 } },
  [TileType.GasPlant]: { cost: 350, color: 0xff7043, height: 1.2, upkeep: 4, produces: { kind: 'gas', amount: 320 } },
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
 * Capacidad de una casilla: habitantes (residencial) o empleos (comercial /
 * industrial), según su nivel. El resto no aporta.
 */
export function capacityOf(type: TileType, level: number): number {
  if (level <= 0) return 0;
  switch (type) {
    case TileType.Residential:
      return level * 10;
    case TileType.Commercial:
      return level * 6;
    case TileType.Industrial:
      return level * 8;
    default:
      return 0;
  }
}
