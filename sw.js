// Service worker: caches the whole game so it loads instantly and works
// offline once installed. Bump the version string whenever files change.
const CACHE = 'hole-royale-v6';
const ASSETS = [
  './',
  './index.html',
  './classic2d.html',
  './css/style.css',
  './js/vendor/three.min.js',
  './js/config.js',
  './js/engine.js',
  './js/props.js',
  './js/save.js',
  './js/cosmetics.js',
  './js/hole.js',
  './js/levels/city.js',
  './js/levels/island.js',
  './js/input.js',
  './js/rules.js',
  './js/hud.js',
  './js/main.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './art/Black_Cat_Transparent.png',
  './art/black_white_cat.png',
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

// Cache-first, falling back to the network (and caching what it fetches).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
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
