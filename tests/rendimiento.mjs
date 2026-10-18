/**
 * T28 y T30 · Prueba de rendimiento del motor y del globo.
 *
 * Mide, no estima. Dos cosas:
 *
 *  1. **Tareas largas** (`longtask`, más de 50 ms de bloqueo del hilo
 *     principal) al cambiar de región en el panel. El Monte Carlo de 400
 *     simulaciones costaba 86 ms medidos y producía una tarea larga en cada
 *     cambio; con el worker de T28 el hilo principal no se bloquea.
 *
 *  2. **Fotogramas y tiempo de carga del globo**, que es la página más cara.
 *
 * Y de paso comprueba lo que de verdad importa de haber movido el cálculo a
 * un worker: que **da el mismo resultado** que el hilo principal. Un worker
 * que devuelve otros números no es una optimización, es un error.
 *
 * Uso: node tests/rendimiento.mjs [--base http://localhost:8080/OkrtSystemLabs]
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080').replace(/\/$/, '');

/** Tope de tareas largas aceptadas al recorrer cinco regiones. */
const MAX_TAREAS_LARGAS = 2;

/**
 * Topes del globo.
 *
 * Se mide lo que NO depende de la máquina: llamadas de dibujado, triángulos y
 * objetos en la escena. Antes de T30 eran 1.724 llamadas, 433.656 triángulos
 * y 1.728 hijos, porque cada país tenía seis mallas sueltas.
 *
 * Los fps se MIDEN y se IMPRIMEN, pero no deciden si la prueba pasa. El
 * navegador de las pruebas va sin GPU (SwiftShader), y en esta escena el
 * coste dominante es de relleno: la Tierra, las nubes y tres capas de
 * atmósfera transparentes y aditivas que cubren media pantalla. Eso en
 * software es lentísimo y en una GPU de verdad no se parece. Poner un umbral
 * de fps aquí sería medir el entorno de pruebas, no el globo.
 */
const MAX_LLAMADAS = 700;
const MAX_HIJOS = 700;

let fallos = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const mal = (m) => { fallos++; console.log(`   FALLO ${m}`); };

const observarTareasLargas = () => {
  window.__largas = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push(Math.round(e.duration));
    }).observe({ entryTypes: ['longtask'] });
  } catch (err) { window.__sinObservador = true; }
};

