// Minimal COOP/COEP service worker to enable crossOriginIsolated on static hosts.
// 1) Responds to all top-level and worker requests with COOP/COEP
// 2) Claims clients immediately and forces a one-time reload on first install
// Source pattern: WICG coi-serviceworker (trimmed and inlined for single-file use)

const COOP = 'same-origin';
const COEP = 'require-corp';

self.addEventListener('install', (e) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Become the controller for existing clients
  e.waitUntil(self.clients.claim().then(async () => {
    const allClients = await self.clients.matchAll({ includeUncontrolled: true });
    for (const client of allClients) {
      // Trigger a one-time reload so the page is controlled and crossOriginIsolated can apply
      client.navigate(client.url);
    }
  }));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;

  // Only modify same-origin requests we can handle
  if (new URL(r.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const resp = await fetch(r, { mode: 'same-origin', credentials: 'same-origin' });
    // Clone and set headers needed for SAB/threads
    const newHeaders = new Headers(resp.headers);
    newHeaders.set('Cross-Origin-Opener-Policy', COOP);
    newHeaders.set('Cross-Origin-Embedder-Policy', COEP);

    // Allow common static types to be embedded with CORP same-origin by default assets
    // Static GitHub Pages assets are same-origin, so this is sufficient.

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: newHeaders
    });
  })());
});
