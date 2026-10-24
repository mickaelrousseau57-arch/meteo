/* Radar de pluie : carte Leaflet (chargee a la demande) + images RainViewer des 2 dernieres heures. */

import { $ } from './util.js';
import { icon } from './icons.js';
import { getJSON, RADAR_INDEX } from './api.js';

let L = null;
let map = null, marker = null, base = null;
let layers = [];
let frames = [];
let current = 0;
let timer = null;
let loadedFor = null;
let wired = false;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'vendor/leaflet/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'vendor/leaflet/leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error('Leaflet indisponible'));
    document.head.appendChild(s);
  });
}

const clock = (ts) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function message(text) {
  const el = $('map-msg');
  el.hidden = !text;
  el.textContent = text || '';
}

function showFrame(i) {
  if (!layers.length) return;
  current = (i + layers.length) % layers.length;
  layers.forEach((l, k) => l.setOpacity(k === current ? 0.7 : 0));
  $('radar-range').value = String(current);
  $('radar-time').textContent = clock(frames[current].time);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  $('radar-play').innerHTML = icon('play');
  $('radar-play').setAttribute('aria-label', 'Lecture');
}

function play() {
  stop();
  $('radar-play').innerHTML = icon('pause');
  $('radar-play').setAttribute('aria-label', 'Pause');
  timer = setInterval(() => showFrame(current + 1), 700);
}

function wire() {
  if (wired) return;
  wired = true;
  $('radar-play').addEventListener('click', () => (timer ? stop() : play()));
  $('radar-range').addEventListener('input', (e) => { stop(); showFrame(Number(e.target.value)); });
  $('map-lock').addEventListener('click', () => {
    $('map-lock').hidden = true;
    map.dragging.enable();
    map.touchZoom.enable();
  });
}

/* Appelee a chaque changement de lieu ou de mise a jour. Ne charge rien tant que la carte n'est pas visible. */
export async function setupRadar(pos) {
  const key = `${pos.lat.toFixed(2)},${pos.lon.toFixed(2)}`;
  try {
    L = await loadLeaflet();
    wire();
    if (!map) {
      map = L.map('map', { zoomControl: true, attributionControl: true, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, maxZoom: 12, minZoom: 4 });
      base = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    }
    if (loadedFor === key && layers.length) return;
    map.setView([pos.lat, pos.lon], 7);
    if (marker) marker.remove();
    marker = L.circleMarker([pos.lat, pos.lon], { radius: 6, weight: 3, color: '#ffffff', fillColor: '#3d5f94', fillOpacity: 1 }).addTo(map);

    message('');
    const idx = await getJSON(RADAR_INDEX, 10000);
    const past = (idx.radar && idx.radar.past) || [];
    if (!past.length) throw new Error('Aucune image radar');
    stop();
    layers.forEach((l) => l.remove());
    frames = past;
    layers = frames.map((f) => L.tileLayer(`${idx.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0, maxNativeZoom: 7, maxZoom: 12, zIndex: 5 }).addTo(map));
    $('radar-range').max = String(frames.length - 1);
    loadedFor = key;
    showFrame(frames.length - 1);
    setTimeout(() => map.invalidateSize(), 50);
  } catch {
    message('Radar indisponible pour le moment.');
  }
}

/* Charge le radar quand la carte approche de l'ecran (economise la data mobile). */
export function lazyRadar(getPos) {
  const card = $('radar-card');
  if (!('IntersectionObserver' in window)) { const p = getPos(); if (p) setupRadar(p); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      const p = getPos();
      if (p) setupRadar(p);
    }
  }, { rootMargin: '300px' });
  io.observe(card);
}
