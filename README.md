# Météo locale

Application météo installable sur smartphone (PWA), sans compte ni clé d'accès.

## Ce qu'elle fait
- À chaque ouverture, demande la position du téléphone et recharge toutes les données. Elle se met aussi à jour au retour sur l'appli si la dernière mise à jour date de plus de 2 minutes.
- Position refusée : dernière position connue, puis position approximative par adresse IP.
- Plusieurs lieux : recherche de n'importe quelle ville, lieux enregistrés, retour à "Ma position" en un geste.
- Affiche :
  - synthèse du jour avec bulletin généré et point d'attention ;
  - pluie dans les 2 prochaines heures (pas de 15 minutes) ;
  - 36 prochaines heures (température, pluie, probabilité) et prévisions sur 10 jours ;
  - conseils du jour : parapluie, tenue, linge dehors, meilleur créneau pour une sortie sportive, UV ;
  - ressenti, pluie (7 jours, cumul mois et année), vent, pression, humidité, point de rosée, rayonnement ;
  - lever et coucher du soleil, durée du jour, indice UV, phase de la lune ;
  - radar de pluie animé (2 dernières heures) sur carte ;
  - qualité de l'air et pollens.
- Thème clair, sombre ou automatique (bouton en haut à droite).
- Fonctionne hors ligne avec les dernières données reçues.

## Sources de données
- Open-Meteo : prévisions, qualité de l'air (indice européen), pollens (Europe, en saison), archive ERA5 (cumuls), recherche de villes. Usage non commercial gratuit.
- RainViewer : images du radar de pluie. Le service fournit les 2 dernières heures, pas de prévision radar.
- BigDataCloud : nom de la commune à partir de la position.
- OpenStreetMap : fond de carte. Leaflet (licence BSD-2) est inclus dans `vendor/leaflet`.

Limites par rapport à une application avec station locale et données Météo-France / Atmo France :
- Les valeurs sont des estimations de modèles, pas des mesures de station.
- "Point d'attention" est une estimation d'après les prévisions, pas la vigilance officielle.
- Cumuls du mois et de l'année : archive ERA5 (environ 5 jours de retard) complétée par la prévision, donc approximatifs.
- Les niveaux de pollens sont une échelle indicative propre à l'application. Les conseils sont des règles simples, à titre indicatif.
- Si le service refuse certaines variables ou est saturé, l'application affiche ce qu'elle peut (version réduite) ou les dernières données en mémoire, avec un message.

## Mise en ligne
La géolocalisation d'un téléphone n'est autorisée que sur une adresse en `https`. Il faut donc publier le dossier `meteo-app` sur un hébergement statique (par exemple GitHub Pages, Netlify ou Cloudflare Pages), puis ouvrir l'adresse sur le téléphone.

## Installation sur le téléphone
- iPhone (Safari) : Partager, puis "Sur l'écran d'accueil".
- Android (Chrome) : menu, puis "Installer l'application" ou "Ajouter à l'écran d'accueil".

## Test sur ordinateur
Dans le dossier `meteo-app` : `python3 -m http.server 8765`, puis ouvrir `http://localhost:8765`.
Tests automatiques des calculs (lune, cumuls de pluie, pluie dans l'heure, conseils...) : `npm test` (Node 20 ou plus récent, aucune installation nécessaire).

## Organisation du code
- `index.html`, `style.css` : page et mise en forme.
- `js/main.js` : orchestration (chargement à chaque ouverture, cache, thème).
- `js/api.js` : accès réseau. `js/analyze.js`, `js/astro.js` : calculs. `js/views.js` : affichage. `js/places.js` : lieux. `js/radar.js` : carte radar.
- `sw.js`, `manifest.webmanifest` : installation et mode hors ligne.
