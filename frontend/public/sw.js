// ==========================================================================
//  FATHOM — Service Worker (PWA offline + caching)
// ==========================================================================

const CACHE_NAME = 'fathom-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// Install — cache shell
self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
    );
    self.clients.claim();
});

// Fetch — network-first for API, cache-first for static assets
self.addEventListener('fetch', (e) => {
    const { request } = e;
    const url = new URL(request.url);

    // Skip non-GET and cross-origin
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    // API calls: network-first (don't cache stale monitoring data)
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(fetch(request).catch(() => caches.match(request)));
        return;
    }

    // Static assets: stale-while-revalidate
    e.respondWith(
        caches.match(request).then((cached) => {
            const fetched = fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || fetched;
        }),
    );
});
