const CACHE_NAME = 'wealthflow-pro-v3';

// 1. Files to save immediately (Local files)
const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// Step 1: App Install hote hi in files ko offline memory me daal do
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('App Core Cached Successfully!');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Step 2: Purane kachre (Old caches) ko delete karo jab naya update aaye
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Step 3: THE OFFLINE SERVER ENGINE (Smart Fetch)
self.addEventListener('fetch', (event) => {
    // Sirf 'GET' requests ko intercept karo
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Agar internet chal raha hai, toh latest file download karo
                // Aur sath hi use chupke se Cache me save (Clone) kar lo agle offline use ke liye
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // 🚨 Agar INTERNET BAND HAI, toh crash hone ke bajaye Cache se file nikal kar de do!
                return caches.match(event.request);
            })
    );
});
