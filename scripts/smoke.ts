// Prueba de humo de la SIMULACIÓN (sin navegador).
// Correr con:  pnpm dlx tsx scripts/smoke.ts
import { City } from '../src/sim/City';
import { Simulation } from '../src/sim/Simulation';
import { TileType, TILE_DEF, capacityOf } from '../src/sim/types';

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
  console.log('[materiales] totales tras 10 meses:', totals, '| inactivas:', sim.getStats().materials.idleProducers);
  checks.push(['la arenera produce arena (más que la reserva)', totals.arena > 80]);
  checks.push(['la cementera convierte arena en cemento', totals.cemento > 60]);
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

let allOk = true;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nSMOKE OK ✅' : '\nSMOKE FALLÓ ❌');
process.exit(allOk ? 0 : 1);
