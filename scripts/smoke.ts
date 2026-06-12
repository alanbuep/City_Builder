// Prueba de humo de la SIMULACIÓN (sin navegador).
// Correr con:  pnpm dlx tsx scripts/smoke.ts
import { City } from '../src/sim/City';
import { Simulation } from '../src/sim/Simulation';
import { TileType, TILE_DEF, capacityOf } from '../src/sim/types';
import { generateTerrain } from '../src/sim/Terrain';

function zonedCity(): { city: City; sim: Simulation } {
  const city = new City(10, 10);
  const sim = new Simulation(city);
  for (let x = 0; x < 10; x++) {
    city.setType(x, 3, TileType.Road);
    city.setType(x, 2, TileType.Residential);
    city.setType(x, 4, TileType.Commercial);
  }
  city.drainDirty();
  return { city, sim };
}

const checks: Array<[string, boolean]> = [];

// 1) Modo Simulación (auto): debe crecer solo.
{
  const { sim } = zonedCity();
  for (let i = 0; i < 60; i++) sim.tick();
  const s = sim.getStats();
  console.log('[auto] tras 60 meses:', { pop: s.population, jobs: s.jobs, money: s.money });
  checks.push(['auto crece solo (pop>0)', s.population > 0 && s.jobs > 0]);
  checks.push(['la plata no se dispara sola', s.money < 25000]);
}

// 2) Modo Constructor (manual): NO crece solo; mejorar a mano sí sube población.
{
  const { city, sim } = zonedCity();
  sim.mode = 'manual';
  for (let i = 0; i < 30; i++) sim.tick();
  const popAuto = sim.population;
  const upgraded = sim.tryUpgrade(0, 2); // abre una obra de ampliación (no es instantáneo)
  for (let i = 0; i < 3; i++) sim.tick(); // la obra de zona tarda 2 meses
  console.log('[manual] sin tocar:', popAuto, '| obra aplicada:', upgraded, '| pop:', sim.population);
  checks.push(['manual NO crece solo', popAuto === 0]);
  checks.push(['mejorar a mano (obra) sube población al terminar', upgraded && sim.population > 0]);
}

// 3) Parque: aporta valor de suelo sin romper nada; la ciudad sigue creciendo.
{
  const { city, sim } = zonedCity();
  city.setType(5, 1, TileType.Park);
  city.drainDirty();
  for (let i = 0; i < 60; i++) sim.tick();
  console.log('[parque] pop:', sim.population);
  checks.push(['con parque sigue creciendo', sim.population > 0]);
}

// 4) Demografía e inspección.
{
  const { sim } = zonedCity();
  for (let i = 0; i < 60; i++) sim.tick();
  const s = sim.getStats();
  console.log('[demografía]', {
    pop: s.population,
    niños: s.children,
    adultos: s.adults,
    empleados: s.employed,
    desempleo: `${Math.round(s.unemploymentRate * 100)}%`,
  });
  checks.push(['niños + adultos = población', s.children + s.adults === s.population]);
  checks.push(['hay adultos empleados', s.employed > 0]);

  const info = sim.inspect(0, 2); // casilla residencial
  console.log('[inspect 0,2]', info);
  checks.push(['inspect ve residencial', info.type === TileType.Residential]);
}

// 5) Servicios (topan el nivel), tráfico en calles y amenidades (valor del suelo).
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  for (let x = 0; x < 12; x++) {
    city.setType(x, 5, TileType.Road);
    city.setType(x, 4, TileType.Residential);
    city.setType(x, 6, TileType.Commercial); // empleos, para que la zona cobre vida
  }

  const before = sim.inspect(0, 4); // sin nada todavía
  city.placeBuilding(0, 0, TileType.PowerPlant, 2); // luz/agua (necesarios para nivel 2)
  city.setType(0, 3, TileType.Police);
  sim.tick(); // recalcula cobertura
  const after = sim.inspect(0, 4);
  console.log('[servicios] maxLevel sin → con policía+luz:', before.maxLevel, '→', after.maxLevel);
  checks.push(['sin servicios el nivel topa en 1', before.maxLevel === 1]);
  checks.push(['con policía + luz el nivel sube', after.maxLevel >= 2]);

  for (let i = 0; i < 40; i++) sim.tick();
  let maxTraffic = 0;
  for (let x = 0; x < 12; x++) maxTraffic = Math.max(maxTraffic, sim.inspect(x, 5).traffic);
  console.log('[tráfico] máximo en la avenida:', maxTraffic);
  checks.push(['alguna calle registra tráfico', maxTraffic > 0]);

  city.setType(6, 3, TileType.Stadium);
  sim.tick();
  const nearStadium = sim.inspect(6, 4);
  console.log('[amenidad] valor del suelo junto al estadio:', nearStadium.value.toFixed(2));
  checks.push(['el estadio aporta valor del suelo', nearStadium.value > 0]);
}

// 6) Mejora de carretera por TRAMO completo + capacidad de servicio.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  // Forma de L: fila horizontal (z=0, x 0..5) + columna vertical (x=0, z 1..5).
  for (let x = 0; x < 6; x++) city.setType(x, 0, TileType.Road);
  for (let z = 1; z < 6; z++) city.setType(0, z, TileType.Road);
  city.drainDirty();

  sim.tryUpgrade(3, 0); // toco la parte HORIZONTAL
  let horizUp = true;
  for (let x = 0; x < 6; x++) if (city.getTile(x, 0).level !== 1) horizUp = false;
  let vertStayed = true;
  for (let z = 1; z < 6; z++) if (city.getTile(0, z).level !== 0) vertStayed = false;
  console.log('[tramo recto] horizontal subió:', horizUp, '| vertical quedó igual:', vertStayed);
  checks.push(['mejorar sube solo la línea recta, no la red entera', horizUp && vertStayed]);

  city.setType(8, 8, TileType.Police);
  sim.tick();
  const pol = sim.inspect(8, 8);
  console.log('[servicio] policía atiende/capacidad:', `${pol.serviceServed}/${pol.serviceCapacity}`);
  checks.push(['el servicio tiene capacidad por población', pol.serviceCapacity > 0]);
}

// 7) Edificios multi-casilla (estadio 2×2).
{
  const city = new City(10, 10);
  const sim = new Simulation(city);

  const placed = city.placeBuilding(3, 3, TileType.Stadium, 2);
  let occupied = 0;
  let subs = 0;
  for (let dz = 0; dz < 2; dz++) {
    for (let dx = 0; dx < 2; dx++) {
      if (city.getTile(3 + dx, 3 + dz).type === TileType.Stadium) occupied++;
      if (city.isSubCell(3 + dx, 3 + dz)) subs++;
    }
  }
  console.log('[multi] estadio colocado:', placed, '| celdas:', occupied, '| sub-celdas:', subs);
  checks.push(['estadio 2×2 ocupa 4 casillas', placed && occupied === 4]);
  checks.push(['1 ancla + 3 sub-celdas', subs === 3]);

  checks.push(['no se solapa con otro edificio', city.placeBuilding(3, 3, TileType.Stadium, 2) === false]);
  checks.push(['inspect del estadio reporta 2×2', sim.inspect(3, 3).size === 2]);

  city.setType(4, 4, TileType.Empty); // (4,4) es sub-celda → debe borrar todo el estadio
  let remaining = 0;
  for (let dz = 0; dz < 2; dz++) {
    for (let dx = 0; dx < 2; dx++) if (city.getTile(3 + dx, 3 + dz).type !== TileType.Empty) remaining++;
  }
  console.log('[multi] tras demoler una celda, quedan:', remaining);
  checks.push(['demoler una celda borra el edificio entero', remaining === 0]);
}

// 8) Fábrica prefabricada: plopearla da empleos industriales.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  city.placeBuilding(0, 0, TileType.FactoryMedium, 2);
  sim.tick();
  console.log('[fábrica] empleos industriales tras plopear F. mediana:', sim.industrialJobs);
  checks.push(['fábrica prefabricada aporta empleos', sim.industrialJobs >= 90]);
}

