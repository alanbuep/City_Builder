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

  const before = sim.inspect(0, 4); // sin servicios todavía
  city.setType(0, 3, TileType.Police);
  sim.tick(); // recalcula cobertura
  const after = sim.inspect(0, 4);
  console.log('[servicios] maxLevel sin → con policía:', before.maxLevel, '→', after.maxLevel);
  checks.push(['sin servicios el nivel topa en 1', before.maxLevel === 1]);
  checks.push(['con policía cerca el nivel sube', after.maxLevel >= 2]);

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
  for (let x = 0; x < 6; x++) city.setType(x, 0, TileType.Road); // tramo de 6 calles
  city.drainDirty();

  const ok = sim.tryUpgrade(2, 0); // toco UNA casilla del tramo
  let allAvenue = true;
  for (let x = 0; x < 6; x++) if (city.getTile(x, 0).level !== 1) allAvenue = false;
  console.log('[tramo] mejora desde 1 casilla → todo avenida:', ok && allAvenue);
  checks.push(['mejorar carretera sube TODO el tramo', ok && allAvenue]);

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

let allOk = true;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nSMOKE OK ✅' : '\nSMOKE FALLÓ ❌');
process.exit(allOk ? 0 : 1);
