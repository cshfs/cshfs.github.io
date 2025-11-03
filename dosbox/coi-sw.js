// coi-sw.js — COOP/COEP + install-time precache + Brotli (.br) preference + immutable caching
// Designed for GitHub Pages (no server headers needed).

const COOP = 'same-origin';
const COEP = 'require-corp';

// Bump this when assets change to bust cache:
const CACHE_NAME = 'dosbox-prewarm-v6';

// Files to precache at install
const PRECACHE = [
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

  // Optional Brotli siblings (place next to originals if you generate them)
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
    try { await cache.addAll(PRECACHE); } catch {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Prefer .br when available in cache
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

function setCommonHeaders(headers) {
  headers.set('Cross-Origin-Opener-Policy', COOP);
  headers.set('Cross-Origin-Embedder-Policy', COEP);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
}

async function matchBest(cache, req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\//, '');

  const br = BR_MAP[path];
  if (br) {
    const brURL = new URL(url.origin + '/' + br);
    const brHit = await cache.match(brURL.href);
    if (brHit) {
      const headers = new Headers(brHit.headers);
      headers.set('Content-Encoding', 'br');
      if (path.endsWith('.wasm')) headers.set('Content-Type','application/wasm');
      else if (path.endsWith('.js')) headers.set('Content-Type','application/javascript');
      else headers.set('Content-Type', headers.get('Content-Type') || 'application/octet-stream');
      setCommonHeaders(headers);
      return new Response(brHit.body, { status: brHit.status, statusText: brHit.statusText, headers });
    }
  }

  const hit = await cache.match(req);
  if (hit) {
    const headers = new Headers(hit.headers);
    setCommonHeaders(headers);
    return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 1) Cache first (prefer .br)
    const cached = await matchBest(cache, event.request);
    if (cached) return cached;

    // 2) Network, then cache
    let resp = await fetch(event.request, { mode: 'same-origin', credentials: 'same-origin' });
    if (resp && resp.ok && event.request.method === 'GET') {
      cache.put(event.request, resp.clone()).catch(()=>{});
    }

    const headers = new Headers(resp.headers);
    setCommonHeaders(headers);
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
  })());
});
