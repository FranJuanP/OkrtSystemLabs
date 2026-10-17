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

/* El service worker ya NO intercepta las peticiones a otros origenes.

   Interceptarlas tenia un coste que no compensaba: cuando la fuente responde
   410, 429 o 403, este manejador lo trataba como un fallo y devolvia
   Response.error(). Desde la pagina eso es indistinguible de una caida de
   red -Chrome ademas lo redacta como un bloqueo de CORS-, de modo que la
   interfaz no podia decir "ReliefWeb ha retirado su API" ni "GDELT ha
   limitado las consultas": solo podia decir "sin conexion".

   Dejandolas pasar, la pagina recibe la respuesta real y puede leer el
   codigo de estado cuando la fuente envia cabeceras de CORS, que es lo que
   permite distinguir un limite de consultas de una caida.

   Lo que se pierde: la copia en cache de las respuestas de las fuentes. A
   cambio, Signal guarda su ultima lectura en localStorage y marca esas
   senales como tales, que es lo que ya hacia.

   Las peticiones al propio origen se siguen sirviendo del precache, asi que
   el sitio funciona offline igual que antes. */

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
