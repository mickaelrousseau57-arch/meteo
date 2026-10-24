/* Outils partages : formats, calculs simples, stockage, dates locales.
   Aucune dependance au DOM a l'import, pour pouvoir etre testes avec Node. */

const FMT = {
  0: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }),
  1: new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
};

export const $ = (id) => document.getElementById(id);
export const num = (v, d = 0) => (v == null || Number.isNaN(v) ? '--' : FMT[d].format(v));
export const signed = (v, d = 1) => (v > 0 ? '+' : '') + num(v, d);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sum = (a) => a.reduce((s, v) => s + (v || 0), 0);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* stockage indisponible */ } },
};

/* Les heures de l'API sont deja en heure locale du lieu ("2026-10-24T21:15"), sans decalage. */
export const dateOf = (s) => s.slice(0, 10);
export const minutesOf = (s) => Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
export const hourLabel = (s) => `${Number(s.slice(11, 13))} h`;

const utcDate = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const dayShort = (iso) => utcDate(iso).toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '').slice(0, 3).toUpperCase();
export const dayLong = (iso) => {
  const t = utcDate(iso).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const longDate = (iso) => {
  const t = utcDate(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const dayOfMonth = (iso) => Number(iso.slice(8, 10));

export function addDays(iso, n) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function fmtDuration(seconds) {
  const m = Math.round(seconds / 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export function distKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/* Trace une courbe SVG ("M x y L x y ...") a partir d'une serie de valeurs. */
export function linePath(vals, min, max, w = 300, h = 90, pad = 10) {
  const n = Math.max(vals.length - 1, 1);
  return vals.map((v, i) => `${i ? 'L' : 'M'}${((i / n) * w).toFixed(1)} ${(h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad)).toFixed(1)}`).join(' ');
}