// 9) Fusión: un bloque 2×2 de industria a nivel máx (con calle) → fábrica mediana.
{
  const city = new City(14, 14);
  const sim = new Simulation(city);
  for (let x = 4; x < 7; x++) city.setType(x, 7, TileType.Road);
  // Re-forzamos cada mes: población (para demanda industrial positiva) + el bloque.
  const force = () => {
    for (let z = 0; z < 4; z++) {
      for (let x = 8; x < 14; x++) {
        city.setType(x, z, TileType.Residential);
        city.setLevel(x, z, 3);
      }
    }
    for (let dz = 0; dz < 2; dz++) {
      for (let dx = 0; dx < 2; dx++) {
        city.setType(4 + dx, 5 + dz, TileType.Industrial);
        city.setLevel(4 + dx, 5 + dz, 3);
      }
    }
  };
  force();
  let merged = false;
  for (let i = 0; i < 100 && !merged; i++) {
    sim.tick();
    if (city.getTile(4, 5).type === TileType.FactoryMedium) merged = true;
    else force();
  }
  console.log('[fusión] bloque 2×2 industrial → fábrica mediana:', merged);
  checks.push(['zonas industriales se fusionan en fábrica', merged]);
}

// 10) Servicios básicos (luz/agua/gas) necesarios para crecer de nivel.
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  city.setType(0, 1, TileType.Road);
  city.setType(0, 0, TileType.Residential);
  city.setType(0, 2, TileType.Police); // hay servicios, pero no básicos aún
  sim.tick();
  const noUtil = sim.inspect(0, 0).maxLevel;
  city.placeBuilding(2, 0, TileType.PowerPlant, 2); // ahora hay luz/agua cerca
  sim.tick();
  const withUtil = sim.inspect(0, 0).maxLevel;
  console.log('[básicos] maxLevel sin luz → con luz:', noUtil, '→', withUtil);
  checks.push(['sin luz/agua no pasa de nivel 1 aunque haya policía', noUtil === 1]);
  checks.push(['con luz/agua + servicios sube de nivel', withUtil >= 2]);
}

// 11) Guardado: serializar y restaurar conserva casillas y estado.
{
  const city = new City(8, 8);
  const sim = new Simulation(city);
  city.setType(2, 2, TileType.Residential);
  city.setLevel(2, 2, 2);
  city.placeBuilding(4, 4, TileType.Stadium, 2);
  sim.money = 4321;
  sim.month = 7;

  const citySave = city.serialize();
  const simSave = sim.serialize();

  const city2 = new City(8, 8);
  const sim2 = new Simulation(city2);
  city2.load(citySave);
  sim2.load(simSave);

  const okTile = city2.getTile(2, 2).type === TileType.Residential && city2.getTile(2, 2).level === 2;
  const okStadium =
    city2.getTile(4, 4).type === TileType.Stadium && city2.getTile(4, 4).size === 2 && city2.isSubCell(5, 5);
  console.log('[guardado] tile ok:', okTile, '| estadio ok:', okStadium, '| money:', sim2.money, '| mes:', sim2.month);
  checks.push(['guardar/cargar conserva las casillas', okTile && okStadium]);
  checks.push(['guardar/cargar conserva dinero y mes', sim2.money === 4321 && sim2.month === 7]);
}

// 12) Notificaciones: población sin energía → alerta de energía.
{
  const city = new City(8, 8);
  const sim = new Simulation(city);
  city.setType(0, 1, TileType.Road);
  city.setType(0, 0, TileType.Residential);
  city.setLevel(0, 0, 1); // garantiza población (sin depender del crecimiento por obra)
  sim.tick();
  const alerts = sim.getAlerts();
  console.log('[alertas]', alerts.map((a) => a.id));
  checks.push(['avisa cuando falta energía con población', alerts.some((a) => a.id === 'power')]);
}

// 13) Tecnología: al inicio hay un kit básico; los hitos desbloquean lo avanzado.
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  const u0 = sim.unlockedTypes();
  console.log('[tech] desbloqueos iniciales:', sim.getTechStatus().unlocked, '/', sim.getTechStatus().total);
  checks.push(['al inicio la fábrica chica está disponible', u0.has(TileType.FactorySmall)]);
  checks.push(['al inicio la fábrica grande está bloqueada', !u0.has(TileType.FactoryLarge)]);
  checks.push(['al inicio bomberos está bloqueado', !u0.has(TileType.Fire)]);

  // Crecer la población para alcanzar el hito "Servicios públicos" (pop ≥ 40).
  for (let x = 0; x < 12; x++) {
    city.setType(x, 5, TileType.Road);
    city.setType(x, 4, TileType.Residential);
    city.setType(x, 6, TileType.Commercial);
  }
  city.placeBuilding(0, 0, TileType.PowerPlant, 2);
  city.setType(0, 3, TileType.Police);
  for (let i = 0; i < 80; i++) sim.tick();
  const u1 = sim.unlockedTypes();
  console.log('[tech] tras crecer → pop:', sim.population, '| bomberos:', u1.has(TileType.Fire));
  checks.push(['al crecer la población se desbloquean bomberos + agua', u1.has(TileType.Fire) && u1.has(TileType.WaterTower)]);

  // El progreso tecnológico se conserva al guardar/cargar.
  const sim2 = new Simulation(new City(12, 12));
  sim2.load(sim.serialize());
  checks.push(['guardar/cargar conserva los desbloqueos', sim2.unlockedTypes().has(TileType.Fire)]);
}

// 14) Negocios especializados: un centro comercial aporta empleos comerciales.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  city.placeBuilding(0, 0, TileType.ShoppingMall, 2);
  sim.tick();
  console.log('[comercio] empleos comerciales tras centro comercial:', sim.commercialJobs);
  checks.push(['el centro comercial aporta empleos comerciales', sim.commercialJobs >= 70]);
}

// 15) Cadena de materiales: productoras + corralón conectados por calle producen.
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  for (let x = 0; x < 12; x++) city.setType(x, 5, TileType.Road); // una sola red de calles
  city.setType(1, 4, TileType.SandPit); // arena
  city.setType(3, 4, TileType.CementPlant); // arena → cemento
  city.placeBuilding(6, 6, TileType.BuildYard, 2); // corralón (almacén) conectado
  city.placeBuilding(9, 6, TileType.PowerPlant, 2); // energía (las productoras la necesitan)
  city.drainDirty();

  for (let i = 0; i < 10; i++) sim.tick();
  const totals = sim.getStats().materials.totals;
  const yard = sim.materials.stockAt(6, 6); // stock que se acumuló EN el corralón
  console.log('[materiales] totales tras 10 meses:', totals, '| corralón:', yard, '| inactivas:', sim.getStats().materials.idleProducers);
  checks.push(['la arenera produce arena (más que la reserva)', totals.arena > 80]);
  checks.push(['la cementera acumula cemento en el corralón', yard.cemento > 0]);
  checks.push(['con corralón + energía no hay productoras inactivas', sim.getStats().materials.idleProducers === 0]);
}

// 16) La empresa tecnológica exige un corralón conectado CON materiales.
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  for (let x = 0; x < 12; x++) city.setType(x, 5, TileType.Road);
  city.drainDirty();
  const noYard = sim.buildMaterialsOk(2, 6, 2, TileType.TechCompany); // sin corralón
  city.placeBuilding(6, 6, TileType.BuildYard, 2); // corralón vacío
  city.drainDirty();
  const yardEmpty = sim.buildMaterialsOk(2, 6, 2, TileType.TechCompany);
  console.log('[techco] sin corralón:', noYard, '| corralón vacío:', yardEmpty);
  checks.push(['sin corralón no se puede la empresa tecnológica', noYard === false]);
  checks.push(['con corralón vacío tampoco (faltan materiales)', yardEmpty === false]);
}

// 17) Guardado: el stock de materiales se conserva.
{
  const city = new City(8, 8);
  const sim = new Simulation(city);
  for (let x = 0; x < 8; x++) city.setType(x, 3, TileType.Road);
  city.setType(0, 2, TileType.SandPit);
  city.placeBuilding(2, 4, TileType.BuildYard, 2);
  city.placeBuilding(5, 4, TileType.PowerPlant, 2);
  city.drainDirty();
  for (let i = 0; i < 6; i++) sim.tick();
  const before = sim.getStats().materials.totals.arena;

  const city2 = new City(8, 8);
  const sim2 = new Simulation(city2);
  city2.load(city.serialize());
  sim2.load(sim.serialize());
  const after = sim2.getStats().materials.totals.arena;
  console.log('[guardado materiales] arena antes/después:', before, after);
  checks.push(['guardar/cargar conserva el stock de materiales', after === before && before > 80]);
}

