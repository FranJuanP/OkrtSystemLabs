/**
 * AETHER · retirada del service worker anterior a la Fase 2.
 *
 * El caso: un navegador que visitó el sitio antes de la Fase 2 quedó con
 * `service-worker.js` registrado. La Fase 2 lo sustituyó por `sw.js` y dejó de
 * publicar esa ruta, así que el navegador comprobaba si había versión nueva,
 * recibía un 404, daba la comprobación por fallida y **seguía usando el
 * antiguo**. Indefinidamente.
 *
 * Como ese worker servía CSS y datos con «caché primero», esos visitantes
 * veían el sitio actual sin estilos y con los datos de antes: el globo decía
 * «201 PAÍSES» donde hoy son 217.
 *
 * La salida es volver a publicar `public/service-worker.js` con un worker que
 * solo sabe retirarse. Esto comprueba que funciona, en los dos motores.
 *
 * Necesita los DOS builds, así que no va en `npm test`. Para prepararlo:
 *
 *   git worktree add /tmp/aether-viejo ccea93d --detach
 *   cd /tmp/aether-viejo && npm ci && npm run build
 *   cd - && npm run build
 *
 * Y luego:
 *
 *   node tests/retirada-sw.mjs --viejo /tmp/aether-viejo/dist --nuevo dist
 */
