// Estudio del BALANCE ECONÓMICO (sin navegador). Corre ciudades representativas
// muchos meses y muestra la trayectoria del dinero + el desglose ingreso/gasto.
//   pnpm dlx tsx scripts/economy-sim.ts
import { City } from '../src/sim/City';
import { Simulation } from '../src/sim/Simulation';
import { TileType } from '../src/sim/types';

const fmt = (n: number) => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString('es');
const pad = (s: string | number, n: number) => String(s).padStart(n);

/** Coloca servicios básicos generosos para que las zonas puedan crecer al máximo. */
function serviceCore(city: City): void {
  // Energía/agua/gas de sobra (2×2 la central; 1×1 agua/gas). Los pongo en una
  // franja de servicios arriba (z=0..2), sobre una calle.
  for (let x = 0; x < city.width; x++) city.setType(x, 2, TileType.Road);
  let x = 0;
  const place2 = (t: TileType) => { city.placeBuilding(x, 0, t, 2); x += 3; };
  const place1 = (t: TileType) => { city.setType(x, 1, t); x += 1; };
  place2(TileType.PowerPlant);
  place2(TileType.PowerPlant);
  place2(TileType.Government); // seguridad (cap 600)
  place2(TileType.Market); // comida
  place2(TileType.Hospital); // salud
  place2(TileType.University); // educación
  x = 0;
  place1(TileType.WaterTower); x += 1;
  place1(TileType.WaterTower); x += 1;
  place1(TileType.GasPlant); x += 1;
  place1(TileType.GasPlant); x += 1;
  place1(TileType.Police); x += 1;
  place1(TileType.School); x += 1;
  place1(TileType.Clinic);
}

/**
 * Ciudad mixta: calles cada 3 filas y, entre ellas, una mezcla de residencial +
 * fábricas (empleo industrial) + negocios (empleo comercial + renta). `mix`
 * define cada cuántas casillas va una fábrica o un negocio.
 */
function mixedCity(N: number, opts: { factoryEvery: number; shopEvery: number; rent: boolean } = { factoryEvery: 4, shopEvery: 5, rent: false }): { city: City; sim: Simulation } {
  const city = new City(N, N);
  const sim = new Simulation(city);
  serviceCore(city);
  // Calles horizontales cada 3 filas (desde z=5, dejando la franja de servicios arriba).
  for (let z = 5; z < N; z += 3) for (let x = 0; x < N; x++) city.setType(x, z, TileType.Road);
  let k = 0;
  for (let z = 3; z < N; z++) {
    if (z < 5) continue;
    if ((z - 5) % 3 === 0) continue; // fila de calle
    for (let x = 0; x < N; x++) {
      if (city.getTile(x, z).type !== TileType.Empty || !city.hasRoadAccess(x, z)) continue;
      k++;
      if (k % opts.factoryEvery === 0) {
        city.setType(x, z, TileType.FactorySmall); // 20 empleos industriales
      } else if (k % opts.shopEvery === 0) {
        city.setType(x, z, opts.rent ? TileType.Bank : TileType.Kiosk); // comercio (+ renta si rent)
      } else {
        city.setType(x, z, TileType.Residential);
      }
    }
  }
  city.drainDirty();
  return { city, sim };
}

/** Corre `months` meses en modo auto e informa la trayectoria del dinero. */
function run(name: string, build: () => { city: City; sim: Simulation }, months: number, marks: number[]): void {
  const { sim } = build();
  console.log('\n=== ' + name + ' ===');
  console.log(`mes │  dinero  │  Δ/mes │  pob  │ empleo │ desempleo`);
  let prev = sim.money;
  for (let m = 1; m <= months; m++) {
    sim.tick();
    if (marks.includes(m)) {
      const s = sim.getStats();
      const d = (sim.money - prev) / (m === marks[0] ? m : (m - marks[marks.indexOf(m) - 1]));
      console.log(
        `${pad(m, 3)} │ ${pad(Math.round(sim.money).toLocaleString('es'), 8)} │ ${pad(fmt(d), 6)} │ ${pad(s.population, 5)} │ ${pad(s.employed, 6)} │ ${pad(Math.round(s.unemploymentRate * 100) + '%', 5)}`,
      );
      prev = sim.money;
    }
  }
  const b = sim.economyBreakdown();
  console.log('desglose del último mes ($/mes):');
  console.log(
    `  ingresos: renta-empleados ${fmt(b.incomeTax)} · comercio ${fmt(b.commerce)} · industria ${fmt(b.industry)} · rentas-fijas ${fmt(b.rents)} · materiales ${fmt(b.trade)}`,
  );
  console.log(`  gastos:   mantenimiento ${fmt(-b.upkeep)} · servicios/habitante ${fmt(-b.services)}`);
  console.log(`  NETO: ${fmt(b.net)} /mes   |   dinero final: ${Math.round(sim.money).toLocaleString('es')} (empezó en 10.000)`);
}

const MARKS = [1, 6, 12, 24, 48, 72, 120];

// 1) Juego normal: ciudad equilibrada que crece sola.
run('Ciudad equilibrada (R + fábricas + kioscos), 24×24', () => mixedCity(24), 120, MARKS);

// 2) El novato: solo casas (sin empleos). ¿Se endeuda?
run('Solo casas (sin empleos) 14×14', () => {
  const N = 14;
  const city = new City(N, N);
  const sim = new Simulation(city);
  for (let x = 0; x < N; x++) city.setType(x, 2, TileType.Road);
  city.placeBuilding(0, 0, TileType.PowerPlant, 2);
  for (let z = 4; z < N; z += 2) {
    for (let x = 0; x < N; x++) city.setType(x, z, TileType.Road);
    for (let x = 0; x < N; x++) if (z + 1 < N) city.setType(x, z + 1, TileType.Residential);
  }
  city.drainDirty();
  return { city, sim };
}, 60, [1, 6, 12, 24, 48, 60]);

// 3) Exploit de renta: negocios con renta fija (bancos) por todos lados.
run('Exploit de renta (bancos) 24×24', () => mixedCity(24, { factoryEvery: 6, shopEvery: 3, rent: true }), 120, MARKS);