// 18) Bienestar (educación/salud cercana) y renta fija del casino.
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  for (let x = 0; x < 12; x++) {
    city.setType(x, 5, TileType.Road);
    city.setType(x, 4, TileType.Residential);
  }
  city.placeBuilding(0, 6, TileType.Hospital, 2);
  city.setType(3, 6, TileType.School);
  city.drainDirty();
  sim.tick();
  const zinfo = sim.inspect(1, 4);
  console.log('[bienestar] salud:', zinfo.health.toFixed(2), '| educación:', zinfo.education.toFixed(2));
  checks.push(['el hospital da cobertura de salud cercana', zinfo.health > 0]);
  checks.push(['la escuela da cobertura educativa cercana', zinfo.education > 0]);

  const c2 = new City(8, 8);
  const s2 = new Simulation(c2);
  s2.mode = 'manual'; // que nada crezca solo
  c2.setType(0, 1, TileType.Road);
  c2.placeBuilding(0, 2, TileType.Casino, 2);
  c2.drainDirty();
  const before = s2.money;
  s2.tick();
  console.log('[casino] dinero antes/después:', before, '→', Math.round(s2.money));
  checks.push(['el casino genera renta (sube el dinero)', s2.money > before]);
}

// 19) Obras: el cartel no construye solo; al dar OK cobra y, tras la duración, aparece el edificio.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  city.setType(0, 1, TileType.Road);
  city.placeBuilding(0, 0, TileType.Construction, 1); // cartel de obra (ocupa el terreno)
  sim.addSite(0, 0, 1, TileType.Police);
  city.drainDirty();

  for (let i = 0; i < 5; i++) sim.tick(); // sin OK: sigue siendo obra
  checks.push(['la obra no se construye sin el OK', city.getTile(0, 0).type === TileType.Construction]);

  const before = sim.money;
  const started = sim.startConstruction(0, 0);
  checks.push(['se puede iniciar la obra', started]);
  checks.push(['iniciar cobra el costo', sim.money === before - TILE_DEF[TileType.Police].cost]);

  for (let i = 0; i < 4; i++) sim.tick(); // 1×1 = 3 meses de obra
  console.log('[obra] tras iniciar y esperar:', city.getTile(0, 0).type);
  checks.push(['la obra terminada se vuelve el edificio real', city.getTile(0, 0).type === TileType.Police]);
}

// 20) Paso 2: ampliar una zona es una OBRA (no instantáneo) y sube de nivel al terminar.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  sim.mode = 'manual'; // sin crecimiento automático que interfiera
  for (let x = 0; x < 10; x++) {
    city.setType(x, 1, TileType.Road);
    city.setType(x, 0, TileType.Residential);
  }
  city.drainDirty();
  const started = sim.beginZoneConstruction(0, 0, true);
  checks.push(['se abre una obra de ampliación de zona', started]);
  checks.push(['la zona NO sube de nivel al instante (está en obra)', city.getTile(0, 0).level === 0]);
  for (let i = 0; i < 3; i++) sim.tick(); // duración de la obra de zona = 2 meses
  console.log('[zona-obra] nivel tras la obra:', city.getTile(0, 0).level);
  checks.push(['al terminar la obra la zona sube de nivel', city.getTile(0, 0).level === 1]);

  // Marcadores: una calle saturada (nivel 0 rodeada de zonas a tope) sugiere mejora (💡).
  const c2 = new City(8, 8);
  const s2 = new Simulation(c2);
  c2.setType(1, 1, TileType.Road); // calle nivel 0, capacidad 40
  for (const [zx, zz, t] of [
    [0, 1, TileType.Residential],
    [2, 1, TileType.Commercial],
    [1, 0, TileType.Residential],
    [1, 2, TileType.Commercial],
  ] as const) {
    c2.setType(zx, zz, t);
    c2.setLevel(zx, zz, 3); // mucho tráfico hacia la calle
  }
  c2.drainDirty();
  s2.tick(); // calcula el tráfico
  const markers = s2.getMarkers();
  console.log('[marcadores] cantidad:', markers.length);
  checks.push(['una calle saturada sugiere mejora (💡)', markers.some((m) => m.x === 1 && m.z === 1 && m.kind === 'upgrade')]);
}

// 21) Carretera: mejorar SOLO el tramo elegido (no todo). Biblioteca: educación.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  for (let x = 0; x < 6; x++) city.setType(x, 0, TileType.Road);
  city.drainDirty();
  const before = sim.money;
  const ok = sim.upgradeRoadCells([{ x: 1, z: 0 }, { x: 2, z: 0 }]); // solo 2 de 6 casillas
  console.log('[carretera] tramo elegido ok:', ok, '| (1,0):', city.getTile(1, 0).level, '| (3,0):', city.getTile(3, 0).level);
  checks.push([
    'mejora solo el tramo elegido (no toda la calle)',
    ok && city.getTile(1, 0).level === 1 && city.getTile(2, 0).level === 1 && city.getTile(0, 0).level === 0 && city.getTile(3, 0).level === 0,
  ]);
  checks.push(['cobra por casilla del tramo', sim.money === before - 2 * 120]);

  const c2 = new City(10, 10);
  const s2 = new Simulation(c2);
  for (let x = 0; x < 10; x++) {
    c2.setType(x, 1, TileType.Road);
    c2.setType(x, 0, TileType.Residential);
  }
  c2.setType(2, 2, TileType.Library);
  c2.drainDirty();
  s2.tick();
  console.log('[biblioteca] educación cercana:', s2.inspect(2, 0).education.toFixed(2));
  checks.push(['la biblioteca da cobertura educativa', s2.inspect(2, 0).education > 0]);
}

// 22) Comercio de materiales: ferretería vende (renta) y terminal exporta el excedente.
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  for (let x = 0; x < 12; x++) city.setType(x, 5, TileType.Road);
  city.setType(1, 4, TileType.SandPit); // produce arena
  city.placeBuilding(3, 6, TileType.BuildYard, 2); // corralón
  city.placeBuilding(6, 6, TileType.PowerPlant, 2); // energía
  city.setType(9, 4, TileType.Hardware); // ferretería (vende a la ciudad)
  city.drainDirty();
  let tradeSeen = 0;
  for (let i = 0; i < 6; i++) {
    sim.tick();
    tradeSeen = Math.max(tradeSeen, sim.materials.tradeIncome);
  }
  console.log('[comercio] renta por venta:', tradeSeen);
  checks.push(['la ferretería genera renta vendiendo materiales', tradeSeen > 0]);

  const c2 = new City(12, 12);
  const s2 = new Simulation(c2);
  for (let x = 0; x < 12; x++) c2.setType(x, 5, TileType.Road);
  c2.setType(1, 4, TileType.SandPit);
  c2.placeBuilding(3, 6, TileType.BuildYard, 2);
  c2.placeBuilding(6, 6, TileType.PowerPlant, 2);
  c2.placeBuilding(9, 6, TileType.ExportTerminal, 2);
  c2.drainDirty();
  s2.setExportKeep(0); // exportar todo el excedente
  let exp = 0;
  for (let i = 0; i < 4; i++) {
    s2.tick();
    exp = Math.max(exp, s2.materials.tradeIncome);
  }
  console.log('[exportación] renta por exportación:', exp.toFixed(1));
  checks.push(['la terminal exporta el excedente y da renta', exp > 0]);
}

// 23) Casas de comida: dan cobertura de "comida" a las zonas cercanas.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  for (let x = 0; x < 10; x++) {
    city.setType(x, 1, TileType.Road);
    city.setType(x, 0, TileType.Residential);
  }
  city.setType(2, 2, TileType.Restaurant);
  city.drainDirty();
  sim.tick();
  console.log('[comida] cobertura cercana:', sim.inspect(2, 0).food.toFixed(2));
  checks.push(['el restaurante da cobertura de comida cercana', sim.inspect(2, 0).food > 0]);
}

