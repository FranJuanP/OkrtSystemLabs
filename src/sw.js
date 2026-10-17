/**
 * AETHER · service worker (T18)
 *
 * Workbox `injectManifest`: Vite inyecta en `self.__WB_MANIFEST` la lista de
 * todo lo que produce el build, cada entrada con su revisión. Eso resuelve el
 * problema que arrastraba el service worker anterior: precacheaba rutas de
 * `src/`, que en el build no existen porque Vite las empaqueta con nombres
 * con hash, así que offline fallaba al resolver el primer import.
 *
 * Qué se precachea: HTML, JS, CSS, imágenes, tipografías y texturas. Todo lo
 * que el build emite, sin listas escritas a mano que se queden atrás.
 *
 * Actualizaciones: NO hay `skipWaiting()` automático. Un service worker que
 * se activa solo puede cambiarle el código a alguien a mitad de uso. Este se
 * queda esperando y avisa a la página, que muestra «Nueva versión disponible
 * · Recargar»; solo al pulsar se le manda SKIP_WAITING.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

/** Lista inyectada por Vite: cada recurso del build con su revisión. */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/** Las cuatro páginas son navegaciones; se sirven del precache. */
const PAGES = ['index.html', 'aether-globe-v3.html', 'aether-signal.html', 'aether-vector.html'];
registerRoute(new NavigationRoute(
  createHandlerBoundToURL('index.html'),
  {
    // Cada página tiene su propia entrada; solo se usa index como respaldo
    // de navegaciones que no correspondan a ninguna.
    denylist: PAGES.map((p) => new RegExp(p.replace('.', '\\.') + '$')),
  },
));

/**
 * Las cuatro fuentes de datos de Signal: red primero, con caída explícita a
 * la última respuesta guardada.
 *
 * El matiz importante, y que costó ver: si el service worker devuelve lo que
 * tiene en caché, la página no puede distinguirlo de una respuesta recién
 * traída, porque a nivel de `fetch` son idénticas. Signal pintaría datos
 * viejos con el punto de la fuente en verde, que es exactamente lo que T1
 * quitó. Para que no pase, la respuesta servida de caché se devuelve con dos
 * cabeceras propias, y el motor de Signal las mira para marcar esas señales
 * como última lectura.
 *
 * El `timeoutSeconds` también importa: sin él, una red que acepta la
 * conexión pero no responde deja la página esperando en vez de usar lo que
 * ya tiene.
 */
const FUENTES = /^(earthquake\.usgs\.gov|eonet\.gsfc\.nasa\.gov|api\.reliefweb\.int|api\.gdeltproject\.org|api\.worldbank\.org)$/;
const CACHE_FUENTES = 'aether-fuentes';
const TIMEOUT_FUENTES_MS = 4000;

/** Copia una respuesta añadiéndole las cabeceras que la marcan como caché. */
async function marcarComoCache(response, fechaGuardado) {
  const headers = new Headers(response.headers);
  headers.set('X-AETHER-Cache', 'hit');
  if (fechaGuardado) headers.set('X-AETHER-Cached-At', fechaGuardado);
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

registerRoute(
  ({ url }) => FUENTES.test(url.hostname),
  async ({ request }) => {
    const cache = await caches.open(CACHE_FUENTES);

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), TIMEOUT_FUENTES_MS);
      const fresh = await fetch(request, { signal: controller.signal });
      clearTimeout(t);
      if (fresh && fresh.ok) {
        // Se guarda con la fecha, para poder decir luego de cuándo es.
        const headers = new Headers(fresh.headers);
        headers.set('X-AETHER-Cached-At', new Date().toISOString());
        const guardable = new Response(await fresh.clone().blob(), {
          status: fresh.status, statusText: fresh.statusText, headers,
        });
        await cache.put(request, guardable);
        return fresh;
      }
      throw new Error('respuesta no utilizable: ' + (fresh && fresh.status));
    } catch (err) {
      const cached = await cache.match(request);
      if (cached) return marcarComoCache(cached, cached.headers.get('X-AETHER-Cached-At'));
      // Sin red y sin copia: que la página lo vea como un fallo, no como
      // una respuesta vacía que parecería un feed sin eventos.
      return Response.error();
    }
  },
);

/** Datos propios (data/*.json, que trae la Fase 3): red primero. */
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
  new NetworkFirst({
    cacheName: 'aether-datos',
    networkTimeoutSeconds: 6,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

/**
 * Texturas del globo e imágenes grandes. Son estables y pesan: cache
 * primero, y que no caduquen por tiempo sino por número.
 */
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
  new CacheFirst({
    cacheName: 'aether-imagenes',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 400, purgeOnQuotaError: true }),
    ],
  }),
);

/** Tipografías: cache primero, son inmutables. */
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
  new CacheFirst({
    cacheName: 'aether-fuentes-tipograficas',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 40 }),
    ],
  }),
);

/** Cualquier otra cosa del propio origen que no esté precacheada. */
registerRoute(
  ({ sameOrigin, request }) => sameOrigin && ['style', 'script', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'aether-otros' }),
);

/**
 * Activación controlada por la página. Hasta que el usuario pulse
 * «Recargar», este service worker se queda en espera y el anterior sigue
 * sirviendo: nadie se queda a medias con dos versiones mezcladas.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
