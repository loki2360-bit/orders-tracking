const CACHE_NAME = 'operator-app-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // Кэшируем иконки и шрифты, если они локальные. 
  // CDN шрифты могут не работать офлайн, если браузер не закешировал их ранее.
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// Установка Service Worker и кэширование файлов
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Активация и очистка старых кэшей
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Перехват запросов (стратегия: Cache First, fallback Network)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
