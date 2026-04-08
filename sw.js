const CACHE_NAME = 'wealthflow-v7-master';
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './manifest.json'
];

// Install Event: Skip waiting and force the new worker
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

// Activate Event: Clean up old caches immediately
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Take control of all open pages
});

// Fetch Event: Serve from cache, fallback to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        }).catch(() => {
            // Optional: Offline fallback page can be added here
        })
    );
});
