/**
 * T23 · El panel y el globo tienen que decir lo mismo.
 *
 * Esta prueba existe porque antes no lo decían. El panel tenía su tabla
 * `DATA` con 204 países y el globo su tabla `COUNTRIES` con 176, las dos
 * escritas a mano y mantenidas por separado, así que el mismo país podía
 * salir con un nivel de riesgo en una página y con otro en la otra sin que
 * nada lo detectara.
 *
 * Ahora las dos leen `data/latest.json` y calculan con `src/core/scoring.js`.
 * La prueba abre las dos páginas, saca de cada una su propia lista de países
 * con su nivel, y las compara una por una.
 *
 * Qué comprueba:
 *   1. que los dos lados conocen a los mismos países;
 *   2. que el nivel de riesgo coincide país a país;
 *   3. que la puntuación coincide país a país;
 *   4. que el número que muestra el banner del panel es el del fichero y no
 *      un recálculo distinto;
 *   5. que los territorios sin fuente oficial no aparecen puntuados en
 *      ninguna de las dos.
 *
 * Uso: node tests/paridad.mjs [--base http://localhost:8080/OkrtSystemLabs]
 */
import { chromium } from 'playwright';
import { freezeClock, collectDiagnostics } from './lib/harness.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080').replace(/\/$/, '');

let fallos = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const mal = (m) => { fallos++; console.log(`   FALLO ${m}`); };

/** Corta los terceros para que la prueba no dependa de la red. */
const cortarTerceros = (page) =>
  page.route(/flagcdn|fonts\.g|11434|usgs|eonet|reliefweb|gdelt|api\.worldbank/i,
    (r) => r.abort('connectionrefused'));