// 24) Negocios variados: el banco da renta fija; la farmacia da algo de salud.
{
  const c = new City(8, 8);
  const s = new Simulation(c);
  s.mode = 'manual';
  c.setType(0, 1, TileType.Road);
  c.setType(0, 0, TileType.Bank);
  c.drainDirty();
  const before = s.money;
  s.tick();
  console.log('[negocios] banco dinero:', before, '→', Math.round(s.money));
  checks.push(['el banco genera renta', s.money > before]);

  const c2 = new City(10, 10);
  const s2 = new Simulation(c2);
  for (let x = 0; x < 10; x++) {
    c2.setType(x, 1, TileType.Road);
    c2.setType(x, 0, TileType.Residential);
  }
  c2.setType(2, 2, TileType.Pharmacy);
  c2.drainDirty();
  s2.tick();
  console.log('[negocios] farmacia salud:', s2.inspect(2, 0).health.toFixed(2));
  checks.push(['la farmacia da algo de cobertura de salud', s2.inspect(2, 0).health > 0]);
}

// 25) Cadena profunda: acería → acero, electrónica usa acero, empresa tecnológica los exige.
{
  const city = new City(14, 14);
  const sim = new Simulation(city);
  for (let x = 0; x < 14; x++) city.setType(x, 6, TileType.Road);
  city.placeBuilding(0, 7, TileType.SteelMill, 2); // acero
  city.placeBuilding(3, 7, TileType.ElectronicsFactory, 2); // acero → electrónica
  city.placeBuilding(6, 7, TileType.BuildYard, 2); // corralón
  city.placeBuilding(9, 7, TileType.PowerPlant, 2); // energía
  city.drainDirty();
  for (let i = 0; i < 12; i++) sim.tick();
  const t = sim.getStats().materials.totals;
  console.log('[cadena profunda] acero/electrónica:', t.acero, '/', t.electronica);
  checks.push(['la acería produce acero', t.acero > 0]);
  checks.push(['la fábrica de electrónica produce electrónica', t.electronica > 0]);
  checks.push([
    'la empresa tecnológica ahora exige acero + electrónica',
    (TILE_DEF[TileType.TechCompany].build?.acero ?? 0) > 0 && (TILE_DEF[TileType.TechCompany].build?.electronica ?? 0) > 0,
  ]);
}

// 26) Rascacielos residenciales: con servicios básicos + barrio deseable + bienestar,
// una zona residencial supera el nivel 3; sin amenidades, topa en 3 (y el comercio siempre en 3).
{
  const city = new City(20, 20);
  const sim = new Simulation(city);
  city.setType(8, 9, TileType.Road);
  city.setType(8, 8, TileType.Residential);
  // Servicios básicos (luz/agua/gas) + cobertura fuerte (gobierno) → habilita nivel 3.
  city.placeBuilding(0, 0, TileType.PowerPlant, 2);
  city.setType(3, 0, TileType.WaterTower);
  city.setType(5, 0, TileType.GasPlant);
  city.placeBuilding(7, 6, TileType.Government, 2); // cobertura fuerte y cercana (la influencia sale del ancla)
  city.drainDirty();
  sim.tick();
  const baseMax = sim.inspect(8, 8).maxLevel;
  checks.push(['sin amenidades la residencia topa en nivel 3', baseMax === 3]);

  // Barrio deseable (monumento + parque) y bienestar (escuela/hospital/mercado) → rascacielos.
  city.placeBuilding(9, 6, TileType.Monument, 2);
  city.setType(7, 8, TileType.Park);
  city.setType(7, 9, TileType.School);
  city.placeBuilding(10, 8, TileType.Hospital, 2);
  city.placeBuilding(5, 8, TileType.Market, 2);
  city.drainDirty();
  sim.tick();
  const towerMax = sim.inspect(8, 8).maxLevel;
  console.log('[rascacielos] maxLevel base → con barrio:', baseMax, '→', towerMax);
  checks.push(['con barrio deseable + bienestar la residencia llega a rascacielos (≥4)', towerMax >= 4]);

  // Clamp por tipo: la residencia puede llegar a nivel 5; el comercio sigue topando en 3.
  city.setLevel(8, 8, 5);
  checks.push(['la residencia puede alcanzar el nivel 5', city.getTile(8, 8).level === 5]);
  checks.push(['un rascacielos nivel 5 concentra 130 habitantes', capacityOf(TileType.Residential, 5) === 130]);
  city.setType(0, 8, TileType.Commercial);
  city.setLevel(0, 8, 5);
  checks.push(['el comercio sigue topando en nivel 3', city.getTile(0, 8).level === 3]);
}

// 27) Receta de materiales: casi todo cuesta materiales (no solo dinero); la obra
// los expone (tenés/necesitás) y se puede iniciar con la reserva inicial. La cadena
// de materiales NO cuesta materiales (para poder arrancar de cero).
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  city.setType(1, 2, TileType.Road);
  city.placeBuilding(2, 2, TileType.Construction, 2); // cartel 2×2 de un Mercado
  sim.addSite(2, 2, 2, TileType.Market);
  city.drainDirty();
  const info = sim.inspect(2, 2).construction!;
  console.log('[receta] Mercado needs:', info.needs, '| have.ladrillo:', info.have?.ladrillo, '| canStart:', info.canStart);
  checks.push(['el mercado define receta de materiales', (TILE_DEF[TileType.Market].build?.ladrillo ?? 0) > 0]);
  checks.push(['la obra expone los materiales necesarios (needs)', !!info.needs && (info.needs.ladrillo ?? 0) > 0]);
  checks.push(['la obra expone cuánto hay disponible (have)', !!info.have && info.have.ladrillo > 0]);
  checks.push(['se puede iniciar con la reserva inicial', info.canStart === true]);
  checks.push(['el corralón NO cuesta materiales (bootstrap)', TILE_DEF[TileType.BuildYard].build === undefined]);
  checks.push(['la arenera NO cuesta materiales (bootstrap)', TILE_DEF[TileType.SandPit].build === undefined]);
}

// 28) Productoras: el insumo sale del corralón O de la reserva. Una ladrillería +
// corralón + energía (SIN arenera) produce ladrillo gastando la reserva de arena.
// Sin un corralón conectado, la productora queda inactiva (y el inspector lo dice).
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  for (let x = 0; x < 10; x++) city.setType(x, 3, TileType.Road);
  city.setType(1, 2, TileType.BrickKiln); // ladrillo (consume arena)
  city.placeBuilding(4, 4, TileType.BuildYard, 2); // corralón conectado
  city.placeBuilding(7, 4, TileType.PowerPlant, 2); // energía
  city.drainDirty();
  const ladrillo0 = sim.getStats().materials.totals.ladrillo;
  const arena0 = sim.getStats().materials.totals.arena;
  for (let i = 0; i < 5; i++) sim.tick();
  const t = sim.getStats().materials.totals;
  console.log('[ladrillería] ladrillo', ladrillo0, '→', t.ladrillo, '| arena', arena0, '→', t.arena);
  checks.push(['la ladrillería produce ladrillo usando la reserva de arena', t.ladrillo > ladrillo0]);
  checks.push(['gasta arena al producir (sale de la reserva)', t.arena < arena0]);

  const c2 = new City(10, 10);
  const s2 = new Simulation(c2);
  c2.setType(0, 1, TileType.Road);
  c2.setType(0, 0, TileType.BrickKiln);
  c2.placeBuilding(4, 4, TileType.PowerPlant, 2); // hay energía, pero NO corralón
  c2.drainDirty();
  const st = s2.materials.producerStatusAt(c2, 0, 0, true);
  s2.tick();
  console.log('[ladrillería sin corralón] activa:', st.active, '| reason:', st.reason, '| inactivas:', s2.getStats().materials.idleProducers);
  checks.push(['sin corralón conectado la productora queda inactiva', st.active === false && s2.getStats().materials.idleProducers > 0]);
}

