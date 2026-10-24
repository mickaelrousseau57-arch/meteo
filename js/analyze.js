/* Analyse des donnees meteo : bulletin, alertes, conseils, cumuls, niveaux.
   Fonctions pures (aucun acces au DOM) pour pouvoir etre testees avec Node. */

import { wmo, isWet } from './icons.js';
import { clamp, sum, num, hourLabel, dateOf, minutesOf, addDays } from './util.js';

/* ---------- Libelles ---------- */
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export const compass = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

export function windLabel(v) {
  const t = [[1, 'Calme'], [6, 'Très légère brise'], [12, 'Légère brise'], [20, 'Petite brise'], [29, 'Jolie brise'], [39, 'Bonne brise'], [50, 'Vent frais'], [62, 'Grand frais'], [75, 'Coup de vent'], [89, 'Fort coup de vent'], [103, 'Tempête']];
  for (const [max, label] of t) if (v < max) return label;
  return 'Violente tempête';
}

export function feelLabel(v) {
  const t = [[0, 'Très froid'], [10, 'Froid'], [18, 'Frais'], [24, 'Agréable'], [30, 'Chaud'], [36, 'Très chaud']];
  for (const [max, label] of t) if (v < max) return label;
  return 'Torride';
}

export function dewLabel(v) {
  if (v < 10) return 'sec';
  if (v < 16) return 'confortable';
  if (v < 20) return 'lourd';
  return 'étouffant';
}

export function uvLabel(v) {
  if (v < 3) return 'Faible';
  if (v < 6) return 'Modéré';
  if (v < 8) return 'Élevé';
  if (v < 11) return 'Très élevé';
  return 'Extrême';
}

/* Indice europeen de qualite de l'air : seuils 20/40/60/80/100. */
export const AQI_NAMES = ['Bon', 'Correct', 'Moyen', 'Médiocre', 'Mauvais', 'Extrêmement mauvais'];
export const aqiLevel = (aqi) => clamp(Math.floor(aqi / 20) + 1, 1, 6);

/* Echelle indicative propre a l'application (grains/m3, valeur la plus forte parmi les especes). */
export const POLLEN_NAMES = ['Très faible', 'Faible', 'Modéré', 'Élevé', 'Très élevé', 'Extrême'];
export const POLLEN_SPECIES = [['Aulne', 'alder_pollen'], ['Bouleau', 'birch_pollen'], ['Graminées', 'grass_pollen'], ['Armoise', 'mugwort_pollen'], ['Olivier', 'olive_pollen'], ['Ambroisie', 'ragweed_pollen']];
export const pollenLevel = (max) => [1, 20, 50, 100, 200].filter((t) => max >= t).length + 1;

/* ---------- Contexte ---------- */
export function context(wx) {
  const h = wx.hourly, c = wx.current, d = wx.daily;
  const hourKey = c.time.slice(0, 13) + ':00';
  let nowIdx = h.time.indexOf(hourKey);
  if (nowIdx < 0) nowIdx = Math.max(0, h.time.findIndex((t) => t > c.time) - 1);
  const today = dateOf(c.time);
  return { h, c, d, nowIdx, today, todayIdx: d.time.indexOf(today), dayStart: h.time.indexOf(today + 'T00:00') };
}

const isDayAt = (h, i) => (h.is_day ? h.is_day[i] : 1);

export function nowInfo(ctx) {
  const { c, h, nowIdx } = ctx;
  const info = wmo(c.weather_code, c.is_day == null ? isDayAt(h, nowIdx) : c.is_day);
  return info;
}

const when = (ctx, i) => (dateOf(ctx.h.time[i]) === ctx.today ? '' : 'demain à ') + hourLabel(ctx.h.time[i]);

