/* Orchestration : choix du lieu, chargement des donnees a chaque ouverture, cache, theme. */

import { $, store } from './util.js';
import { icon } from './icons.js';
import { resolveGps, reverseName, fetchWeather, fetchAir, fetchArchive, canGeolocate, KEY_GPS } from './api.js';
import { renderAll } from './views.js';
import { places, initPlaces, GPS } from './places.js';
import { lazyRadar, setupRadar } from './radar.js';

const MIN_REFRESH_MS = 2 * 60 * 1000;
const cacheKey = (id) => `meteo.cache.${id}`;
const hhmm = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const SOURCES = { gps: 'position actuelle', saved: 'dernière position connue', ip: 'position approximative (adresse IP)', place: 'lieu enregistré' };

let loading = false;
let lastOk = 0;
let lastId = null;
let radarPos = null;

const setStatus = (t) => { $('status').textContent = t; };

/* Lieu a afficher. Sans position automatique, on prend le premier lieu enregistre ; null = il faut en choisir un. */
function currentId() {
  const id = places.active();
  if (id !== GPS || canGeolocate()) return id;
  const first = places.list()[0];
  return first ? first.id : null;
}

function askForPlace() {
  $('place').textContent = 'Choisir une ville';
  setStatus('Choisissez votre ville pour afficher la météo.');
}

/* ---------- Theme ---------- */
const THEMES = ['auto', 'light', 'dark'];
const THEME_LABEL = { auto: 'automatique', light: 'clair', dark: 'sombre' };
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const b = $('theme-btn');
  b.title = `Thème : ${THEME_LABEL[t]}`;
  b.setAttribute('aria-label', `Changer de thème (actuel : ${THEME_LABEL[t]})`);
}
function initTheme() {
  let t = store.get('meteo.theme');
  if (!THEMES.includes(t)) t = 'auto';
  applyTheme(t);
  $('theme-btn').addEventListener('click', () => {
    t = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
    store.set('meteo.theme', t);
    applyTheme(t);
  });
}

/* ---------- Chargement ---------- */
async function target(id) {
  if (id === GPS) return resolveGps();
  const p = places.get(id);
  if (!p) return resolveGps();
  return { lat: p.lat, lon: p.lon, name: p.name, source: 'place' };
}

function paint(data) {
  renderAll(data);
  radarPos = data.pos;
  if (data.pos) setupRadarIfVisible();
}

let radarVisible = false;
function setupRadarIfVisible() { if (radarVisible && radarPos) setupRadar(radarPos); }

async function load(force = false) {
  const id = currentId();
  if (!id) { askForPlace(); return; }
  if (loading) return;
  if (!force && id === lastId && Date.now() - lastOk < MIN_REFRESH_MS) return;
  loading = true;
  $('refresh').classList.add('spin');
  setStatus('Mise à jour en cours...');
  try {
    const pos = await target(id);
    const [wx, aq, name] = await Promise.all([fetchWeather(pos), fetchAir(pos), reverseName(pos)]);
    const archive = await fetchArchive(pos, wx.current.time.slice(0, 10));
    if (id === GPS) store.set(KEY_GPS, { lat: pos.lat, lon: pos.lon, name });
    const data = { wx, aq, archive, place: name, pos: { lat: pos.lat, lon: pos.lon }, at: Date.now(), source: pos.source };
    store.set(cacheKey(id), data);
    paint(data);
    lastOk = data.at;
    lastId = id;
    setStatus(`Mis à jour à ${hhmm(data.at)} · ${SOURCES[pos.source]}`);
  } catch (e) {
    const cached = store.get(cacheKey(id));
    if (cached && lastId !== id) { try { paint(cached); lastId = id; } catch { /* cache incompatible */ } }
    const why = e && e.status === 429 ? 'service saturé, réessayez dans quelques minutes' : 'hors ligne ou service indisponible';
    setStatus(cached ? `${why[0].toUpperCase() + why.slice(1)} : données de ${hhmm(cached.at)}` : 'Impossible de charger la météo. Vérifiez la connexion et la localisation.');
  } finally {
    loading = false;
    $('refresh').classList.remove('spin');
  }
}

function start() {
  document.querySelectorAll('[data-i]').forEach((el) => { el.innerHTML = icon(el.dataset.i); });
  initTheme();
  const sheet = initPlaces(() => {
    const cached = store.get(cacheKey(currentId()));
    if (cached) { try { paint(cached); setStatus(`Données de ${hhmm(cached.at)}, mise à jour...`); } catch { /* cache incompatible */ } }
    load(true);
  });

  const cached = store.get(cacheKey(currentId()));
  if (cached) {
    try { paint(cached); lastId = currentId(); setStatus(`Données de ${hhmm(cached.at)}, mise à jour...`); } catch { /* cache incompatible */ }
  }

  $('refresh').addEventListener('click', () => load(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
  window.addEventListener('pageshow', (ev) => { if (ev.persisted) load(); });

  lazyRadar(() => { radarVisible = true; return radarPos; });
  load(true);
  if (!currentId()) sheet.open();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