// 29) Ritmo de materiales: se reporta producción y consumo por material (para el HUD).
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  for (let x = 0; x < 12; x++) city.setType(x, 5, TileType.Road);
  city.setType(1, 4, TileType.SandPit); // produce arena
  city.setType(3, 4, TileType.CementPlant); // consume arena → produce cemento
  city.placeBuilding(6, 6, TileType.BuildYard, 2);
  city.placeBuilding(9, 6, TileType.PowerPlant, 2);
  city.drainDirty();
  sim.tick();
  const M = sim.getStats().materials;
  console.log('[ritmo] arena +' + M.produced.arena + ' −' + M.consumed.arena + ' | cemento +' + M.produced.cemento);
  checks.push(['se reporta la producción de arena (ritmo)', M.produced.arena > 0]);
  checks.push(['se reporta el consumo de arena (la cementera la usa)', M.consumed.arena > 0]);
  checks.push(['se reporta la producción de cemento', M.produced.cemento > 0]);
}

// 30) Transporte público: una parada cerca de las zonas alivia el tráfico de la calle.
{
  const build = () => {
    const city = new City(12, 12);
    const sim = new Simulation(city);
    for (let x = 0; x < 12; x++) {
      city.setType(x, 5, TileType.Road);
      city.setType(x, 4, TileType.Residential);
      city.setLevel(x, 4, 3); // mucha gente → mucho tráfico hacia la calle
      city.setType(x, 6, TileType.Commercial);
      city.setLevel(x, 6, 3);
    }
    city.drainDirty();
    return { city, sim };
  };
  const a = build();
  a.sim.tick();
  const trafficNoTransit = a.sim.inspect(5, 5).traffic;

  const b = build();
  b.city.placeBuilding(4, 0, TileType.MetroStation, 2); // estación cerca de las zonas
  b.city.drainDirty();
  b.sim.tick();
  const trafficWithTransit = b.sim.inspect(5, 5).traffic;
  console.log('[transporte] tráfico sin → con metro:', Math.round(trafficNoTransit), '→', Math.round(trafficWithTransit));
  checks.push(['el transporte público alivia el tráfico de la calle', trafficWithTransit < trafficNoTransit]);
  checks.push(['la estación de metro brinda cobertura de transporte', b.sim.inspect(5, 4).transit > 0]);
}

// 31) Complejo industrial: un bloque 3×3 de industria a nivel máximo (con calle) → fábrica grande.
{
  const city = new City(16, 16);
  const sim = new Simulation(city);
  for (let x = 2; x < 6; x++) city.setType(x, 8, TileType.Road); // calle al lado del bloque
  const force = () => {
    // Población lejos para que haya demanda industrial positiva.
    for (let z = 0; z < 4; z++) {
      for (let x = 10; x < 16; x++) {
        city.setType(x, z, TileType.Residential);
        city.setLevel(x, z, 3);
      }
    }
    for (let dz = 0; dz < 3; dz++) {
      for (let dx = 0; dx < 3; dx++) {
        city.setType(2 + dx, 5 + dz, TileType.Industrial);
        city.setLevel(2 + dx, 5 + dz, 3);
      }
    }
  };
  force();
  let mergedLarge = false;
  for (let i = 0; i < 200 && !mergedLarge; i++) {
    sim.tick();
    if (city.getTile(2, 5).type === TileType.FactoryLarge) mergedLarge = true;
    else if (city.getTile(2, 5).type !== TileType.FactoryMedium) force();
    else break; // se fusionó en mediana (2×2): no es lo que buscamos, cortamos
  }
  console.log('[complejo 3×3] bloque industrial → fábrica grande:', mergedLarge, '| en (2,5):', city.getTile(2, 5).type);
  checks.push(['un bloque 3×3 de industria se fusiona en fábrica grande', mergedLarge]);
}

// 32) Terreno: el agua no es edificable y sube el valor del suelo cercano; guardar/cargar lo conserva.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  city.setTerrain(5, 5, 'water');
  city.setTerrain(0, 0, 'mountain');
  city.drainDirty();
  checks.push(['no se puede construir sobre agua', city.isBuildable(5, 5) === false]);
  checks.push(['no se puede construir sobre montaña', city.isBuildable(0, 0) === false]);
  checks.push(['la tierra normal sí es edificable', city.isBuildable(3, 3) === true]);

  sim.tick();
  console.log('[terreno] valor del suelo junto al agua:', sim.inspect(5, 6).value.toFixed(2), '| inspect terreno:', sim.inspect(5, 5).terrainKind);
  checks.push(['el agua sube el valor del suelo cercano', sim.inspect(5, 6).value > 0]);
  checks.push(['inspect reporta el tipo de terreno', sim.inspect(5, 5).terrainKind === 'water']);

  const city2 = new City(10, 10);
  city2.load(city.serialize());
  console.log('[terreno guardado] agua en (5,5):', city2.getTerrain(5, 5), '| montaña en (0,0):', city2.getTerrain(0, 0));
  checks.push([
    'guardar/cargar conserva el terreno (agua + montaña)',
    city2.getTerrain(5, 5) === 'water' && city2.getTerrain(0, 0) === 'mountain' && city2.getTerrain(3, 3) === 'land',
  ]);
}

// 33) Incendios: un fuego desatendido daña/destruye y se propaga; los bomberos lo apagan.
{
  // (a) Sin bomberos: el incendio destruye el edificio y se propaga al vecino.
  const city = new City(12, 12);
  const sim = new Simulation(city);
  sim.mode = 'manual'; // sin develop(): aísla el comportamiento del fuego
  for (let x = 0; x < 12; x++) city.setType(x, 5, TileType.Road);
  // Una hilera de comercios pegados (combustibles, nivel 1) para ver la propagación.
  for (let x = 2; x <= 5; x++) {
    city.setType(x, 4, TileType.Commercial);
    city.setLevel(x, 4, 1);
  }
  city.drainDirty();
  const ignited = sim.disasters.igniteAt(2, 4);
  checks.push(['se puede provocar un incendio en un edificio', ignited === true]);
  checks.push(['una calle no es combustible', sim.disasters.igniteAt(0, 5) === false]);

  let spread = false;
  let destroyed = 0;
  for (let i = 0; i < 15; i++) {
    sim.tick();
    if (sim.disasters.isBurning(3, 4)) spread = true; // prendió al vecino
    destroyed += sim.disasters.drainDestroyed().length;
  }
  console.log('[incendio] propagó al vecino:', spread, '| destruidos:', destroyed, '| en llamas:', sim.disasters.burningCount);
  checks.push(['el fuego se propaga a un edificio vecino', spread]);
  checks.push(['el fuego desatendido termina destruyendo edificios', destroyed > 0]);

  // (b) Con bomberos al lado: el incendio se apaga (no destruye).
  const city2 = new City(12, 12);
  const sim2 = new Simulation(city2);
  sim2.mode = 'manual';
  city2.setType(5, 5, TileType.Road);
  city2.setType(5, 4, TileType.Commercial);
  city2.setLevel(5, 4, 1);
  city2.setType(6, 4, TileType.Fire); // estación de bomberos pegada
  city2.drainDirty();
  sim2.disasters.igniteAt(5, 4);
  let outDestroyed = 0;
  for (let i = 0; i < 8; i++) {
    sim2.tick();
    outDestroyed += sim2.disasters.drainDestroyed().length;
  }
  console.log('[incendio] con bomberos → en llamas:', sim2.disasters.burningCount, '| destruidos:', outDestroyed);
  checks.push(['los bomberos apagan el incendio', sim2.disasters.burningCount === 0]);
  checks.push(['con bomberos cerca no se destruye el edificio', outDestroyed === 0 && city2.getTile(5, 4).type === TileType.Commercial]);

  // (c) Guardar/cargar conserva los incendios en curso.
  const city3 = new City(12, 12);
  const sim3 = new Simulation(city3);
  sim3.mode = 'manual';
  city3.setType(3, 3, TileType.Commercial);
  city3.setLevel(3, 3, 1);
  city3.drainDirty();
  sim3.disasters.igniteAt(3, 3);
  const sim3b = new Simulation(city3);
  sim3b.load(sim3.serialize());
  console.log('[incendio guardado] sigue ardiendo (3,3):', sim3b.disasters.isBurning(3, 3));
  checks.push(['guardar/cargar conserva los incendios en curso', sim3b.disasters.isBurning(3, 3)]);
}

