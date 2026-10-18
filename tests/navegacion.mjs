/**
 * AETHER · los botones que llevan de una página a otra.
 *
 * Antes se llamaba `globo-boton.mjs` y solo cubría GLOBE. Lo cubre todo
 * porque los tres fallos que hemos tenido aquí eran el mismo fallo repartido:
 *
 *   1. `openAetherGlobe()` llamaba a `syncAetherGlobeBridge()` sin proteger.
 *      Si lanzaba, `window.open` no llegaba a ejecutarse.
 *   2. Los tres botones usaban `window.open(..., 'noopener')`, que devuelve
 *      `null` SIEMPRE: era imposible detectar una emergente bloqueada, y
 *      cuando el navegador la bloqueaba no ocurría nada ni se decía nada.
 *   3. GLOBE abría `aether-globe-v3.html?ctx=<marca>`. Con el service worker
 *      ya controlando, Workbox no encontraba esa URL en su precache, la
 *      navegación caía al respaldo y el respaldo servía `index.html`: en un
 *      iPhone, pulsar GLOBE llevaba a la portada.
 *
 * El tercero solo se ve en la SEGUNDA visita, con el worker controlando. Por
 * eso aquí todo se prueba dos veces, y en los dos motores: WebKit es el de
 * iPhone, que es donde apareció.
 *
 * Uso:
 *   node tests/navegacion.mjs --base http://localhost:8080/OkrtSystemLabs
 */
import { chromium, webkit, devices } from 'playwright';

const argOf = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = argOf('base', 'http://localhost:8080/OkrtSystemLabs').replace(/\/$/, '');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let fallos = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const mal = (m) => { fallos++; console.log(`   FALLO ${m}`); };

/** Las páginas que publica el sitio, con un trozo de su <title>. */
const PAGINAS = [
  ['index.html', 'Global Intelligence System'],
  ['aether-globe-v3.html', 'Global Intelligence Globe'],
  ['aether-signal.html', 'AETHER SIGNAL'],
  ['aether-vector.html', 'AETHER VECTOR'],
  ['metodologia.html', 'Metodología'],
];

/** Deja la página con el service worker YA controlando. */
async function conWorkerControlando(page) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await esperar(6000);
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await esperar(5000);
  return page.evaluate(() => !!navigator.serviceWorker.controller);
}

/** Entra al panel desde la portada. */
async function entrarAlPanel(page) {
  await page.evaluate(() => document.querySelector('.nav-cta[data-launch-aether]')?.click());
  await esperar(2500);
}

/**
 * Cada página se sirve a sí misma, con y sin parámetros.
 *
 * El `?ctx=` no era el problema de fondo: el problema era que CUALQUIER
 * parámetro rompía la correspondencia con el precache. Se comprueban los tres
 * que el sitio usa de verdad —`ctx`, y `source`/`icon` del manifiesto— porque
 * el `start_url` de la app instalada lleva los dos últimos.
 */
async function paginasConParametros(page, etiqueta) {
  for (const [pagina, trozo] of PAGINAS) {
    for (const query of ['', '?ctx=' + Date.now(), '?source=pwa&icon=okrtv2']) {
      /* NAVEGANDO, no con `fetch`. Es la diferencia que ocultó el fallo
         durante una versión entera: `NavigationRoute` solo mira peticiones
         con `mode: 'navigate'`, así que un `fetch` de la misma URL devolvía
         la página correcta mientras la navegación servía la portada. */
      await page.goto(`${BASE}/${pagina}${query}`, { waitUntil: 'load', timeout: 60000 });
      await esperar(1200);
      const titulo = await page.title();
      if (titulo.includes(trozo)) continue;
      mal(`${etiqueta}: navegar a ${pagina}${query} muestra «${titulo}» (esperaba «${trozo}»)`);
      return;
    }
  }
  ok(`${etiqueta}: las ${PAGINAS.length} páginas se sirven a sí mismas navegando, con y sin parámetros`);
}

/** Pulsa un botón del panel y dice a dónde se llega. */
async function pulsar(ctx, page, accion) {
  const antes = ctx.pages().length;
  const urlAntes = page.url();
  const boton = await page.$(`[data-action="${accion}"]`);
  if (!boton) return { error: 'no existe el botón' };
  await boton.click().catch(() => {});
  await esperar(6500);
  const pags = ctx.pages();
  const nueva = pags.length > antes ? pags[pags.length - 1] : null;
  const destino = nueva || (page.url() !== urlAntes ? page : null);
  if (!destino) return { error: 'no abre nada' };
  await destino.waitForLoadState('load').catch(() => {});
  await esperar(2500);
  return { nueva: !!nueva, url: destino.url(), titulo: await destino.title(), pagina: destino };
}

const BOTONES = [
  ['open-globe', 'aether-globe-v3.html', 'Global Intelligence Globe'],
  ['open-signal', 'aether-signal.html', 'AETHER SIGNAL'],
  ['open-vector', 'aether-vector.html', 'AETHER VECTOR'],
];

