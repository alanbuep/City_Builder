import { City } from './City';

/**
 * Genera el terreno natural de una ciudad nueva: un MAR ancho en un borde (con
 * costa ondulada), una CORDILLERA de punta a punta en el borde opuesto, y una
 * franja de PLAYA donde la tierra toca el agua. Los RÍOS se hacen a mano con la
 * herramienta de Agua. Engine-agnostic; la aleatoriedad se inyecta (`rand`).
 */
export function generateTerrain(city: City, rand: () => number = Math.random): void {
  const width = city.width;
  const height = city.height;

  // 1) MAR: un borde es la costa, con una banda ANCHA (escala con el mapa) y costa ondulada.
  const edge = Math.floor(rand() * 4); // 0=N, 1=E, 2=S, 3=O
  const depth = Math.max(6, Math.round(Math.min(width, height) * 0.18)) + rand() * 3;
  const phase = rand() * 6.28;
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const dist = edge === 0 ? z : edge === 2 ? height - 1 - z : edge === 3 ? x : width - 1 - x;
      const along = edge === 0 || edge === 2 ? x : z;
      const wave = Math.sin(along * 0.4 + phase) * 1.6 + Math.sin(along * 0.13) * 1.6;
      if (dist < depth + wave) city.setTerrain(x, z, 'water');
    }
  }

  // 2) CORDILLERA: cadena de montañas de PUNTA A PUNTA a lo largo del borde OPUESTO
  // al mar, con un frente ondulado (no una pared recta).
  const opp = (edge + 2) % 4; // borde donde va la cordillera (lejos del mar)
  const horiz = opp === 0 || opp === 2; // ¿la sierra corre a lo largo de X?
  const thick = 2.5 + rand() * 2; // profundidad media de la sierra
  const ph = rand() * 6.28;
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      if (city.getTerrain(x, z) !== 'land') continue;
      const d = opp === 0 ? z : opp === 2 ? height - 1 - z : opp === 3 ? x : width - 1 - x; // dist al borde
      const along = horiz ? x : z;
      // Frente ondulado pero con un MÍNIMO: siempre hay sierra (no quedan huecos),
      // así la cadena es continua de un extremo al otro del borde.
      const front = Math.max(1.6, thick + Math.sin(along * 0.5 + ph) * 1.4 + Math.sin(along * 0.16) * 1.1);
      if (d < front) city.setTerrain(x, z, 'mountain');
    }
  }

  // 3) PLAYAS: la tierra que toca el agua se vuelve arena.
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      if (city.getTerrain(x, z) !== 'land') continue;
      let coast = false;
      for (let dz = -1; dz <= 1 && !coast; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (city.inBounds(x + dx, z + dz) && city.getTerrain(x + dx, z + dz) === 'water') {
            coast = true;
            break;
          }
        }
      }
      if (coast) city.setTerrain(x, z, 'beach');
    }
  }
}