// 34) Replanteo de zonas: el comercio ya NO es zona (Kiosco disponible al inicio,
// Commercial bloqueada); los locales temáticos de comida dan cobertura de comida.
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  const unlocked = sim.unlockedTypes();
  checks.push(['el kiosco está disponible desde el inicio', unlocked.has(TileType.Kiosk)]);
  checks.push(['la zona comercial ya NO se coloca (no está desbloqueada)', !unlocked.has(TileType.Commercial)]);
  checks.push(['la zona industrial ya NO se coloca (no está desbloqueada)', !unlocked.has(TileType.Industrial)]);
  checks.push(['la fábrica chica sí está disponible (industria ploppable)', unlocked.has(TileType.FactorySmall)]);

  city.setType(2, 2, TileType.Residential);
  city.setLevel(2, 2, 1);
  city.setType(4, 2, TileType.Pizzeria);
  city.drainDirty();
  sim.tick();
  console.log('[locales] comida cerca de la pizzería:', sim.inspect(3, 2).food.toFixed(2));
  checks.push(['la pizzería da cobertura de comida cercana', sim.inspect(3, 2).food > 0]);
}

// 35) Servicios POR POBLACIÓN + CONTAMINACIÓN como área.
{
  // (a) Seguridad por población: sin policía, cobertura 0; con policía, sube.
  const city = new City(14, 14);
  const sim = new Simulation(city);
  for (let x = 0; x < 8; x++) {
    city.setType(x, 1, TileType.Residential);
    city.setLevel(x, 1, 1);
  }
  city.drainDirty();
  sim.tick();
  const secSin = sim.getStats().coverage.security;
  city.setType(10, 1, TileType.Police); // cap 250 >> población → cobertura 100%
  city.drainDirty();
  sim.tick();
  const secCon = sim.getStats().coverage.security;
  console.log('[servicios pob] seguridad sin → con policía:', secSin.toFixed(2), '→', secCon.toFixed(2));
  checks.push(['sin servicios la cobertura de seguridad es 0', secSin === 0]);
  checks.push(['la policía da cobertura de seguridad por población', secCon > secSin && secCon > 0]);
  checks.push(['la cobertura no depende de la distancia (es global)', sim.inspect(0, 1).coverage === sim.inspect(7, 1).coverage]);

  // (b) Contaminación: una fábrica grande ensucia su área y frena el crecimiento.
  const city2 = new City(16, 16);
  const sim2 = new Simulation(city2);
  city2.placeBuilding(6, 6, TileType.FactoryLarge, 3); // ancla en (6,6), contamina radio 4
  // Servicios básicos + seguridad fuertes: sin contaminación, una zona podría llegar a nivel 3.
  city2.placeBuilding(0, 0, TileType.PowerPlant, 2);
  city2.setType(12, 0, TileType.WaterTower);
  city2.setType(14, 0, TileType.GasPlant);
  city2.setType(0, 12, TileType.Police);
  city2.setType(5, 6, TileType.Residential); // pegada al ancla de la fábrica (muy contaminada)
  city2.setLevel(5, 6, 1);
  city2.setType(5, 13, TileType.Residential); // lejos de la fábrica (aire limpio)
  city2.setLevel(5, 13, 1);
  city2.drainDirty();
  sim2.tick();
  const polluted = sim2.inspect(5, 6);
  const clean = sim2.inspect(5, 13);
  console.log('[contaminación] pegada:', polluted.pollution.toFixed(2), 'maxLv', polluted.maxLevel, '| lejos:', clean.pollution.toFixed(2), 'maxLv', clean.maxLevel);
  checks.push(['la fábrica contamina la casilla vecina', polluted.pollution > 0]);
  checks.push(['la contaminación fuerte frena el crecimiento (maxLevel 1)', polluted.maxLevel === 1]);
  checks.push(['lejos de la fábrica (aire limpio) sí puede crecer', clean.pollution < 0.1 && clean.maxLevel > 1]);
}

// 36) Consumo de servicios básicos: lo consumen casas + comercios + industria, así que
// DEMOLER reduce el consumo (antes solo contaba la población → demoler no bajaba nada).
{
  const city = new City(12, 12);
  const sim = new Simulation(city);
  for (let x = 0; x < 4; x++) {
    city.setType(x, 1, TileType.Residential);
    city.setLevel(x, 1, 1);
  }
  city.placeBuilding(6, 6, TileType.FactoryLarge, 3); // 220 empleos industriales
  city.drainDirty();
  sim.tick();
  const demandCon = sim.getStats().utilities.power.demand;
  city.setType(6, 6, TileType.Empty); // demoler la fábrica
  city.drainDirty();
  sim.tick();
  const demandSin = sim.getStats().utilities.power.demand;
  console.log('[consumo] con fábrica → sin fábrica:', demandCon, '→', demandSin);
  checks.push(['demoler una fábrica reduce el consumo de servicios básicos', demandSin < demandCon]);
  checks.push(['la industria consume servicios básicos (demanda > población)', demandCon > sim.population]);
}

// 37) Catástrofes instantáneas: meteorito (cráter + incendios), tornado (recorrido
// que arrasa) y huracán (barre la ciudad sin destruirla por completo).
{
  // Fuente de azar determinista (LCG) para que el test sea reproducible.
  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // Ciudad llena de casas (todas combustibles) para ver bien el daño.
  const fill = (): { city: City; sim: Simulation } => {
    const city = new City(12, 12);
    const sim = new Simulation(city);
    sim.mode = 'manual';
    for (let z = 0; z < 12; z++) {
      for (let x = 0; x < 12; x++) {
        city.setType(x, z, TileType.Residential);
        city.setLevel(x, z, 1);
      }
    }
    city.drainDirty();
    return { city, sim };
  };

  // (a) Meteorito: arrasa el cráter y prende fuegos alrededor.
  const a = fill();
  const target = a.sim.disasters.pickMeteorTarget(rand);
  checks.push(['el meteorito elige un objetivo dentro del mapa', a.city.inBounds(target.x, target.z)]);
  const met = a.sim.disasters.strikeMeteor(6, 6);
  console.log('[meteorito] dañados:', met.destroyed.length, '| incendios:', met.ignited.length);
  checks.push(['el meteorito daña el cráter (varios edificios)', met.destroyed.length >= 1]);
  checks.push(['el edificio dañado NO desaparece (queda como ruina)', a.city.getTile(6, 6).type === TileType.Residential && a.city.getTile(6, 6).damaged]);
  checks.push(['el impacto prende incendios alrededor', met.ignited.length > 0]);

  // Reparar (ciudad aislada, sin incendios que interfieran): una ruina no aporta
  // población; al repararla vuelve a contar y cobra el costo.
  const d = new City(8, 8);
  const dsim = new Simulation(d);
  dsim.mode = 'manual';
  d.setType(4, 4, TileType.Residential);
  d.setLevel(4, 4, 1);
  d.drainDirty();
  dsim.disasters.strikeMeteor(4, 4); // edificio aislado: lo daña sin prender vecinos
  dsim.tick();
  const popRuina = dsim.population;
  const moneyAntes = dsim.money;
  const repaired = dsim.repair(4, 4);
  dsim.tick();
  console.log('[reparar] pop con ruina:', popRuina, '→ reparada:', dsim.population, '| reparó:', repaired);
  checks.push(['una ruina no aporta población (pop 0)', popRuina === 0]);
  checks.push(['se puede reparar un edificio dañado', repaired && !d.getTile(4, 4).damaged]);
  checks.push(['reparar cobra el costo', dsim.money < moneyAntes]);
  checks.push(['tras reparar el edificio vuelve a aportar', dsim.population > popRuina]);

  // (b) Tornado: recorre el mapa y arrasa edificios en el camino.
  const b = fill();
  const tor = b.sim.disasters.spawnTornado(rand);
  console.log('[tornado] recorrido:', tor.path?.length, '| arrasados:', tor.destroyed.length);
  checks.push(['el tornado traza un recorrido', (tor.path?.length ?? 0) > 0]);
  checks.push(['el tornado arrasa edificios en el camino', tor.destroyed.length > 0]);

  // (c) Huracán: castiga toda la ciudad, pero no la borra entera.
  const c = fill();
  const total = 144; // 12×12 casas
  const hur = c.sim.disasters.spawnHurricane(rand);
  console.log('[huracán] arrasados:', hur.destroyed.length, '/', total, '| incendios:', hur.ignited.length);
  checks.push(['el huracán arrasa varios edificios', hur.destroyed.length > 0]);
  checks.push(['el huracán no destruye la ciudad entera', hur.destroyed.length < total]);
}

