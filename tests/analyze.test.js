import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moonPhase, moonSvg, sunProgress } from '../js/astro.js';
import { rainTotals, nowcast, windLabel, feelLabel, aqiLevel, pollenLevel, compass, context, advice, dailyList, hourlyStrip } from '../js/analyze.js';
import { addDays, num, fmtDuration } from '../js/util.js';
import { wmo } from '../js/icons.js';

/* ---------- Astro ---------- */
test('lune : nouvelle lune du 11 janvier 2024 et pleine lune du 25 janvier 2024', () => {
  const nm = moonPhase('2024-01-11');
  assert.ok(nm.frac < 0.03 || nm.frac > 0.97, `frac=${nm.frac}`);
  assert.equal(nm.name, 'Nouvelle lune');
  const fm = moonPhase('2024-01-25');
  assert.ok(Math.abs(fm.frac - 0.5) < 0.03, `frac=${fm.frac}`);
  assert.equal(fm.name, 'Pleine lune');
  assert.ok(fm.illum > 0.97);
});

test('lune : le dessin SVG est produit sans valeur invalide', () => {
  for (const f of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) assert.ok(!/NaN|undefined/.test(moonSvg(f)));
});

test('soleil : progression entre lever et coucher', () => {
  assert.deepEqual(sunProgress('2026-10-24T08:00', '2026-10-24T18:00', '2026-10-24T13:00'), { value: 0.5, isDay: true });
  assert.equal(sunProgress('2026-10-24T08:00', '2026-10-24T18:00', '2026-10-24T21:00').isDay, false);
  assert.equal(sunProgress('2026-10-24T08:00', '2026-10-24T18:00', '2026-10-25T09:00'), null);
});

/* ---------- Utilitaires ---------- */
test('dates et formats', () => {
  assert.equal(addDays('2026-10-24', -7), '2026-10-17');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(num(1234.56, 1), '1 234,6'.replace(' ', ' '));
  assert.equal(num(null), '--');
  assert.equal(fmtDuration(36480), '10 h 08');
});

/* ---------- Cumuls de pluie ---------- */
test('cumuls : archive prioritaire, prevision en complement, aujourd hui = depuis minuit', () => {
  const archive = { time: ['2026-10-01', '2026-10-02', '2026-10-03'], precipitation_sum: [1, 2, null] };
  const forecast = { time: ['2026-10-03', '2026-10-04', '2026-10-05'], precipitation_sum: [4, 8, 16] };
  const r = rainTotals(archive, forecast, '2026-10-05', 0.5);
  /* 1 + 2 (archive) + 4 (prevision, archive nulle) + 8 + 0,5 (aujourd'hui) */
  assert.equal(r.month.mm, 15.5);
  assert.equal(r.month.missing, 0);
  assert.equal(r.week.mm, 15.5);
  assert.equal(r.week.missing, 2); /* 29 et 30 septembre non couverts */
  assert.ok(r.year.missing > 100);
});

test('cumuls : sans archive, les jours manquants sont comptes', () => {
  const forecast = { time: ['2026-10-22', '2026-10-23'], precipitation_sum: [1, 1] };
  const r = rainTotals(null, forecast, '2026-10-24', 2);
  assert.equal(r.month.mm, 4);
  assert.equal(r.month.missing, 21);
});

/* ---------- Pluie dans l heure ----------
   valeurs[i] = pluie du quart d'heure situe a now + i x 15 min ; le tableau commence donc a l'instant present. */
