/**
 * AETHER · INTERRUPTOR DE APAGADO DEL SERVICE WORKER ANTIGUO
 *
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║  NO BORRAR ESTE FICHERO. Tiene que seguir publicado durante MESES.     ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 *
 * Qué pasó
 * --------
 * Hasta la Fase 2, el sitio registraba su service worker en esta ruta,
 * `service-worker.js`. La Fase 2 lo sustituyó por `sw.js` (Workbox,
 * injectManifest) y este fichero dejó de publicarse.
 *
 * Eso dejó atrapados a los navegadores que ya habían visitado el sitio. Un
 * service worker registrado NO desaparece porque su fichero deje de existir:
 * el navegador comprueba si hay versión nueva, recibe un 404, da la
 * comprobación por fallida y **sigue usando el que tiene**. Para siempre.
 *
 * Y el que tenían servía CSS y datos con «caché primero», así que esos
 * visitantes veían el sitio actual sin estilos y con el fichero de datos de
 * antes: el globo decía «201 PAÍSES» cuando hoy son 217. En un iPhone, sin
 * forma de vaciar la caché de un sitio sin borrar la del navegador entero.
 *
 * La detección de cachés heredadas que lleva `sw.js` no servía de nada aquí,
 * porque para detectar algo hay que llegar a instalarse, y `sw.js` no llegaba:
 * el HTML antiguo que servía el worker antiguo carga `/src/...`, que este
 * build ya no publica, así que el módulo que registra `sw.js` no se ejecutaba
 * nunca.
 *
 * Qué hace
 * --------
 * Volver a publicar ESTA ruta con un worker que solo sabe retirarse:
 *
 *   1. `install` → `skipWaiting()`, para no esperar a nada.
 *   2. `activate` → borra TODAS las cachés de este origen, se da de baja con
 *      `registration.unregister()` y recarga las ventanas abiertas.
 *   3. **No tiene manejador de `fetch`.** Mientras está activo, todo pasa
 *      directo a la red: ni una respuesta vieja más.
 *
 * Tras la recarga no queda ningún worker controlando. La página llega de la
 * red, ya con el build actual, y es ella la que registra `sw.js`.
 *
 * Por qué no se puede borrar
 * --------------------------
 * Un navegador que no vuelva a abrir el sitio hasta dentro de seis meses
 * seguirá teniendo el registro antiguo apuntando aquí. Si para entonces esto
 * no existe, vuelve a quedarse atrapado exactamente igual. El fichero pesa
 * menos de 2 KB y es la única salida para esos visitantes.
 */

self.addEventListener('install', () => {
  // Sin esperar: el worker al que sustituye está sirviendo páginas rotas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. Todas las cachés de este origen, sin mirar el nombre. Las de este
    //    worker y las que hubiera dejado cualquier versión anterior.
    try {
      const claves = await caches.keys();
      await Promise.all(claves.map((k) => caches.delete(k)));
      console.warn('[AETHER] retirando el service worker antiguo · cachés borradas: '
        + (claves.length ? claves.join(', ') : 'ninguna'));
    } catch (e) {
      console.warn('[AETHER] no se pudieron borrar las cachés:', e);
    }

    // 2. Darse de baja. A partir de aquí no habrá worker que controle nada.
    try {
      await self.registration.unregister();
    } catch (e) {
      console.warn('[AETHER] no se pudo dar de baja el registro:', e);
    }

    /* 3. Y recargar lo que esté abierto. Sin esto, la pestaña actual sigue
          mostrando la página rota hasta que alguien la recargue a mano, que
          es justo lo que no va a ocurrir: se ve mal, se cierra y se olvida. */
    try {
      const ventanas = await self.clients.matchAll({ type: 'window' });
      await Promise.all(ventanas.map((c) => {
        try { return c.navigate(c.url); } catch (e) { return Promise.resolve(); }
      }));
    } catch (e) {
      console.warn('[AETHER] no se pudieron recargar las ventanas:', e);
    }
  })());
});

/* Deliberadamente SIN `addEventListener('fetch', ...)`.

   Un service worker sin manejador de fetch no intercepta nada: el navegador
   va a la red como si no existiera. Es lo que hace falta mientras dura el
   trámite de retirada. */