// 38) Investigación científica: los laboratorios generan ciencia (con energía) y
// la ciencia acumulada desbloquea los hitos científicos (parque científico, etc.).
{
  const city = new City(10, 10);
  const sim = new Simulation(city);
  sim.mode = 'manual';
  city.setType(0, 1, TileType.Road);
  city.setType(0, 0, TileType.ResearchLab);
  city.drainDirty();
  sim.tick(); // todavía sin energía
  const noPower = sim.science;
  city.placeBuilding(3, 0, TileType.PowerPlant, 2); // ahora hay luz
  city.drainDirty();
  for (let i = 0; i < 5; i++) sim.tick();
  console.log('[ciencia] sin luz:', noPower, '→ con luz tras 5 meses:', sim.science, '| ritmo:', sim.researchRate);
  checks.push(['sin energía el laboratorio no produce ciencia', noPower === 0]);
  checks.push(['con energía la ciencia se acumula', sim.science > 0 && sim.researchRate > 0]);

  const u0 = sim.unlockedTypes();
  checks.push(['el parque científico arranca bloqueado', !u0.has(TileType.SciencePark)]);
  checks.push(['el centro espacial arranca bloqueado', !u0.has(TileType.SpaceCenter)]);
  sim.science = 400; // supera el hito "Parque científico" (ciencia ≥ 300)
  sim.tick();
  console.log('[ciencia] desbloqueos con ciencia alta → parque científico:', sim.unlockedTypes().has(TileType.SciencePark));
  checks.push(['con suficiente ciencia se desbloquea el parque científico', sim.unlockedTypes().has(TileType.SciencePark)]);

  // La ciencia acumulada se conserva al guardar/cargar.
  const sim2 = new Simulation(new City(10, 10));
  sim2.load(sim.serialize());
  checks.push(['guardar/cargar conserva la ciencia', sim2.science >= 400]);
}

// 39) El héroe: con un cuartel sano apaga los incendios él solo; se desbloquea con mucha ciencia.
{
  // (a) Sin héroe: un incendio sin bomberos daña el edificio.
  const c1 = new City(10, 10);
  const s1 = new Simulation(c1);
  s1.mode = 'manual';
  c1.setType(2, 2, TileType.Commercial);
  c1.setLevel(2, 2, 1);
  c1.drainDirty();
  s1.disasters.igniteAt(2, 2);
  let d1 = 0;
  for (let i = 0; i < 8; i++) {
    s1.tick();
    d1 += s1.disasters.drainDestroyed().length;
  }
  checks.push(['sin héroe el incendio termina dañando', d1 > 0 || c1.getTile(2, 2).damaged]);

  // (b) Con héroe (cuartel sano): el mismo incendio se apaga sin dañar.
  const c2 = new City(12, 12);
  const s2 = new Simulation(c2);
  s2.mode = 'manual';
  c2.placeBuilding(8, 8, TileType.HeroHQ, 2); // cuartel → la ciudad tiene héroe
  c2.setType(2, 2, TileType.Commercial);
  c2.setLevel(2, 2, 1);
  c2.drainDirty();
  s2.tick(); // recount → hasHero = true
  s2.disasters.igniteAt(2, 2);
  let d2 = 0;
  for (let i = 0; i < 8; i++) {
    s2.tick();
    d2 += s2.disasters.drainDestroyed().length;
  }
  console.log('[héroe] sin héroe dañados:', d1, '| con héroe en llamas:', s2.disasters.burningCount, 'dañados:', d2, '| hasHero:', s2.hasHero);
  checks.push(['la ciudad detecta el cuartel del héroe', s2.hasHero === true]);
  checks.push(['con héroe el incendio se apaga (no daña)', s2.disasters.burningCount === 0 && d2 === 0 && !c2.getTile(2, 2).damaged]);

  // (c) El cuartel se desbloquea con ciencia muy alta.
  checks.push(['el cuartel del héroe arranca bloqueado', !s1.unlockedTypes().has(TileType.HeroHQ)]);
  s1.science = 3500;
  s1.tick();
  console.log('[héroe] desbloqueo con ciencia 3500 →', s1.unlockedTypes().has(TileType.HeroHQ));
  checks.push(['con muchísima ciencia se desbloquea el héroe', s1.unlockedTypes().has(TileType.HeroHQ)]);
}

// 40) Estilos de residencia: distinta densidad/tope; eco resiste la contaminación.
{
  checks.push(['lujo concentra más habitantes que estándar', capacityOf(TileType.Residential, 3, 'luxury') > capacityOf(TileType.Residential, 3, 'default')]);
  checks.push(['suburbio es de baja densidad', capacityOf(TileType.Residential, 2, 'suburb') < capacityOf(TileType.Residential, 2, 'default')]);

  // El suburbio topa en nivel 2 aunque la ciudad tenga de todo.
  const city = new City(20, 20);
  const sim = new Simulation(city);
  city.setType(8, 9, TileType.Road);
  city.setType(8, 8, TileType.Residential);
  city.setResidentialStyle(8, 8, 'suburb');
  city.placeBuilding(0, 0, TileType.PowerPlant, 2);
  city.setType(3, 0, TileType.WaterTower);
  city.setType(5, 0, TileType.GasPlant);
  city.placeBuilding(7, 6, TileType.Government, 2);
  city.drainDirty();
  sim.tick();
  console.log('[estilos] suburbio maxLevel:', sim.inspect(8, 8).maxLevel);
  checks.push(['el suburbio topa en nivel 2', sim.inspect(8, 8).maxLevel === 2]);

  // Eco resiste la contaminación: pegado a una fábrica grande sí puede crecer; estándar no.
  const c2 = new City(16, 16);
  const s2 = new Simulation(c2);
  c2.placeBuilding(6, 6, TileType.FactoryLarge, 3); // contamina su área (ancla 6,6)
  c2.placeBuilding(0, 0, TileType.PowerPlant, 2);
  c2.setType(12, 0, TileType.WaterTower);
  c2.setType(14, 0, TileType.GasPlant);
  c2.setType(0, 12, TileType.Police);
  c2.setType(5, 6, TileType.Residential); // estándar, muy contaminada
  c2.setLevel(5, 6, 1);
  c2.setType(6, 5, TileType.Residential); // eco, misma contaminación
  c2.setLevel(6, 5, 1);
  c2.setResidentialStyle(6, 5, 'eco');
  c2.drainDirty();
  s2.tick();
  const std = s2.inspect(5, 6);
  const eco = s2.inspect(6, 5);
  console.log('[estilos] estándar maxLv', std.maxLevel, 'cont', std.pollution.toFixed(2), '| eco maxLv', eco.maxLevel, 'cont', eco.pollution.toFixed(2));
  checks.push(['estándar pegado a la fábrica no crece (contaminación)', std.maxLevel === 1]);
  checks.push(['eco resiste la contaminación y sí puede crecer', eco.maxLevel > 1]);
}