/* ---------- Bulletin du jour ---------- */
export function buildBulletin(ctx) {
  const { h, c, d, nowIdx, todayIdx } = ctx;
  const p = h.precipitation;
  const out = [];
  const raining = c.precipitation > 0 || isWet(wmo(c.weather_code).cat);
  const last = Math.min(nowIdx + 24, p.length - 2);
  if (raining) {
    let end = -1;
    for (let i = nowIdx + 1; i <= last; i++) if (p[i] < 0.1 && p[i + 1] < 0.1) { end = i; break; }
    if (end > 0) {
      const mm = sum(p.slice(nowIdx + 1, end));
      out.push(`Il pleut, jusqu’à ${when(ctx, end - 1)}${mm >= 0.5 ? ` (environ ${num(mm, 1)} mm)` : ''}`);
    } else {
      out.push('Il pleut et la pluie se poursuit sur les 24 prochaines heures');
    }
  } else {
    let start = -1;
    for (let i = nowIdx + 1; i <= last + 1; i++) if (p[i] >= 0.2) { start = i; break; }
    out.push(start > 0 ? `Temps sec pour l’instant, pluie attendue à partir de ${when(ctx, start - 1)}` : 'Pas de pluie prévue dans les 24 prochaines heures');
  }
  const win = h.temperature_2m.slice(nowIdx, nowIdx + 13);
  const minT = Math.min(...win);
  out.push(`minimum de ${num(minT)} °C vers ${when(ctx, nowIdx + win.indexOf(minT))}`);
  const gust = Math.max(...h.wind_gusts_10m.slice(nowIdx, nowIdx + 13));
  if (gust >= 50) out.push(`rafales jusqu’à ${num(gust)} km/h`);
  let text = out.join(' ; ') + '.';
  const t = todayIdx >= 0 ? todayIdx + 1 : -1;
  if (t > 0 && d.time[t]) {
    const mm = d.precipitation_sum[t];
    text += ` Demain : de ${num(d.temperature_2m_min[t])} à ${num(d.temperature_2m_max[t])} °C, ${mm >= 0.5 ? `pluie ${num(mm, 1)} mm` : 'temps sec'}.`;
  }
  return text;
}

/* Point d'attention : estimation d'apres les previsions, jamais la vigilance officielle. */
export function buildAlert(ctx) {
  const { h, c, d, nowIdx, todayIdx } = ctx;
  const n12 = (arr) => arr.slice(nowIdx, nowIdx + 13);
  if (Math.max(...h.wind_gusts_10m.slice(nowIdx, nowIdx + 25)) >= 70) return 'Vent fort';
  if (sum(h.precipitation.slice(nowIdx + 1, nowIdx + 25)) >= 20) return 'Fortes pluies';
  if (n12(h.weather_code).some((x) => x >= 95)) return 'Orages possibles';
  if (n12(h.weather_code).some((x) => (x >= 71 && x <= 77) || x === 85 || x === 86)) return 'Neige possible';
  if ((todayIdx >= 0 && d.temperature_2m_max[todayIdx] >= 35) || c.apparent_temperature >= 35) return 'Forte chaleur';
  if (Math.min(...n12(h.temperature_2m)) <= -5) return 'Grand froid';
  return null;
}

/* ---------- Pluie dans les 2 prochaines heures (pas de 15 minutes) ---------- */
const WET_15 = 0.05; /* mm par quart d'heure, soit environ 0,2 mm/h */

