/**
 * Prueba de humo contra el sitio PUBLICADO, con red real.
 *
 * Es distinta de `tests/smoke.mjs`: esa corre contra el build servido en
 * local, con las fuentes externas interceptadas y el reloj congelado, para
 * que dos ejecuciones sean comparables píxel a píxel. Esta corre contra
 * https://franjuanp.github.io/OkrtSystemLabs/ **sin interceptar nada**, que
 * es lo único que comprueba que el despliegue de verdad funciona: las rutas
 * con `base`, los nombres con hash, la política de seguridad tal y como la
 * sirve GitHub Pages, y que las fuentes externas responden desde ese origen.
 *
 * Lo que se exige: 0 pageerror, 0 violaciones de CSP, y el globo renderizado.
 *
 * Y después, offline de verdad: primera visita con red para que el service
 * worker se instale y llene su caché, y luego la red cortada y las cuatro
 * páginas recargadas.
 *
 * Uso: node tests/publicado.mjs [--base https://franjuanp.github.io/OkrtSystemLabs]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'https://franjuanp.github.io/OkrtSystemLabs').replace(/\/$/, '');
const SALIDA = argOf('out', path.join(import.meta.dirname, 'shots', 'publicado'));

const PAGINAS = ['index.html', 'aether-globe-v3.html', 'aether-signal.html', 'aether-vector.html'];
const VENTANAS = [
  { nombre: '1440x900', width: 1440, height: 900 },
  { nombre: '390x844', width: 390, height: 844 },
];

let fallos = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const mal = (m) => { fallos++; console.log(`   FALLO ${m}`); };

/** Recoge lo que importa de una página. */
function diagnosticos(page) {
  const consola = [];
  const terceros = [];
  const pageErrors = [];
  const csp = [];
  const peticionesFallidas = [];

  page.on('console', (msg) => {
    const texto = msg.text();
    if (msg.type() === 'error') {
      // "Failed to load resource: net::ERR_..." no dice qué recurso falló y
      // lo que importa ya se recoge en requestfailed con su URL.
      const ruido = /^Failed to load resource: net::ERR_/.test(texto);
      // Un error que nombra una de las fuentes externas es la fuente
      // rechazando la petición, no un defecto del sitio: se cuenta aparte y
      // se imprime, pero no hace fallar la prueba. Si no, la prueba mediría
      // el limitador de GDELT o el cierre de la API de ReliefWeb.
      const deTercero = TERCEROS.test(texto);
      if (!ruido && !deTercero) consola.push(texto);
      if (!ruido && deTercero) terceros.push(texto);
    }
    if (/Content Security Policy|Refused to/i.test(texto)) csp.push(texto);
  });
  page.on('pageerror', (err) => pageErrors.push((err && err.message) || String(err)));
  page.on('requestfailed', (req) => {
    peticionesFallidas.push(`${req.url()} :: ${(req.failure() || {}).errorText}`);
  });
  return { consola, terceros, pageErrors, csp, peticionesFallidas };
}

/** Los terceros que el sitio consulta a propósito y pueden fallar por su cuenta. */
const TERCEROS = /earthquake\.usgs\.gov|eonet\.gsfc\.nasa\.gov|api\.reliefweb\.int|api\.gdeltproject\.org|api\.worldbank\.org|localhost:11434|127\.0\.0\.1:11434/i;

