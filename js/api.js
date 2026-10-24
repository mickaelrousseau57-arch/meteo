/* Acces reseau : position, lieux, meteo, qualite de l'air, archive de pluie.
   Sources : Open-Meteo (prevision, air, archive ERA5, recherche de villes) et BigDataCloud (nom du lieu). */

import { store, distKm, addDays } from './util.js';

export class HttpError extends Error {
  constructor(status) { super('HTTP ' + status); this.status = status; }
}

export async function getJSON(url, ms = 15000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new HttpError(r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Position ---------- */
export const KEY_GPS = 'meteo.gps';

/* La position automatique exige une adresse securisee (https) ; sans elle on passe par le choix manuel de la ville. */
export const canGeolocate = () => window.isSecureContext !== false && 'geolocation' in navigator;

function geolocate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation indisponible'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

/* Position du telephone ; sinon derniere position connue ; sinon position approximative par adresse IP. */
export async function resolveGps() {
  if (!canGeolocate()) throw new Error('Géolocalisation indisponible');
  const saved = store.get(KEY_GPS);
  try {
    const p = await geolocate();
    return { ...p, source: 'gps', name: saved && distKm(saved, p) < 3 ? saved.name : null };
  } catch { /* refus ou echec : on essaie la derniere position connue */ }
  if (saved) return { ...saved, source: 'saved' };
  const ip = await getJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=fr');
  if (typeof ip.latitude !== 'number' || typeof ip.longitude !== 'number') throw new Error('Position introuvable');
  return { lat: ip.latitude, lon: ip.longitude, name: ip.city || ip.locality || null, source: 'ip' };
}

export async function reverseName(pos) {
  if (pos.name) return pos.name;
  try {
    const g = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.lat}&longitude=${pos.lon}&localityLanguage=fr`, 8000);
    return g.city || g.locality || 'Position actuelle';
  } catch {
    return 'Position actuelle';
  }
}

/* Recherche de villes (Open-Meteo geocoding). */
export async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await getJSON('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: q, count: '6', language: 'fr', format: 'json' }), 8000);
  return (data.results || []).map((r) => ({
    id: `${r.latitude.toFixed(3)},${r.longitude.toFixed(3)}`,
    name: r.name,
    sub: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/* ---------- Meteo ---------- */
const BASE = (p) => ({ latitude: p.lat.toFixed(4), longitude: p.lon.toFixed(4), timezone: 'auto', wind_speed_unit: 'kmh' });

const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,shortwave_radiation';
const HOURLY_BASIC = 'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl';
const HOURLY_FULL = HOURLY_BASIC + ',apparent_temperature,relative_humidity_2m,precipitation_probability,uv_index,is_day';
const DAILY_BASIC = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';
const DAILY_FULL = DAILY_BASIC + ',precipitation_probability_max,sunrise,sunset,daylight_duration,uv_index_max';

/* Trois niveaux de requete : complet, sans pas de 15 minutes, minimal.
   Si le service refuse une variable (erreur 400), on retombe sur le niveau suivant plutot que de tout perdre. */
export const WX_TIERS = [
  (p) => new URLSearchParams({ ...BASE(p), current: CURRENT + ',is_day', minutely_15: 'precipitation', hourly: HOURLY_FULL, daily: DAILY_FULL, past_days: '7', forecast_days: '10' }),
  (p) => new URLSearchParams({ ...BASE(p), current: CURRENT + ',is_day', hourly: HOURLY_FULL, daily: DAILY_FULL, past_days: '7', forecast_days: '10' }),
  (p) => new URLSearchParams({ ...BASE(p), current: CURRENT, hourly: HOURLY_BASIC, daily: DAILY_BASIC, past_days: '7', forecast_days: '3' }),
];

export async function fetchWeather(pos) {
  let lastErr;
  for (const tier of WX_TIERS) {
    try {
      return await getJSON('https://api.open-meteo.com/v1/forecast?' + tier(pos));
    } catch (e) {
      lastErr = e;
      if (!(e instanceof HttpError) || e.status !== 400) throw e;
    }
  }
  throw lastErr;
}

export const fetchAir = (pos) => getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?' + new URLSearchParams({
  ...BASE(pos),
  current: 'european_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,sulphur_dioxide,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
})).catch(() => null);

/* ---------- Archive de pluie (cumuls du mois et de l'annee) ----------
   Les donnees ERA5 ont environ 5 jours de retard : on s'arrete 7 jours avant aujourd'hui,
   la prevision (7 jours passes) comble le reste. Resultat mis en cache pour la journee. */
export async function fetchArchive(pos, today) {
  const end = addDays(today, -7);
  const start = today.slice(0, 4) + '-01-01';
  if (end < start) return null;
  const key = `meteo.arch.${pos.lat.toFixed(1)},${pos.lon.toFixed(1)}.${end}`;
  const cached = store.get(key);
  if (cached) return cached;
  try {
    const data = await getJSON('https://archive-api.open-meteo.com/v1/archive?' + new URLSearchParams({
      ...BASE(pos), start_date: start, end_date: end, daily: 'precipitation_sum',
    }), 20000);
    const daily = data.daily;
    if (!daily || !daily.time) return null;
    purgeArchiveCache(end);
    store.set(key, daily);
    return daily;
  } catch {
    return null;
  }
}

/* Supprime les archives d'un jour precedent ; celles des autres lieux du meme jour sont conservees. */
function purgeArchiveCache(currentEnd) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('meteo.arch.') && !k.endsWith('.' + currentEnd)) localStorage.removeItem(k);
    }
  } catch { /* stockage indisponible */ }
}

/* ---------- Radar (RainViewer) : liste des images disponibles ---------- */
export const RADAR_INDEX = 'https://api.rainviewer.com/public/weather-maps.json';
