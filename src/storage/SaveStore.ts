import { CitySave } from '../sim/City';
import { SimSave } from '../sim/Simulation';

/**
 * Formato de guardado. El `version` permite migrar partidas viejas el día que
 * el formato cambie. Hoy guardamos en localStorage; este MISMO JSON es el que,
 * más adelante, subiríamos a la nube por usuario (sin rehacer nada).
 */
export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  name: string;
  savedAt: string; // ISO
  city: CitySave;
  sim: SimSave;
}

const KEY = 'city-builder:save';

export function saveLocal(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('No se pudo guardar:', e);
  }
}

export function loadLocal(): SaveData | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  return parse(raw);
}

export function hasLocal(): boolean {
  return localStorage.getItem(KEY) !== null;
}

/** Descarga la partida como archivo .json (respaldo o para compartir). */
export function exportFile(data: SaveData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(data.name || 'ciudad').replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lee una partida desde un archivo elegido por el usuario. */
export async function importFile(file: File): Promise<SaveData | null> {
  try {
    return parse(await file.text());
  } catch {
    return null;
  }
}

/** Valida y parsea un JSON de guardado; null si es inválido o de otra versión. */
function parse(raw: string): SaveData | null {
  try {
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.version !== SAVE_VERSION || !data.city || !data.sim) return null;
    return data;
  } catch {
    return null;
  }
}