import { chromium, webkit, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const argOf = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const VIEJO = path.resolve(argOf('viejo', ''));
const NUEVO = path.resolve(argOf('nuevo', 'dist'));
const PUERTO = Number(argOf('puerto', '8099'));
const BASE = `http://localhost:${PUERTO}/OkrtSystemLabs`;
const PERFILES = path.join(process.env.TEMP || '/tmp', 'aether-perfiles-retirada');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let fallos = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const mal = (m) => { fallos++; console.log(`   FALLO ${m}`); };

if (!VIEJO || !fs.existsSync(path.join(VIEJO, 'service-worker.js'))) {
  console.error('Falta el build antiguo. Ver la cabecera de este fichero.');
  process.exit(2);
}

/* Un servidor que puede cambiar de raíz SIN cambiar de origen, que es lo que
   conserva el registro del service worker. Es la única forma de simular un
   despliegue sobre un navegador que ya estuvo aquí. */
let raiz = VIEJO;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.avif': 'image/avif',
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

/** Qué worker controla, qué cachés hay y qué enseña el globo. */
const estado = (page) => page.evaluate(async () => ({
  controlador: navigator.serviceWorker.controller
    ? navigator.serviceWorker.controller.scriptURL.split('/').pop() : null,
  caches: await caches.keys(),
}));

/**
 * @param {boolean} sinJs  si se bloquea el JavaScript de la página
 *
 * `sinJs` es lo que reproduce el caso real. Con el JS corriendo, el propio
 * sitio se rescata: el worker antiguo es «red primero» para HTML, sirve el
 * index actual, su módulo registra `sw.js` y la detección de cachés heredadas
 * hace el resto. Eso ya funcionaba.
 *
 * Lo que NO funcionaba es cuando el JS no llega a ejecutarse —la página sale
 * «sin CSS ni JS», que es el síntoma que se reportó—, porque entonces nadie
 * registra nada y el único canal que queda es la comprobación de versión que
 * el navegador hace del script registrado. Si esa ruta da 404, no hay salida.
 */
async function prueba(motor, nombre, sinJs) {
  console.log(`
--- ${nombre} · iPhone${sinJs ? ' · con el JS de la página bloqueado' : ''} ---`);
  const perfil = path.join(PERFILES, nombre + (sinJs ? '-sinjs' : ''));
  fs.rmSync(perfil, { recursive: true, force: true });

  // ── 1. La versión antigua, que registra service-worker.js ──────────────
  raiz = VIEJO;
  let ctx = await motor.launchPersistentContext(perfil, { ...devices['iPhone 13'] });
  let page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => navigator.serviceWorker.ready).catch(() => {});
  await esperar(3000);
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 })
    .catch(() => {});
  await esperar(2000);
  const antes = await estado(page);
  if (antes.controlador === 'service-worker.js') {
    ok(`${nombre}: la versión antigua deja «${antes.controlador}» controlando · cachés: ${antes.caches.join(', ') || 'ninguna'}`);
  } else {
    mal(`${nombre}: no se pudo dejar el worker antiguo controlando (${JSON.stringify(antes)})`);
  }
  // 2. Se cierra la pestaña, como haría cualquiera.
  await ctx.close();

  // ── 3. Se publica la versión actual, mismo origen ──────────────────────
  raiz = NUEVO;
  ctx = await motor.launchPersistentContext(perfil, { ...devices['iPhone 13'] });
  if (sinJs) {
    /* Ni un módulo de la aplicación. Así la recuperación no puede depender de
       que la página haga nada: o la provoca el navegador al comprobar el
       script registrado, o no ocurre. */
    await ctx.route('**/assets/*.js', (r) => r.abort());
  }
  page = ctx.pages()[0] || await ctx.newPage();

  let despues = null;
  for (let carga = 1; carga <= 2; carga++) {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
    /* El interruptor recarga la ventana él mismo al activarse; se le da
       tiempo y se vuelve a mirar. */
    await esperar(9000);
    despues = await estado(page);
    /* Lo que hay que conseguir es que el ANTIGUO se vaya. Que entre `sw.js`
       depende de que la página lo registre, y con el JS bloqueado no puede:
       ahí el final correcto es «sin controlador». */
    const seFue = despues.controlador !== 'service-worker.js'
      && !despues.caches.some((k) => /^aether-v\d/.test(k));
    if (seFue) break;
    if (carga === 1) console.log(`         tras la 1ª carga: controlador=${despues.controlador}, cachés=${despues.caches.join(', ') || 'ninguna'}`);
  }

  if (despues.controlador === 'service-worker.js') {
    mal(`${nombre}: el worker antiguo sigue controlando`);
  } else if (sinJs) {
    ok(`${nombre}: el worker antiguo se retira sin que la página ejecute nada (controlador: ${despues.controlador || 'ninguno'})`);
  } else if (despues.controlador === 'sw.js') {
    ok(`${nombre}: el controlador pasa a «sw.js»`);
  } else {
    mal(`${nombre}: no queda ningún controlador y la página sí podía registrar`);
  }
  const viejas = despues.caches.filter((k) => /^aether-v\d/.test(k));
  if (!viejas.length) ok(`${nombre}: no quedan cachés antiguas`);
  else mal(`${nombre}: quedan cachés antiguas (${viejas.join(', ')})`);

  if (sinJs) {
    /* Se levanta el bloqueo y se recarga: con el worker antiguo ya retirado,
       la página tiene que llegar entera de la red. */
    await ctx.unroute('**/assets/*.js');
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.evaluate(() => navigator.serviceWorker.ready).catch(() => {});
    await esperar(3000);
    await page.reload({ waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 })
      .catch(() => {});
    await esperar(3000);
    const final = await estado(page);
    if (final.controlador === 'sw.js') ok(`${nombre}: con el JS de vuelta, el controlador acaba siendo «sw.js»`);
    else mal(`${nombre}: con el JS de vuelta sigue sin «sw.js» (${final.controlador || 'ninguno'})`);
  }

  // ── 4. Y el globo, con los países de hoy ───────────────────────────────
  await page.evaluate(() => document.querySelector('.nav-cta[data-launch-aether]')?.click());
  await esperar(3000);
  const boton = await page.$('[data-action="open-globe"]');
  if (!boton) {
    mal(`${nombre}: no aparece el botón GLOBE`);
  } else {
    const antesPags = ctx.pages().length;
    await boton.click().catch(() => {});
    await esperar(10000);
    const pags = ctx.pages();
    const globo = pags.length > antesPags ? pags[pags.length - 1] : page;
    await globo.waitForLoadState('load').catch(() => {});
    await esperar(8000);
    const g = await globo.evaluate(() => {
      /* El contador lo escribe el motor: «SEÑAL ACTIVA — 217 DE 217 PAÍSES».
         El HTML viene con «217 PAÍSES» escrito, asi que se lee el primer
         numero y se exige la forma completa: si el motor no ha llegado a
         correr, el texto no lleva «DE». */
      const el = document.getElementById('countLabel');
      const texto = (el && el.textContent) || '';
      const m = texto.match(/(\d+)\s+DE\s+(\d+)\s*PA[IÍ]SES/i);
      return {
        titulo: document.title,
        canvas: document.querySelectorAll('canvas').length,
        etiqueta: texto.trim(),
        paises: m ? Number(m[1]) : null,
      };
    });
    if (!/Globe/i.test(g.titulo)) mal(`${nombre}: GLOBE lleva a «${g.titulo}»`);
    else if (g.canvas < 2) mal(`${nombre}: el globo no renderiza (${g.canvas} canvas)`);
    else if (g.paises !== 217) mal(`${nombre}: el globo dice «${g.etiqueta}», esperaba 217 países`);
    else ok(`${nombre}: el globo renderiza con 217 países (${g.canvas} canvas)`);
  }
  await ctx.close();
}

(async () => {
  console.log('\n===== RETIRADA DEL SERVICE WORKER ANTIGUO =====');
  console.log(`antiguo: ${VIEJO}\nactual : ${NUEVO}`);
  await new Promise((r) => servidor.listen(PUERTO, r));

  for (const sinJs of [false, true]) {
    await prueba(chromium, 'Chromium', sinJs);
    await prueba(webkit, 'WebKit', sinJs);
  }

  servidor.close();
  console.log(`\n===== ${fallos === 0 ? 'SIN FALLOS' : fallos + ' FALLOS'} =====`);
  process.exit(fallos === 0 ? 0 : 1);
})();
