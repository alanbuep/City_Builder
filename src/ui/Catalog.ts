import { TileType, ResidentialStyle } from '../sim/types';

/** Una herramienta: colocar un tipo de casilla, "seleccionar", o pintar terreno (agua/tierra). */
export type Tool = TileType | 'select' | 'terrain_water' | 'terrain_land';

/** ¿Es una herramienta de pintar terreno (ríos/lagos a mano)? */
export function isPaintTool(tool: Tool): tool is 'terrain_water' | 'terrain_land' {
  return tool === 'terrain_water' || tool === 'terrain_land';
}

export interface ToolEntry {
  tool: Tool;
  icon: string; // nombre de icono (ver ui/icons.ts)
  label: string;
  desc: string;
  style?: ResidentialStyle; // (residencial) estilo de barrio que pinta esta entrada
}

export interface Category {
  icon: string; // nombre de icono (ver ui/icons.ts)
  name: string;
  tools: ToolEntry[];
}

// Catálogo de construcción agrupado por rubros (lo usa el menú Construir).
export const CATEGORIES: Category[] = [
  {
    icon: 'wrench',
    name: 'Básico',
    tools: [
      { tool: TileType.Road, icon: 'road', label: 'Carretera', desc: 'Las zonas necesitan una calle al lado para crecer. Se mejora a avenida/autopista (sube todo el tramo recto de una).' },
      { tool: TileType.Empty, icon: 'trash', label: 'Demoler', desc: 'Borra lo que haya en la casilla. Es gratis.' },
    ],
  },
  {
    icon: 'waves',
    name: 'Terreno',
    tools: [
      { tool: 'terrain_water', icon: 'droplet', label: 'Agua / Río', desc: 'Pintá agua a mano (ríos, lagos, ensanchar la costa). Arrastrá para trazar. Deja orillas de arena solas. Solo sobre terreno libre (no bajo edificios). Las calles sobre agua se vuelven puente.' },
      { tool: 'terrain_land', icon: 'square', label: 'Rellenar tierra', desc: 'Vuelve el agua/arena a tierra firme (borra ríos/lagos). Arrastrá.' },
    ],
  },
  {
    icon: 'home',
    name: 'Residencial',
    tools: [
      { tool: TileType.Residential, style: 'default', icon: 'home', label: 'Estándar', desc: 'Barrio clásico: crece con la demanda (barra R) y los servicios. El único que llega a RASCACIELOS (nivel 5). El comercio y la industria se colocan como edificios.' },
      { tool: TileType.Residential, style: 'suburb', icon: 'home', label: 'Suburbio', desc: 'Casas bajas: poca densidad (tope nivel 2) pero barrio tranquilo. Para las afueras.' },
      { tool: TileType.Residential, style: 'eco', icon: 'home', label: 'Eco', desc: 'Barrio ecológico: casi inmune a la contaminación y suma algo de valor del suelo. Densidad media (tope nivel 3).' },
      { tool: TileType.Residential, style: 'luxury', icon: 'home', label: 'Lujo', desc: 'Barrio premium: alta densidad por nivel e irradia mucho valor del suelo a los vecinos (tope nivel 3).' },
    ],
  },
  {
    icon: 'factory',
    name: 'Fábricas',
    tools: [
      { tool: TileType.FactorySmall, icon: 'factory', label: 'Fábrica chica', desc: 'Fábrica 1×1. Da 20 empleos al instante. La demanda industrial (barra I) te indica cuándo poner más.' },
      { tool: TileType.FactoryMedium, icon: 'factory', label: 'Fábrica mediana', desc: 'Fábrica 2×2. Da 90 empleos. Es en lo que se fusionan las zonas industriales.' },
      { tool: TileType.FactoryLarge, icon: 'factory', label: 'Fábrica grande', desc: 'Fábrica 3×3. Da 220 empleos. El motor de una gran ciudad industrial.' },
      { tool: TileType.TechPark, icon: 'cpu', label: 'Parque tecnológico', desc: 'Edificio 2×2. Empleo industrial limpio (150) y agradable: sube el valor del suelo cercano.' },
    ],
  },
  {
    icon: 'cart',
    name: 'Comercio',
    tools: [
      { tool: TileType.ShoppingMall, icon: 'cart', label: 'Centro comercial', desc: 'Edificio 2×2. Muchos empleos comerciales (70) y atrae gente (sube el valor del suelo).' },
      { tool: TileType.Hotel, icon: 'building', label: 'Hotel', desc: 'Edificio 2×2. Turismo: sube mucho el valor del suelo alrededor + 50 empleos comerciales.' },
      { tool: TileType.OfficeTower, icon: 'building', label: 'Torre de oficinas', desc: 'Altísima densidad de empleo comercial (100) en una sola casilla.' },
      { tool: TileType.Airport, icon: 'airship', label: 'Aeropuerto', desc: 'Edificio 3×3. Turismo: 80 empleos comerciales, gran valor del suelo y renta fija ($40/mes).' },
    ],
  },
  {
    icon: 'store',
    name: 'Negocios',
    tools: [
      { tool: TileType.Kiosk, icon: 'store', label: 'Kiosco', desc: 'Comercio chico y barato (6 empleos). Ideal para huecos chicos y el arranque.' },
      { tool: TileType.Boutique, icon: 'store', label: 'Boutique', desc: 'Tienda de ropa: 18 empleos y sube un poco el valor del suelo.' },
      { tool: TileType.Pharmacy, icon: 'heart', label: 'Farmacia', desc: 'Comercio (12 empleos) que además da algo de cobertura de salud cercana.' },
      { tool: TileType.GasStation, icon: 'fuel', label: 'Estación de servicio', desc: '12 empleos + renta fija ($10/mes) por venta de combustible.' },
      { tool: TileType.Bank, icon: 'landmark', label: 'Banco', desc: '30 empleos + renta fija ($16/mes). El negocio financiero de la ciudad.' },
      { tool: TileType.Dealership, icon: 'cart', label: 'Concesionaria', desc: 'Edificio 2×2. Mucho empleo comercial (50) y algo de valor del suelo.' },
    ],
  },
  {
    icon: 'box',
    name: 'Materiales',
    tools: [
      { tool: TileType.SandPit, icon: 'layers', label: 'Arenera', desc: 'Produce 16 de arena por mes (la arena alimenta el cemento Y el ladrillo). Necesita energía + corralón conectado. Poné suficientes: 1 arenera abastece ~2-3 cementeras/ladrillerías.' },
      { tool: TileType.CementPlant, icon: 'box', label: 'Cementera', desc: 'Convierte 6 arena → 4 cemento por mes. Necesita energía + corralón + ARENA (de una arenera).' },
      { tool: TileType.BrickKiln, icon: 'wall', label: 'Ladrillería', desc: 'Convierte 6 arena → 5 ladrillo por mes. Necesita energía + corralón + ARENA (de una arenera).' },
      { tool: TileType.BuildYard, icon: 'box', label: 'Corralón', desc: 'Edificio 2×2. Almacena materiales y los distribuye por su red de calles. Hace falta para construir lo avanzado.' },
      { tool: TileType.SawMill, icon: 'tree', label: 'Aserradero', desc: 'Produce 6 de madera por mes (necesita energía + corralón conectado). La madera sirve para monumentos, aeropuerto y exportar.' },
      { tool: TileType.SteelMill, icon: 'ingot', label: 'Acería', desc: 'Edificio 2×2. Produce 4 de acero por mes (energía + corralón). El acero alimenta la electrónica y la empresa tecnológica.' },
      { tool: TileType.ElectronicsFactory, icon: 'cpu', label: 'Fábrica de electrónica', desc: 'Edificio 2×2. Convierte 3 acero → 2 electrónica por mes. La electrónica es clave para la empresa tecnológica.' },
      { tool: TileType.Hardware, icon: 'wrench', label: 'Ferretería', desc: 'Vende materiales de construcción del corralón conectado a la población → renta + empleos.' },
      { tool: TileType.ExportTerminal, icon: 'box', label: 'Terminal de exportación', desc: 'Edificio 2×2. Exporta el excedente de materiales (sobre un stock mínimo que configurás) → renta.' },
      { tool: TileType.TechCompany, icon: 'cpu', label: 'Empresa tecnológica', desc: 'Edificio 2×2. Requiere un corralón conectado con 30 ladrillo + 30 acero + 15 electrónica. 200 empleos de alto valor.' },
    ],
  },
  {
    icon: 'shield',
    name: 'Servicios',
    tools: [
      { tool: TileType.Police, icon: 'shield', label: 'Policía', desc: 'Cobertura de servicios (radio 5) para que las zonas crezcan a niveles altos. Atiende ~250 habitantes.' },
      { tool: TileType.Fire, icon: 'flame', label: 'Bomberos', desc: 'Cobertura de servicios (radio 5). Atiende ~250 habitantes.' },
      { tool: TileType.Government, icon: 'landmark', label: 'Gobierno', desc: 'Edificio 2×2. Gran cobertura de servicios (radio 7). Atiende ~600 habitantes.' },
    ],
  },
  {
    icon: 'bus',
    name: 'Transporte',
    tools: [
      { tool: TileType.BusStop, icon: 'bus', label: 'Parada de colectivo', desc: 'Alivia el tráfico de las calles cercanas (radio 4): la gente cerca viaja en colectivo en vez de auto. Atiende ~250 hab.' },
      { tool: TileType.TramStop, icon: 'train', label: 'Parada de tranvía', desc: 'Más alivio de tráfico que el colectivo (radio 5). Atiende ~500 hab.' },
      { tool: TileType.MetroStation, icon: 'train', label: 'Estación de metro', desc: 'Edificio 2×2. El que más descongestiona (radio 8): clave para una metrópolis densa. Atiende ~1200 hab.' },
    ],
  },
  {
    icon: 'zap',
    name: 'Energía y agua',
    tools: [
      { tool: TileType.PowerPlant, icon: 'zap', label: 'Central eléctrica', desc: 'Edificio 2×2. Produce 400 de energía para toda la ciudad. Sin energía suficiente, las zonas no pasan de nivel 1.' },
      { tool: TileType.WaterTower, icon: 'droplet', label: 'Torre de agua', desc: 'Produce 350 de agua. Junto al gas, hace falta para que las zonas lleguen al nivel máximo.' },
      { tool: TileType.GasPlant, icon: 'flame', label: 'Planta de gas', desc: 'Produce 320 de gas. Junto al agua, hace falta para el nivel máximo de las zonas.' },
      { tool: TileType.SolarPlant, icon: 'sun', label: 'Planta solar', desc: 'Edificio 2×2. Energía LIMPIA: 220 de electricidad sin contaminar. Más cara por MW que el carbón, pero sin humo.' },
      { tool: TileType.WindTurbine, icon: 'wind', label: 'Parque eólico', desc: 'Turbina 1×1: 150 de electricidad limpia, barata. Poné varias.' },
      { tool: TileType.HydroPlant, icon: 'waves', label: 'Represa hidroeléctrica', desc: 'Edificio 2×2. 380 de electricidad limpia. Hay que colocarla JUNTO AL AGUA (río o mar).' },
    ],
  },
  {
    icon: 'cap',
    name: 'Bienestar',
    tools: [
      { tool: TileType.School, icon: 'cap', label: 'Escuela', desc: 'Cobertura educativa (radio 5). Las zonas con buena educación crecen más rápido. Atiende ~300 hab.' },
      { tool: TileType.University, icon: 'cap', label: 'Universidad', desc: 'Edificio 2×2. Gran cobertura educativa (radio 7). Atiende ~800 hab.' },
      { tool: TileType.Clinic, icon: 'heart', label: 'Clínica', desc: 'Cobertura de salud (radio 5). Atiende ~300 hab.' },
      { tool: TileType.Hospital, icon: 'heart', label: 'Hospital', desc: 'Edificio 2×2. Gran cobertura de salud (radio 7). Atiende ~800 hab.' },
      { tool: TileType.Library, icon: 'book', label: 'Biblioteca', desc: 'Cobertura educativa (radio 6). Alternativa cultural a la escuela. Atiende ~500 hab.' },
    ],
  },
  {
    icon: 'flask',
    name: 'Ciencia',
    tools: [
      { tool: TileType.ResearchLab, icon: 'flask', label: 'Laboratorio', desc: 'Genera 4 de ciencia por mes (con energía) + 30 empleos limpios. La ciencia acumulada desbloquea lo más avanzado.' },
      { tool: TileType.Observatory, icon: 'star', label: 'Observatorio', desc: 'Genera 5 de ciencia por mes y sube el valor del suelo (radio 3). Necesita energía.' },
      { tool: TileType.SciencePark, icon: 'flask', label: 'Parque científico', desc: 'Edificio 2×2. Mucha ciencia (12/mes) + 100 empleos limpios + valor del suelo. Se desbloquea con ciencia acumulada.' },
      { tool: TileType.SpaceCenter, icon: 'rocket', label: 'Centro espacial', desc: 'Edificio 3×3. El hito científico máximo: 30 ciencia/mes, 150 empleos y gran prestigio. Requiere un gran programa espacial.' },
    ],
  },
  {
    icon: 'sparkles',
    name: 'Héroe',
    tools: [
      { tool: TileType.HeroHQ, icon: 'shield', label: 'Cuartel del héroe', desc: 'Edificio 2×2. Mientras esté en pie, la ciudad tiene un héroe que apaga los incendios él solo y atrae prestigio. Se desbloquea con mucha ciencia.' },
      { tool: TileType.HeroBeacon, icon: 'sparkles', label: 'Señal del héroe', desc: 'Llama al héroe: prestigio y valor del suelo (radio 3).' },
      { tool: TileType.HeroStatue, icon: 'landmark', label: 'Estatua del héroe', desc: 'Monumento al héroe: gran valor del suelo en un radio amplio.' },
    ],
  },
  {
    icon: 'ferris',
    name: 'Ocio',
    tools: [
      { tool: TileType.Cinema, icon: 'film', label: 'Cine', desc: 'Empleos comerciales (25) + valor del suelo cercano.' },
      { tool: TileType.AmusementPark, icon: 'ferris', label: 'Parque de diversiones', desc: 'Edificio 2×2. Gran atractivo (radio 6) + 40 empleos comerciales.' },
      { tool: TileType.Casino, icon: 'gem', label: 'Casino', desc: 'Edificio 2×2. 60 empleos comerciales, sube el valor del suelo y genera renta fija ($25/mes).' },
      { tool: TileType.RaceTrack, icon: 'flag', label: 'Circuito de carreras', desc: 'Edificio 3×3. Gran atracción + 40 empleos. Organiza días de evento: cada tanto hay un fin de semana de carreras con renta extra y autos dando vueltas.' },
      { tool: TileType.BalloonPort, icon: 'balloon', label: 'Globopuerto', desc: 'Atracción: de acá salen los globos aerostáticos que flotan sobre la ciudad. Sube el valor del suelo + empleos.' },
      { tool: TileType.AirshipDock, icon: 'airship', label: 'Hangar de dirigibles', desc: 'Edificio 2×2. De acá sale el dirigible que sobrevuela la ciudad. Atracción turística.' },
    ],
  },
  {
    icon: 'utensils',
    name: 'Comida',
    tools: [
      { tool: TileType.Cafe, icon: 'coffee', label: 'Café', desc: 'Cobertura de comida chica + 8 empleos. La población necesita comida cerca para crecer mejor.' },
      { tool: TileType.HotDog, icon: 'utensils', label: 'Panchería', desc: 'Local chico y barato: cobertura de comida (radio 3) + 7 empleos. Ideal para huecos.' },
      { tool: TileType.IceCream, icon: 'utensils', label: 'Heladería', desc: 'Comida (radio 3) + 8 empleos y sube un poco el valor del suelo.' },
      { tool: TileType.Pizzeria, icon: 'utensils', label: 'Pizzería', desc: 'Comida (radio 4) + 14 empleos y algo de valor del suelo.' },
      { tool: TileType.Burger, icon: 'utensils', label: 'Hamburguesería', desc: 'Comida rápida (radio 4) + 14 empleos.' },
      { tool: TileType.Bakery, icon: 'utensils', label: 'Panadería', desc: 'Comida (radio 4) + 10 empleos.' },
      { tool: TileType.Diner, icon: 'utensils', label: 'Casa de comidas', desc: 'Comida rápida: buena cobertura de comida (radio 5) + 15 empleos.' },
      { tool: TileType.Restaurant, icon: 'utensils', label: 'Restaurante', desc: 'Más empleos (25) y sube el valor del suelo, además de cobertura de comida.' },
      { tool: TileType.Market, icon: 'cart', label: 'Mercado', desc: 'Edificio 2×2 — más grande = más cobertura: gran alcance de comida (radio 7) + 40 empleos.' },
    ],
  },
  {
    icon: 'tree',
    name: 'Amenidades',
    tools: [
      { tool: TileType.Park, icon: 'tree', label: 'Parque', desc: 'Sube el valor del suelo en un radio chico → las zonas cercanas crecen más rápido.' },
      { tool: TileType.Plaza, icon: 'square', label: 'Plaza', desc: 'Amenidad chica y barata; aporta algo de valor del suelo cerca.' },
      { tool: TileType.Stadium, icon: 'trophy', label: 'Estadio', desc: 'Edificio 2×2. Gran atractivo: mucho valor del suelo en un radio amplio.' },
      { tool: TileType.Museum, icon: 'landmark', label: 'Museo', desc: 'Cultura: sube el valor del suelo en un buen radio.' },
      { tool: TileType.Church, icon: 'landmark', label: 'Iglesia', desc: 'Comunidad: sube el valor del suelo de las zonas cercanas.' },
      { tool: TileType.Monument, icon: 'landmark', label: 'Monumento', desc: 'Edificio 2×2. Hito de prestigio: muchísimo valor del suelo en un radio amplio.' },
    ],
  },
  {
    icon: 'flower',
    name: 'Paisaje',
    tools: [
      { tool: TileType.Tree, icon: 'tree', label: 'Árboles', desc: 'Decoración instantánea (sin calle). Sube un poco el valor del suelo. Cerca del mar salen palmeras. Arrastrá para plantar varios.' },
      { tool: TileType.Bush, icon: 'tree', label: 'Arbustos', desc: 'Vegetación baja y barata; suma un toque de valor del suelo.' },
      { tool: TileType.Flowers, icon: 'flower', label: 'Flores', desc: 'Cantero de flores: decora y aporta un poquito de valor del suelo.' },
      { tool: TileType.Rock, icon: 'rock', label: 'Rocas', desc: 'Decoración natural (sin efecto de valor del suelo).' },
    ],
  },
];

/** Etiqueta e icono de cada herramienta (para la píldora "Construyendo: …"). */
const TOOL_INFO = (() => {
  const map = new Map<Tool, { label: string; icon: string }>();
  for (const c of CATEGORIES) for (const t of c.tools) map.set(t.tool, { label: t.label, icon: t.icon });
  return map;
})();

export function toolLabel(tool: Tool): string {
  return TOOL_INFO.get(tool)?.label ?? '';
}
export function toolIcon(tool: Tool): string {
  return TOOL_INFO.get(tool)?.icon ?? 'square';
}
