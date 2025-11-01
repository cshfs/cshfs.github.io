// coi-sw.js — Service Worker to enable crossOriginIsolated on static hosting.
// Adds COOP/COEP to same-origin responses. Reloads controlled pages once on activate.

const COOP = 'same-origin';
const COEP = 'require-corp';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim().then(async () => {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const c of clients) c.navigate(c.url); // one-time reload
  }));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const resp = await fetch(event.request, { mode: 'same-origin', credentials: 'same-origin' });
    const headers = new Headers(resp.headers);
    headers.set('Cross-Origin-Opener-Policy', COOP);
    headers.set('Cross-Origin-Embedder-Policy', COEP);
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
  })());
});
