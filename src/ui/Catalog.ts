import { TileType, ResidentialStyle } from '../sim/types';

/** Una herramienta: colocar un tipo de casilla, "seleccionar", o pintar terreno (agua/tierra). */
export type Tool = TileType | 'select' | 'terrain_water' | 'terrain_land';

/** ¿Es una herramienta de pintar terreno (ríos/lagos a mano)? */
export function isPaintTool(tool: Tool): tool is 'terrain_water' | 'terrain_land' {
  return tool === 'terrain_water' || tool === 'terrain_land';
}

export interface ToolEntry {
  tool: Tool;
  label: string;
  desc: string;
  style?: ResidentialStyle; // (residencial) estilo de barrio que pinta esta entrada
}

export interface Category {
  icon: string;
  name: string;
  tools: ToolEntry[];
}

// Catálogo de construcción agrupado por rubros (lo usa el menú 🏗️ Construir).
export const CATEGORIES: Category[] = [
  {
    icon: '🔧',
    name: 'Básico',
    tools: [
      { tool: TileType.Road, label: '🛣️ Carretera', desc: 'Las zonas necesitan una calle al lado para crecer. Se mejora a avenida/autopista (sube todo el tramo recto de una).' },
      { tool: TileType.Empty, label: '🧨 Demoler', desc: 'Borra lo que haya en la casilla. Es gratis.' },
    ],
  },
  {
    icon: '🌊',
    name: 'Terreno',
    tools: [
      { tool: 'terrain_water', label: '💧 Agua / Río', desc: 'Pintá agua a mano (ríos, lagos, ensanchar la costa). Arrastrá para trazar. Deja orillas de arena solas. Solo sobre terreno libre (no bajo edificios). Las calles sobre agua se vuelven puente.' },
      { tool: 'terrain_land', label: '🟩 Rellenar tierra', desc: 'Vuelve el agua/arena a tierra firme (borra ríos/lagos). Arrastrá.' },
    ],
  },
  {
    icon: '🏠',
    name: 'Residencial',
    tools: [
      { tool: TileType.Residential, style: 'default', label: '🏠 Estándar', desc: 'Barrio clásico: crece con la demanda (barra R) y los servicios. El único que llega a RASCACIELOS (nivel 5). El comercio y la industria se colocan como edificios.' },
      { tool: TileType.Residential, style: 'suburb', label: '🏡 Suburbio', desc: 'Casas bajas: poca densidad (tope nivel 2) pero barrio tranquilo. Para las afueras.' },
      { tool: TileType.Residential, style: 'eco', label: '🌿 Eco', desc: 'Barrio ecológico: casi inmune a la contaminación y suma algo de valor del suelo. Densidad media (tope nivel 3).' },
      { tool: TileType.Residential, style: 'luxury', label: '💎 Lujo', desc: 'Barrio premium: alta densidad por nivel e irradia mucho valor del suelo a los vecinos (tope nivel 3).' },
    ],
  },
  {
    icon: '🏭',
    name: 'Fábricas',
    tools: [
      { tool: TileType.FactorySmall, label: '🏭 Fábrica chica', desc: 'Fábrica 1×1. Da 20 empleos al instante. La demanda industrial (barra I) te indica cuándo poner más.' },
      { tool: TileType.FactoryMedium, label: '🏭 Fábrica mediana', desc: 'Fábrica 2×2. Da 90 empleos. Es en lo que se fusionan las zonas industriales.' },
      { tool: TileType.FactoryLarge, label: '🏭 Fábrica grande', desc: 'Fábrica 3×3. Da 220 empleos. El motor de una gran ciudad industrial.' },
      { tool: TileType.TechPark, label: '🔬 Parque tecnológico', desc: 'Edificio 2×2. Empleo industrial limpio (150) y agradable: sube el valor del suelo cercano.' },
    ],
  },
  {
    icon: '🛒',
    name: 'Comercio',
    tools: [
      { tool: TileType.ShoppingMall, label: '🛒 Centro comercial', desc: 'Edificio 2×2. Muchos empleos comerciales (70) y atrae gente (sube el valor del suelo).' },
      { tool: TileType.Hotel, label: '🏨 Hotel', desc: 'Edificio 2×2. Turismo: sube mucho el valor del suelo alrededor + 50 empleos comerciales.' },
      { tool: TileType.OfficeTower, label: '🏦 Torre de oficinas', desc: 'Altísima densidad de empleo comercial (100) en una sola casilla.' },
      { tool: TileType.Airport, label: '✈️ Aeropuerto', desc: 'Edificio 3×3. Turismo: 80 empleos comerciales, gran valor del suelo y renta fija ($60/mes).' },
    ],
  },
  {
    icon: '🏪',
    name: 'Negocios',
    tools: [
      { tool: TileType.Kiosk, label: '🏪 Kiosco', desc: 'Comercio chico y barato (6 empleos). Ideal para huecos chicos y el arranque.' },
      { tool: TileType.Boutique, label: '👗 Boutique', desc: 'Tienda de ropa: 18 empleos y sube un poco el valor del suelo.' },
      { tool: TileType.Pharmacy, label: '💊 Farmacia', desc: 'Comercio (12 empleos) que además da algo de cobertura de salud cercana.' },
      { tool: TileType.GasStation, label: '⛽ Estación de servicio', desc: '12 empleos + renta fija ($20/mes) por venta de combustible.' },
      { tool: TileType.Bank, label: '💰 Banco', desc: '30 empleos + renta fija ($30/mes). El negocio financiero de la ciudad.' },
      { tool: TileType.Dealership, label: '🚗 Concesionaria', desc: 'Edificio 2×2. Mucho empleo comercial (50) y algo de valor del suelo.' },
    ],
  },
  {
    icon: '🧱',
    name: 'Materiales',
    tools: [
      { tool: TileType.SandPit, label: '⏳ Arenera', desc: 'Produce 16 de arena por mes (la arena alimenta el cemento Y el ladrillo). Necesita energía + corralón conectado. Poné suficientes: 1 arenera abastece ~2-3 cementeras/ladrillerías.' },
      { tool: TileType.CementPlant, label: '🪨 Cementera', desc: 'Convierte 6 arena → 4 cemento por mes. Necesita energía + corralón + ARENA (de una arenera).' },
      { tool: TileType.BrickKiln, label: '🧱 Ladrillería', desc: 'Convierte 6 arena → 5 ladrillo por mes. Necesita energía + corralón + ARENA (de una arenera).' },
      { tool: TileType.BuildYard, label: '🏬 Corralón', desc: 'Edificio 2×2. Almacena materiales y los distribuye por su red de calles. Hace falta para construir lo avanzado.' },
      { tool: TileType.SawMill, label: '🪵 Aserradero', desc: 'Produce 6 de madera por mes (necesita energía + corralón conectado). La madera sirve para monumentos, aeropuerto y exportar.' },
      { tool: TileType.SteelMill, label: '⚙️ Acería', desc: 'Edificio 2×2. Produce 4 de acero por mes (energía + corralón). El acero alimenta la electrónica y la empresa tecnológica.' },
      { tool: TileType.ElectronicsFactory, label: '🔌 Fábrica de electrónica', desc: 'Edificio 2×2. Convierte 3 acero → 2 electrónica por mes. La electrónica es clave para la empresa tecnológica.' },
      { tool: TileType.Hardware, label: '🔧 Ferretería', desc: 'Vende materiales del corralón conectado a la población → renta + empleos. Compite con la construcción por el stock.' },
      { tool: TileType.ExportTerminal, label: '🚢 Terminal de exportación', desc: 'Edificio 2×2. Exporta el excedente de materiales (sobre un stock mínimo que configurás) → renta.' },
      { tool: TileType.TechCompany, label: '🔬 Empresa tecnológica', desc: 'Edificio 2×2. Requiere un corralón conectado con 30 ladrillo + 30 acero + 15 electrónica. 200 empleos de alto valor.' },
    ],
  },
  {
    icon: '🚓',
    name: 'Servicios',
    tools: [
      { tool: TileType.Police, label: '🚓 Policía', desc: 'Cobertura de servicios (radio 5) para que las zonas crezcan a niveles altos. Atiende ~250 habitantes.' },
      { tool: TileType.Fire, label: '🚒 Bomberos', desc: 'Cobertura de servicios (radio 5). Atiende ~250 habitantes.' },
      { tool: TileType.Government, label: '🏛️ Gobierno', desc: 'Edificio 2×2. Gran cobertura de servicios (radio 7). Atiende ~600 habitantes.' },
    ],
  },
  {
    icon: '🚍',
    name: 'Transporte',
    tools: [
      { tool: TileType.BusStop, label: '🚏 Parada de colectivo', desc: 'Alivia el tráfico de las calles cercanas (radio 4): la gente cerca viaja en colectivo en vez de auto. Atiende ~250 hab.' },
      { tool: TileType.TramStop, label: '🚋 Parada de tranvía', desc: 'Más alivio de tráfico que el colectivo (radio 5). Atiende ~500 hab.' },
      { tool: TileType.MetroStation, label: '🚇 Estación de metro', desc: 'Edificio 2×2. El que más descongestiona (radio 8): clave para una metrópolis densa. Atiende ~1200 hab.' },
    ],
  },
  {
    icon: '⚡',
    name: 'Energía y agua',
    tools: [
      { tool: TileType.PowerPlant, label: '⚡ Central eléctrica', desc: 'Edificio 2×2. Produce 400 de energía para toda la ciudad. Sin energía suficiente, las zonas no pasan de nivel 1.' },
      { tool: TileType.WaterTower, label: '💧 Torre de agua', desc: 'Produce 350 de agua. Junto al gas, hace falta para que las zonas lleguen al nivel máximo.' },
      { tool: TileType.GasPlant, label: '🔥 Planta de gas', desc: 'Produce 320 de gas. Junto al agua, hace falta para el nivel máximo de las zonas.' },
      { tool: TileType.SolarPlant, label: '☀️ Planta solar', desc: 'Edificio 2×2. Energía LIMPIA: 220 de electricidad sin contaminar. Más cara por MW que el carbón, pero sin humo.' },
      { tool: TileType.WindTurbine, label: '💨 Parque eólico', desc: 'Turbina 1×1: 150 de electricidad limpia, barata. Poné varias.' },
      { tool: TileType.HydroPlant, label: '🌊 Represa hidroeléctrica', desc: 'Edificio 2×2. 380 de electricidad limpia. Hay que colocarla JUNTO AL AGUA (río o mar).' },
    ],
  },
  {
    icon: '🎓',
    name: 'Bienestar',
    tools: [
      { tool: TileType.School, label: '🏫 Escuela', desc: 'Cobertura educativa (radio 5). Las zonas con buena educación crecen más rápido. Atiende ~300 hab.' },
      { tool: TileType.University, label: '🎓 Universidad', desc: 'Edificio 2×2. Gran cobertura educativa (radio 7). Atiende ~800 hab.' },
      { tool: TileType.Clinic, label: '⛑️ Clínica', desc: 'Cobertura de salud (radio 5). Atiende ~300 hab.' },
      { tool: TileType.Hospital, label: '🏥 Hospital', desc: 'Edificio 2×2. Gran cobertura de salud (radio 7). Atiende ~800 hab.' },
      { tool: TileType.Library, label: '📚 Biblioteca', desc: 'Cobertura educativa (radio 6). Alternativa cultural a la escuela. Atiende ~500 hab.' },
    ],
  },
  {
    icon: '🔬',
    name: 'Ciencia',
    tools: [
      { tool: TileType.ResearchLab, label: '🔬 Laboratorio', desc: 'Genera 4 🔬 de ciencia por mes (con energía) + 30 empleos limpios. La ciencia acumulada desbloquea lo más avanzado.' },
      { tool: TileType.Observatory, label: '🔭 Observatorio', desc: 'Genera 5 🔬 por mes y sube el valor del suelo (radio 3). Necesita energía.' },
      { tool: TileType.SciencePark, label: '🧪 Parque científico', desc: 'Edificio 2×2. Mucha ciencia (12 🔬/mes) + 100 empleos limpios + valor del suelo. Se desbloquea con ciencia acumulada.' },
      { tool: TileType.SpaceCenter, label: '🚀 Centro espacial', desc: 'Edificio 3×3. El hito científico máximo: 30 🔬/mes, 150 empleos y gran prestigio (valor del suelo). Requiere un gran programa espacial.' },
    ],
  },
  {
    icon: '🦸',
    name: 'Héroe',
    tools: [
      { tool: TileType.HeroHQ, label: '🦸 Cuartel del héroe', desc: 'Edificio 2×2. Mientras esté en pie, la ciudad tiene un héroe que apaga los incendios él solo y atrae prestigio. Se desbloquea con mucha ciencia.' },
      { tool: TileType.HeroBeacon, label: '🔦 Señal del héroe', desc: 'Llama al héroe: prestigio y valor del suelo (radio 3).' },
      { tool: TileType.HeroStatue, label: '🗽 Estatua del héroe', desc: 'Monumento al héroe: gran valor del suelo en un radio amplio.' },
    ],
  },
  {
    icon: '🎡',
    name: 'Ocio',
    tools: [
      { tool: TileType.Cinema, label: '🎬 Cine', desc: 'Empleos comerciales (25) + valor del suelo cercano.' },
      { tool: TileType.AmusementPark, label: '🎡 Parque de diversiones', desc: 'Edificio 2×2. Gran atractivo (radio 6) + 40 empleos comerciales.' },
      { tool: TileType.Casino, label: '🎰 Casino', desc: 'Edificio 2×2. 60 empleos comerciales, sube el valor del suelo y genera renta fija ($40/mes).' },
      { tool: TileType.RaceTrack, label: '🏁 Circuito de carreras', desc: 'Edificio 3×3. Gran atracción + 40 empleos. Organiza días de evento: cada tanto hay un fin de semana de carreras con renta extra y autos dando vueltas. 🏎️' },
      { tool: TileType.BalloonPort, label: '🎈 Globopuerto', desc: 'Atracción: de acá salen los globos aerostáticos que flotan sobre la ciudad. Sube el valor del suelo + empleos.' },
      { tool: TileType.AirshipDock, label: '🛩️ Hangar de dirigibles', desc: 'Edificio 2×2. De acá sale el dirigible que sobrevuela la ciudad. Atracción turística.' },
    ],
  },
  {
    icon: '🍽️',
    name: 'Comida',
    tools: [
      { tool: TileType.Cafe, label: '☕ Café', desc: 'Cobertura de comida chica + 8 empleos. La población necesita comida cerca para crecer mejor.' },
      { tool: TileType.HotDog, label: '🌭 Panchería', desc: 'Local chico y barato: cobertura de comida (radio 3) + 7 empleos. Ideal para huecos.' },
      { tool: TileType.IceCream, label: '🍦 Heladería', desc: 'Comida (radio 3) + 8 empleos y sube un poco el valor del suelo.' },
      { tool: TileType.Pizzeria, label: '🍕 Pizzería', desc: 'Comida (radio 4) + 14 empleos y algo de valor del suelo.' },
      { tool: TileType.Burger, label: '🍔 Hamburguesería', desc: 'Comida rápida (radio 4) + 14 empleos.' },
      { tool: TileType.Bakery, label: '🥖 Panadería', desc: 'Comida (radio 4) + 10 empleos.' },
      { tool: TileType.Diner, label: '🍴 Casa de comidas', desc: 'Comida rápida: buena cobertura de comida (radio 5) + 15 empleos.' },
      { tool: TileType.Restaurant, label: '🍽️ Restaurante', desc: 'Más empleos (25) y sube el valor del suelo, además de cobertura de comida.' },
      { tool: TileType.Market, label: '🛒 Mercado', desc: 'Edificio 2×2 — más grande = más cobertura: gran alcance de comida (radio 7) + 40 empleos.' },
    ],
  },
  {
    icon: '🌳',
    name: 'Amenidades',
    tools: [
      { tool: TileType.Park, label: '🌳 Parque', desc: 'Sube el valor del suelo en un radio chico → las zonas cercanas crecen más rápido.' },
      { tool: TileType.Plaza, label: '⛲ Plaza', desc: 'Amenidad chica y barata; aporta algo de valor del suelo cerca.' },
      { tool: TileType.Stadium, label: '🏟️ Estadio', desc: 'Edificio 2×2. Gran atractivo: mucho valor del suelo en un radio amplio.' },
      { tool: TileType.Museum, label: '🖼️ Museo', desc: 'Cultura: sube el valor del suelo en un buen radio.' },
      { tool: TileType.Church, label: '⛪ Iglesia', desc: 'Comunidad: sube el valor del suelo de las zonas cercanas.' },
      { tool: TileType.Monument, label: '🗽 Monumento', desc: 'Edificio 2×2. Hito de prestigio: muchísimo valor del suelo en un radio amplio.' },
    ],
  },
  {
    icon: '🌸',
    name: 'Paisaje',
    tools: [
      { tool: TileType.Tree, label: '🌳 Árboles', desc: 'Decoración instantánea (sin calle). Sube un poco el valor del suelo. Cerca del mar salen palmeras. Arrastrá para plantar varios.' },
      { tool: TileType.Bush, label: '🌿 Arbustos', desc: 'Vegetación baja y barata; suma un toque de valor del suelo.' },
      { tool: TileType.Flowers, label: '🌸 Flores', desc: 'Cantero de flores: decora y aporta un poquito de valor del suelo.' },
      { tool: TileType.Rock, label: '🪨 Rocas', desc: 'Decoración natural (sin efecto de valor del suelo).' },
    ],
  },
];

/** Etiqueta de cada herramienta (para la píldora "Construyendo: …"). */
export const TOOL_LABEL = (() => {
  const map = new Map<Tool, string>();
  for (const c of CATEGORIES) for (const t of c.tools) map.set(t.tool, t.label);
  return map;
})();
