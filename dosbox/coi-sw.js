// coi-sw.js — COOP/COEP + navigation handling + Brotli preference (GitHub Pages)
// v10

const COOP = 'same-origin';
const COEP = 'require-corp';
const CACHE_NAME = 'dosbox-prewarm-v11';

const PRECACHE = [
  // HTML / entry (serve with COOP/COEP, no long cache)
  './',
  'index.html',

  // Local editor libs if you self-hosted CodeMirror
  'codemirror.min.css',
  'codemirror.min.js',
  'gas.min.js',

  // js-dos bundle
  'js-dos.js',
  'js-dos.css',

  // Emulator core
  'emulators/wdosbox.wasm',
  'emulators/wdosbox.js',

  // Tools
  'tools/TASM.EXE',
  'tools/TLINK.EXE',
  'tools/DPMI16BI.OVL',
  'tools/RTM.EXE',
  'tools/TD.EXE',
  'tools/TDCONFIG.TD',

  // OPTIONAL: Brotli siblings — include only the ones you actually uploaded
  // (keep originals above too)
  'emulators/wdosbox.wasm.br',
  'emulators/wdosbox.js.br',
  'tools/TASM.EXE.br',
  'tools/TLINK.EXE.br',
  'tools/DPMI16BI.OVL.br',
  'tools/RTM.EXE.br',
  'tools/TD.EXE.br',
  'tools/TDCONFIG.TD.br',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(PRECACHE); } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    await self.clients.claim();
  })());
});

// Map “original path -> .br path” so we can prefer Brotli when present.
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

function withHeaders(resp, {contentType, contentEncoding, noCacheControl} = {}) {
  const h = new Headers(resp.headers);
  h.set('Cross-Origin-Opener-Policy', COOP);
  h.set('Cross-Origin-Embedder-Policy', COEP);
  if (contentType) h.set('Content-Type', contentType);
  if (contentEncoding) h.set('Content-Encoding', contentEncoding);
  if (!noCacheControl) h.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(resp.body, {status: resp.status, statusText: resp.statusText, headers: h});
}

async function matchBrOrNormal(cache, req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\//, '');
  const br = BR_MAP[path];

  // Prefer .br when we have it cached
  if (br) {
    const brURL = new URL(url.origin + '/' + br);
    const brHit = await cache.match(brURL.href);
    if (brHit) {
      const ct =
        path.endsWith('.wasm') ? 'application/wasm' :
        path.endsWith('.js')   ? 'application/javascript' :
        path.endsWith('.css')  ? 'text/css; charset=utf-8' :
        'application/octet-stream';
      return withHeaders(brHit, {contentType: ct, contentEncoding: 'br'});
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

  // 1) Navigations (HTML): network-first so updates show; always add COOP/COEP; no long cache.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const net = await fetch(req);
        if (net && net.ok) {
          cache.put(req, net.clone()).catch(()=>{});
          return withHeaders(net, { noCacheControl: true, contentType: 'text/html; charset=utf-8' });
        }
      } catch {}
      const fallback = await cache.match('index.html') || await cache.match('./');
      if (fallback) return withHeaders(fallback, { noCacheControl: true, contentType: 'text/html; charset=utf-8' });
      const resp = await fetch(req);
      return withHeaders(resp, { noCacheControl: true, contentType: 'text/html; charset=utf-8' });
    })());
    return;
  }

  // 2) Static assets: cache-first; prefer .br when available; add COOP/COEP + long cache.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await matchBrOrNormal(cache, req);
    if (cached) return cached;

    // Miss: fetch normal, cache, serve with headers.
    let resp = await fetch(req).catch(()=>null);
    if (resp && resp.ok && req.method === 'GET') {
      cache.put(req, resp.clone()).catch(()=>{});
    }
    if (!resp) resp = new Response('Network error', { status: 502 });
    // Guess content-type for a few common types (optional)
    const path = url.pathname;
    const ct =
      path.endsWith('.wasm') ? 'application/wasm' :
      path.endsWith('.js')   ? 'application/javascript' :
      path.endsWith('.css')  ? 'text/css; charset=utf-8' :
      undefined;
    return withHeaders(resp, { contentType: ct });
  })());
});