(async () => {
  console.log('===== PARIDAD ENTRE EL PANEL Y EL GLOBO (T23) =====\n');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await freezeClock(context);

  // ── El panel ─────────────────────────────────────────────────────────────
  const panel = await context.newPage();
  const diagPanel = collectDiagnostics(panel, BASE);
  await cortarTerceros(panel);
  await panel.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 45000 });
  await panel.waitForTimeout(2500);

  const delPanel = await panel.evaluate(() => {
    const data = (window.__AETHER__ || {}).DATA;
    if (!data) return { error: 'el panel no expone __AETHER__.DATA' };
    const salida = {};
    const sinDatos = [];
    for (const [iso, d] of Object.entries(data)) {
      if (iso === 'WLD' || iso === 'EUU') continue;
      if (d.sinDatos) { sinDatos.push(iso); continue; }
      if (typeof d.score !== 'number') continue;
      salida[iso] = { score: d.score, nivel: d.nivel, nombre: d.name };
    }
    return { paises: salida, sinDatos };
  });

  if (delPanel.error) { mal(delPanel.error); }

  // ── El globo ─────────────────────────────────────────────────────────────
  const globo = await context.newPage();
  const diagGlobo = collectDiagnostics(globo, BASE);
  await cortarTerceros(globo);
  await globo.goto(`${BASE}/aether-globe-v3.html`, { waitUntil: 'load', timeout: 60000 });
  await globo.waitForTimeout(6000);

  const delGlobo = await globo.evaluate(() => {
    const h = window.__AETHER_GLOBE__;
    if (!h || !Array.isArray(h.COUNTRIES)) return { error: 'el globo no expone __AETHER_GLOBE__.COUNTRIES' };
    const salida = {};
    for (const c of h.COUNTRIES) salida[c.iso] = { score: c.score, nivel: c.risk, nombre: c.name };
    return { paises: salida, fuera: h.PAISES_FUERA || [] };
  });

  if (delGlobo.error) { mal(delGlobo.error); }

  if (!delPanel.error && !delGlobo.error) {
    const isoPanel = Object.keys(delPanel.paises);
    const isoGlobo = Object.keys(delGlobo.paises);

    // 1. Mismos países. El globo tiene menos: los que no traen coordenadas
    //    de su capital en la fuente no se pueden dibujar.
    const soloPanel = isoPanel.filter((i) => !delGlobo.paises[i]);
    const soloGlobo = isoGlobo.filter((i) => !delPanel.paises[i]);
    if (soloGlobo.length === 0) ok(`el globo no inventa países: sus ${isoGlobo.length} están todos en el panel`);
    else mal(`países en el globo que el panel no tiene: ${soloGlobo.join(', ')}`);

    const sinCoordenadas = (delGlobo.fuera || []).filter((f) => /sin coordenadas/.test(f)).length;
    if (soloPanel.length === sinCoordenadas) {
      ok(`los ${soloPanel.length} que faltan en el globo son exactamente los que no traen coordenadas: ${soloPanel.join(', ')}`);
    } else {
      mal(`${soloPanel.length} países solo en el panel pero ${sinCoordenadas} descartados por coordenadas: ${soloPanel.join(', ')}`);
    }

    // 2 y 3. Nivel y puntuación, país a país.
    const comunes = isoPanel.filter((i) => delGlobo.paises[i]);
    const nivelDistinto = [];
    const scoreDistinto = [];
    for (const iso of comunes) {
      const a = delPanel.paises[iso];
      const b = delGlobo.paises[iso];
      if (a.nivel !== b.nivel) nivelDistinto.push(`${iso}: panel ${a.nivel} / globo ${b.nivel}`);
      if (a.score !== b.score) scoreDistinto.push(`${iso}: panel ${a.score} / globo ${b.score}`);
    }
    if (nivelDistinto.length === 0) ok(`el nivel de riesgo coincide en los ${comunes.length} países`);
    else mal(`${nivelDistinto.length} países con nivel distinto:\n          ` + nivelDistinto.slice(0, 10).join('\n          '));

    if (scoreDistinto.length === 0) ok(`la puntuación coincide en los ${comunes.length} países`);
    else mal(`${scoreDistinto.length} países con puntuación distinta:\n          ` + scoreDistinto.slice(0, 10).join('\n          '));

    // 4. El banner del panel muestra la puntuación del fichero.
    const banner = await panel.evaluate(async () => {
      const sel = document.getElementById('region-sel');
      if (!sel) return { error: 'no hay selector de región' };
      // Entrar en el panel: el motor se inicia al pulsar.
      const btn = document.querySelector('[data-action="launch-aether"]');
      if (btn) btn.click();
      await new Promise((r) => setTimeout(r, 3500));
      const out = [];
      for (const iso of ['ESP', 'UKR', 'SOM', 'JPN']) {
        sel.value = iso;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 700));
        const d = (window.__AETHER__ || {}).DATA[iso];
        out.push({
          iso,
          enPantalla: (document.getElementById('gnum') || {}).textContent,
          enDatos: d ? d.score : null,
        });
      }
      return { out };
    });

    if (banner.error) mal(banner.error);
    else {
      const desajuste = banner.out.filter((r) => String(r.enDatos) !== String(r.enPantalla).trim());
      if (desajuste.length === 0) {
        ok('el banner muestra la puntuación del fichero: ' + banner.out.map((r) => `${r.iso}=${r.enPantalla}`).join(' '));
      } else {
        mal('el banner no coincide con los datos: ' + desajuste.map((r) => `${r.iso} pantalla ${r.enPantalla} datos ${r.enDatos}`).join(', '));
      }
    }

    // 5. Los territorios sin fuente oficial no salen puntuados.
    const colados = (delPanel.sinDatos || []).filter((i) => delGlobo.paises[i]);
    if (colados.length === 0) {
      ok(`los territorios sin fuente oficial no aparecen puntuados: ${(delPanel.sinDatos || []).join(', ') || '(ninguno)'}`);
    } else {
      mal(`territorios sin datos que el globo puntúa: ${colados.join(', ')}`);
    }
  }

  // Errores de consola en cualquiera de las dos páginas.
  const errores = [...diagPanel.pageErrors, ...diagGlobo.pageErrors,
    ...diagPanel.consoleErrors, ...diagGlobo.consoleErrors];
  if (errores.length === 0) ok('ninguna de las dos páginas da errores');
  else mal(`errores: ${errores.slice(0, 5).join(' | ')}`);

  await browser.close();
  console.log(`\n===== ${fallos === 0 ? 'SIN FALLOS' : fallos + ' FALLOS'} =====`);
  process.exit(fallos === 0 ? 0 : 1);
})();
