/**
 * AETHER · service worker
 *
 * GENERADO POR tools/build-sw.mjs — no editar a mano.
 * Para regenerarlo: npm run build:sw
 *
 * Estrategias (T11):
 *   - HTML y JS: red primero, con caida a cache. Asi un despliegue nuevo se
 *     ve en la primera carga con red, y offline se sigue abriendo.
 *   - CSS, imagenes, fuentes y datos: cache primero. Son estables y lo que
 *     importa es que la pagina pinte rapido.
 *   - Solo se guarda en cache lo que responde ok. Antes se cacheaba cualquier
 *     status 200 y, en el camino de navegacion, incluso respuestas de error,
 *     que quedaban fijadas hasta el siguiente despliegue.
 *   - El nombre de cache lleva fecha y hash del contenido, de modo que al
 *     activarse una version nueva se borran las anteriores.
 *
 * La Fase 2 (T18) lo sustituye por Workbox injectManifest, con precache por
 * revision de build y aviso de "Nueva version disponible" en vez de
 * skipWaiting automatico.
 */
const AETHER_CACHE = 'aether-v20261017-63eed361';

const AETHER_ASSETS = [
  "./",
  "./aether-globe-v3.html",
  "./aether-signal.html",
  "./aether-vector.html",
  "./apple-touch-icon-okrt-v2.png",
  "./apple-touch-icon-precomposed.png",
  "./apple-touch-icon.png",
  "./assets/css/aether.css",
  "./assets/css/globe-functional-boost.css",
  "./assets/css/globe-hardening.css",
  "./assets/css/globe-mobile-hotspots-off.css",
  "./assets/css/globe-tablet-portrait-cleanup.css",
  "./assets/css/landing.css",
  "./assets/css/mobile-responsive.css",
  "./assets/css/router.css",
  "./assets/css/signal-mobile-fix.css",
  "./assets/css/usability-fix.css",
  "./assets/css/vector-functional-boost.css",
  "./assets/css/vector-mobile-fix.css",
  "./assets/icons/apple-touch-icon-okrt-v2.png",
  "./assets/icons/icon-okrt-192-v2.png",
  "./assets/icons/icon-okrt-512-maskable-v2.png",
  "./assets/icons/icon-okrt-512-v2.png",
  "./assets/img/earth-clouds.png",
  "./favicon.ico",
  "./index.html",
  "./manifest.webmanifest",
  "./src/core/coverage.js",
  "./src/core/dependency-resilience.js",
  "./src/core/domain-notice.js",
  "./src/core/escape.js",
  "./src/core/frame-buster.js",
  "./src/core/mobile-viewport-fix.js",
  "./src/core/pwa-register.js",
  "./src/core/storage.js",
  "./src/core/visibility.js",
  "./src/dashboard/app-aux.js",
  "./src/dashboard/app-dom.js",
  "./src/dashboard/app-enhancements.js",
  "./src/dashboard/app-robustness.js",
  "./src/dashboard/app-router-legacy.js",
  "./src/dashboard/app-shell-bindings.js",
  "./src/dashboard/app-shell-config.js",
  "./src/dashboard/app-shell-diagnostics.js",
  "./src/dashboard/app-shell-errors.js",
  "./src/dashboard/app-shell-health.js",
  "./src/dashboard/app-shell-panels.js",
  "./src/dashboard/app-shell-session.js",
  "./src/dashboard/app-shell-telemetry.js",
  "./src/dashboard/engine.js",
  "./src/dashboard/globe-bridge.js",
  "./src/dashboard/okrt-flags-data.js",
  "./src/dashboard/runtime-guard.js",
  "./src/dashboard/shell-state.js",
  "./src/globe/engine.js",
  "./src/globe/functional-boost.js",
  "./src/globe/touch.js",
  "./src/pages/globe.js",
  "./src/pages/index.js",
  "./src/pages/signal.js",
  "./src/pages/vector.js",
  "./src/signal/engine.js",
  "./src/signal/feed-boost.js",
  "./src/signal/mobile-fix.js",
  "./src/vector/engine.js",
  "./src/vector/functional-boost.js",
  "./src/vector/mobile-fix.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(AETHER_CACHE);
    // Una a una: si un recurso falla, no se lleva por delante toda la
    // instalacion, como ocurria con cache.addAll.
    await Promise.all(AETHER_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await cache.put(url, res);
      } catch (err) { /* recurso no disponible en la instalacion */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== AETHER_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** Guarda en cache solo respuestas correctas. */
async function cachePut(request, response) {
  if (!response || !response.ok) return;
  if (response.type === 'opaque') return;
  try {
    const cache = await caches.open(AETHER_CACHE);
    await cache.put(request, response.clone());
  } catch (err) { /* cuota llena */ }
}

/** Red primero, con caida a cache. Para HTML y JS. */
async function networkFirst(request, fallbackUrl) {
  try {
    const fresh = await fetch(request);
    await cachePut(request, fresh);
    if (fresh && fresh.ok) return fresh;
    const cached = await caches.match(request);
    return cached || fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fb = await caches.match(fallbackUrl);
      if (fb) return fb;
    }
    return new Response('Sin conexión y sin copia en caché.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Cache primero. Para CSS, imagenes, fuentes y datos. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    await cachePut(request, fresh);
    return fresh;
  } catch (err) {
    return new Response('', { status: 504 });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // nada de terceros

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
    return;
  }
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs')) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
