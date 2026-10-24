/* Affichage : remplit la page a partir des donnees analysees. */

import { $, num, signed, clamp, sum, esc, dayShort, dayLong, longDate, dayOfMonth, hourLabel, addDays, fmtDuration, linePath } from './util.js';
import { icon, wmo, isWet } from './icons.js';
import { moonPhase, moonSvg, sunProgress } from './astro.js';
import {
  context, nowInfo, buildBulletin, buildAlert, nowcast, hourlyStrip, dailyList, rainTotals, advice,
  compass, windLabel, feelLabel, dewLabel, uvLabel, AQI_NAMES, aqiLevel, POLLEN_NAMES, POLLEN_SPECIES, pollenLevel,
} from './analyze.js';

const set = (id, text) => { $(id).textContent = text; };
const show = (id, on) => { $(id).hidden = !on; };

function renderHero(ctx, place) {
  const { c, h, nowIdx } = ctx;
  const now = nowInfo(ctx);
  document.body.dataset.cat = now.cat;
  set('place', place);
  set('date', longDate(c.time));
  set('bulletin', buildBulletin(ctx));

  const alert = buildAlert(ctx);
  show('alert', !!alert);
  if (alert) {
    set('alert', `Point d’attention · ${alert}`);
    $('alert').title = 'Estimation d’après les prévisions, pas la vigilance officielle';
  }

  $('now-icon').innerHTML = icon(now.cat);
  set('now-label', now.label);
  set('now-temp', num(c.temperature_2m, 1));
  const minutes = Number(c.time.slice(14, 16));
  const prevT = h.temperature_2m[nowIdx - 1];
  const rate = prevT == null ? null : (c.temperature_2m - prevT) / (1 + minutes / 60);
  set('now-trend', rate == null ? '--' : `${rate < -0.05 ? '↘' : rate > 0.05 ? '↗' : '→'} ${signed(rate)} °C/h`);

  const slotRain = h.precipitation[nowIdx + 1];
  const raining = c.precipitation > 0 || isWet(now.cat);
  set('tl-text', raining && slotRain > 0 ? `${now.label} : ${num(slotRain, 1)} mm/h` : now.label);

  const N = 18;
  const segs = [];
  for (let i = nowIdx + 1; i <= nowIdx + N && i < h.time.length; i++) {
    const cat = wmo(h.weather_code[i], h.is_day ? h.is_day[i] : 1).cat;
    const prev = segs[segs.length - 1];
    if (prev && prev.cat === cat) prev.n++; else segs.push({ cat, n: 1 });
  }
  $('timeline').innerHTML = segs.map((s) => `<div class="seg seg-${s.cat}" style="flex:${s.n}">${s.n >= 3 ? icon(s.cat) : ''}</div>`).join('');
  const label = (k) => (h.time[nowIdx + k] ? hourLabel(h.time[nowIdx + k]) : '');
  $('tl-axis').innerHTML = `<span>Maintenant</span><span>${label(6)}</span><span>${label(12)}</span><span>${label(18)}</span>`;
}

function renderNowcast(wx) {
  const n = nowcast(wx);
  show('nowcast-card', !!n);
  if (!n) return;
  set('nowcast-text', n.summary);
  const scale = Math.max(n.max, 0.5);
  $('nowcast-bars').innerHTML = n.bars.map((b) => {
    const mm = b.mm || 0;
    const t = `${Number(b.time.slice(11, 13))} h ${b.time.slice(14, 16)}`;
    return `<div class="nc" title="${t} : ${num(mm * 4, 1)} mm/h"><i class="${mm >= 0.05 ? '' : 'zero'}" style="height:${mm >= 0.05 ? Math.max(8, (mm / scale) * 100) : 4}%"></i><span>${b.time.slice(14, 16) === '00' ? hourLabel(b.time) : ''}</span></div>`;
  }).join('');
}

