// ---------------------------------------------------------------------------
// Árbol de tecnología / progreso. Engine-agnóstico (sin Three.js).
//
// Modelo simple de HITOS: cuando la ciudad alcanza una meta (población, empleo
// industrial o tesoro), se "desbloquean" edificios nuevos. Los desbloqueos son
// permanentes: una vez logrados, no se pierden aunque la métrica baje después.
// ---------------------------------------------------------------------------
import { TileType } from './types';

/** Sobre qué métrica de la ciudad se mide un hito. */
export type TechMetric = 'population' | 'industrialJobs' | 'money';

export interface TechDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  metric: TechMetric;
  target: number; // valor de la métrica necesario para desbloquear
  unlocks: TileType[]; // edificios que habilita
}

/** Edificios disponibles desde el comienzo (no requieren tecnología). */
export const BASE_UNLOCKED: TileType[] = [
  TileType.Empty, // demoler
  TileType.Road,
  TileType.Residential,
  TileType.Commercial,
  TileType.Industrial,
  TileType.FactorySmall,
  TileType.Police,
  TileType.PowerPlant,
  TileType.Park,
  TileType.Plaza,
];

/** Hitos de progreso, en orden creciente de dificultad. */
export const TECHS: TechDef[] = [
  {
    id: 'services',
    icon: '🚒',
    name: 'Servicios públicos',
    desc: 'Bomberos y red de agua para una ciudad más segura y densa.',
    metric: 'population',
    target: 40,
    unlocks: [TileType.Fire, TileType.WaterTower, TileType.Cafe, TileType.Diner, TileType.Kiosk, TileType.GasStation],
  },
  {
    id: 'welfare',
    icon: '🏥',
    name: 'Bienestar',
    desc: 'Escuelas, clínicas y hospitales: educación y salud para que la ciudad crezca sana.',
    metric: 'population',
    target: 90,
    unlocks: [TileType.School, TileType.Clinic, TileType.Hospital, TileType.Market, TileType.Pharmacy],
  },
  {
    id: 'industry2',
    icon: '🏭',
    name: 'Industria pesada',
    desc: 'Fábricas medianas y red de gas para escalar la producción.',
    metric: 'industrialJobs',
    target: 60,
    unlocks: [TileType.FactoryMedium, TileType.GasPlant],
  },
  {
    id: 'materials',
    icon: '🧱',
    name: 'Materiales de construcción',
    desc: 'Arenera, cementera y ladrillería + corralón: producí y almacená tus propios materiales.',
    metric: 'population',
    target: 120,
    unlocks: [TileType.SandPit, TileType.CementPlant, TileType.BrickKiln, TileType.BuildYard, TileType.Hardware, TileType.SawMill],
  },
  {
    id: 'culture',
    icon: '🖼️',
    name: 'Cultura y comercio',
    desc: 'Museos, centros comerciales y universidad: cultura, empleo y educación superior.',
    metric: 'population',
    target: 180,
    unlocks: [TileType.Museum, TileType.ShoppingMall, TileType.University, TileType.Church, TileType.Library, TileType.Restaurant, TileType.Boutique, TileType.Dealership],
  },
  {
    id: 'leisure',
    icon: '🎡',
    name: 'Ocio y entretenimiento',
    desc: 'Cines, parques de diversiones y casinos: diversión, empleo y renta.',
    metric: 'population',
    target: 250,
    unlocks: [TileType.Cinema, TileType.AmusementPark, TileType.Casino],
  },
  {
    id: 'capital',
    icon: '🏛️',
    name: 'Capital regional',
    desc: 'Un tesoro sólido habilita el gobierno y grandes obras como el estadio.',
    metric: 'money',
    target: 20000,
    unlocks: [TileType.Government, TileType.Stadium, TileType.Monument, TileType.ExportTerminal, TileType.Bank],
  },
  {
    id: 'bigindustry',
    icon: '🏗️',
    name: 'Gran industria',
    desc: 'Acería, electrónica, fábricas grandes y la empresa tecnológica (acero + electrónica).',
    metric: 'industrialJobs',
    target: 220,
    unlocks: [TileType.FactoryLarge, TileType.TechPark, TileType.SteelMill, TileType.ElectronicsFactory, TileType.TechCompany],
  },
  {
    id: 'metropolis',
    icon: '🌆',
    name: 'Metrópolis',
    desc: 'Hoteles y torres de oficinas, el sello de una gran ciudad.',
    metric: 'population',
    target: 600,
    unlocks: [TileType.Hotel, TileType.OfficeTower, TileType.Airport],
  },
];

export const METRIC_LABEL: Record<TechMetric, string> = {
  population: 'Población',
  industrialJobs: 'Empleo industrial',
  money: 'Tesoro',
};

/** Mapa rápido edificio → hito que lo desbloquea (para mostrar el requisito). */
export const TECH_BY_TYPE: Map<TileType, TechDef> = (() => {
  const map = new Map<TileType, TechDef>();
  for (const tech of TECHS) for (const t of tech.unlocks) map.set(t, tech);
  return map;
})();
