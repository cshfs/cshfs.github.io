// coi-sw.js — COOP/COEP + cache for emulator assets.
// No client.navigate. Page handles a one-time reload.

const COOP = 'same-origin';
const COEP = 'require-corp';
const CACHE_NAME = 'dosbox-prewarm-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // same-origin only

  const wantsCache = url.pathname.includes('/emulators/');

  event.respondWith((async () => {
    const cache = wantsCache ? await caches.open(CACHE_NAME) : null;

    let resp = null;
    if (wantsCache && cache) resp = await cache.match(event.request);

    if (!resp) {
      resp = await fetch(event.request, { mode: 'same-origin', credentials: 'same-origin' });
      if (wantsCache && cache && event.request.method === 'GET' && resp.ok) {
        cache.put(event.request, resp.clone()).catch(() => {});
      }
    }

    const headers = new Headers(resp.headers);
    headers.set('Cross-Origin-Opener-Policy', COOP);
    headers.set('Cross-Origin-Embedder-Policy', COEP);

    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
  })());
});
