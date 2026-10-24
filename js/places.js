/* Lieux : liste enregistree, choix du lieu actif, recherche de villes. */

import { $, esc, store } from './util.js';
import { icon } from './icons.js';
import { searchPlaces, canGeolocate } from './api.js';

const KEY_PLACES = 'meteo.places';
const KEY_ACTIVE = 'meteo.active';
export const GPS = 'gps';

export const places = {
  list() { const l = store.get(KEY_PLACES); return Array.isArray(l) ? l : []; },
  active() { return store.get(KEY_ACTIVE) || GPS; },
  setActive(id) { store.set(KEY_ACTIVE, id); },
  add(p) {
    const l = this.list().filter((x) => x.id !== p.id);
    l.unshift({ id: p.id, name: p.name, sub: p.sub, lat: p.lat, lon: p.lon });
    store.set(KEY_PLACES, l.slice(0, 12));
  },
  remove(id) {
    store.set(KEY_PLACES, this.list().filter((x) => x.id !== id));
    if (this.active() === id) this.setActive(GPS);
  },
  get(id) { return this.list().find((x) => x.id === id) || null; },
};

const row = (p, extra = '') => `<li><button class="place-row" type="button" data-id="${esc(p.id)}"><span class="ico tint-blue">${icon('pin')}</span><span><b>${esc(p.name)}</b><i>${esc(p.sub || '')}</i></span></button>${extra}</li>`;

function renderSaved(activeId) {
  const l = places.list();
  $('saved-empty').hidden = l.length > 0;
  $('saved-list').innerHTML = l.map((p) => row(p, `<button class="round small del" type="button" data-del="${esc(p.id)}" aria-label="Supprimer ${esc(p.name)}">${icon('trash')}</button>`)).join('');
  $('use-gps').classList.toggle('on', activeId === GPS);
  $('saved-list').querySelectorAll('[data-id]').forEach((b) => b.classList.toggle('on', b.dataset.id === activeId));
}

/* onChange(id) est appele quand l'utilisateur choisit un lieu (ou "Ma position"). */
export function initPlaces(onChange) {
  const sheet = $('sheet');
  const input = $('search-input');
  const results = $('search-results');
  let found = [];
  let seq = 0;

  const open = (hint) => {
    if (sheet.open) return;
    renderSaved(places.active());
    $('use-gps').hidden = !canGeolocate();
    const text = hint || (canGeolocate() ? '' : 'La position automatique n’est pas disponible sur cette adresse. Choisissez votre ville : elle sera mémorisée.');
    $('sheet-hint').textContent = text;
    $('sheet-hint').hidden = !text;
    results.innerHTML = '';
    input.value = '';
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
    if (!places.list().length) input.focus();
  };
  const close = () => { if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open'); };

  $('place-btn').addEventListener('click', () => open());
  $('sheet-close').addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });

  $('use-gps').addEventListener('click', () => { places.setActive(GPS); close(); onChange(GPS); });

  $('saved-list').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) { const wasActive = places.active() === del.dataset.del; places.remove(del.dataset.del); renderSaved(places.active()); if (wasActive) onChange(GPS); return; }
    const b = e.target.closest('[data-id]');
    if (b) { places.setActive(b.dataset.id); close(); onChange(b.dataset.id); }
  });

  results.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    const p = b && found.find((x) => x.id === b.dataset.id);
    if (!p) return;
    places.add(p);
    places.setActive(p.id);
    close();
    onChange(p.id);
  });

  let debounce;
  const run = async () => {
    const my = ++seq;
    const q = input.value;
    if (q.trim().length < 2) { results.innerHTML = ''; return; }
    try {
      const r = await searchPlaces(q);
      if (my !== seq) return;
      found = r;
      results.innerHTML = r.length ? r.map((p) => row(p)).join('') : '<li class="note">Aucun résultat.</li>';
    } catch {
      if (my === seq) results.innerHTML = '<li class="note">Recherche indisponible pour le moment.</li>';
    }
  };
  input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(run, 300); });
  $('search-form').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(debounce); run(); });
  return { open };
}
