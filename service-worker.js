const CACHE_NAME = 'orders-tracking-v1';
const urlsToCache = [
  '/orders-tracking/',
  '/orders-tracking/index.html',
  '/orders-tracking/manifest.json',
  '/orders-tracking/script.js',
  '/orders-tracking/style.css',
  '/orders-tracking/icon-192.png',
  '/orders-tracking/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
