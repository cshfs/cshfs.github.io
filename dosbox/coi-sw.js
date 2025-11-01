// coi-sw.js — COOP/COEP + cache support for emulator assets.
// - Adds COOP/COEP on every same-origin response
// - Serves /emulators/* from Cache Storage if present (prefetched)
// - Populates cache on first fetch fallback

const COOP = 'same-origin';
const COEP = 'require-corp';
const CACHE_NAME = 'dosbox-prewarm-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim().then(async () => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const c of clients) c.navigate(c.url); // one-time reload
  }));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // only same-origin

  const wantsCache = url.pathname.includes('/emulators/');

  event.respondWith((async () => {
    const cache = wantsCache ? await caches.open(CACHE_NAME) : null;

    // Try cache first for emulator files.
    let resp = null;
    if (wantsCache && cache) {
      resp = await cache.match(event.request);
    }

    // Network if not in cache.
    if (!resp) {
      resp = await fetch(event.request, { mode: 'same-origin', credentials: 'same-origin' });
      // Populate cache for emulator assets on successful GET.
      if (wantsCache && cache && event.request.method === 'GET' && resp.ok) {
        // Put a clone, since we will stream the body to the client.
        cache.put(event.request, resp.clone()).catch(() => {});
      }
    }

    // Inject COOP/COEP headers.
    const headers = new Headers(resp.headers);
    headers.set('Cross-Origin-Opener-Policy', COOP);
    headers.set('Cross-Origin-Embedder-Policy', COEP);

    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
  })());
});