function renderHourly(ctx) {
  const items = hourlyStrip(ctx, 36);
  const maxMm = Math.max(1, ...items.map((x) => x.mm || 0));
  $('hourly').innerHTML = items.map((x) => {
    const cat = wmo(x.code, x.isDay).cat;
    const prob = x.prob != null && x.prob >= 10 ? `${num(x.prob)} %` : '';
    return `<div class="hr${x.newDay ? ' new-day' : ''}"><span class="hr-t">${x.newDay ? dayShort(x.time) : x.label}</span><span class="hr-i cat-${cat}">${icon(cat)}</span><b class="hr-temp">${num(x.temp)}°</b><span class="hr-p">${prob}</span><span class="hr-mm" title="${num(x.mm, 1)} mm">${x.mm > 0.05 ? `<i style="height:${clamp((x.mm / maxMm) * 100, 12, 100)}%"></i>` : ''}</span></div>`;
  }).join('');
}

function renderAdvice(ctx) {
  const list = advice(ctx);
  show('advice-card', list.length > 0);
  $('advice').innerHTML = list.map((a) => `<li><span class="ico tint-violet">${icon(a.icon)}</span><span><b>${esc(a.title)}</b><i>${esc(a.text)}</i></span></li>`).join('');
}

function renderFeel(ctx) {
  const { c } = ctx;
  const feel = c.apparent_temperature;
  set('feel-val', num(feel, 1));
  set('feel-label', feelLabel(feel));
  set('feel-diff', `· ${signed(feel - c.temperature_2m)} °C par rapport au thermomètre`);
  set('chip-hum', `${num(c.relative_humidity_2m)} % humidité`);
  set('chip-wind', `${num(c.wind_speed_10m)} km/h vent`);
  $('gauge-dot').style.left = `${clamp((feel + 5) / 50, 0, 1) * 100}%`;
  set('chip-rad', `${num(c.shortwave_radiation)} W/m² soleil`);
  set('chip-dew', `${num(c.dew_point_2m, 1)} °C rosée · ${dewLabel(c.dew_point_2m)}`);
}

function renderRain(ctx, archive) {
  const { h, d, nowIdx, dayStart, today } = ctx;
  const sinceMidnight = dayStart >= 0 ? sum(h.precipitation.slice(dayStart + 1, nowIdx + 1)) : 0;
  const slotRain = h.precipitation[nowIdx + 1];
  set('rain-val', num(sinceMidnight, 1));
  set('rain-rate', `${num(slotRain || 0, 1)} mm/h cette heure`);
  const totals = rainTotals(archive, d, today, sinceMidnight);
  const fmt = (t, tolerance) => (t.missing > tolerance ? '--' : `${num(t.mm, t.mm < 100 ? 1 : 0)} mm`);
  set('rain-7d', fmt(totals.week, 1));
  set('rain-month', fmt(totals.month, 2));
  set('rain-year', fmt(totals.year, 5));
  set('rain-note', archive ? 'Mois et année : archive ERA5 complétée par la prévision, estimation de modèle.' : 'Mois et année indisponibles pour le moment (archive non reçue).');
  const days = [];
  for (let k = 6; k >= 0; k--) {
    const t = addDays(today, -k);
    days.push({ t, v: totals.byDay.get(t) || 0 });
  }
  const max = Math.max(...days.map((x) => x.v), 1);
  $('rain-bars').innerHTML = days.map((x, k) => `<div class="bar${k === days.length - 1 ? ' today' : ''}"><b>${x.v > 0 ? num(x.v, 1) : ''}</b><i class="${x.v > 0 ? '' : 'zero'}" style="height:${Math.max(3, (x.v / max) * 70)}%"></i><span>${dayShort(x.t)}</span></div>`).join('');
}

function renderWind(ctx) {
  const { h, c, dayStart, nowIdx } = ctx;
  const from6 = Math.max(0, nowIdx - 6);
  const ws = [...h.wind_speed_10m.slice(from6, nowIdx + 1), c.wind_speed_10m];
  const wg = [...h.wind_gusts_10m.slice(from6, nowIdx + 1), c.wind_gusts_10m];
  const wmax = Math.max(...wg, 10);
  set('wind-val', num(c.wind_speed_10m));
  set('wind-label', `Vent moyen · ${windLabel(c.wind_speed_10m).toLowerCase()}`);
  $('wind-arrow').style.transform = `rotate(${c.wind_direction_10m + 180}deg)`;
  $('wind-chart').innerHTML = `<path class="l-gust" d="${linePath(wg, 0, wmax)}"/><path class="l-wind" d="${linePath(ws, 0, wmax)}"/>`;
  set('wind-gust', `${num(c.wind_gusts_10m)} km/h`);
  set('wind-dir', `${compass(c.wind_direction_10m)} · ${num(c.wind_direction_10m)}°`);
  const dayGusts = dayStart >= 0 ? h.wind_gusts_10m.slice(dayStart, nowIdx + 1) : [];
  set('wind-max', `${num(Math.max(c.wind_gusts_10m, ...dayGusts))} km/h`);
}

