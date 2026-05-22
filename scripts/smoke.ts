// Prueba de humo de la SIMULACIÓN (sin navegador).
// Correr con:  pnpm dlx tsx scripts/smoke.ts
import { City } from '../src/sim/City';
import { Simulation } from '../src/sim/Simulation';
import { TileType } from '../src/sim/types';

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
  const upgraded = sim.tryUpgrade(0, 2); // residencial con carretera al lado
  console.log('[manual] sin tocar:', popAuto, '| mejora aplicada:', upgraded, '| pop:', sim.population);
  checks.push(['manual NO crece solo', popAuto === 0]);
  checks.push(['mejorar a mano sube población', upgraded && sim.population > 0]);
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
  for (let i = 0; i < 20; i++) sim.tick(); // crece a nivel 1 → hay población
  const alerts = sim.getAlerts();
  console.log('[alertas]', alerts.map((a) => a.id));
  checks.push(['avisa cuando falta energía con población', alerts.some((a) => a.id === 'power')]);
}

let allOk = true;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nSMOKE OK ✅' : '\nSMOKE FALLÓ ❌');
process.exit(allOk ? 0 : 1);
