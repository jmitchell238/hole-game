// Service worker: caches the whole game so it loads instantly and works
// offline once installed. Bump with GAME_VERSION in js/config.js (MAJOR.MINOR.PATCH).
const CACHE = 'voidrush-2.39.003';
const ASSETS = [
  './',
  './index.html',
  './classic2d.html',
  './css/style.css',
  './js/vendor/three.min.js',
  './js/vendor/GLTFLoader.js',
  './js/config.js',
  './js/models.js',
  './js/engine.js',
  './js/props.js',
  './js/spatial.js',
  './js/save.js',
  './js/cosmetics.js',
  './js/hole.js',
  './js/levels/city.js',
  './js/levels/city-test.js',
  './js/levels/island.js',
  './js/levels/winter.js',
  './js/levels/desert.js',
  './js/levels/medieval.js',
  './js/input.js',
  './js/rules.js',
  './js/hud.js',
  './js/main.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './art/Black_Cat_Transparent.png',
  './art/fixed/black_white_cat.png',
  './art/fixed/fire.png',
  './art/fixed/ice.png',
  './art/fixed/lava.png',
  './art/fixed/lightening.png',
  './art/fixed/tornado.png',
  './art/fixed/black_hole.png',
  './art/fixed/dinosaure_green.png',
  './art/fixed/dog_one.png',
  './art/fixed/dog_blue_heeler_real.png',
  './art/fixed/whale_blue.png',
  './art/menu-bg.jpg',
  './art/icon-store.png',
  './art/icon-play.png',
  './art/icon-settings.png',
  // KayKit City Builder Bits models
  './art/models/citybits/citybits_texture.png',
  './art/models/citybits/bench.gltf',
  './art/models/citybits/bench.bin',
  './art/models/citybits/building_A.gltf',
  './art/models/citybits/building_A.bin',
  './art/models/citybits/building_B.gltf',
  './art/models/citybits/building_B.bin',
  './art/models/citybits/building_C.gltf',
  './art/models/citybits/building_C.bin',
  './art/models/citybits/building_D.gltf',
  './art/models/citybits/building_D.bin',
  './art/models/citybits/building_E.gltf',
  './art/models/citybits/building_E.bin',
  './art/models/citybits/building_F.gltf',
  './art/models/citybits/building_F.bin',
  './art/models/citybits/building_G.gltf',
  './art/models/citybits/building_G.bin',
  './art/models/citybits/building_H.gltf',
  './art/models/citybits/building_H.bin',
  './art/models/citybits/bush.gltf',
  './art/models/citybits/bush.bin',
  './art/models/citybits/car_hatchback.gltf',
  './art/models/citybits/car_hatchback.bin',
  './art/models/citybits/car_police.gltf',
  './art/models/citybits/car_police.bin',
  './art/models/citybits/car_sedan.gltf',
  './art/models/citybits/car_sedan.bin',
  './art/models/citybits/car_stationwagon.gltf',
  './art/models/citybits/car_stationwagon.bin',
  './art/models/citybits/car_taxi.gltf',
  './art/models/citybits/car_taxi.bin',
  './art/models/citybits/dumpster.gltf',
  './art/models/citybits/dumpster.bin',
  './art/models/citybits/firehydrant.gltf',
  './art/models/citybits/firehydrant.bin',
  './art/models/citybits/streetlight.gltf',
  './art/models/citybits/streetlight.bin',
  './art/models/citybits/trash_A.gltf',
  './art/models/citybits/trash_A.bin',
  './art/models/citybits/trash_B.gltf',
  './art/models/citybits/trash_B.bin',
  './art/models/citybits/watertower.gltf',
  './art/models/citybits/watertower.bin',
];

// Cache each URL individually so one missing/optional asset cannot abort
// the entire install (addAll is all-or-nothing and was blocking updates).
function precacheAll(cache) {
  return Promise.allSettled(
    ASSETS.map(url =>
      cache.add(url).catch(err => {
        console.warn('[sw] precache failed:', url, err);
      })));
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(precacheAll)
      .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Client can force activation of a waiting worker
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function sameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; }
  catch (_) { return false; }
}

function networkFirst(request) {
  return fetch(request).then(res => {
    if (res.ok && sameOrigin(request.url)) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
    }
    return res;
  }).catch(() => caches.match(request).then(hit => hit || Response.error()));
}

function cacheFirst(request) {
  return caches.match(request).then(hit => hit ||
    fetch(request).then(res => {
      if (res.ok && sameOrigin(request.url)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy));
      }
      return res;
    }));
}

// Game code + shell: network-first so updates apply without reinstall.
// Art/models/vendor: cache-first for offline/speed.
function isShellOrCode(url) {
  const path = new URL(url).pathname;
  if (path.endsWith('/sw.js')) return true;
  if (path.endsWith('.html') || path.endsWith('/')) return true;
  if (path.includes('/css/')) return true;
  if (path.includes('/js/') && !path.includes('/js/vendor/')) return true;
  if (path.endsWith('manifest.webmanifest')) return true;
  return false;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  if (e.request.mode === 'navigate' || isShellOrCode(e.request.url)) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  e.respondWith(cacheFirst(e.request));
});
