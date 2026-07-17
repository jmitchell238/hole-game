// Service worker: caches the whole game so it loads instantly and works
// offline once installed. Bump the version string whenever files change.
const CACHE = 'voidrush-v27';
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
  './js/save.js',
  './js/cosmetics.js',
  './js/hole.js',
  './js/levels/city.js',
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

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Network-first for navigations and sw-critical files; cache-first for everything else.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Network-first for navigations and sw-critical files
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request)));
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })));
});
