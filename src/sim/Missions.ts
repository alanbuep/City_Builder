/**
 * Misiones / objetivos: metas concretas que guían al jugador ("llegá a 500
 * habitantes", "sobreviví una catástrofe") y dan recompensas ($ y fichas 🗝️).
 * Igual que la tecnología, son MONOTÓNICAS: una misión cumplida queda cumplida
 * aunque la métrica después baje. Sin Three.js ni Math.random (testeable en Node).
 */

/** Foto de las métricas que las misiones pueden mirar (la arma Simulation). */
export interface MissionMetrics {
  population: number;
  money: number;
  jobs: number; // empleos totales (comercio + industria)
  science: number;
  disastersSurvived: number;
  techCount: number; // hitos tecnológicos desbloqueados
  skyscrapers: number; // casillas residenciales nivel 4+ (torres)
  parcelsBought: number; // parcelas de territorio compradas por el jugador
}

export type MissionMetric = keyof MissionMetrics;

export interface MissionDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  metric: MissionMetric;
  target: number;
  reward: { money?: number; tokens?: number };
}

/** Estado de una misión para la UI. */
export interface MissionStatus {
  def: MissionDef;
  done: boolean;
  value: number; // valor actual de la métrica
  progress: number; // 0..1
}

/** En orden aproximado de dificultad: las primeras guían el arranque. */
export const MISSIONS: MissionDef[] = [
  { id: 'vecinos', icon: '🌱', name: 'Primeros vecinos', desc: 'Llegá a 25 habitantes', metric: 'population', target: 25, reward: { money: 300 } },
  { id: 'trabajo', icon: '🛠️', name: 'Pueblo con trabajo', desc: 'Generá 60 empleos', metric: 'jobs', target: 60, reward: { money: 400 } },
  { id: 'pueblito', icon: '🏘️', name: 'Pueblito', desc: 'Llegá a 150 habitantes', metric: 'population', target: 150, reward: { money: 600 } },
  { id: 'caja', icon: '💰', name: 'Caja sana', desc: 'Juntá $8.000', metric: 'money', target: 8000, reward: { tokens: 1 } },
  { id: 'ciencia1', icon: '🔬', name: 'Primeros experimentos', desc: 'Acumulá 100 de ciencia', metric: 'science', target: 100, reward: { money: 600 } },
  { id: 'tech3', icon: '🧪', name: 'Despegue tecnológico', desc: 'Desbloqueá 4 hitos de tecnología', metric: 'techCount', target: 4, reward: { money: 800 } },
  { id: 'ciudad', icon: '🏙️', name: 'Ciudad de verdad', desc: 'Llegá a 500 habitantes', metric: 'population', target: 500, reward: { tokens: 1 } },
  { id: 'sobreviviente', icon: '💪', name: 'Sobreviviente', desc: 'Superá una catástrofe', metric: 'disastersSurvived', target: 1, reward: { money: 800 } },
  { id: 'torre', icon: '🌆', name: 'Primera torre', desc: 'Lográ un residencial nivel 4+', metric: 'skyscrapers', target: 1, reward: { money: 1000 } },
  { id: 'expansion', icon: '🗺️', name: 'Conquistador', desc: 'Comprá 2 parcelas de territorio', metric: 'parcelsBought', target: 2, reward: { money: 1200 } },
  { id: 'ciencia2', icon: '🚀', name: 'Mente brillante', desc: 'Acumulá 1.500 de ciencia', metric: 'science', target: 1500, reward: { money: 1500 } },
  { id: 'metropolis', icon: '🌃', name: 'Metrópolis', desc: 'Llegá a 1.500 habitantes', metric: 'population', target: 1500, reward: { tokens: 2 } },
  { id: 'skyline', icon: '🏗️', name: 'Skyline', desc: 'Tené 5 torres residenciales (nivel 4+)', metric: 'skyscrapers', target: 5, reward: { money: 2000 } },
  { id: 'magnate', icon: '🤑', name: 'Magnate', desc: 'Juntá $50.000', metric: 'money', target: 50000, reward: { tokens: 2 } },
];

export const MISSION_BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));
