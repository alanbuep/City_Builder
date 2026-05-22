// ---------------------------------------------------------------------------
// Conversión entre coordenadas de casilla (x, z enteros) y coordenadas del
// mundo 3D (metros). Lo dejo en UN solo lugar para que el render y el picking
// usen exactamente la misma matemática y nunca se "desalineen".
//
// La cuadrícula está centrada en el origen, igual que el GridHelper de Three.
// El centro de la casilla (x, z) está en world = (x+0.5)*tile - (n*tile)/2.
// ---------------------------------------------------------------------------

export interface GridSpec {
  width: number;
  height: number;
  tileSize: number;
}

/** Centro de la casilla, en el eje X del mundo. */
export function tileCenterX(x: number, g: GridSpec): number {
  return (x + 0.5) * g.tileSize - (g.width * g.tileSize) / 2;
}

/** Centro de la casilla, en el eje Z del mundo. */
export function tileCenterZ(z: number, g: GridSpec): number {
  return (z + 0.5) * g.tileSize - (g.height * g.tileSize) / 2;
}

/** Pasa un punto del mundo (wx, wz) a coordenadas de casilla (puede caer fuera). */
export function worldToTile(wx: number, wz: number, g: GridSpec): { x: number; z: number } {
  return {
    x: Math.floor((wx + (g.width * g.tileSize) / 2) / g.tileSize),
    z: Math.floor((wz + (g.height * g.tileSize) / 2) / g.tileSize),
  };
}
