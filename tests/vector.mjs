/**
 * T25 · Prueba de los datos de Vector.
 *
 * Dos cosas que el diagrama anterior no cumplía y que ahora se comprueban:
 *
 *   1. **Conservación.** Lo que entra por el nodo total de un bloque tiene
 *      que salir repartido entre sus destinos. Antes el diagrama tenía 42
 *      enlaces escritos a mano y nada obligaba a que los hubs cuadraran:
 *      entraban 1.240 + 890 + 680 + 340 y salían 820 + 380 + 440 + 210, es
 *      decir, 3.150 dentro y 1.850 fuera. El resto se perdía por el camino,
 *      sin que el diagrama lo dijera.
 *
 *   2. **Stocks y flujos separados.** Un saldo («lo que hay acumulado») y un
 *      flujo anual («lo que se mueve en un año») son magnitudes de
 *      dimensiones distintas. Mezclarlos en la misma escala no significa
 *      nada, así que ningún bloque puede tener enlaces de las dos clases, y
 *      la vista por defecto solo muestra flujos.
 *
 * Y lo de siempre: que todo enlace tenga valor, unidad, periodo y fuente.
 *
 * Uso: node tests/vector.mjs [--base http://localhost:8080/OkrtSystemLabs]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { REPO_DIR, freezeClock } from './lib/harness.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080').replace(/\/$/, '');

let fallos = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const mal = (m) => { fallos++; console.log(`   FALLO ${m}`); };

(async () => {
  console.log('===== PRUEBA DE LOS DATOS DE VECTOR (T25) =====\n');

  const fichero = path.join(REPO_DIR, 'data', 'vector.json');
  if (!fs.existsSync(fichero)) {
    mal('no existe data/vector.json; ejecuta `npm run vector`');
    console.log('\n===== 1 FALLOS =====');
    process.exit(1);
  }
  const d = JSON.parse(fs.readFileSync(fichero, 'utf8'));

  // ── 1. Conservación ───────────────────────────────────────────────────────
  for (const b of d.bloques) {
    const entradas = b.enlaces.filter((l) => l.s === 'TOTAL_' + b.id).reduce((a, l) => a + l.v, 0);
    const residuo = Math.abs(entradas - b.total);
    const tol = Math.max(0.5, b.enlaces.length * 0.05);
    if (residuo <= tol) {
      ok(`${b.id.padEnd(16)} conserva: total ${b.total}, enlaces ${Math.round(entradas * 10) / 10} (residuo ${Math.round(residuo * 100) / 100} ≤ ${Math.round(tol * 100) / 100})`);
    } else {
      mal(`${b.id}: entran ${b.total} y salen ${Math.round(entradas * 10) / 10}; residuo ${Math.round(residuo * 100) / 100} > ${Math.round(tol * 100) / 100}`);
    }
  }

  // El fichero publica su propio cálculo de conservación: tiene que coincidir.
  for (const c of d.conservacion || []) {
    if (!c.ok) mal(`el fichero declara que ${c.bloque} no conserva (residuo ${c.residuo})`);
  }

  // ── 2. Stocks y flujos, nunca en el mismo bloque ─────────────────────────
  const clases = new Set(d.bloques.map((b) => b.clase));
  if ([...clases].every((c) => c === 'stock' || c === 'flujo')) ok(`clases declaradas: ${[...clases].join(', ')}`);
  else mal(`clases inesperadas: ${[...clases].join(', ')}`);

  const soloFlujos = (d.porDefecto || []).every((id) => {
    const b = d.bloques.find((x) => x.id === id);
    return b && b.clase === 'flujo';
  });
  if (soloFlujos && (d.porDefecto || []).length) {
    ok(`la vista por defecto son ${d.porDefecto.length} bloques y todos son flujos anuales`);
  } else {
    mal('la vista por defecto mezcla saldos con flujos, o está vacía');
  }

  // ── 3. Procedencia de cada enlace ────────────────────────────────────────
  const sinFuente = [];
  const sinPeriodo = [];
  const sinUnidad = [];
  let enlaces = 0;
  for (const b of d.bloques) {
    for (const l of b.enlaces) {
      enlaces++;
      if (!l.source) sinFuente.push(`${b.id}/${l.t}`);
      if (!l.year) sinPeriodo.push(`${b.id}/${l.t}`);
      if (!l.unit) sinUnidad.push(`${b.id}/${l.t}`);
      if (!/^https:\/\//.test(l.url || '')) sinFuente.push(`${b.id}/${l.t} (url)`);
    }
  }
  if (!sinFuente.length) ok(`los ${enlaces} enlaces llevan fuente y enlace https`);
  else mal(`${sinFuente.length} enlaces sin fuente o sin url: ${sinFuente.slice(0, 5).join(', ')}`);
  if (!sinPeriodo.length) ok('todos los enlaces llevan periodo');
  else mal(`${sinPeriodo.length} enlaces sin periodo`);
  if (!sinUnidad.length) ok('todos los enlaces llevan unidad');
  else mal(`${sinUnidad.length} enlaces sin unidad`);

  // ── 4. La página lo muestra y lo dice ────────────────────────────────────
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await freezeClock(context);
  const page = await context.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.route(/flagcdn|fonts\.g|11434/i, (r) => r.abort('connectionrefused'));
  await page.goto(`${BASE}/aether-vector.html`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);

  const vista = await page.evaluate(() => ({
    pie: (document.getElementById('vector-pie') || {}).textContent || '',
    paths: document.querySelectorAll('#sankey-svg path').length,
  }));

  if (/FLUJO ANUAL/.test(vista.pie) && !/SALDO/.test(vista.pie)) {
    ok('la vista inicial se declara como flujo anual y no incluye saldos');
  } else {
    mal(`la barra inferior no distingue la clase: «${vista.pie.slice(0, 120)}»`);
  }
  if (/cuadra/.test(vista.pie)) ok('la barra inferior dice que el bloque cuadra');
  else mal('la barra inferior no publica el estado de conservación');
  if (vista.paths > 5) ok(`el diagrama dibuja ${vista.paths} enlaces`);
  else mal(`el diagrama solo dibuja ${vista.paths} enlaces`);

  // Cambiar a un saldo tiene que cambiar la etiqueta.
  await page.evaluate(() => {
    const btn = document.querySelector('.flow-btn[data-flow="reserves"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(900);
  const saldo = await page.evaluate(() => (document.getElementById('vector-pie') || {}).textContent || '');
  if (/^SALDO/.test(saldo)) ok(`al elegir reservas se declara como saldo: «${saldo.slice(0, 90)}»`);
  else mal(`al elegir reservas no se declara como saldo: «${saldo.slice(0, 90)}»`);

  if (!errores.length) ok('la página no da errores');
  else mal(`errores: ${errores.slice(0, 3).join(' | ')}`);

  await browser.close();
  console.log(`\n===== ${fallos === 0 ? 'SIN FALLOS' : fallos + ' FALLOS'} =====`);
  process.exit(fallos === 0 ? 0 : 1);
})();
