const AETHER_CACHE = 'aether-pwa-okrt-icon-v2';
const AETHER_ASSETS = [
  "./",
  "./index.html",
  "./aether-globe-v3.html",
  "./aether-signal.html",
  "./aether-vector.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./assets/icons/icon-okrt-512-maskable-v2.png",
  "./assets/icons/icon-okrt-512-v2.png",
  "./assets/icons/icon-okrt-192-v2.png",
  "./apple-touch-icon-precomposed.png",
  "./apple-touch-icon.png",
  "./apple-touch-icon-okrt-v2.png",
  "./assets/css/aether-globe-v3.inline1.css",
  "./assets/css/aether-globe-v3.inline2.css",
  "./assets/css/aether-globe-v3.inline3.css",
  "./assets/css/aether-signal.inline1.css",
  "./assets/css/aether-vector.inline1.css",
  "./assets/css/aether.css",
  "./assets/css/diagnostic-mode.css",
  "./assets/css/globe-functional-boost.css",
  "./assets/css/globe-hardening.css",
  "./assets/css/globe-mobile-hotspots-off.css",
  "./assets/css/index.inline1.css",
  "./assets/css/index.inline2.css",
  "./assets/css/index.inline3.css",
  "./assets/css/index.inline4.css",
  "./assets/css/landing.css",
  "./assets/css/mobile-responsive.css",
  "./assets/css/router.css",
  "./assets/css/usability-fix.css",
  "./assets/css/vector-functional-boost.css",
  "./assets/js/aether-dom-guard.js",
  "./assets/js/aether-globe-v3.inline1.js",
  "./assets/js/aether-globe-v3.inline2.js",
  "./assets/js/aether-globe-v3.inline3.js",
  "./assets/js/aether-runtime-throttle.js",
  "./assets/js/aether-signal.inline1.js",
  "./assets/js/aether-signal.inline2.js",
  "./assets/js/aether-storage-contract.js",
  "./assets/js/aether-vector.inline1.js",
  "./assets/js/app-aux.js",
  "./assets/js/app-config.js",
  "./assets/js/app-core.js",
  "./assets/js/app-dom.js",
  "./assets/js/app-enhancements.js",
  "./assets/js/app-robustness.js",
  "./assets/js/app-router-legacy.js",
  "./assets/js/app-shell-bindings.js",
  "./assets/js/app-shell-config.js",
  "./assets/js/app-shell-diagnostics.js",
  "./assets/js/app-shell-errors.js",
  "./assets/js/app-shell-health.js",
  "./assets/js/app-shell-hooks.js",
  "./assets/js/app-shell-overlays.js",
  "./assets/js/app-shell-panels.js",
  "./assets/js/app-shell-session.js",
  "./assets/js/app-shell-telemetry.js",
  "./assets/js/app-shell-ui.js",
  "./assets/js/background-throttle.js",
  "./assets/js/dependency-resilience.js",
  "./assets/js/diagnostic-mode.js",
  "./assets/js/diagnostic-mode.v1121.js",
  "./assets/js/diagnostic-mode.v113.js",
  "./assets/js/diagnostic-mode.v114.js",
  "./assets/js/dom-safety-layer.js",
  "./assets/js/globe-bridge.js",
  "./assets/js/globe-functional-boost.js",
  "./assets/js/globe-module-hardening.js",
  "./assets/js/globe-touch-patch.js",
  "./assets/js/index.inline1.js",
  "./assets/js/index.inline2.js",
  "./assets/js/index.inline3.js",
  "./assets/js/index.inline4.js",
  "./assets/js/inline-handlers-migration-1.js",
  "./assets/js/launch-fix.js",
  "./assets/js/mobile-viewport-fix.js",
  "./assets/js/module-handlers-migration-2.js",
  "./assets/js/okrt-flags-data.js",
  "./assets/js/pwa-register.js",
  "./assets/js/runtime-guard.js",
  "./assets/js/security-hardening.js",
  "./assets/js/signal-feed-boost.js",
  "./assets/js/storage-contract.js",
  "./assets/js/vector-functional-boost.js",
  "./assets/img/earth-clouds.png",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(AETHER_CACHE)
      .then(cache => cache.addAll(AETHER_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== AETHER_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(AETHER_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match(req)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(AETHER_CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
