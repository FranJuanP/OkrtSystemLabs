/**
 * T11 · Prueba del service worker.
 *
 *   1. El precache cubre todo lo que las páginas referencian y todas sus
 *      entradas existen en disco.
 *   2. El nombre de caché lleva versión.
 *   3. Tras una primera visita con red, las cuatro páginas siguen abriendo
 *      con la red cortada, y el CSS móvil que antes faltaba está en caché.
 *
 * Uso: node tests/sw.mjs [--base http://localhost:8080]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { REPO_DIR, PAGES } from './lib/harness.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080').replace(/\/$/, '');

let failures = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const bad = (m) => { failures++; console.log(`   FALLO ${m}`); };

const swText = fs.readFileSync(path.join(REPO_DIR, 'service-worker.js'), 'utf8');
const precache = JSON.parse(swText.slice(swText.indexOf('const AETHER_ASSETS = [') + 'const AETHER_ASSETS = '.length,
  swText.indexOf('];', swText.indexOf('const AETHER_ASSETS = [')) + 1));
const cacheName = (swText.match(/const AETHER_CACHE = '([^']+)'/) || [])[1];

console.log('===== PRUEBA DEL SERVICE WORKER (T11) =====\n');

// 1. Nombre de cache versionado.
if (cacheName && /^aether-v\d{8}-[0-9a-f]{8}$/.test(cacheName)) ok(`nombre de cache versionado: ${cacheName}`);
else bad(`nombre de cache sin version reconocible: ${cacheName}`);

// 2. Todas las entradas del precache existen.
const inexistentes = precache.filter((rel) => rel !== './' && !fs.existsSync(path.join(REPO_DIR, rel.replace(/^\.\//, ''))));
if (inexistentes.length === 0) ok(`las ${precache.length} entradas del precache existen en disco`);
else bad(`entradas inexistentes: ${JSON.stringify(inexistentes)}`);

// 3. El precache cubre lo que las paginas referencian.
const referenced = new Set();
for (const page of PAGES) {
  const html = fs.readFileSync(path.join(REPO_DIR, page), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="((?:assets|src)\/[^"]+)"/g)) referenced.add('./' + m[1]);
}
const set = new Set(precache);
const uncovered = [...referenced].filter((r) => !set.has(r)).sort();
if (uncovered.length === 0) ok(`el precache cubre los ${referenced.size} recursos que referencian las paginas`);
else bad(`referenciados y fuera del precache: ${JSON.stringify(uncovered)}`);

// Los seis ficheros que faltaban en el precache segun el encargo (T11).
// Tras T12 los dos .js viven en src/ y el navegador los carga como parte del
// grafo de modulos de su pagina, no como <script> sueltos; el generador los
// precachea igualmente siguiendo los imports.
const REQUERIDOS = [
  './src/signal/mobile-fix.js', './assets/css/signal-mobile-fix.css',
  './src/vector/mobile-fix.js', './assets/css/vector-mobile-fix.css',
  './assets/css/globe-tablet-portrait-cleanup.css',
  './assets/icons/apple-touch-icon-okrt-v2.png',
];
const faltan = REQUERIDOS.filter((r) => !set.has(r));
if (faltan.length === 0) ok('los seis ficheros que faltaban estan en el precache');
else bad(`siguen faltando: ${JSON.stringify(faltan)}`);

// 5. Offline de verdad.
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 45000 });
  // Esperar a que el service worker tome el control y acabe el precache.
  const registered = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 'sin soporte';
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg) return 'no listo';
    for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return navigator.serviceWorker.controller ? 'controlando' : 'registrado sin control';
  });
  if (registered === 'controlando') ok('el service worker controla la pagina');
  else bad(`el service worker no tomo el control: ${registered}`);

  await page.waitForTimeout(4000);   // margen para que termine de precachear

  const cached = await page.evaluate(async (required) => {
    const names = await caches.keys();
    const name = names.find((n) => n.startsWith('aether-v')) || names[0];
    if (!name) return { names, error: 'sin cache' };
    const cache = await caches.open(name);
    const keys = (await cache.keys()).map((r) => new URL(r.url).pathname);
    const have = required.filter((r) => keys.some((k) => k.endsWith(r.replace(/^\.\//, ''))));
    return { names, name, total: keys.length, have };
  }, REQUERIDOS);

  if (cached.error) bad(cached.error);
  else {
    if (cached.names.length === 1) ok(`una sola cache activa: ${cached.name} (${cached.total} entradas)`);
    else bad(`hay ${cached.names.length} caches a la vez: ${JSON.stringify(cached.names)}`);
    if (cached.have.length === REQUERIDOS.length) ok('los seis ficheros estan realmente en la cache del navegador');
    else bad(`en cache solo ${cached.have.length} de ${REQUERIDOS.length}: ${JSON.stringify(cached.have)}`);
  }

  // Cortar la red y recargar las cuatro paginas.
  await context.setOffline(true);
  for (const p of PAGES) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
    let navOk = true;
    try {
      await page.goto(`${BASE}/${p}`, { waitUntil: 'load', timeout: 30000 });
    } catch (e) { navOk = false; }
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => ({
      titulo: document.title,
      nodos: document.querySelectorAll('*').length,
      cuerpo: document.body ? document.body.innerText.length : 0,
    })).catch(() => ({ nodos: 0, cuerpo: 0 }));

    // El globo necesita three.js, que hoy viene de CDN: offline no renderiza.
    // Es lo esperado en la Fase 1; T16 lo empaqueta en el repositorio.
    const esGlobo = p.includes('globe');
    if (navOk && state.nodos > 50) {
      ok(`offline: ${p} carga (${state.nodos} nodos, ${state.cuerpo} chars)${esGlobo ? ' — sin three.js, esperado hasta T16' : ''}`);
    } else {
      bad(`offline: ${p} no carga (nav=${navOk}, nodos=${state.nodos})`);
    }
  }

  await browser.close();
  console.log(`\n===== ${failures === 0 ? 'SIN FALLOS' : failures + ' FALLOS'} =====`);
  process.exit(failures === 0 ? 0 : 1);
})();
