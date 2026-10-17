/**
 * T8 · Prueba de la watchlist.
 *
 * dom-safety-layer.js sanea, entre otros contenedores, #aether-watchlist.
 * Su lista de atributos permitidos solo incluía 'data-value', así que
 * borraba data-open y data-del de los botones y los dejaba sin efecto.
 *
 * Esta prueba comprueba el camino completo sobre la página real:
 *   1. añadir una región a la watchlist;
 *   2. que los botones conservan sus atributos data-*;
 *   3. que el botón de cargar (data-open) cambia la región activa;
 *   4. que el botón de eliminar (data-del) la quita y no vuelve al recargar.
 *
 * Uso: node tests/watchlist.mjs [--base http://localhost:8080]
 */
import { chromium } from 'playwright';
import { freezeClock } from './lib/harness.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080').replace(/\/$/, '');

let failures = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const bad = (m) => { failures++; console.log(`   FALLO ${m}`); };

/** Abre el dashboard (está detrás de la portada). */
async function openDashboard(page) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2000);
  const cta = await page.$('[data-launch-aether]');
  if (cta) { await cta.click(); await page.waitForTimeout(3000); }
}

(async () => {
  console.log('===== PRUEBA DE LA WATCHLIST (T8) =====\n');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await freezeClock(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message.split('\n')[0]));
  await page.route(/flagcdn|fonts\.g|11434|usgs|eonet|reliefweb|gdelt|worldbank/i, (r) => r.abort('connectionrefused'));

  await openDashboard(page);

  // 1. Añadir dos regiones distintas a la watchlist.
  const added = await page.evaluate(async () => {
    const sel = document.getElementById('region-sel');
    const btn = [...document.querySelectorAll('button,a')]
      .find((b) => /añadir actual/i.test(b.textContent || ''));
    if (!sel || !btn) return { error: 'no se encontro el selector o el boton de anadir' };
    const codes = [];
    for (const code of ['ESP', 'UKR']) {
      sel.value = code;
      if (typeof window.onRegionChange === 'function') window.onRegionChange();
      await new Promise((r) => setTimeout(r, 900));
      btn.click();
      await new Promise((r) => setTimeout(r, 700));
      codes.push(code);
    }
    return { codes };
  });
  if (added.error) { bad(added.error); await browser.close(); process.exit(1); }
  await page.waitForTimeout(1200);

  // 2. Los atributos data-* deben seguir en su sitio.
  //
  // T8 arreglo dom-safety-layer, que los borraba. T14 ha retirado esa capa
  // entera: el escapado en origen de la Fase 1 cubre los sumideros, como
  // demuestra tests/xss.mjs. Si vuelve a existir un saneador, esta prueba
  // fuerza una pasada suya para comprobar que no rompe los botones.
  await page.evaluate(() => {
    const box = document.getElementById('aether-watchlist');
    if (box && window.AetherSafeDOM) window.AetherSafeDOM.sanitizeTree(box);
  });
  await page.waitForTimeout(400);

  const attrs = await page.evaluate(() => ({
    items: document.querySelectorAll('#aether-watchlist .aether-watch-item').length,
    open: [...document.querySelectorAll('#aether-watchlist [data-open]')].map((b) => b.getAttribute('data-open')),
    del: [...document.querySelectorAll('#aether-watchlist [data-del]')].map((b) => b.getAttribute('data-del')),
    botones: document.querySelectorAll('#aether-watchlist .aether-watch-icon').length,
  }));

  if (attrs.items >= 2) ok(`la watchlist tiene ${attrs.items} regiones`);
  else bad(`la watchlist tiene ${attrs.items} regiones, se esperaban 2 o mas`);

  if (attrs.open.length === attrs.items && attrs.open.every(Boolean)) {
    ok(`data-open sobrevive al saneador: ${JSON.stringify(attrs.open)}`);
  } else {
    bad(`data-open perdido o vacio: ${JSON.stringify(attrs.open)} sobre ${attrs.botones} botones`);
  }
  if (attrs.del.length === attrs.items && attrs.del.every(Boolean)) {
    ok(`data-del sobrevive al saneador: ${JSON.stringify(attrs.del)}`);
  } else {
    bad(`data-del perdido o vacio: ${JSON.stringify(attrs.del)} sobre ${attrs.botones} botones`);
  }

  // 3. Cargar desde la watchlist debe cambiar la region activa.
  await page.evaluate(() => {
    const sel = document.getElementById('region-sel');
    sel.value = 'WLD';
    if (typeof window.onRegionChange === 'function') window.onRegionChange();
  });
  await page.waitForTimeout(900);

  const target = attrs.open[0];
  const openBtn = await page.$(`#aether-watchlist [data-open="${target}"]`);
  if (!openBtn) {
    bad(`no se encontro el boton de cargar de ${target}`);
  } else {
    await openBtn.click();
    await page.waitForTimeout(1500);
    const now = await page.$eval('#region-sel', (e) => e.value);
    if (now === target) ok(`cargar desde la watchlist cambia la region a ${now}`);
    else bad(`cargar desde la watchlist no cambio la region: ${now} en vez de ${target}`);
  }

  // 4. Eliminar debe quitarla, y no debe volver al recargar.
  const before = attrs.items;
  const delBtn = await page.$(`#aether-watchlist [data-del="${target}"]`);
  if (!delBtn) {
    bad(`no se encontro el boton de eliminar de ${target}`);
  } else {
    await delBtn.click();
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => ({
      items: document.querySelectorAll('#aether-watchlist .aether-watch-item').length,
      codes: [...document.querySelectorAll('#aether-watchlist [data-open]')].map((b) => b.getAttribute('data-open')),
    }));
    if (after.items === before - 1 && !after.codes.includes(target)) {
      ok(`eliminar quita ${target} de la watchlist (${before} -> ${after.items})`);
    } else {
      bad(`eliminar no funciono: ${before} -> ${after.items}, quedan ${JSON.stringify(after.codes)}`);
    }

    await openDashboard(page);
    await page.waitForTimeout(1500);
    const persisted = await page.evaluate(() =>
      [...document.querySelectorAll('#aether-watchlist [data-open]')].map((b) => b.getAttribute('data-open')));
    if (!persisted.includes(target)) ok(`${target} sigue fuera tras recargar: ${JSON.stringify(persisted)}`);
    else bad(`${target} reaparecio tras recargar: ${JSON.stringify(persisted)}`);
  }

  if (pageErrors.length === 0) ok('sin pageerror durante la prueba');
  else bad(`pageerror: ${JSON.stringify([...new Set(pageErrors)].slice(0, 3))}`);

  await browser.close();
  console.log(`\n===== ${failures === 0 ? 'SIN FALLOS' : failures + ' FALLOS'} =====`);
  process.exit(failures === 0 ? 0 : 1);
})();