(async () => {
  console.log('===== RENDIMIENTO (T28 · T30) =====\n');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // ── Panel ────────────────────────────────────────────────────────────────
  const panel = await context.newPage();
  const errores = [];
  panel.on('pageerror', (e) => errores.push(e.message));
  await panel.route(/flagcdn|fonts\.g|11434/i, (r) => r.abort('connectionrefused'));
  await panel.addInitScript(observarTareasLargas);
  await panel.goto(`${BASE}/index.html?seed=1`, { waitUntil: 'load', timeout: 45000 });
  await panel.click('[data-action="launch-aether"]');
  await panel.waitForTimeout(4500);

  const sinObservador = await panel.evaluate(() => !!window.__sinObservador);
  await panel.evaluate(() => { window.__largas.length = 0; });

  const recorrido = await panel.evaluate(async () => {
    const sel = document.getElementById('region-sel');
    const etiquetas = [];
    for (const iso of ['ESP', 'UKR', 'SOM', 'JPN', 'USA']) {
      sel.value = iso;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      etiquetas.push((document.getElementById('mc-semilla') || {}).textContent || '');
    }
    return etiquetas;
  });
  await panel.waitForTimeout(800);

  const largas = await panel.evaluate(() => window.__largas.slice().sort((a, b) => b - a));
  if (sinObservador) {
    console.log('   nota  este navegador no expone longtask; se omite esa comprobación');
  } else if (largas.length <= MAX_TAREAS_LARGAS) {
    ok(`${largas.length} tareas largas al recorrer 5 regiones (tope ${MAX_TAREAS_LARGAS})` +
       (largas.length ? `, mayores: ${largas.slice(0, 4).join(' ')} ms` : ''));
  } else {
    mal(`${largas.length} tareas largas: ${largas.slice(0, 6).join(' ')} ms`);
  }

  // La proyección tiene que calcularse fuera del hilo principal o salir de
  // la memoria; si dice «hilo principal» es que el worker no arrancó.
  const enPrincipal = recorrido.filter((t) => /hilo principal/.test(t));
  if (!enPrincipal.length) ok(`la proyección se calcula en el worker o sale de memoria: «${recorrido[0]}»`);
  else mal(`${enPrincipal.length} de 5 proyecciones se calcularon en el hilo principal`);

  // Memoria: volver a una región ya vista no debe recalcular.
  const memoria = await panel.evaluate(async () => {
    const h = window.__AETHER__;
    const antes = await h.proyeccionDe('ESP', 103);
    const t0 = performance.now();
    const despues = await h.proyeccionDe('ESP', 103);
    return { ms: performance.now() - t0, iguales: JSON.stringify(antes.bands) === JSON.stringify(despues.bands) };
  });
  if (memoria.iguales && memoria.ms < 5) ok(`la segunda petición sale de memoria en ${memoria.ms.toFixed(2)} ms`);
  else if (!memoria.iguales) mal('la segunda petición devuelve otro resultado: la memoria no es válida');
  else mal(`la segunda petición tarda ${memoria.ms.toFixed(1)} ms: no está saliendo de memoria`);

  // Lo esencial: el worker tiene que dar el mismo resultado.
  const coherencia = await panel.evaluate(async () => {
    const h = window.__AETHER__;
    const local = h.runMonteCarlo('UKR', 103);
    const viaWorker = await h.proyeccionDe('UKR', 103);
    return {
      iguales: JSON.stringify(local.bands) === JSON.stringify(viaWorker.bands),
      local: local.bands[103], worker: viaWorker.bands[103],
    };
  });
  if (coherencia.iguales) ok('el worker y el hilo principal dan exactamente el mismo resultado');
  else mal(`el worker difiere: hilo ${JSON.stringify(coherencia.local)} vs worker ${JSON.stringify(coherencia.worker)}`);

  // ── Globo ────────────────────────────────────────────────────────────────
  const globo = await context.newPage();
  globo.on('pageerror', (e) => errores.push('globo: ' + e.message));
  await globo.route(/flagcdn|fonts\.g|11434/i, (r) => r.abort('connectionrefused'));
  const t0 = Date.now();
  await globo.goto(`${BASE}/aether-globe-v3.html`, { waitUntil: 'load', timeout: 60000 });
  await globo.waitForFunction(() => document.querySelectorAll('canvas').length >= 2, { timeout: 30000 });
  const carga = Date.now() - t0;

  await globo.waitForTimeout(3000);
  const fps = await globo.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const t = performance.now();
    const tic = () => {
      n++;
      if (performance.now() - t < 2000) requestAnimationFrame(tic);
      else resolve(Math.round(n / ((performance.now() - t) / 1000)));
    };
    requestAnimationFrame(tic);
  }));

  const malla = await globo.evaluate(() => {
    const h = window.__AETHER_GLOBE__;
    const d = window.__AETHER_GLOBE_DIAG__;
    return {
      paises: h && h.COUNTRIES ? h.COUNTRIES.length : 0,
      info: d ? d.info : null,
      instancias: d && d.dotInstances ? d.dotInstances.count : null,
      sueltas: d ? d.dotMeshes.length + d.pulseMeshes.length : null,
    };
  });

  console.log(`   dato  el globo carga en ${carga} ms con ${malla.paises} países y rinde ${fps} fps`);
  console.log('   dato  (los fps de aquí salen de un navegador sin GPU; valen para comparar, no como cifra de usuario)');

  if (!malla.info) {
    mal('el globo no expone __AETHER_GLOBE_DIAG__.info');
  } else {
    const { calls, triangles, hijos } = malla.info;
    if (calls <= MAX_LLAMADAS) ok(`${calls} llamadas de dibujado (eran 1.724 antes de instanciar; tope ${MAX_LLAMADAS})`);
    else mal(`${calls} llamadas de dibujado, por encima de ${MAX_LLAMADAS}`);
    if (hijos <= MAX_HIJOS) ok(`${hijos} objetos en la escena (eran 1.728; tope ${MAX_HIJOS})`);
    else mal(`${hijos} objetos en la escena, por encima de ${MAX_HIJOS}`);
    console.log(`   dato  ${triangles.toLocaleString('es-ES')} triángulos (eran 433.656)`);
  }

  if (malla.instancias === malla.paises) {
    ok(`los marcadores son una malla instanciada con ${malla.instancias} instancias`);
  } else {
    mal(`la malla instanciada tiene ${malla.instancias} instancias y hay ${malla.paises} países`);
  }
  if (malla.sueltas === 0) ok('no queda ninguna malla de marcador suelta');
  else mal(`quedan ${malla.sueltas} mallas de marcador sueltas`);

  // El raycast solo puede correr una vez por fotograma, no en cada mousemove.
  const raycasts = await globo.evaluate(async () => {
    const d = window.__AETHER_GLOBE_DIAG__;
    if (!d || !d.dotInstances) return null;
    let n = 0;
    const original = d.dotInstances.raycast.bind(d.dotInstances);
    d.dotInstances.raycast = function (...a) { n++; return original(...a); };
    // 40 movimientos de puntero en un solo fotograma.
    for (let i = 0; i < 40; i++) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 700 + i, clientY: 400, bubbles: true }));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    d.dotInstances.raycast = original;
    return n;
  });
  if (raycasts === null) mal('no se puede comprobar el raycast');
  else if (raycasts <= 2) ok(`40 movimientos de puntero producen ${raycasts} raycast (antes, 40)`);
  else mal(`40 movimientos de puntero producen ${raycasts} raycast`);

  if (!errores.length) ok('ninguna de las dos páginas da errores');
  else mal(`errores: ${errores.slice(0, 3).join(' | ')}`);

  await browser.close();
  console.log(`\n===== ${fallos === 0 ? 'SIN FALLOS' : fallos + ' FALLOS'} =====`);
  process.exit(fallos === 0 ? 0 : 1);
})();
