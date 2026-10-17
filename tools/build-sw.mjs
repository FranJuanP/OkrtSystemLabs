/**
 * Genera service-worker.js (T11).
 *
 * El precache estaba escrito a mano y se habia quedado atras: faltaban seis
 * ficheros que las paginas si cargan (signal-mobile-fix.js/.css,
 * vector-mobile-fix.js/.css, globe-tablet-portrait-cleanup.css y el icono
 * assets/icons/apple-touch-icon-okrt-v2.png), de modo que offline esas
 * paginas se quedaban sin su CSS movil.
 *
 * Para que no vuelva a pasar, la lista se deriva de lo que las cuatro
 * paginas referencian de verdad, mas unos extras explicitos. El nombre de
 * cache lleva la fecha y un hash del contenido precacheado, asi que cambia
 * solo cuando cambia algo.
 *
 * Uso: node tools/build-sw.mjs
 *
 * La Fase 2 (T18) lo sustituye por Workbox injectManifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = ['index.html', 'aether-globe-v3.html', 'aether-signal.html', 'aether-vector.html'];

/** Ficheros que no referencia ningun <script>/<link> pero deben estar. */
const EXTRAS = [
  './',
  './manifest.webmanifest',
  './favicon.ico',
  './apple-touch-icon.png',
  './apple-touch-icon-precomposed.png',
  './apple-touch-icon-okrt-v2.png',
  './assets/icons/apple-touch-icon-okrt-v2.png',
  './assets/icons/icon-okrt-192-v2.png',
  './assets/icons/icon-okrt-512-v2.png',
  './assets/icons/icon-okrt-512-maskable-v2.png',
  './assets/img/earth-clouds.png',
];

/**
 * Sigue el grafo de imports de un modulo ES y devuelve todos los ficheros
 * que acaba cargando el navegador.
 *
 * Hace falta desde T12: las paginas ya no listan sus scripts, solo apuntan a
 * una entrada de modulo, y los `import` de esa entrada no aparecen en el
 * HTML. Sin esto el precache se quedaria en la entrada y offline fallaria al
 * resolver el primer import.
 *
 * T18 lo sustituye por Workbox injectManifest sobre el build, que es quien
 * debe hacer esto de verdad.
 */
function moduleGraph(entryRel, seen = new Set()) {
  const rel = entryRel.replace(/^\.\//, '');
  if (seen.has(rel)) return seen;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return seen;
  seen.add(rel);
  const src = fs.readFileSync(abs, 'utf8');
  const specifiers = [
    ...src.matchAll(/^\s*import\s+(?:[^'"]*?from\s*)?['"]([^'"]+)['"]/gm),
    ...src.matchAll(/^\s*export\s+\*\s+from\s*['"]([^'"]+)['"]/gm),
  ].map((m) => m[1]).filter((spec) => spec.startsWith('.'));
  for (const spec of specifiers) {
    const resolved = path.relative(ROOT, path.resolve(path.dirname(abs), spec)).split(path.sep).join('/');
    moduleGraph(resolved, seen);
  }
  return seen;
}

function referencedAssets() {
  const found = new Set();
  for (const page of PAGES) {
    found.add('./' + page);
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    for (const m of html.matchAll(/(?:src|href)="\/?((?:assets|src)\/[^"]+)"/g)) {
      const rel = m[1];
      found.add('./' + rel);
      // Si es un modulo, hay que precachear tambien todo lo que importa.
      if (rel.endsWith('.js')) {
        for (const dep of moduleGraph(rel)) found.add('./' + dep);
      }
    }
  }
  return found;
}

const assets = new Set([...referencedAssets(), ...EXTRAS]);

// Solo lo que existe de verdad: una sola entrada rota hace fallar cache.addAll
// entera y deja la PWA sin instalar.
const missing = [];
const present = [...assets].filter((rel) => {
  if (rel === './') return true;
  const name = rel.replace(/^\.\//, '');
  if (fs.existsSync(path.join(ROOT, name)) || fs.existsSync(path.join(ROOT, 'public', name))) return true;
  missing.push(rel);
  return false;
}).sort();

if (missing.length) {
  console.warn('Avisos: referencias que no existen en disco y se omiten del precache:');
  missing.forEach((m) => console.warn('  ' + m));
}

// Hash del contenido precacheado: el nombre de cache cambia solo si cambia algo.
const hash = crypto.createHash('sha256');
for (const rel of present) {
  if (rel === './') continue;
  const name = rel.replace(/^\.\//, '');
  const abs = fs.existsSync(path.join(ROOT, name)) ? path.join(ROOT, name) : path.join(ROOT, 'public', name);
  hash.update(rel);
  hash.update(fs.readFileSync(abs));
}
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const CACHE_NAME = `aether-v${stamp}-${hash.digest('hex').slice(0, 8)}`;

const sw = `/**
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
const AETHER_CACHE = '${CACHE_NAME}';

const AETHER_ASSETS = ${JSON.stringify(present, null, 2)};

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
`;

fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public', 'service-worker.js'), sw);
console.log(`service-worker.js generado`);
console.log(`  cache     : ${CACHE_NAME}`);
console.log(`  recursos  : ${present.length}`);
console.log(`  omitidos  : ${missing.length}`);
