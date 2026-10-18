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
 *
 * Con UNA excepción, al final del fichero: si detecta las cachés del service
 * worker anterior a la Fase 2 —que precacheaba rutas de `src/` y no sabe
 * servir este build— se activa sin esperar. Entre dos versiones que se
 * entienden, esperar es cortés; con una que ya está rota, es dejar a alguien
 * con la página a medias sin decírselo.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

/**
 * Parámetros que NO cambian qué documento se pide.
 *
 * Esto costó un fallo que solo se veía en la segunda visita, y en móvil.
 *
 * El botón GLOBE abría `aether-globe-v3.html?ctx=<marca de tiempo>`. Workbox
 * busca en el precache por URL exacta salvo los parámetros que se le digan, y
 * por defecto solo ignora `utm_*` y `fbclid`: con `?ctx=` no encontraba la
 * entrada, la navegación caía al respaldo y el respaldo servía `index.html`.
 * El usuario pulsaba GLOBE y aterrizaba en la portada, con la URL del globo en
 * la barra de direcciones.
 *
 * `source` e `icon` son del `start_url` del manifiesto
 * (`./index.html?source=pwa&icon=okrtv2`), así que la app instalada arrancaba
 * por el mismo camino de respaldo. Ahí daba igual —el respaldo ES index.html—
 * pero era suerte, no diseño.
 *
 * Se conservan los dos por defecto de Workbox, que no vienen incluidos al
 * pasar la opción.
 */
const PARAMETROS_IGNORABLES = [/^utm_/, /^fbclid$/, /^ctx$/, /^source$/, /^icon$/];

/** Lista inyectada por Vite: cada recurso del build con su revisión. */
precacheAndRoute(self.__WB_MANIFEST, {
  ignoreURLParametersMatching: PARAMETROS_IGNORABLES,
});
cleanupOutdatedCaches();

/** Las páginas que el sitio publica, cada una con su entrada en el precache. */
const PAGES = [
  'index.html', 'aether-globe-v3.html', 'aether-signal.html',
  'aether-vector.html', 'metodologia.html',
];

/**
 * El respaldo de navegación, acotado.
 *
 * `index.html` solo puede servir de respaldo para navegaciones que no sean
 * ninguna de las páginas conocidas. Antes la lista de excepciones se anclaba
 * con `$` —`/aether-globe-v3\.html$/`— y Workbox compara contra
 * `pathname + search`: en cuanto había un parámetro, la excepción dejaba de
 * aplicarse y la página se convertía en la portada.
 *
 * Ahora la excepción admite parámetros y están las CINCO páginas; antes
 * faltaba `metodologia.html`, que se libraba solo porque su URL sin
 * parámetros sí casa con el precache.
 */
registerRoute(new NavigationRoute(
  createHandlerBoundToURL('index.html'),
  {
    denylist: PAGES.map((p) => new RegExp(p.replace(/\./g, '\\.') + '(\\?|$)')),
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

/* ── La excepción: un predecesor incompatible ─────────────────────────────
 *
 * Esperar al «Recargar» es lo correcto entre dos versiones que se entienden.
 * No lo es cuando quien está sirviendo es el service worker ANTERIOR a la
 * Fase 2, porque ese no precacheaba el build: precacheaba rutas de `src/`,
 * que ya no existen, y servía CSS y datos con «caché primero». Un visitante
 * que vuelva se queda con una mezcla de las dos versiones hasta que a alguien
 * se le ocurra pulsar un aviso, y mientras tanto le fallan cosas sueltas sin
 * un solo error que lo explique: el botón GLOBE fue una de ellas.
 *
 * Se reconoce por sus cachés, que llevan una firma inconfundible:
 * `aether-v20261017-fcd0234a`. Workbox no las toca —`cleanupOutdatedCaches()`
 * solo limpia precachés suyos— así que además se quedaban ahí para siempre.
 *
 * Cuando aparece esa firma, este worker se activa SIN esperar y toma el
 * control de las pestañas abiertas. Es exactamente lo que el aviso evita en
 * el caso normal, y aquí es lo que hay que hacer: el código que está
 * sirviendo ya está roto.
 */
const FIRMA_HEREDADA = /^aether-v\d{8}-[0-9a-f]+$/;

/** Las cachés del service worker anterior a la Fase 2, si quedan. */
async function cachesHeredadas() {
  const claves = await caches.keys();
  return claves.filter((k) => FIRMA_HEREDADA.test(k));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const heredadas = await cachesHeredadas();
    if (heredadas.length) {
      console.warn('[AETHER SW] predecesor incompatible (' + heredadas.join(', ')
        + '): se fuerza la actualización sin esperar.');
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const heredadas = await cachesHeredadas();
    if (!heredadas.length) return;
    // Se borran: su contenido son rutas de `src/` que este build no sirve.
    await Promise.all(heredadas.map((k) => caches.delete(k)));
    // Y se toman las pestañas que estaba sirviendo el anterior.
    await self.clients.claim();
    console.warn('[AETHER SW] cachés heredadas borradas y control tomado.');
  })());
});