(async () => {
  console.log('===== PRUEBA DE HUMO CONTRA EL SITIO PUBLICADO =====');
  console.log(`base: ${BASE}\n`);
  fs.mkdirSync(SALIDA, { recursive: true });

  const browser = await chromium.launch();

  // ── 1. Con red real ──────────────────────────────────────────────────────
  for (const v of VENTANAS) {
    const context = await browser.newContext({ viewport: { width: v.width, height: v.height } });
    for (const pagina of PAGINAS) {
      const page = await context.newPage();
      const d = diagnosticos(page);
      await page.goto(`${BASE}/${pagina}`, { waitUntil: 'load', timeout: 60000 });
      // Tiempo para que arranquen los temporizadores, las fuentes externas y
      // el globo, que carga tres texturas y construye la escena.
      await page.waitForTimeout(pagina.includes('globe') ? 9000 : 6000);

      const estado = await page.evaluate(() => ({
        titulo: document.title,
        nodos: document.querySelectorAll('*').length,
        canvas: document.querySelectorAll('canvas').length,
        caminos: document.querySelectorAll('svg path').length,
        tarjetas: document.querySelectorAll('.signal-card, [class*="signal-card"]').length,
      }));

      const archivo = path.join(SALIDA, `${pagina.replace('.html', '')}-${v.nombre}.png`);
      await page.screenshot({ path: archivo, fullPage: false });

      const propias = d.peticionesFallidas.filter((u) => !TERCEROS.test(u));
      const ajenas = d.peticionesFallidas.length - propias.length;

      const etiqueta = `${pagina} ${v.nombre}`;
      if (d.pageErrors.length === 0) ok(`${etiqueta}: 0 pageerror`);
      else mal(`${etiqueta}: ${d.pageErrors.length} pageerror · ${d.pageErrors.slice(0, 3).join(' | ')}`);

      if (d.csp.length === 0) ok(`${etiqueta}: 0 violaciones de CSP`);
      else mal(`${etiqueta}: ${d.csp.length} de CSP · ${d.csp.slice(0, 2).join(' | ')}`);

      if (propias.length === 0) ok(`${etiqueta}: 0 peticiones propias fallidas${ajenas ? ` (${ajenas} de terceros, no cuentan)` : ''}`);
      else mal(`${etiqueta}: ${propias.length} peticiones propias fallidas · ${propias.slice(0, 3).join(' | ')}`);

      if (d.consola.length === 0) {
        ok(`${etiqueta}: 0 errores de consola propios${d.terceros.length ? ` (${d.terceros.length} de fuentes externas, ver abajo)` : ''}`);
      } else {
        mal(`${etiqueta}: ${d.consola.length} errores de consola · ${d.consola.slice(0, 3).join(' | ')}`);
      }
      for (const t of d.terceros.slice(0, 6)) {
        const quien = (t.match(/https:\/\/([^/?'"]+)/) || [, '?'])[1];
        console.log(`         · fuente externa rechaza la petición: ${quien}`);
      }

      if (pagina.includes('globe')) {
        // El globo necesita dos canvas: el de WebGL y el de las etiquetas, y
        // el de WebGL tiene que haber pintado algo.
        const pintado = await page.evaluate(() => {
          const cs = [...document.querySelectorAll('canvas')];
          const webgl = cs.find((c) => {
            try { return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
          });
          if (!webgl) return { webgl: false };
          return { webgl: true, w: webgl.width, h: webgl.height };
        });
        if (estado.canvas >= 2 && pintado.webgl && pintado.w > 100) {
          ok(`${etiqueta}: el globo está renderizado (${estado.canvas} canvas, WebGL ${pintado.w}×${pintado.h})`);
        } else {
          mal(`${etiqueta}: el globo NO está renderizado (${JSON.stringify({ ...estado, ...pintado })})`);
        }
      }

      if (pagina.includes('signal')) {
        // Esto sí es nuestro: el feed no puede declararse EN VIVO sin tener
        // ni una señal. Es el defecto que T1 corrigió, y aquí reaparece
        // mientras las fuentes están en vuelo.
        const feed = await page.evaluate(() => ({
          etiqueta: (document.getElementById('feed-state-label') || {}).textContent || '',
          ticker: (document.getElementById('ticker-state-label') || {}).textContent || '',
          tarjetas: document.querySelectorAll('.signal-card, [class*="signal-card"]').length,
        }));
        if (feed.tarjetas === 0 && /EN VIVO|LIVE/i.test(feed.etiqueta + feed.ticker)) {
          mal(`${etiqueta}: el feed dice «${feed.etiqueta.trim()}» / «${feed.ticker.trim()}» con 0 señales`);
        } else {
          ok(`${etiqueta}: el estado del feed concuerda con lo que muestra (${feed.tarjetas} señales, «${feed.etiqueta.trim()}»)`);
        }
      }

      console.log(`         ${etiqueta}: «${estado.titulo}» · ${estado.nodos} nodos · ${estado.canvas} canvas · ${estado.caminos} paths${estado.tarjetas ? ` · ${estado.tarjetas} tarjetas` : ''}`);
      await page.close();
    }
    await context.close();
  }

  // ── 1 bis. Signal a los 2 segundos ───────────────────────────────────────
  /* El caso que motivó esta prueba.

     El HTML venía con "FEED EN VIVO" y "⬡ LIVE" escritos como estado
     inicial, y el estado real solo se escribía al terminar el primer intento.
     En la web publicada eso son hasta treinta segundos afirmando estar en
     vivo con cero señales, porque dos de las cuatro fuentes fallan.

     Dos segundos es el momento en el que se ve: ya ha habido tiempo de
     pintar, y todavía no de que respondan las fuentes lentas. */
  console.log('');
  console.log('--- Signal a los 2 s de cargar ---');
  {
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx2.newPage();
    await page.goto(`${BASE}/aether-signal.html`, { waitUntil: 'commit', timeout: 60000 });
    await page.waitForTimeout(2000);

    const alos2s = await page.evaluate(() => {
      const t = (id) => ((document.getElementById(id) || {}).textContent || '').trim();
      const tarjetas = document.querySelectorAll('.signal-card, [class*="signal-card"]').length;
      // Señales que de verdad vienen de ahora, no de una lectura guardada.
      const marcadas = document.querySelectorAll('[class*="stale"], .ultima-lectura').length;
      return {
        cabecera: t('feed-state-label'),
        ticker: t('ticker-state-label'),
        conteo: t('signal-count'),
        punto: ((document.getElementById('feed-state-dot') || {}).className || ''),
        tarjetas,
        enVivo: tarjetas - marcadas,
      };
    });

    const afirmaVivo = /EN VIVO|LIVE/i.test(alos2s.cabecera + ' ' + alos2s.ticker);
    if (afirmaVivo && alos2s.enVivo === 0) {
      mal(`a los 2 s dice «${alos2s.cabecera}» / «${alos2s.ticker}» con 0 señales en vivo`);
    } else if (afirmaVivo) {
      ok(`a los 2 s dice «${alos2s.cabecera}» y tiene ${alos2s.enVivo} señales en vivo que lo respaldan`);
    } else {
      ok(`a los 2 s no afirma estar en vivo: «${alos2s.cabecera}» / «${alos2s.ticker}» · ${alos2s.conteo}`);
    }

    // El punto de la cabecera no puede estar en verde sin señales en vivo.
    const verde = !/offline|cargando/.test(alos2s.punto);
    if (verde && alos2s.enVivo === 0) {
      mal(`a los 2 s el punto de estado está en verde sin señales en vivo (class="${alos2s.punto}")`);
    } else {
      ok(`a los 2 s el punto de estado concuerda (class="${alos2s.punto}", ${alos2s.enVivo} en vivo)`);
    }

    await page.screenshot({ path: path.join(SALIDA, 'signal-2s.png') });
    await ctx2.close();
  }

  // ── 2. Offline de verdad ─────────────────────────────────────────────────
  console.log('\n--- offline: primera visita con red, luego sin red ---');
  const ctxOffline = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const primera = await ctxOffline.newPage();
  await primera.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });

  // El service worker tiene que quedar activo y con su precache lleno.
  const sw = await primera.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { soportado: false };
    const reg = await navigator.serviceWorker.ready;
    // Esperar a que acabe de precachear.
    for (let i = 0; i < 40; i++) {
      const nombres = await caches.keys();
      let total = 0;
      for (const n of nombres) total += (await (await caches.open(n)).keys()).length;
      if (total > 100) return { soportado: true, activo: !!reg.active, cacheados: total, cachés: nombres.length };
      await new Promise((r) => setTimeout(r, 500));
    }
    const nombres = await caches.keys();
    let total = 0;
    for (const n of nombres) total += (await (await caches.open(n)).keys()).length;
    return { soportado: true, activo: !!reg.active, cacheados: total, cachés: nombres.length };
  });

  if (sw.soportado && sw.activo && sw.cacheados > 100) {
    ok(`service worker activo con ${sw.cacheados} recursos en ${sw.cachés} cachés`);
  } else {
    mal(`el service worker no ha quedado listo: ${JSON.stringify(sw)}`);
  }

  // Visitar las otras tres con red, para que la navegación quede precacheada.
  for (const p of PAGINAS.slice(1)) {
    await primera.goto(`${BASE}/${p}`, { waitUntil: 'load', timeout: 60000 });
    await primera.waitForTimeout(p.includes('globe') ? 7000 : 2500);
  }

  await ctxOffline.setOffline(true);
  console.log('         red cortada');

  for (const pagina of PAGINAS) {
    const page = await ctxOffline.newPage();
    const d = diagnosticos(page);
    let cargo = true;
    try {
      await page.goto(`${BASE}/${pagina}`, { waitUntil: 'load', timeout: 45000 });
    } catch (err) {
      cargo = false;
      mal(`offline ${pagina}: no carga · ${err.message.split('\n')[0]}`);
    }
    if (cargo) {
      await page.waitForTimeout(pagina.includes('globe') ? 8000 : 4000);
      const estado = await page.evaluate(() => ({
        titulo: document.title,
        nodos: document.querySelectorAll('*').length,
        canvas: document.querySelectorAll('canvas').length,
        texto: (document.body.innerText || '').trim().length,
      }));
      const archivo = path.join(SALIDA, `offline-${pagina.replace('.html', '')}.png`);
      await page.screenshot({ path: archivo });

      if (estado.nodos > 50 && estado.texto > 20) {
        ok(`offline ${pagina}: carga (${estado.nodos} nodos, ${estado.texto} caracteres de texto)`);
      } else {
        mal(`offline ${pagina}: carga vacía (${JSON.stringify(estado)})`);
      }
      if (pagina.includes('globe')) {
        if (estado.canvas >= 2) ok(`offline ${pagina}: el globo se renderiza (${estado.canvas} canvas)`);
        else mal(`offline ${pagina}: el globo no se renderiza (${estado.canvas} canvas)`);
      }
      if (d.pageErrors.length) mal(`offline ${pagina}: ${d.pageErrors.length} pageerror · ${d.pageErrors.slice(0, 2).join(' | ')}`);
    }
    await page.close();
  }

  await ctxOffline.close();
  await browser.close();

  console.log(`\ncapturas en ${path.relative(process.cwd(), SALIDA).replace(/\\/g, '/')}`);
  console.log(`\n===== ${fallos === 0 ? 'SIN FALLOS' : fallos + ' FALLOS'} =====`);
  process.exit(fallos === 0 ? 0 : 1);
})();