function renderPressure(ctx) {
  const { h, c, nowIdx } = ctx;
  const from6 = Math.max(0, nowIdx - 6);
  const pr = [...h.pressure_msl.slice(from6, nowIdx + 1), c.pressure_msl];
  const pmin = Math.min(...pr), pmax = Math.max(...pr);
  const p3 = h.pressure_msl[nowIdx - 3];
  const dp = p3 == null ? null : c.pressure_msl - p3;
  set('pres-val', num(c.pressure_msl));
  set('pres-label', dp == null ? '--' : dp > 3 ? 'forte hausse' : dp > 1 ? 'légère hausse' : dp < -3 ? 'forte baisse' : dp < -1 ? 'légère baisse' : 'stable');
  set('pres-trend', dp == null ? '--' : `${dp >= 0 ? '↗' : '↘'} ${signed(dp)} hPa en 3 h`);
  const pad = Math.max(1, (pmax - pmin) * 0.2);
  const path = linePath(pr, pmin - pad, pmax + pad);
  $('pres-chart').innerHTML = `<path class="area" d="${path} L300 90 L0 90 Z"/><path class="l-pres" d="${path}"/>`;
  set('pres-6h', `${num(pr[0])} hPa`);
  set('pres-min', `${num(pmin)} hPa`);
  set('pres-max', `${num(pmax)} hPa`);
}

function renderSun(ctx) {
  const { d, h, c, todayIdx, nowIdx, today } = ctx;
  const sunrise = d.sunrise && todayIdx >= 0 ? d.sunrise[todayIdx] : null;
  const sunset = d.sunset && todayIdx >= 0 ? d.sunset[todayIdx] : null;
  show('sun-card', !!(sunrise && sunset));
  if (!sunrise || !sunset) return;
  set('sunrise', hourLabelMin(sunrise));
  set('sunset', hourLabelMin(sunset));
  set('daylight', d.daylight_duration ? fmtDuration(d.daylight_duration[todayIdx]) : '--');
  const p = sunProgress(sunrise, sunset, c.time);
  const arc = 'M20 100A130 85 0 0 1 280 100';
  let dot = '';
  if (p && p.isDay) {
    const a = Math.PI * (1 - clamp(p.value, 0, 1));
    dot = `<circle class="sun-dot" cx="${(150 + 130 * Math.cos(a)).toFixed(1)}" cy="${(100 - 85 * Math.sin(a)).toFixed(1)}" r="9"/>`;
  }
  $('sun-arc').innerHTML = `<path class="arc-bg" d="${arc}"/><path class="arc-fg" pathLength="100" stroke-dasharray="${p && p.isDay ? clamp(p.value, 0, 1) * 100 : p && p.value > 1 ? 100 : 0} 100" d="${arc}"/><path class="horizon" d="M8 100H292"/>${dot}`;
  const uvNow = h.uv_index ? h.uv_index[nowIdx] : null;
  const uvMax = d.uv_index_max ? d.uv_index_max[todayIdx] : null;
  set('uv-max', uvMax == null ? '--' : `${num(uvMax, 1)} · ${uvLabel(uvMax).toLowerCase()}`);
  set('uv-now', uvNow == null ? '--' : `${num(uvNow, 1)} · ${uvLabel(uvNow).toLowerCase()}`);
  const m = moonPhase(today);
  $('moon-ico').innerHTML = moonSvg(m.frac);
  set('moon-name', m.name);
  set('moon-pct', `${num(m.illum * 100)} % éclairée`);
}

const hourLabelMin = (s) => `${Number(s.slice(11, 13))} h ${s.slice(14, 16)}`;

