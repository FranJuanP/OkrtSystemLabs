/**
 * T18 · Prueba del service worker (Workbox).
 *
 * Lo que de verdad hay que comprobar, y que el service worker anterior no
 * cumplía: **con la red cortada después de la primera visita, las cuatro
 * páginas cargan y el globo se renderiza**.
 *
 * Además:
 *   - el precache lo genera el build, no una lista escrita a mano;
 *   - cubre HTML, JS, CSS, imágenes, tipografías y texturas;
 *   - no hay `skipWaiting()` automático: una versión nueva espera y avisa.
 *
 * Requiere el sitio construido y servido:
 *   npm run build && npm run preview
 *   node tests/sw.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { REPO_DIR, PAGES } from './lib/harness.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080/OkrtSystemLabs').replace(/\/$/, '');

let failures = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const bad = (m) => { failures++; console.log(`   FALLO ${m}`); };

console.log('===== PRUEBA DEL SERVICE WORKER (T18) =====\n');

// ── 1. El build genera el service worker y su manifiesto ──────────────────
const SW = path.join(REPO_DIR, 'dist', 'sw.js');
if (!fs.existsSync(SW)) {
  bad('no existe dist/sw.js — hay que ejecutar npm run build antes');
  process.exit(1);
}
const sw = fs.readFileSync(SW, 'utf8');
// Workbox inyecta el manifiesto como [{"revision":...,"url":"..."}].
const entradas = [...sw.matchAll(/\{"revision":(null|"[^"]*"),"url":"([^"]+)"\}/g)]
  .map((m) => ({ revision: m[1] === 'null' ? null : m[1], url: m[2] }));
const urls = entradas.map((e) => e.url);

if (urls.length > 50) ok(`el precache lo genera el build: ${urls.length} entradas`);
else bad(`solo ${urls.length} entradas en el precache; se esperaban muchas más`);

const byExt = {};
for (const u of urls) {
  const ext = (u.match(/\.([a-z0-9]+)(?:\?|$)/i) || [, 'otro'])[1].toLowerCase();
  byExt[ext] = (byExt[ext] || 0) + 1;
}
const quiere = { html: 'HTML', js: 'JS', css: 'CSS', webp: 'imágenes', woff2: 'tipografías' };
const faltan = Object.keys(quiere).filter((e) => !byExt[e]);
if (faltan.length === 0) {
  ok('cubre ' + Object.entries(byExt).filter(([e]) => quiere[e]).map(([e, n]) => `${quiere[e]} ${n}`).join(', '));
} else {
  bad(`el precache no cubre: ${faltan.map((e) => quiere[e]).join(', ')}`);
}

const texturas = urls.filter((u) => /earth-(day|night|clouds)/.test(u));
if (texturas.length >= 3) ok(`las texturas del globo están precacheadas (${texturas.length})`);
else bad(`solo ${texturas.length} texturas del globo en el precache`);

// Cada entrada tiene que poder invalidarse: o revisión propia, o hash de
// Vite en el nombre. Las dos cosas a null significa que un cambio en ese
// fichero no llegaría nunca al navegador.
const sinVersion = entradas.filter((e) => !e.revision && !/-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/.test(e.url));
if (sinVersion.length === 0) ok('todas las entradas llevan revisión o hash en el nombre');
else bad(`${sinVersion.length} entradas sin forma de invalidarse: ${JSON.stringify(sinVersion.slice(0, 3).map((e) => e.url))}`);

// ── 2. Nada de skipWaiting automático ─────────────────────────────────────
if (/SKIP_WAITING/.test(sw)) ok('la activación espera a que la página mande SKIP_WAITING');
else bad('el service worker no espera: se activa solo');

// ── 3. Offline de verdad ──────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });
  const estado = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 'sin soporte';
    await navigator.serviceWorker.ready.catch(() => null);
    for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return navigator.serviceWorker.controller ? 'controlando' : 'registrado sin control';
  });
  // Con activación diferida (sin skipWaiting ni clients.claim) el service
  // worker NO controla la primera carga: se instala, precachea y toma el
  // control en la siguiente navegación. Eso es lo correcto aquí, así que se
  // comprueba que esté registrado y activo, no que mande ya.
  if (estado === 'controlando' || estado === 'registrado sin control') {
    ok(`service worker instalado y activo (${estado})`);
  } else {
    bad(`el service worker no se instaló: ${estado}`);
  }

  // Dar tiempo a que termine de precachear.
  await page.waitForTimeout(14000);

  const cacheado = await page.evaluate(async () => {
    const names = await caches.keys();
    let total = 0;
    for (const n of names) total += (await (await caches.open(n)).keys()).length;
    return { names, total };
  });
  if (cacheado.total > 50) ok(`${cacheado.total} recursos en caché (${cacheado.names.length} cachés)`);
  else bad(`solo ${cacheado.total} recursos en caché`);

  await context.setOffline(true);
  for (const p of PAGES) {
    const errors = [];
    const onErr = (e) => errors.push(e.message.split('\n')[0]);
    page.on('pageerror', onErr);

    let navOk = true;
    try { await page.goto(`${BASE}/${p}`, { waitUntil: 'load', timeout: 40000 }); }
    catch { navOk = false; }
    await page.waitForTimeout(p.includes('globe') ? 10000 : 4000);

    const vista = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return {
        nodos: document.querySelectorAll('*').length,
        canvas: document.querySelectorAll('canvas').length,
        globoVivo: !!c && c.width > 100 && c.height > 100,
        svg: document.querySelectorAll('svg path').length,
        tarjetas: document.querySelectorAll('.signal-card').length,
      };
    }).catch(() => ({ nodos: 0 }));

    page.off('pageerror', onErr);

    if (!navOk || vista.nodos < 50) {
      bad(`offline: ${p} no carga (nav=${navOk}, nodos=${vista.nodos})`);
    } else if (errors.length) {
      bad(`offline: ${p} carga pero da pageerror: ${JSON.stringify([...new Set(errors)].slice(0, 2))}`);
    } else if (p.includes('globe')) {
      if (vista.globoVivo) ok(`offline: ${p} carga Y el globo se renderiza (${vista.canvas} canvas)`);
      else bad(`offline: ${p} carga pero el globo no se renderiza`);
    } else {
      ok(`offline: ${p} carga (${vista.nodos} nodos, ${vista.svg} paths, ${vista.tarjetas} tarjetas)`);
    }
  }

  await browser.close();
  console.log(`\n===== ${failures === 0 ? 'SIN FALLOS' : failures + ' FALLOS'} =====`);
  process.exit(failures === 0 ? 0 : 1);
})();
