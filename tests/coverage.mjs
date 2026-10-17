/**
 * T9 · Prueba de la cifra de cobertura.
 *
 * La cifra de países aparecía con cuatro valores distintos (202, 201, 195 y
 * 173 según la pantalla). Ahora hay una sola fuente, AETHER_COVERAGE, y esta
 * prueba comprueba dos cosas:
 *
 *   1. que la constante coincide con el recuento real de `DATA` en el motor,
 *      excluyendo WLD, EUU y el duplicado MKD2;
 *   2. que ninguna página ni el README muestran una cifra distinta.
 *
 * Uso: node tests/coverage.mjs [--base http://localhost:8080]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { REPO_DIR, freezeClock } from './lib/harness.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080').replace(/\/$/, '');

let failures = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const bad = (m) => { failures++; console.log(`   FALLO ${m}`); };

/** Cifras de países que aparecen como texto en un fichero. */
function countryFiguresIn(file) {
  const text = fs.readFileSync(path.join(REPO_DIR, file), 'utf8');
  const out = new Set();
  const patterns = [
    /(\d{2,4})\s+PA[IÍ]SES/gi,
    /(\d{2,4})\s+pa[ií]ses/gi,
    /badge\/countries-(\d{2,4})-/gi,
    /hex-num">(\d{2,4})</gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) out.add(Number(m[1]));
  }
  return [...out];
}

(async () => {
  console.log('===== PRUEBA DE COBERTURA (T9) =====\n');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await freezeClock(context);
  const page = await context.newPage();
  await page.route(/flagcdn|fonts\.g|11434|usgs|eonet|reliefweb|gdelt|worldbank/i, (r) => r.abort('connectionrefused'));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);

  // 1. La constante contra el recuento real del motor.
  const real = await page.evaluate(() => {
    // Desde T12 el motor es un módulo: ni AETHER_COVERAGE ni DATA son
    // globales. El asa window.__AETHER__ existe para las pruebas y la consola.
    const handle = window.__AETHER__ || {};
    const cov = handle.COVERAGE || window.AETHER_COVERAGE;
    const data = handle.DATA;
    if (!cov || !data) return { error: 'falta __AETHER__.COVERAGE o __AETHER__.DATA' };
    const keys = Object.keys(data);
    const excluded = cov.nonCountryKeys || [];
    return {
      declared: cov.countries,
      declaredEntries: cov.dataEntries,
      entries: keys.length,
      counted: keys.filter((k) => excluded.indexOf(k) === -1).length,
      excludedPresent: excluded.filter((k) => keys.indexOf(k) !== -1),
      missingExcluded: excluded.filter((k) => keys.indexOf(k) === -1),
    };
  });

  if (real.error) { bad(real.error); }
  else {
    if (real.declared === real.counted) {
      ok(`AETHER_COVERAGE.countries = ${real.declared} coincide con DATA (${real.entries} entradas − ${real.excludedPresent.join(', ')})`);
    } else {
      bad(`AETHER_COVERAGE.countries = ${real.declared} pero DATA da ${real.counted}`);
    }
    if (real.declaredEntries === real.entries) ok(`dataEntries = ${real.entries} coincide`);
    else bad(`dataEntries = ${real.declaredEntries} pero DATA tiene ${real.entries}`);
    if (real.missingExcluded.length === 0) ok('las tres claves excluidas existen en DATA');
    else bad(`claves excluidas que ya no estan en DATA: ${real.missingExcluded.join(', ')}`);
  }

  // 2. Ninguna pagina ni el README muestran otra cifra.
  const expected = real.declared;
  for (const file of ['index.html', 'aether-globe-v3.html', 'README.md']) {
    const figures = countryFiguresIn(file);
    const wrong = figures.filter((n) => n !== expected && n > 50);
    if (wrong.length === 0) ok(`${file}: todas las cifras de paises son ${expected} ${JSON.stringify(figures)}`);
    else bad(`${file}: cifras distintas de ${expected}: ${JSON.stringify(wrong)}`);
  }

  // 3. La insignia de robustez no debe verse en pantalla.
  const badge = await page.evaluate(() => ({
    enDom: !!document.getElementById('aether-robust-topline'),
    enTexto: /robustez premium/i.test(document.body ? document.body.innerText : ''),
  }));
  if (!badge.enDom && !badge.enTexto) ok('la insignia de robustez no aparece en la portada');
  else bad(`la insignia de robustez sigue visible (dom=${badge.enDom}, texto=${badge.enTexto})`);

  await browser.close();
  console.log(`\n===== ${failures === 0 ? 'SIN FALLOS' : failures + ' FALLOS'} =====`);
  process.exit(failures === 0 ? 0 : 1);
})();
