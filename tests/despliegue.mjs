/**
 * AETHER · qué ve quien vuelve después de un despliegue.
 *
 * El caso que motivó esto: pulsar GLOBE abría el globo con una versión
 * anterior, y había que recargar a mano cada vez.
 *
 * El mecanismo: el service worker nuevo se instalaba y se quedaba EN ESPERA
 * —no había `skipWaiting()`— mientras el anterior seguía sirviendo el HTML y
 * el JS desde su precache, que es «caché primero». Hasta que alguien pulsaba
 * «Recargar», el navegador enseñaba la versión de antes.
 *
 * Se prueban las dos clases de despliegue, que no son iguales:
 *   - uno que SOLO cambia datos: el service worker no debe cambiar, porque
 *     los JSON no entran en el precache;
 *   - uno que cambia CÓDIGO: la siguiente navegación debe servir ya la
 *     versión nueva, sin recargar a mano.
 *
 * Necesita dos copias del build, así que no va en `npm test`:
 *   npm run build
 *   node tests/despliegue.mjs --dist dist
 */
import { chromium, webkit, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const argOf = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const DIST = path.resolve(argOf('dist', 'dist'));
const PUERTO = Number(argOf('puerto', '8097'));
const BASE = `http://localhost:${PUERTO}/OkrtSystemLabs`;
const TRABAJO = path.join(process.env.TEMP || '/tmp', 'aether-despliegue');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let fallos = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const mal = (m) => { fallos++; console.log(`   FALLO ${m}`); };

/* Dos copias del sitio: una «antes» y otra «después». El servidor apunta a
   una u otra sin cambiar de origen, que es lo que conserva el registro del
   service worker. */
const ANTES = path.join(TRABAJO, 'antes');
const DESPUES = path.join(TRABAJO, 'despues');
fs.rmSync(TRABAJO, { recursive: true, force: true });
fs.cpSync(DIST, ANTES, { recursive: true });
fs.cpSync(DIST, DESPUES, { recursive: true });

/** Marca la copia «después» como una versión distinta del código. */
function cambiaCodigo() {
  const idx = path.join(DESPUES, 'index.html');
  let html = fs.readFileSync(idx, 'utf8');
  html = html.replace('</head>', '<meta name="aether-version" content="nueva"></head>');
  fs.writeFileSync(idx, html);
  // Y el service worker, que es lo que de verdad dispara la actualización.
  const sw = path.join(DESPUES, 'sw.js');
  fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8') + '\n// despliegue de prueba\n');
}

/** Marca la copia «después» como un despliegue que solo cambia datos. */
function cambiaSoloDatos() {
  const f = path.join(DESPUES, 'data', 'events.json');
  if (!fs.existsSync(f)) return;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  d.descargado = new Date().toISOString();
  fs.writeFileSync(f, JSON.stringify(d));
}

let raiz = ANTES;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};
const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (!ruta.startsWith('/OkrtSystemLabs')) { res.writeHead(404); res.end(); return; }
  ruta = ruta.replace(/^\/OkrtSystemLabs\/?/, '') || 'index.html';
  if (ruta.endsWith('/')) ruta += 'index.html';
  const f = path.resolve(raiz, ruta);
  if (!f.startsWith(raiz)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); res.end('no existe'); return; }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
});

const estado = (page) => page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return {
    controlador: navigator.serviceWorker.controller
      ? navigator.serviceWorker.controller.scriptURL.split('/').pop() : null,
    esperando: regs.some((r) => !!r.waiting),
    version: (document.querySelector('meta[name="aether-version"]') || {}).content || 'antigua',
  };
});

/** Deja la página con el service worker ya controlando (segunda visita). */
async function segundaVisita(page) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => navigator.serviceWorker.ready).catch(() => {});
  await esperar(1500);
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 })
    .catch(() => {});
  await esperar(2000);
}

