// coi-sw.js — COOP/COEP + navigation handling + precache + Brotli preference
// Works on GitHub Pages by re-serving pages with headers after SW takes control.

const COOP = 'same-origin';
const COEP = 'require-corp';
const CACHE_NAME = 'dosbox-prewarm-v8';

// Add your entry HTML explicitly so navigations can be served with headers.
const PRECACHE = [
  './',                 // the directory index
  'index.html',         // explicit index
  'js-dos.js',
  'js-dos.css',
  // Emulator
  'emulators/wdosbox.wasm',
  'emulators/wdosbox.js',
  // Tools
  'tools/TASM.EXE',
  'tools/TLINK.EXE',
  'tools/DPMI16BI.OVL',
  'tools/RTM.EXE',
  'tools/TD.EXE',
  'tools/TDCONFIG.TD',
  // Optional .br siblings if you generated them (leave commented if not present)
  // 'emulators/wdosbox.wasm.br',
  // 'emulators/wdosbox.js.br',
  // 'tools/TASM.EXE.br',
  // 'tools/TLINK.EXE.br',
  // 'tools/DPMI16BI.OVL.br',
  // 'tools/RTM.EXE.br',
  // 'tools/TD.EXE.br',
  // 'tools/TDCONFIG.TD.br',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(PRECACHE);
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    // Optional: navigation preload can help, but not required
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    await self.clients.claim();
  })());
});

// Prefer .br when available
const BR_MAP = {
  'emulators/wdosbox.wasm': 'emulators/wdosbox.wasm.br',
  'emulators/wdosbox.js':   'emulators/wdosbox.js.br',
  'tools/TASM.EXE':         'tools/TASM.EXE.br',
  'tools/TLINK.EXE':        'tools/TLINK.EXE.br',
  'tools/DPMI16BI.OVL':     'tools/DPMI16BI.OVL.br',
  'tools/RTM.EXE':          'tools/RTM.EXE.br',
  'tools/TD.EXE':           'tools/TD.EXE.br',
  'tools/TDCONFIG.TD':      'tools/TDCONFIG.TD.br',
};

function withHeaders(resp, extra = {}) {
  const headers = new Headers(resp.headers);
  headers.set('Cross-Origin-Opener-Policy', COOP);
  headers.set('Cross-Origin-Embedder-Policy', COEP);
  if (extra.contentType) headers.set('Content-Type', extra.contentType);
  if (extra.contentEncoding) headers.set('Content-Encoding', extra.contentEncoding);
  // Immutable cache headers help first-load perf
  if (!extra.noCacheControl) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

async function brOrNormal(cache, req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\//, '');
  const br = BR_MAP[path];
  if (br) {
    const brURL = new URL(url.origin + '/' + br);
    const brHit = await cache.match(brURL.href);
    if (brHit) {
      const ct = path.endsWith('.wasm') ? 'application/wasm'
               : path.endsWith('.js')   ? 'application/javascript'
               : (brHit.headers.get('Content-Type') || 'application/octet-stream');
      return withHeaders(brHit, { contentType: ct, contentEncoding: 'br' });
    }
  }
  const hit = await cache.match(req);
  if (hit) return withHeaders(hit);
  return null;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Handle top-level navigations (HTML) with headers applied
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // Network-first for HTML (so updates apply), with cache fallback
      try {
        const netResp = await fetch(req);
        if (netResp && netResp.ok) {
          cache.put(req, netResp.clone()).catch(()=>{});
          // Do NOT set immutable caching on HTML to allow updates
          return withHeaders(netResp, { noCacheControl: true, contentType: 'text/html; charset=utf-8' });
        }
      } catch {}
      // Fallback to cached index.html / './'
      const fallback = await cache.match('index.html') || await cache.match('./');
      if (fallback) return withHeaders(fallback, { noCacheControl: true, contentType: 'text/html; charset=utf-8' });
      // As last resort, fetch normally and add headers
      const resp = await fetch(req);
      return withHeaders(resp, { noCacheControl: true, contentType: 'text/html; charset=utf-8' });
    })());
    return;
  }

  // Non-navigation: cache-first, prefer .br when present
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await brOrNormal(cache, req);
    if (cached) return cached;

    let resp = await fetch(req).catch(()=>null);
    if (resp && resp.ok && req.method === 'GET') {
      cache.put(req, resp.clone()).catch(()=>{});
    }
    if (!resp) resp = new Response('Network error', { status: 502 });
    return withHeaders(resp);
  })());
});