function mini(now, values) {
  const time = [];
  let [h, m] = [Number(now.slice(11, 13)), Number(now.slice(14, 16))];
  for (let i = -2; i < values.length; i++) {
    const t = h * 60 + m + i * 15;
    time.push(`${now.slice(0, 10)}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return { current: { time: now }, minutely_15: { time, precipitation: [0, 0, ...values] } };
}

test('pluie dans l heure : sec, debut a venir, en cours', () => {
  assert.equal(nowcast(mini('2026-10-24T10:00', Array(9).fill(0))).summary, 'Pas de pluie dans les 2 prochaines heures');
  const soon = nowcast(mini('2026-10-24T10:00', [0, 0, 0, 0.4, 0.4, 0, 0, 0, 0]));
  assert.match(soon.summary, /^Pluie dans environ 45 min \(vers 10 h 45\)$/);
  const ongoing = nowcast(mini('2026-10-24T10:00', [0, 0.3, 0.3, 0, 0, 0, 0, 0, 0]));
  assert.match(ongoing.summary, /^Pluie en cours, fin vers 10 h 45$/);
  assert.match(nowcast(mini('2026-10-24T10:00', Array(9).fill(0.2))).summary, /continue/);
});

test('pluie dans l heure : absente ou invalide -> null', () => {
  assert.equal(nowcast({ current: { time: '2026-10-24T10:00' } }), null);
  assert.equal(nowcast({ current: { time: '2026-10-24T10:00' }, minutely_15: { time: [], precipitation: [] } }), null);
});

/* ---------- Libelles et niveaux ---------- */
test('libelles et niveaux', () => {
  assert.equal(windLabel(0), 'Calme');
  assert.equal(windLabel(18), 'Petite brise');
  assert.equal(windLabel(120), 'Violente tempête');
  assert.equal(feelLabel(-3), 'Très froid');
  assert.equal(feelLabel(27.7), 'Chaud');
  assert.equal(aqiLevel(21), 2);
  assert.equal(aqiLevel(250), 6);
  assert.equal(pollenLevel(0), 1);
  assert.equal(pollenLevel(60), 4);
  assert.equal(compass(200), 'SSO');
  assert.equal(compass(359), 'N');
  assert.equal(wmo(0, 0).cat, 'moon');
  assert.equal(wmo(63).label, 'Pluie');
});

/* ---------- Jeu de donnees complet : previsions, bandeau d heures, conseils ---------- */
function fullWeather() {
  const time = [];
  for (let d = 0; d < 3; d++) for (let hh = 0; hh < 24; hh++) time.push(`2026-10-${String(24 + d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:00`);
  const n = time.length;
  const fill = (v) => Array(n).fill(v);
  return {
    current: { time: '2026-10-24T10:15', temperature_2m: 12, apparent_temperature: 10, relative_humidity_2m: 70, weather_code: 3, precipitation: 0, wind_speed_10m: 8, wind_gusts_10m: 15, wind_direction_10m: 180, pressure_msl: 1015, dew_point_2m: 6, shortwave_radiation: 100, is_day: 1 },
    hourly: {
      time, temperature_2m: fill(12), apparent_temperature: fill(11), relative_humidity_2m: fill(65), precipitation: fill(0), precipitation_probability: fill(5),
      weather_code: fill(3), wind_speed_10m: fill(8), wind_gusts_10m: fill(15), pressure_msl: fill(1015), uv_index: fill(1),
      is_day: time.map((t) => (Number(t.slice(11, 13)) >= 8 && Number(t.slice(11, 13)) < 18 ? 1 : 0)),
    },
    daily: {
      time: ['2026-10-24', '2026-10-25', '2026-10-26'], weather_code: [3, 61, 0], temperature_2m_max: [14, 12, 15], temperature_2m_min: [8, 7, 6],
      precipitation_sum: [0, 5, 0], precipitation_probability_max: [10, 80, 5], sunrise: ['2026-10-24T08:04', '2026-10-25T08:05', '2026-10-26T08:07'],
      sunset: ['2026-10-24T18:12', '2026-10-25T18:10', '2026-10-26T18:08'], daylight_duration: [36480, 36300, 36100], uv_index_max: [2, 1, 2],
    },
  };
}

test('bandeau d heures, jours et conseils sur un jeu complet', () => {
  const ctx = context(fullWeather());
  assert.equal(ctx.nowIdx, 10);
  assert.equal(ctx.todayIdx, 0);
  const strip = hourlyStrip(ctx, 36);
  assert.equal(strip.length, 36);
  assert.equal(strip[0].time, '2026-10-24T11:00');
  assert.ok(strip.some((x) => x.newDay));
  const { days, min, max } = dailyList(ctx);
  assert.equal(days.length, 3);
  assert.equal(min, 6);
  assert.equal(max, 15);
  const list = advice(ctx);
  assert.ok(list.length >= 3);
  assert.match(list.find((a) => a.title === 'Parapluie').text, /Inutile/);
  assert.match(list.find((a) => a.title === 'Sortie sport').text, /Meilleur créneau/);
});

test('conseils : pluie annoncee -> parapluie, pas de creneau sportif', () => {
  const wx = fullWeather();
  wx.hourly.precipitation = wx.hourly.precipitation.map((_, i) => (i >= 12 && i <= 40 ? 1 : 0));
  wx.hourly.precipitation_probability = wx.hourly.precipitation_probability.map((_, i) => (i >= 12 && i <= 40 ? 90 : 5));
  const list = advice(context(wx));
  assert.match(list.find((a) => a.title === 'Parapluie').text, /Prenez-le/);
  assert.match(list.find((a) => a.title === 'Linge').text, /intérieur/);
});

test('jeu minimal (requete de secours) : bandeau et jours restent calculables', () => {
  const wx = fullWeather();
  for (const k of ['apparent_temperature', 'relative_humidity_2m', 'precipitation_probability', 'uv_index', 'is_day']) delete wx.hourly[k];
  for (const k of ['precipitation_probability_max', 'sunrise', 'sunset', 'daylight_duration', 'uv_index_max']) delete wx.daily[k];
  delete wx.current.is_day;
  const ctx = context(wx);
  assert.equal(hourlyStrip(ctx, 5).length, 5);
  assert.equal(dailyList(ctx).days.length, 3);
  assert.ok(advice(ctx).length >= 2);
});