async function prueba(motor, nombre) {
  console.log(`\n--- ${nombre} · iPhone ---`);
  const b = await motor.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();

  // ── 1. Segunda visita con la versión de antes ──────────────────────────
  raiz = ANTES;
  await segundaVisita(page);
  const inicial = await estado(page);
  if (inicial.controlador !== 'sw.js') {
    mal(`${nombre}: el service worker no llegó a controlar (${inicial.controlador})`);
    await b.close();
    return;
  }

  // ── 2. Despliegue que SOLO cambia datos ────────────────────────────────
  cambiaSoloDatos();
  raiz = DESPUES;
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await esperar(6000);
  const trasDatos = await estado(page);
  if (trasDatos.esperando) {
    mal(`${nombre}: un despliegue de solo datos ha generado un service worker nuevo`);
  } else {
    ok(`${nombre}: un despliegue de solo datos no toca el service worker`);
  }

  // ── 3. Despliegue que cambia CÓDIGO ────────────────────────────────────
  cambiaCodigo();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
  /* Margen para que el worker nuevo se instale, se active y recargue. El
     caso sano es que a la siguiente navegación ya esté la versión nueva, sin
     que nadie pulse nada. */
  await esperar(12000);
  const trasCodigo = await estado(page);
  if (trasCodigo.version === 'nueva') {
    ok(`${nombre}: tras un despliegue de código, la versión nueva entra sola`);
  } else {
    mal(`${nombre}: sigue sirviéndose la versión antigua (esperando=${trasCodigo.esperando})`);
  }

  // ── 4. Y el globo, pulsando GLOBE ──────────────────────────────────────
  await page.evaluate(() => document.querySelector('.nav-cta[data-launch-aether]')?.click());
  await esperar(3500);
  const boton = await page.$('[data-action="open-globe"]');
  if (!boton) {
    mal(`${nombre}: no aparece el botón GLOBE`);
  } else {
    const antesPags = ctx.pages().length;
    await boton.click().catch(() => {});
    await esperar(9000);
    const pags = ctx.pages();
    const globo = pags.length > antesPags ? pags[pags.length - 1] : page;
    await globo.waitForLoadState('load').catch(() => {});
    await esperar(7000);
    const g = await globo.evaluate(() => ({
      titulo: document.title,
      canvas: document.querySelectorAll('canvas').length,
    }));
    if (!/Globe/i.test(g.titulo)) mal(`${nombre}: GLOBE lleva a «${g.titulo}»`);
    else if (g.canvas < 2) mal(`${nombre}: el globo no renderiza (${g.canvas} canvas)`);
    else ok(`${nombre}: tras el despliegue, GLOBE abre el globo y renderiza`);
  }

  // ── 5. Offline en las cinco páginas ────────────────────────────────────
  const PAGINAS = ['index.html', 'aether-globe-v3.html', 'aether-signal.html',
    'aether-vector.html', 'metodologia.html'];
  for (const p of PAGINAS) {
    await page.goto(`${BASE}/${p}`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await esperar(p.includes('globe') ? 6000 : 1500);
  }
  await ctx.setOffline(true);
  let bien = 0;
  for (const p of PAGINAS) {
    const sin = await ctx.newPage();
    let cargo = true;
    await sin.goto(`${BASE}/${p}`, { waitUntil: 'load', timeout: 45000 }).catch(() => { cargo = false; });
    if (cargo) {
      await esperar(p.includes('globe') ? 6000 : 2000);
      const n = await sin.evaluate(() => document.querySelectorAll('*').length);
      if (n > 50) bien++;
      else mal(`${nombre}: offline ${p} carga vacía (${n} nodos)`);
    } else {
      mal(`${nombre}: offline ${p} no carga`);
    }
    await sin.close();
  }
  if (bien === PAGINAS.length) ok(`${nombre}: offline, las ${bien} páginas siguen cargando`);
  await ctx.setOffline(false);

  await b.close();
}

(async () => {
  console.log('\n===== QUÉ VE QUIEN VUELVE TRAS UN DESPLIEGUE =====');
  await new Promise((r) => servidor.listen(PUERTO, r));
  for (const [motor, nombre] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
    // Cada motor parte de copias limpias.
    fs.rmSync(DESPUES, { recursive: true, force: true });
    fs.cpSync(DIST, DESPUES, { recursive: true });
    await prueba(motor, nombre);
  }
  servidor.close();
  console.log(`\n===== ${fallos === 0 ? 'SIN FALLOS' : fallos + ' FALLOS'} =====`);
  process.exit(fallos === 0 ? 0 : 1);
})();