export function nowcast(wx) {
  const m = wx.minutely_15;
  if (!m || !Array.isArray(m.time) || !Array.isArray(m.precipitation)) return null;
  const now = wx.current.time;
  let i0 = -1;
  for (let i = 0; i < m.time.length; i++) if (m.time[i] <= now) i0 = i; else break;
  if (i0 < 0) return null;
  const bars = [];
  for (let i = i0 + 1; i <= i0 + 8 && i < m.time.length; i++) bars.push({ time: m.time[i], mm: m.precipitation[i] });
  if (bars.length < 4 || bars.every((b) => b.mm == null)) return null;
  const wet = bars.map((b) => (b.mm || 0) >= WET_15);
  const first = wet.indexOf(true);
  const hhmm = (s) => `${Number(s.slice(11, 13))} h ${s.slice(14, 16)}`;
  let summary;
  if (first < 0) {
    summary = 'Pas de pluie dans les 2 prochaines heures';
  } else if (first === 0) {
    const stop = wet.indexOf(false);
    summary = stop < 0 ? 'Pluie continue sur les 2 prochaines heures' : `Pluie en cours, fin vers ${hhmm(bars[stop].time)}`;
  } else {
    const minutes = minutesOf(bars[first].time) - minutesOf(now);
    summary = `Pluie dans environ ${Math.max(5, Math.round(minutes / 5) * 5)} min (vers ${hhmm(bars[first].time)})`;
  }
  return { bars, summary, max: Math.max(...bars.map((b) => b.mm || 0)) };
}

/* ---------- Prochaines heures ---------- */
export function hourlyStrip(ctx, count = 36) {
  const { h, nowIdx } = ctx;
  const out = [];
  for (let i = nowIdx + 1; i <= nowIdx + count && i < h.time.length; i++) {
    const hr = Number(h.time[i].slice(11, 13));
    out.push({
      time: h.time[i],
      label: hr === 0 ? 'Minuit' : `${hr} h`,
      newDay: hr === 0,
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      isDay: isDayAt(h, i),
      prob: h.precipitation_probability ? h.precipitation_probability[i] : null,
      mm: h.precipitation[i],
    });
  }
  return out;
}

/* ---------- Previsions par jour ---------- */
export function dailyList(ctx) {
  const { d, todayIdx } = ctx;
  if (todayIdx < 0) return { days: [], min: 0, max: 1 };
  const days = [];
  for (let i = todayIdx; i < d.time.length; i++) {
    days.push({
      iso: d.time[i],
      code: d.weather_code[i],
      min: d.temperature_2m_min[i],
      max: d.temperature_2m_max[i],
      mm: d.precipitation_sum[i],
      prob: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
      sunrise: d.sunrise ? d.sunrise[i] : null,
      sunset: d.sunset ? d.sunset[i] : null,
      uvMax: d.uv_index_max ? d.uv_index_max[i] : null,
      daylight: d.daylight_duration ? d.daylight_duration[i] : null,
    });
  }
  return { days, min: Math.min(...days.map((x) => x.min)), max: Math.max(...days.map((x) => x.max)) };
}

/* ---------- Cumuls de pluie ---------- */
/* archive : { time[], precipitation_sum[] } (ERA5, quelques jours de retard)
   forecastDaily : meme forme, issu de la prevision (jours passes recents)
   Pour chaque jour avant aujourd'hui on prend l'archive si elle a une valeur, sinon la prevision.
   Aujourd'hui = cumul depuis minuit (sinceMidnight). */
export function rainTotals(archive, forecastDaily, today, sinceMidnight) {
  const byDay = new Map();
  if (forecastDaily) forecastDaily.time.forEach((t, i) => { if (t < today && forecastDaily.precipitation_sum[i] != null) byDay.set(t, forecastDaily.precipitation_sum[i]); });
  if (archive) archive.time.forEach((t, i) => { if (t < today && archive.precipitation_sum[i] != null) byDay.set(t, archive.precipitation_sum[i]); });
  byDay.set(today, sinceMidnight);
  const total = (from) => {
    let s = 0, missing = 0;
    for (let t = from; t <= today; t = addDays(t, 1)) { if (byDay.has(t)) s += byDay.get(t); else missing++; }
    return { mm: s, missing };
  };
  return {
    week: total(addDays(today, -6)),
    month: total(today.slice(0, 8) + '01'),
    year: total(today.slice(0, 5) + '01-01'),
    byDay,
  };
}

