/**
 * Set de iconos SVG en línea (estilo "line icon" moderno, 24×24, trazo). Se
 * dibujan con `currentColor`, así heredan el color del botón (incluye el estado
 * activo naranja). Reemplazan a los emojis en toda la UI para un look profesional.
 *
 * `icon(name, size)` devuelve el markup `<svg>` listo para meter en innerHTML.
 */
const SOLID = new Set(['play', 'pause']); // estos van rellenos, el resto es trazo

const ICONS: Record<string, string> = {
  // --- Reloj / acciones ---
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  gauge: '<path d="M12 13l4-3"/><path d="M4.5 17a8 8 0 1 1 15 0"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 16h4"/>',
  wrench: '<path d="M15.5 6.5a3.6 3.6 0 0 0-4.7 4.5l-6.3 6.3 2.2 2.2 6.3-6.3a3.6 3.6 0 0 0 4.5-4.7l-2.4 2.4-2-2z"/>',
  hammer: '<path d="M14 3l7 7-2.4 2.4-7-7z"/><path d="M12.4 8.6 4 17v3h3l8.4-8.4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  flask: '<path d="M9 3h6M10 3v5.5L5.2 17A2 2 0 0 0 7 20h10a2 2 0 0 0 1.8-3L14 8.5V3"/><path d="M8 14h8"/>',
  alert: '<path d="M12 4 3 19h18z"/><path d="M12 10v4M12 17h.01"/>',
  settings: '<circle cx="8" cy="7" r="2"/><circle cx="16" cy="13" r="2"/><circle cx="9" cy="18" r="2"/><path d="M10 7h10M4 7h2M2 13h12M18 13h4M2 18h5M11 18h11"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v4h-4"/>',
  up: '<path d="M12 20V5M6 11l6-6 6 6"/>',
  // --- Recursos (barra superior) ---
  star: '<path d="M12 3.5l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.9z"/>',
  money: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.6 9.3A2.2 2.2 0 0 1 12 8c1.3 0 2.4.9 2.4 2M14.4 14.7A2.2 2.2 0 0 1 12 16c-1.3 0-2.4-.9-2.4-2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M21 20a5.5 5.5 0 0 0-3.5-5.1"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5M3 13h18"/>',
  down: '<path d="M3 7l6 6 4-4 8 8"/><path d="M21 12v5h-5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  zap: '<path d="M13 2 4 13h6l-1 9 9-11h-6z"/>',
  droplet: '<path d="M12 3.5s6 5.7 6 10.5a6 6 0 0 1-12 0c0-4.8 6-10.5 6-10.5z"/>',
  flame: '<path d="M12 3c2.5 3.5 5 5.6 5 9a5 5 0 0 1-10 0c0-1.8.8-3 1.8-4 .2 1 .9 1.8 1.7 2 .1-2.3-.9-4.5.5-7z"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4 3 6.9 7 8.5 4-1.6 7-4.5 7-8.5V6z"/>',
  heart: '<path d="M12 20S4 14.5 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.5-8 11-8 11z"/>',
  cap: '<path d="M2 9 12 4.5 22 9l-10 4.5z"/><path d="M6 10.8V16c0 1.3 2.7 2.8 6 2.8s6-1.5 6-2.8v-5.2M21 9.5V14"/>',
  utensils: '<path d="M5 3v6a2 2 0 0 0 4 0V3M7 9v12M16.5 3c-1.8 0-3 2-3 5s1.2 4 3 4v9"/>',
  key: '<circle cx="8" cy="9" r="4"/><path d="M10.8 11.8 20 21M17 18l2.2-2.2M14.5 15.5l2.2-2.2"/>',
  // --- Materiales ---
  layers: '<path d="M12 3 3 7.5 12 12l9-4.5zM3 12.5 12 17l9-4.5M3 16.5 12 21l9-4.5"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  wall: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M8.5 5v7M15.5 5v7M12 12v7"/>',
  tree: '<path d="M12 3 6.5 12H10l-3.5 5.5h11L14 12h3.5z"/><path d="M12 17.5V21"/>',
  ingot: '<path d="M5 11h14l2 6H3z"/><path d="M7 11l1.5-3h7L17 11"/>',
  cpu: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><rect x="10" y="10" width="4" height="4"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>',
  // --- Edificios / categorías ---
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  factory: '<path d="M3 21V9l6 4V9l6 4V5h6v16z"/><path d="M9 21v-4M15 21v-4"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5H5l2.2 11h11l2-8H6.2"/>',
  store: '<path d="M4 9 5.2 4h13.6L20 9"/><path d="M5 9v10.5h14V9"/><path d="M4 9h16"/><path d="M10 19.5V14h4v5.5"/>',
  road: '<path d="M7 3 5 21M17 3l2 18M12 4v3.5M12 11v2.5M12 16.5V20"/>',
  trash: '<path d="M4 7h16M10 7V4.5h4V7M6 7l1 13h10l1-13"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M3 21h11M4 11h9"/><path d="M13 8l3.2 3.2V17a1.4 1.4 0 0 0 2.8 0v-6l-2.2-2.2"/>',
  landmark: '<path d="M3 21h18M4 10h16M12 3 4 7h16zM6.5 10v8M10 10v8M14 10v8M17.5 10v8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/>',
  wind: '<path d="M3 8h9a3 3 0 1 0-3-3M3 12h13a3 3 0 1 1-3 3M3 16h7a2.5 2.5 0 1 1-2.5 2.5"/>',
  waves: '<path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  bus: '<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M8 17v2.5M16 17v2.5"/><circle cx="8" cy="14" r="0.6" fill="currentColor" stroke="none"/><circle cx="16" cy="14" r="0.6" fill="currentColor" stroke="none"/>',
  train: '<rect x="5" y="3" width="14" height="13" rx="3.5"/><path d="M5 11h14M8.5 20l-2 2M15.5 20l2 2"/><circle cx="9" cy="13.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="15" cy="13.5" r="0.6" fill="currentColor" stroke="none"/>',
  book: '<path d="M5 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M17 4h2v16h-2"/>',
  rocket: '<path d="M5 15c-1.2 1-2 4-2 4s3-.8 4-2M9.5 11.5A11 11 0 0 1 18 3c1 4-.5 7.5-3.5 10.5L11 17l-4-4z"/><circle cx="14.5" cy="8.5" r="1.3"/>',
  sparkles: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/>',
  film: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>',
  ferris: '<circle cx="12" cy="11" r="7.5"/><circle cx="12" cy="11" r="1.5"/><path d="M12 3.5v7M12 11l6.5 3.8M12 11 5.5 14.8M12 20v1.5M8 21h8"/>',
  flag: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
  gem: '<path d="M6 3h12l3.5 6L12 21 2.5 9z"/><path d="M2.5 9h19M9 3 6 9l6 12 6-12-3-6"/>',
  trophy: '<path d="M7 4h10v3.5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9.5 15h5M8 21h8M12 15v2"/>',
  coffee: '<path d="M4 8h13v4.5a4.5 4.5 0 0 1-4.5 4.5H8.5A4.5 4.5 0 0 1 4 12.5z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17M7 2.5v2M11 2.5v2"/>',
  flower: '<circle cx="12" cy="9" r="2.5"/><path d="M12 11.5V21M9.5 9a2.5 2.5 0 0 1 5 0M12 6.5a2.5 2.5 0 0 1 0-3M9.7 7.6A2.5 2.5 0 0 1 7 6M14.3 7.6A2.5 2.5 0 0 0 17 6"/>',
  rock: '<path d="M4 18l4-9 5 3 4-5 4 11z"/>',
  balloon: '<path d="M12 3a5 5 0 0 1 5 5c0 3.5-3 6-5 6.5C10 14 7 11.5 7 8a5 5 0 0 1 5-5z"/><path d="M12 14.5v3M11 20.5a1 1 0 0 0 2 0c0-1-2-1-2-3"/>',
  airship: '<path d="M4 12c0-2 3-3.5 8-3.5S20 10 20 12s-3 3.5-8 3.5S4 14 4 12z"/><path d="M11 15.5V18M13 15.5V18M11 18h2"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-6h8v6"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  refresh: '<path d="M4 4v5h5M20 20v-5h-5"/><path d="M5 14a7 7 0 0 0 12 3M19 10A7 7 0 0 0 7 7"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
};

/** Devuelve el `<svg>` del icono `name` (o un cuadrado si no existe). */
export function icon(name: string, size = 20): string {
  const path = ICONS[name] ?? ICONS.square;
  const fill = SOLID.has(name) ? 'currentColor' : 'none';
  const stroke = SOLID.has(name) ? 'none' : 'currentColor';
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
