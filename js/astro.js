/* Calculs astronomiques locaux (aucun appel reseau) : phase de la lune et position du soleil. */

const SYNODIC_DAYS = 29.530588853;
const NEW_MOON_JD = 2451550.1; /* nouvelle lune du 6 janvier 2000, 18 h 14 UTC */

function julianDay(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
}

/* Phase de la lune a midi UTC de la date donnee ("AAAA-MM-JJ"). Precision : de l'ordre de la demi-journee. */
export function moonPhase(isoDate) {
  const raw = (julianDay(isoDate) - NEW_MOON_JD) / SYNODIC_DAYS;
  const frac = raw - Math.floor(raw);
  const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  let name;
  if (frac < 0.03 || frac >= 0.97) name = 'Nouvelle lune';
  else if (frac < 0.22) name = 'Premier croissant';
  else if (frac < 0.28) name = 'Premier quartier';
  else if (frac < 0.47) name = 'Gibbeuse croissante';
  else if (frac < 0.53) name = 'Pleine lune';
  else if (frac < 0.72) name = 'Gibbeuse décroissante';
  else if (frac < 0.78) name = 'Dernier quartier';
  else name = 'Dernier croissant';
  return { frac, illum, name, waxing: frac < 0.5 };
}

/* Dessin SVG (viewBox 24x24) de la partie eclairee de la lune, vue de l'hemisphere nord. */
export function moonSvg(frac) {
  const waxing = frac < 0.5;
  const rx = Math.abs(Math.cos(2 * Math.PI * frac)) * 10;
  const crescent = Math.cos(2 * Math.PI * frac) > 0;
  const lit = `M12 2A10 10 0 0 1 12 22A${rx.toFixed(2)} 10 0 0 ${crescent ? 0 : 1} 12 2Z`;
  const g = waxing ? '' : ' transform="translate(24 0) scale(-1 1)"';
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="moon-dark" cx="12" cy="12" r="10"/><path class="moon-lit"${g} d="${lit}"/></svg>`;
}

const toMin = (s) => Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));

/* Avancement du soleil entre lever et coucher : 0 au lever, 1 au coucher.
   Retourne null si les heures ne correspondent pas au meme jour. */
export function sunProgress(sunrise, sunset, now) {
  if (!sunrise || !sunset || !now) return null;
  if (sunrise.slice(0, 10) !== now.slice(0, 10)) return null;
  const a = toMin(sunrise), b = toMin(sunset), n = toMin(now);
  if (b <= a) return null;
  return { value: (n - a) / (b - a), isDay: n >= a && n <= b };
}