/** Escritorio: pestaña nueva, sin botón de volver. */
async function enEscritorio(motor, nombre) {
  const b = await motor.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const controlando = await conWorkerControlando(page);
  console.log(`\n--- ${nombre} · escritorio · service worker ${controlando ? 'CONTROLANDO' : 'sin controlar'} ---`);
  if (!controlando) mal(`${nombre}: el service worker no llegó a controlar la página`);
  await paginasConParametros(page, nombre);
  // Las comprobaciones anteriores han navegado; se vuelve al panel.
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await esperar(3500);
  await entrarAlPanel(page);

  for (const [accion, archivo, trozo] of BOTONES) {
    const r = await pulsar(ctx, page, accion);
    if (r.error) { mal(`${nombre} · ${accion}: ${r.error}`); continue; }
    if (!r.titulo.includes(trozo)) {
      mal(`${nombre} · ${accion}: lleva a «${r.titulo}» · ${r.url.replace(BASE, '')}`);
    } else if (!r.nueva) {
      mal(`${nombre} · ${accion}: en escritorio debería abrir una pestaña nueva`);
    } else if (r.url.includes('?')) {
      mal(`${nombre} · ${accion}: la URL lleva parámetros (${r.url.replace(BASE, '')})`);
    } else {
      const volver = await r.pagina.$('#aether-volver');
      if (volver) mal(`${nombre} · ${accion}: botón de volver en escritorio, donde sobra`);
      else ok(`${nombre} · ${accion}: pestaña nueva con ${archivo}, sin parámetros`);
    }
    if (r.pagina && r.nueva) await r.pagina.close();
  }
  await b.close();
}

/** Móvil: misma ventana, con botón de volver que lleva al PANEL. */
async function enMovil(motor, nombre) {
  const b = await motor.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const controlando = await conWorkerControlando(page);
  console.log(`\n--- ${nombre} · iPhone · service worker ${controlando ? 'CONTROLANDO' : 'sin controlar'} ---`);
  if (!controlando) mal(`${nombre} iPhone: el service worker no llegó a controlar la página`);
  await entrarAlPanel(page);

  for (const [accion, , trozo] of BOTONES) {
    const r = await pulsar(ctx, page, accion);
    if (r.error) { mal(`${nombre} iPhone · ${accion}: ${r.error}`); continue; }
    if (!r.titulo.includes(trozo)) {
      mal(`${nombre} iPhone · ${accion}: lleva a «${r.titulo}» · ${r.url.replace(BASE, '')}`);
      continue;
    }
    if (r.nueva) {
      mal(`${nombre} iPhone · ${accion}: abre pestaña nueva, que en un teléfono no se ve`);
      await r.pagina.close();
      continue;
    }
    const volver = await page.$('#aether-volver');
    if (!volver) { mal(`${nombre} iPhone · ${accion}: sin botón para volver al panel`); continue; }
    await volver.click();
    await esperar(4000);
    /* Tiene que volver AL PANEL, no a la portada: `launchAether()` no deja
       entrada en el historial, así que volver aterrizaba en la animación de
       entrada y había que pulsar otra vez. */
    const enPanel = await page.evaluate(() => {
      const landing = document.getElementById('page-landing');
      const app = document.getElementById('page-aether');
      const oculto = !landing || landing.classList.contains('hidden') || landing.style.display === 'none';
      return oculto && !!app && app.classList.contains('active');
    });
    if (enPanel) ok(`${nombre} iPhone · ${accion}: misma ventana, y «volver» deja el panel abierto`);
    else mal(`${nombre} iPhone · ${accion}: «volver» aterriza en la portada, no en el panel`);
    await esperar(1200);
  }
  await b.close();
}

/** Los fallos inyectados: el botón tiene que abrir el globo igual. */
async function pesePorMedio(motor, nombre, roto, esperaPestana) {
  const b = await motor.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (roto) await ctx.addInitScript(roto);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await esperar(2500);
  await entrarAlPanel(page);
  const r = await pulsar(ctx, page, 'open-globe');
  if (r.error) mal(`${nombre}: ${r.error}`);
  else if (!/Globe/i.test(r.titulo)) mal(`${nombre}: lleva a «${r.titulo}»`);
  else if (esperaPestana && !r.nueva) mal(`${nombre}: debería abrir pestaña nueva`);
  else if (!esperaPestana && r.nueva) mal(`${nombre}: con la emergente bloqueada no puede abrir pestaña`);
  else ok(`${nombre}: el globo se abre ${r.nueva ? 'en una pestaña nueva' : 'en la misma ventana'}`);
  await b.close();
}

(async () => {
  console.log('\n===== NAVEGACIÓN ENTRE PÁGINAS =====');
  console.log(`base: ${BASE}`);

  for (const [motor, nombre] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
    await enEscritorio(motor, nombre);
    await enMovil(motor, nombre);
  }

  console.log('\n--- con un fallo por medio (Chromium) ---');
  await pesePorMedio(chromium, 'syncAetherGlobeBridge lanza', () => {
    Object.defineProperty(window, 'syncAetherGlobeBridge', {
      configurable: true,
      get() { return function () { throw new TypeError('simulado: el puente falla'); }; },
      set() {},
    });
  }, true);
  await pesePorMedio(chromium, 'computeRegionProfile lanza', () => {
    Object.defineProperty(window, 'computeRegionProfile', {
      configurable: true,
      get() { return function () { throw new TypeError('simulado: perfil roto'); }; },
      set() {},
    });
  }, true);
  await pesePorMedio(chromium, 'localStorage bloqueado', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('simulado: almacenamiento bloqueado', 'SecurityError'); },
    });
  }, true);
  await pesePorMedio(chromium, 'ventana emergente bloqueada', () => {
    window.open = function () { return null; };
  }, false);

  console.log(`\n===== ${fallos === 0 ? 'SIN FALLOS' : fallos + ' FALLOS'} =====`);
  process.exit(fallos === 0 ? 0 : 1);
})();
