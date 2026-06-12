/**
 * Nivel de ciudad (estilo SimCity BuildIt): la ciudad gana XP por construir,
 * mejorar zonas, cumplir misiones, desbloquear tecnología y superar catástrofes.
 * Subir de nivel da un premio en dinero y va soltando features (las catástrofes
 * no aparecen hasta cierto nivel, para que el arranque sea tranquilo).
 * Sin Three.js ni Math.random (testeable en Node).
 */

/** XP acumulada necesaria para alcanzar cada nivel (índice 0 = nivel 1). */
export const LEVEL_XP = [
  0, 60, 150, 280, 460, 700, 1000, 1400, 1900, 2500,
  3200, 4000, 5000, 6200, 7600, 9200, 11000, 13200, 15800, 19000,
];

export const MAX_CITY_LEVEL = LEVEL_XP.length;

/** Cuánta XP da cada cosa. */
export const XP_REWARD = {
  /** Obra de edificio terminada: base + proporcional al costo. */
  buildBase: 10,
  buildPerCost: 1 / 8,
  /** Obra de ampliación de zona terminada (× nivel alcanzado). */
  zoneLevel: 6,
  mission: 60,
  tech: 50,
  disaster: 40,
};

/** Premio en dinero al subir de nivel (× nivel alcanzado). */
export const LEVEL_MONEY = 150;

/** A qué nivel se desbloquea cada feature. */
export const FEATURE_LEVEL = {
  disasters: 6, // el menú de catástrofes (y los incendios espontáneos)
};

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
    else break;
  }
  return level;
}

/** Rango de XP del nivel actual (para la barra de progreso del HUD). */
export function xpRange(level: number): { from: number; to: number } {
  const from = LEVEL_XP[Math.min(level, MAX_CITY_LEVEL) - 1];
  const to = level >= MAX_CITY_LEVEL ? from : LEVEL_XP[level];
  return { from, to };
}

/** Estado del nivel para el HUD. */
export interface LevelStatus {
  level: number;
  xp: number;
  from: number; // XP donde empieza el nivel actual
  to: number; // XP donde empieza el próximo (= from si ya es el máximo)
  progress: number; // 0..1 dentro del nivel
}
