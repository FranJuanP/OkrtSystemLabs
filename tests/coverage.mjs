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

  // 1. La constante contra el fichero de datos.
  const real = await page.evaluate(() => {
    // Desde T12 el motor es un módulo: ni AETHER_COVERAGE ni DATA son
    // globales. El asa window.__AETHER__ existe para las pruebas y la consola.
    const handle = window.__AETHER__ || {};
    const cov = handle.COVERAGE;
    const data = handle.DATA;
    if (!cov || !data) return { error: 'falta __AETHER__.COVERAGE o __AETHER__.DATA' };
    const claves = Object.keys(data);
    const conPuntuacion = claves.filter((k) => typeof data[k].score === 'number');
    const sinDatos = claves.filter((k) => data[k].sinDatos);
    return {
      declared: cov.countries,
      withData: cov.withData,
      onGlobe: cov.onGlobe,
      dataYear: cov.dataYear,
      indicators: cov.indicators,
      sources: cov.sources,
      entries: claves.length,
      conPuntuacion: conPuntuacion.length,
      sinDatos,
      // WLD y EUU son agregados: tienen puntuación pero no son países.
      agregados: claves.filter((k) => k === 'WLD' || k === 'EUU').length,
    };
  });

  if (real.error) { bad(real.error); }
  else {
    // La constante cuenta países; DATA añade los dos agregados.
    const esperadoEnData = real.declared + real.agregados;
    if (real.conPuntuacion === esperadoEnData) {
      ok(`AETHER_COVERAGE.countries = ${real.declared} coincide con los datos (${real.conPuntuacion} con puntuación − ${real.agregados} agregados)`);
    } else {
      bad(`AETHER_COVERAGE.countries = ${real.declared} + ${real.agregados} agregados, pero DATA tiene ${real.conPuntuacion} con puntuación`);
    }
    if (real.withData >= real.declared) ok(`withData = ${real.withData} países en el fichero, ${real.declared} con puntuación`);
    else bad(`withData = ${real.withData} es menor que los ${real.declared} con puntuación`);
    if (real.onGlobe > 0 && real.onGlobe <= real.declared) ok(`onGlobe = ${real.onGlobe} (los que además tienen coordenadas)`);
    else bad(`onGlobe = ${real.onGlobe} fuera de rango`);
    if (real.indicators > 0 && real.sources > 0) ok(`${real.indicators} indicadores de ${real.sources} catálogos, datos de ${real.dataYear}`);
    else bad('la cobertura no declara indicadores ni catálogos');
    if (real.sinDatos.length) ok(`territorios sin fuente oficial, marcados como tal: ${real.sinDatos.join(', ')}`);
  }

  // 2. Ninguna pagina ni el README muestran otra cifra.
  const expected = real.declared;
  for (const file of ['index.html', 'aether-globe-v3.html', 'README.md']) {
    const figures = countryFiguresIn(file);
    const wrong = figures.filter((n) => n !== expected && n > 50);
    if (wrong.length === 0) ok(`${file}: todas las cifras de paises son ${expected} ${JSON.stringify(figures)}`);
    else bad(`${file}: cifras distintas de ${expected}: ${JSON.stringify(wrong)}`);
  }

  // 3. El panel dice de cuándo son los datos.
  const pie = await page.evaluate(() => {
    const el = document.getElementById('datos-pie');
    return el ? (el.textContent || '').trim() : null;
  });
  if (pie && /DATOS:\s*\d{2}\/\d{2}\/\d{4}/.test(pie)) ok(`la portada publica la fecha de los datos: «${pie}»`);
  else if (pie) bad(`el pie de datos no trae fecha: «${pie}»`);
  else bad('no existe el pie con la fecha de los datos (#datos-pie)');

  // 4. La insignia de robustez no debe verse en pantalla.
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