const tempHue = (t) => Math.round(clamp(210 - ((t + 5) / 45) * 200, 10, 210));

function renderDays(ctx) {
  const { days, min, max } = dailyList(ctx);
  const span = Math.max(max - min, 1);
  $('days').innerHTML = days.map((x, k) => {
    const left = ((x.min - min) / span) * 100;
    const width = Math.max(((x.max - x.min) / span) * 100, 6);
    const name = k === 0 ? 'Auj.' : k === 1 ? 'Demain' : `${dayLong(x.iso).slice(0, 3)}. ${dayOfMonth(x.iso)}`;
    const cat = wmo(x.code).cat;
    const rain = (x.prob != null && x.prob >= 20 ? `<span>${num(x.prob)} %</span>` : '') + (x.mm >= 0.1 ? `<span>${num(x.mm, 1)} mm</span>` : '');
    return `<li class="day"><span class="d-name">${name}</span><span class="d-ico cat-${cat}" title="${esc(wmo(x.code).label)}">${icon(cat)}</span><span class="d-rain">${rain}</span><span class="d-min">${num(x.min)}°</span><span class="d-bar"><i style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;background:linear-gradient(90deg,hsl(${tempHue(x.min)} 70% 55%),hsl(${tempHue(x.max)} 75% 55%))"></i></span><span class="d-max">${num(x.max)}°</span></li>`;
  }).join('');
}

function renderRing(id, level) {
  const colors = ['#6fcf97', '#a8d86e', '#f2c94c', '#f2994a', '#eb5757', '#9b51e0'];
  const el = $(id);
  const C = 2 * Math.PI * 26;
  el.style.stroke = colors[level - 1];
  el.style.strokeDasharray = `${(level / 6) * C} ${C}`;
  el.style.strokeLinecap = 'round';
}

function renderAir(aq, place) {
  set('air-place', `Aujourd’hui · ${place}`);
  set('pol-place', `Aujourd’hui · ${place}`);
  const c = aq && aq.current;
  if (c && c.european_aqi != null) {
    const level = aqiLevel(c.european_aqi);
    set('air-num', level);
    set('air-label', AQI_NAMES[level - 1]);
    set('air-level', `Niveau ${level} sur 6 · indice ${num(c.european_aqi)}`);
    renderRing('air-ring', level);
    const rows = [['PM2,5', c.pm2_5], ['PM10', c.pm10], ['Dioxyde d’azote', c.nitrogen_dioxide], ['Ozone', c.ozone], ['Dioxyde de soufre', c.sulphur_dioxide]];
    $('air-detail').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${num(v, 1)} µg/m³</dd></div>`).join('');
  } else {
    set('air-num', '-');
    set('air-label', 'Indisponible');
    set('air-level', 'Données de qualité de l’air non reçues');
    $('air-detail').innerHTML = '';
  }
  const known = c ? POLLEN_SPECIES.map(([n, k]) => [n, c[k]]).filter(([, v]) => v != null) : [];
  if (known.length) {
    const max = Math.max(...known.map(([, v]) => v));
    const level = pollenLevel(max);
    set('pol-num', level);
    set('pol-label', POLLEN_NAMES[level - 1]);
    set('pol-level', `Niveau ${level} sur 6 · max ${num(max)} grains/m³`);
    renderRing('pol-ring', level);
    $('pol-detail').innerHTML = known.map(([n, v]) => `<div><dt>${n}</dt><dd>${num(v)} grains/m³</dd></div>`).join('');
  } else {
    set('pol-num', '-');
    set('pol-label', 'Indisponible');
    set('pol-level', 'Hors Europe ou hors saison');
    $('pol-detail').innerHTML = '';
  }
}

/* Point d'entree : data = { wx, aq, archive, place } */
export function renderAll(data) {
  const ctx = context(data.wx);
  renderHero(ctx, data.place);
  renderNowcast(data.wx);
  renderHourly(ctx);
  renderAdvice(ctx);
  renderFeel(ctx);
  renderRain(ctx, data.archive);
  renderWind(ctx);
  renderPressure(ctx);
  renderSun(ctx);
  renderDays(ctx);
  renderAir(data.aq, data.place);
  return ctx;
}