// 41) Renovables (energía limpia), agua para represas/puertos, y playa edificable.
{
  const c = new City(10, 10);
  const s = new Simulation(c);
  c.placeBuilding(0, 0, TileType.SolarPlant, 2);
  s.tick();
  console.log('[renovables] energía solar:', s.powerSupply);
  checks.push(['la planta solar produce energía', s.powerSupply >= 220]);
  checks.push([
    'las renovables NO contaminan',
    TILE_DEF[TileType.SolarPlant].pollution === undefined &&
      TILE_DEF[TileType.WindTurbine].pollution === undefined &&
      TILE_DEF[TileType.HydroPlant].pollution === undefined,
  ]);
  checks.push(['la central de carbón sí contamina (contraste)', TILE_DEF[TileType.PowerPlant].pollution !== undefined]);

  // needsWater: represa y puerto exigen agua al lado.
  checks.push(['la represa exige agua', TILE_DEF[TileType.HydroPlant].needsWater === true]);
  checks.push(['el puerto (terminal) exige agua', TILE_DEF[TileType.ExportTerminal].needsWater === true]);

  const c2 = new City(8, 8);
  c2.setTerrain(5, 5, 'water');
  c2.setTerrain(2, 2, 'beach');
  console.log('[terreno] junto al agua (4,4):', c2.isNextToWater(4, 4), '| lejos (0,0):', c2.isNextToWater(0, 0));
  checks.push(['isNextToWater detecta el agua al lado', c2.isNextToWater(4, 4) === true]);
  checks.push(['isNextToWater es false lejos del agua', c2.isNextToWater(0, 0) === false]);
  checks.push(['la playa es edificable', c2.isBuildable(2, 2) === true]);
  checks.push(['el agua no es edificable', c2.isBuildable(5, 5) === false]);
}

// 42) Circuito de carreras (días de evento con renta extra) y decoración instantánea.
{
  const c = new City(12, 12);
  const s = new Simulation(c);
  s.mode = 'manual';
  c.placeBuilding(2, 2, TileType.RaceTrack, 3);
  c.drainDirty();
  const m0 = s.money;
  s.tick(); // el circuito organiza su primera carrera
  console.log('[carreras] activa:', s.raceActive, '| dinero', m0, '→', Math.round(s.money));
  checks.push(['el circuito organiza una carrera', s.raceActive === true]);
  checks.push(['stats reporta la carrera + 1 circuito', s.getStats().race.active && s.getStats().race.tracks === 1]);
  checks.push(['la carrera da renta extra (sube el dinero)', s.money > m0]);
  let ended = false;
  for (let i = 0; i < 6; i++) {
    s.tick();
    if (!s.raceActive) ended = true;
  }
  checks.push(['la carrera termina tras unos meses', ended]);

  // Decoración: disponible desde el inicio, instantánea y con algo de valor del suelo.
  checks.push(['el árbol es decoración', TILE_DEF[TileType.Tree].decoration === true]);
  checks.push(['las decoraciones están desde el inicio', s.unlockedTypes().has(TileType.Tree) && s.unlockedTypes().has(TileType.Rock)]);

  const c2 = new City(8, 8);
  const s2 = new Simulation(c2);
  for (let x = 0; x < 8; x++) {
    c2.setType(x, 1, TileType.Residential);
    c2.setLevel(x, 1, 1);
  }
  c2.setType(3, 2, TileType.Tree);
  c2.drainDirty();
  s2.tick();
  console.log('[paisaje] valor del suelo junto al árbol:', s2.inspect(3, 1).value.toFixed(2));
  checks.push(['el árbol sube el valor del suelo cercano', s2.inspect(3, 1).value > 0]);
}

// 43) Puentes: una calle puede ir sobre agua (puente) y sigue funcionando como calle.
{
  const c = new City(8, 8);
  c.setTerrain(4, 4, 'water');
  c.setType(4, 3, TileType.Road); // calle en tierra
  c.setType(4, 4, TileType.Road); // puente sobre el agua
  c.setType(4, 5, TileType.Road); // calle del otro lado
  checks.push(['una calle sobre agua sigue siendo Road (puente)', c.getTile(4, 4).type === TileType.Road]);
  checks.push(['el agua no es edificable (el puente es la excepción, solo calles)', c.isBuildable(4, 4) === false]);
  checks.push(['el puente da acceso de calle a ambas orillas', c.hasRoadAccess(3, 4) && c.hasRoadAccess(5, 4)]);
}

// 44) Territorio por parcelas: arranca con una FRANJA lateral bloqueada (hacia el
// lado derecho/este) y se expande hacia ahí con fichas.
{
  const city = new City(32, 32);
  const sim = new Simulation(city);
  const totalParcels = city.parcelCols * city.parcelRows;
  const lockedCols = Math.max(1, Math.floor(city.parcelCols / 2));
  const lockedParcels = lockedCols * city.parcelRows;
  checks.push(['el lado izquierdo arranca abierto', city.isUnlocked(0, 0) === true && city.isUnlocked(4, 16) === true]);
  checks.push(['el costado derecho arranca bloqueado', city.isUnlocked(31, 16) === false]);
  checks.push(['arranca con una franja lateral bloqueada', city.unlockedParcelCount() === totalParcels - lockedParcels]);

  // La primera columna bloqueada (pegada a lo abierto), tile dentro de ella.
  const lockX = (city.parcelCols - lockedCols) * 8; // x de la 1ª parcela cerrada
  // Sin fichas no se puede desbloquear.
  checks.push(['sin fichas no se desbloquea', sim.unlockTerritory(lockX, 0) === false]);
  // Una parcela ya abierta no se "desbloquea".
  checks.push(['no se desbloquea algo ya abierto', sim.unlockTerritory(4, 4) === false]);

  // Cada catástrofe superada vale DOBLE en fichas (2 c/u).
  sim.recordDisaster();
  checks.push(['una catástrofe da 2 fichas', sim.territoryTokens() === 2]);
  checks.push(['el desglose atribuye las fichas a catástrofes', sim.territoryTokenSources().disasters === 2]);

  // Abro la parcela lateral (contigua a lo abierto) y se gastan fichas.
  const before = sim.territoryTokens();
  const firstCost = sim.territoryUnlockCost(); // 1ª parcela = 1
  checks.push(['la primera parcela cuesta 1', firstCost === 1]);
  const opened = sim.unlockTerritory(lockX, 0); // parcela lateral pegada a lo abierto
  console.log('[territorio] abrió parcela:', opened, '| abiertas:', city.unlockedParcelCount());
  checks.push(['se abre una parcela lateral contigua pagando fichas', opened && city.isUnlocked(lockX, 0)]);
  checks.push(['desbloquear gasta fichas', sim.territoryTokens() === before - firstCost]);
  // La rampa: la próxima parcela cuesta una ficha más.
  checks.push(['la próxima parcela cuesta más (rampa)', sim.territoryUnlockCost() === firstCost + 1]);

  // Guardar/cargar conserva el territorio Y la rampa de costo (territoryUnlocks).
  const city2 = new City(32, 32);
  const sim2 = new Simulation(city2);
  city2.load(city.serialize());
  sim2.load(sim.serialize());
  checks.push(['guardar/cargar conserva el territorio', city2.isUnlocked(lockX, 0) === true && city2.isUnlocked(31, 31) === false]);
  checks.push(['guardar/cargar conserva la rampa de costo', sim2.territoryUnlockCost() === firstCost + 1]);
}

// 45) Ciudad nueva: la generación de terreno crea mar, playa, montañas y tierra.
// Se suman varias semillas para no depender de una sola (robusto/determinista).
{
  let water = 0;
  let beach = 0;
  let mountain = 0;
  let land = 0;
  let beachBuildable = true;
  let waterBlocked = true;
  for (let s = 0; s < 6; s++) {
    let seed = 13579 + s * 99991;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const city = new City(32, 32);
    generateTerrain(city, rand);
    city.forEach((_t, x, z) => {
      const k = city.getTerrain(x, z);
      if (k === 'water') {
        water++;
        if (city.isBuildable(x, z)) waterBlocked = false;
      } else if (k === 'beach') {
        beach++;
        if (!city.isBuildable(x, z)) beachBuildable = false;
      } else if (k === 'mountain') mountain++;
      else land++;
    });
  }
  console.log('[terreno nuevo x6] agua:', water, '| playa:', beach, '| montaña:', mountain, '| tierra:', land);
  checks.push(['una ciudad nueva genera mar', water > 200]);
  checks.push(['genera playa en la costa', beach > 0]);
  checks.push(['genera montañas', mountain > 0]);
  checks.push(['queda bastante tierra construible', land > 6 * 32 * 32 * 0.4]);
  checks.push(['el agua generada no es edificable', waterBlocked]);
  checks.push(['la playa generada sí es edificable', beachBuildable]);
}

let allOk = true;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nSMOKE OK ✅' : '\nSMOKE FALLÓ ❌');
process.exit(allOk ? 0 : 1);