/* ---------- Conseils pratiques (indicatifs) ---------- */
export function advice(ctx) {
  const { h, c, d, nowIdx, todayIdx } = ctx;
  const out = [];
  const idx = (n) => Array.from({ length: n }, (_, k) => nowIdx + 1 + k).filter((i) => i < h.time.length);
  const next12 = idx(12), next24 = idx(24);
  const prob = (i) => (h.precipitation_probability ? h.precipitation_probability[i] || 0 : 0);
  const wetSlot = (i) => h.precipitation[i] >= 0.2 || prob(i) >= 60;

  /* Parapluie */
  const wetNow = c.precipitation > 0 || isWet(wmo(c.weather_code).cat);
  const firstWet = next12.find(wetSlot);
  if (wetNow) out.push({ icon: 'umbrella', title: 'Parapluie', text: 'Il pleut : parapluie ou imperméable.' });
  else if (firstWet != null) out.push({ icon: 'umbrella', title: 'Parapluie', text: `Prenez-le : pluie possible vers ${when(ctx, firstWet - 1)}.` });
  else out.push({ icon: 'umbrella', title: 'Parapluie', text: 'Inutile pour les 12 prochaines heures.' });

  /* Tenue */
  const feel = c.apparent_temperature;
  const lowFeel = h.apparent_temperature ? Math.min(feel, ...next12.map((i) => h.apparent_temperature[i])) : feel;
  let wear;
  if (lowFeel < 0) wear = 'Manteau chaud, bonnet et gants.';
  else if (lowFeel < 8) wear = 'Manteau.';
  else if (lowFeel < 14) wear = 'Veste ou gros pull.';
  else if (lowFeel < 20) wear = 'Pull léger.';
  else if (lowFeel < 27) wear = 'T-shirt, une veste légère pour le soir.';
  else wear = 'Tenue légère, pensez à boire.';
  out.push({ icon: 'shirt', title: 'Tenue', text: `${wear} Ressenti le plus bas : ${num(lowFeel)} °C.` });

  /* Linge dehors */
  const dayHours = idx(10).filter((i) => isDayAt(h, i) === 1);
  if (dayHours.length >= 3) {
    const rainy = dayHours.some((i) => h.precipitation[i] >= 0.1 || prob(i) >= 40);
    const humid = h.relative_humidity_2m ? sum(dayHours.map((i) => h.relative_humidity_2m[i])) / dayHours.length : c.relative_humidity_2m;
    if (!rainy && humid < 85) out.push({ icon: 'wind', title: 'Linge', text: 'Séchage dehors possible en journée.' });
    else out.push({ icon: 'wind', title: 'Linge', text: rainy ? 'Pluie possible : séchez plutôt à l’intérieur.' : 'Air très humide : le linge séchera mal dehors.' });
  }

  /* Sortie sportive : meilleur creneau de jour sans pluie, ressenti doux, vent modere */
  const feelAt = (i) => (h.apparent_temperature ? h.apparent_temperature[i] : h.temperature_2m[i]);
  const good = next24.filter((i) => isDayAt(h, i) === 1 && h.precipitation[i] < 0.1 && prob(i) < 30 && feelAt(i) >= 6 && feelAt(i) <= 22 && h.wind_gusts_10m[i] < 40);
  if (good.length) {
    const best = good.reduce((a, b) => (Math.abs(feelAt(a) - 13) <= Math.abs(feelAt(b) - 13) ? a : b));
    out.push({ icon: 'run', title: 'Sortie sport', text: `Meilleur créneau : ${when(ctx, best)} (ressenti ${num(feelAt(best))} °C).` });
  } else {
    out.push({ icon: 'run', title: 'Sortie sport', text: 'Pas de créneau idéal de jour (pluie, vent ou température).' });
  }

  /* UV */
  const uvMax = d.uv_index_max && todayIdx >= 0 ? d.uv_index_max[todayIdx] : null;
  if (uvMax != null && uvMax >= 3) out.push({ icon: 'uv', title: 'Soleil', text: `Indice UV max ${num(uvMax)} (${uvLabel(uvMax).toLowerCase()}) : protection conseillée.` });

  return out;
}
