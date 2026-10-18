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
import { chromium, webkit, devices } from 'playwright';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'https://franjuanp.github.io/OkrtSystemLabs').replace(/\/$/, '');
const SALIDA = argOf('out', path.join(import.meta.dirname, 'shots', 'publicado'));

/* Las cinco páginas que se publican. `metodologia.html` entra aquí porque
   explica cómo se calcula lo que enseñan las otras cuatro: si se rompe, el
   panel sigue pintando números que ya no hay forma de auditar. */
const PAGINAS = ['index.html', 'aether-globe-v3.html', 'aether-signal.html',
  'aether-vector.html', 'metodologia.html'];

/** Cada página con un trozo de su <title>, para saber si se sirvió ELLA. */
const PAGINAS_TITULO = [
  ['index.html', 'Global Intelligence System'],
  ['aether-globe-v3.html', 'Global Intelligence Globe'],
  ['aether-signal.html', 'AETHER SIGNAL'],
  ['aether-vector.html', 'AETHER VECTOR'],
  ['metodologia.html', 'Metodología'],
];
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
  /* El fichero de datos, pedido como lo pide la página.

     Es lo único de lo que depende todo el panel, y un 404 aquí se vería como
     «SIN DATOS» en los 217 países sin un solo error de consola. */
  /* El botón GLOBE del panel, pulsado de verdad.

     Que las dos páginas carguen por separado no dice nada sobre el botón que
     lleva de una a otra, y ese botón ya se quedó muerto una vez sin que
     ninguna prueba se enterase: `syncAetherGlobeBridge()` lanzaba antes de
     `window.open` y la pestaña no llegaba a abrirse. Aquí se pulsa y se
     comprueba que el globo RENDERIZA, no solo que la URL cambió. */
  /* ── SEGUNDA VISITA: con el service worker YA controlando ──────────────
   *
   * Todo lo de arriba se mide en la PRIMERA visita, cuando el worker se está
   * instalando y todavía no decide qué se sirve. Esa diferencia escondió un
   * fallo durante una versión entera: `aether-globe-v3.html?ctx=<marca>` no
   * casaba con el precache, la navegación caía al respaldo y el respaldo
   * servía `index.html`. El botón GLOBE llevaba a la portada, y solo a quien
   * ya había estado antes.
   *
   * Se repite en los dos motores porque el aviso llegó de un iPhone, y el
   * motor de iPhone es WebKit.
   */
  console.log('\n--- segunda visita, con el service worker controlando ---');
  for (const [motor, nombreMotor] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
    const nav = await motor.launch();
    for (const v of VENTANAS) {
      const ctxSw = await nav.newContext({ viewport: { width: v.width, height: v.height } });
      const inicio = await ctxSw.newPage();
      await inicio.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
      await inicio.waitForTimeout(7000);
      await inicio.reload({ waitUntil: 'load', timeout: 90000 });
      await inicio.waitForTimeout(5000);
      const controlando = await inicio.evaluate(() => !!navigator.serviceWorker.controller);
      if (!controlando) {
        mal(`${nombreMotor} ${v.nombre}: el service worker no llegó a controlar la página`);
        await ctxSw.close();
        continue;
      }

      let bien = 0;
      for (const [pagina, trozo] of PAGINAS_TITULO) {
        /* Con parámetros y sin ellos: el fallo no era del `?ctx=` en
           concreto, era que CUALQUIER parámetro rompía la correspondencia.
           `source` e `icon` son los del `start_url` del manifiesto. */
        for (const query of ['', '?ctx=' + Date.now(), '?source=pwa&icon=okrtv2']) {
          const page = await ctxSw.newPage();
          const d = diagnosticos(page);
          await page.goto(`${BASE}/${pagina}${query}`, { waitUntil: 'load', timeout: 90000 });
          await page.waitForTimeout(pagina.includes('globe') ? 9000 : 2500);
          const titulo = await page.title();
          if (!titulo.includes(trozo)) {
            mal(`${nombreMotor} ${v.nombre}: ${pagina}${query} muestra «${titulo}» (esperaba «${trozo}»)`);
          } else if (d.pageErrors.length) {
            mal(`${nombreMotor} ${v.nombre}: ${pagina}${query} da ${d.pageErrors.length} pageerror · ${d.pageErrors[0]}`);
          } else if (d.csp.length) {
            mal(`${nombreMotor} ${v.nombre}: ${pagina}${query} viola la CSP · ${d.csp[0]}`);
          } else if (pagina.includes('globe')) {
            const c = await page.evaluate(() => document.querySelectorAll('canvas').length);
            if (c >= 2) bien++;
            else mal(`${nombreMotor} ${v.nombre}: el globo no renderiza en la segunda visita (${c} canvas)`);
          } else {
            bien++;
          }
          await page.close();
        }
      }
      if (bien) ok(`${nombreMotor} ${v.nombre}: ${bien} navegaciones correctas con el worker controlando`);
      await ctxSw.close();
    }
    await nav.close();
  }

  console.log('\n--- el botón GLOBE abre el globo ---');
  {
    const ctxBoton = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctxBoton.newPage();
    const d = diagnosticos(page);
    try {
      await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(3000);
      // El panel vive detrás de la portada; se entra como entra una persona.
      await page.evaluate(() => document.querySelector('.nav-cta[data-launch-aether]')?.click());
      await page.waitForTimeout(3000);

      const boton = await page.$('[data-action="open-globe"]');
      if (!boton) {
        mal('el botón GLOBE no existe en el panel publicado');
      } else {
        const antes = ctxBoton.pages().length;
        const urlAntes = page.url();
        await boton.click();
        // La pestaña nueva tarda en aparecer; si está bloqueada, navega aquí.
        await page.waitForTimeout(9000);

        const paginas = ctxBoton.pages();
        const nueva = paginas.length > antes ? paginas[paginas.length - 1] : null;
        const destino = nueva || (page.url() !== urlAntes ? page : null);

        if (!destino) {
          mal('el botón GLOBE no abre nada: ni pestaña nueva ni navegación');
        } else {
          const comoAbrio = nueva ? 'en una pestaña nueva' : 'en la misma pestaña';
          if (!/aether-globe-v3\.html/.test(destino.url())) {
            mal(`el botón GLOBE lleva a ${destino.url()}`);
          } else {
            await destino.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
            await destino.waitForTimeout(9000);
            const pintado = await destino.evaluate(() => {
              const cs = [...document.querySelectorAll('canvas')];
              const webgl = cs.find((c) => {
                try { return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
              });
              return { canvas: cs.length, webgl: !!webgl, w: webgl ? webgl.width : 0 };
            });
            if (pintado.canvas >= 2 && pintado.webgl && pintado.w > 100) {
              ok(`el botón GLOBE abre el globo ${comoAbrio} y renderiza (${pintado.canvas} canvas, WebGL ${pintado.w}px)`);
            } else {
              mal(`el botón GLOBE abre el globo ${comoAbrio} pero NO renderiza (${JSON.stringify(pintado)})`);
            }
            const archivo = path.join(SALIDA, 'boton-globe.png');
            await destino.screenshot({ path: archivo });
          }
        }
      }
      if (d.pageErrors.length) {
        mal(`el panel da ${d.pageErrors.length} pageerror al abrir el globo · ${d.pageErrors.slice(0, 2).join(' | ')}`);
      }
    } catch (err) {
      mal(`el botón GLOBE: ${err.message.split('\n')[0]}`);
    }
    await ctxBoton.close();
  }

  console.log('\n--- data/latest.json ---');
  try {
    const r = await fetch(`${BASE}/data/latest.json`);
    if (!r.ok) {
      mal(`data/latest.json responde ${r.status}`);
    } else {
      const d = await r.json();
      const paises = Object.keys(d.paises || {}).length;
      const indicadores = Object.keys(d.indicadores || {}).length;
      if (paises >= 200 && indicadores >= 50) {
        ok(`data/latest.json: 200 · ${paises} países · ${indicadores} indicadores · generado ${String(d.generado || '').slice(0, 10)}`);
      } else {
        mal(`data/latest.json llega corto: ${paises} países, ${indicadores} indicadores`);
      }
      // El desglose del UCDP tiene que viajar: de él dependen los niveles.
      const conBloque = Object.values(d.paises || {}).filter((p) => p.conflicto).length;
      if (conBloque === paises) ok(`el bloque de conflicto viaja en los ${conBloque} países`);
      else mal(`${paises - conBloque} países sin bloque de conflicto en el fichero publicado`);
    }
  } catch (err) {
    mal(`data/latest.json: no se puede leer · ${err.message.split('\n')[0]}`);
  }

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
