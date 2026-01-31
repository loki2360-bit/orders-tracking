const CACHE_NAME = 'orders-app-v2';
const urlsToCache = [
  '/orders-tracking/',
  '/orders-tracking/index.html',
  '/orders-tracking/style.css',
  '/orders-tracking/script.js',
  '/orders-tracking/manifest.json',
  '/orders-tracking/icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
