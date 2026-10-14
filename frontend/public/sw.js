// ==========================================================================
//  PulseDB — Service Worker (PWA offline + caching)
// ==========================================================================
//
//  Pages (index.html / SPA routes) are NETWORK-FIRST. They used to be served
//  stale-while-revalidate, so after every deploy the first visit got the old
//  index.html, which points at the old hashed bundles, and new features only
//  showed up on a later visit. The cache is now only the offline fallback.
//
//  Hashed build assets (/assets/*-<hash>.js|css) never change content, so
//  they are cache-first. Anything else static is stale-while-revalidate.
//  Bump CACHE_NAME to purge caches written by older workers.

const CACHE_NAME = 'pulsedb-v3';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// Install — cache the shell for offline use
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

const putInCache = (request, response) => {
    if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return response;
};

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

    // Pages: network-first so a new deploy is visible on the next load;
    // offline falls back to the cached shell.
    if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
        e.respondWith(
            fetch(request)
                .then((response) => putInCache(request, response))
                .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html'))),
        );
        return;
    }

    // Hashed build assets: immutable, cache-first.
    if (url.pathname.startsWith('/assets/')) {
        e.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((r) => putInCache(request, r))));
        return;
    }

    // Other static files: stale-while-revalidate
    e.respondWith(
        caches.match(request).then((cached) => {
            const fetched = fetch(request)
                .then((response) => putInCache(request, response))
                .catch(() => cached);
            return cached || fetched;
        }),
    );
});
