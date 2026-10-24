/* Mise en cache de l'application pour un lancement instantane et hors ligne.
   Les fichiers de l'application passent par le reseau d'abord (une mise a jour
   publiee est donc visible des l'ouverture suivante), le cache sert de secours.
   Les donnees meteo, le radar et les fonds de carte ne sont jamais interceptes ici :
   ils sont rechargés a chaque ouverture. */
const CACHE = 'meteo-shell-v2';
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/util.js', 'js/icons.js', 'js/api.js', 'js/analyze.js', 'js/astro.js', 'js/views.js', 'js/places.js', 'js/radar.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
