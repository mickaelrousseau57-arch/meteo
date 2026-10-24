/* Icones (SVG en ligne) et traduction des codes meteo WMO. */

const CLOUD = '<path d="M7 17h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 8.6 4.2 4.2 0 0 0 7 17z"/>';

export const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cloud: CLOUD,
  rain: CLOUD + '<path d="M8 20l1-2M12 20l1-2M16 20l1-2"/>',
  storm: CLOUD + '<path d="M12 17l-2 3h3l-1 3"/>',
  snow: CLOUD + '<path d="M8 19.5h.01M12 20.5h.01M16 19.5h.01"/>',
  fog: '<path d="M4 8h16M6 12h14M4 16h16M8 20h10"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  gauge: '<circle cx="12" cy="12" r="9"/><path d="M12 12l4-3"/>',
  leaf: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14zM5 19l8-8"/>',
  flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5V4M12 14.5V20M9.5 12H4M14.5 12H20"/>',
  sunrise: '<path d="M12 3v4M5 12H3M21 12h-2M6.3 6.3l1.4 1.4M17.7 6.3l-1.4 1.4M7 17a5 5 0 0 1 10 0M3 20h18"/>',
  sunset: '<path d="M12 8V4M5 13H3M21 13h-2M6.3 7.3l1.4 1.4M17.7 7.3l-1.4 1.4M7 18a5 5 0 0 1 10 0M3 21h18"/>',
  uv: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0zM12 12v6a2 2 0 0 0 4 0"/>',
  shirt: '<path d="M8 3l-5 3 2 4 3-1v11h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  run: '<circle cx="15" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2 1 4M11 15l-1-5 4-2 2 3h3M7 12l3-4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  target: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  contrast: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
};

export const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* Code WMO -> categorie (pour l'icone et la couleur) et libelle francais.
   isDay = 0 remplace le soleil par la lune. */
export function wmo(code, isDay = 1) {
  const clear = isDay === 0 ? 'moon' : 'sun';
  if (code === 0) return { cat: clear, label: isDay === 0 ? 'Nuit claire' : 'Ciel dégagé' };
  if (code === 1) return { cat: clear, label: isDay === 0 ? 'Nuit plutôt claire' : 'Plutôt dégagé' };
  if (code === 2) return { cat: 'cloud', label: 'Partiellement nuageux' };
  if (code === 3) return { cat: 'cloud', label: 'Couvert' };
  if (code === 45 || code === 48) return { cat: 'fog', label: 'Brouillard' };
  if (code >= 51 && code <= 57) return { cat: 'rain', label: 'Bruine' };
  if (code === 61 || code === 80) return { cat: 'rain', label: 'Pluie faible' };
  if (code === 63 || code === 81) return { cat: 'rain', label: 'Pluie' };
  if (code === 65 || code === 82) return { cat: 'rain', label: 'Pluie forte' };
  if (code === 66 || code === 67) return { cat: 'rain', label: 'Pluie verglaçante' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { cat: 'snow', label: 'Neige' };
  if (code >= 95) return { cat: 'storm', label: 'Orage' };
  return { cat: 'cloud', label: 'Variable' };
}

export const isWet = (cat) => cat === 'rain' || cat === 'storm' || cat === 'snow';
