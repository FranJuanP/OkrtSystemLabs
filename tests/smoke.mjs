/**
 * Prueba de humo de AETHER.
 *
 * Carga las 4 paginas en dos viewports y en dos escenarios (fuentes vivas con
 * fixtures, y todas las fuentes caidas), guarda capturas y diagnosticos, y
 * escribe un informe JSON comparable entre ejecuciones.
 *
 * Uso:
 *   node tests/smoke.mjs --label antes
 *   node tests/smoke.mjs --label despues --base http://localhost:8080
 *   node tests/smoke.mjs --compare antes despues
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  PAGES, VIEWPORTS, TESTS_DIR, routeSources, freezeClock,
  collectDiagnostics, settle, uniq,
} from './lib/harness.mjs';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf('base', 'http://localhost:8080').replace(/\/$/, '');
const LABEL = argOf('label', 'run');
const OUT_ROOT = path.join(TESTS_DIR, 'shots');
const OUT_DIR = path.join(OUT_ROOT, LABEL);

const SCENARIOS = [
  { id: 'online', sources: 'up', note: 'fuentes respondiendo con fixtures' },
  { id: 'offline', sources: 'down', note: 'todas las fuentes caidas' },
];

/** Sondas en pagina: estado observable que debe mantenerse entre versiones. */
async function probe(page) {
  return page.evaluate(() => {
    // Las declaraciones `const`/`let` de un script clasico no crean propiedad
    // en window, asi que hay que preguntar por el binding, no por window.
    const typeOf = (name) => {
      try { return eval(`typeof ${name}`); } catch { return 'err'; }
    };
    const globalValue = (name) => {
      try { return eval(name); } catch { return undefined; }
    };
    const textOf = (id) => {
      const el = document.getElementById(id);
      return el ? (el.textContent || '').trim().slice(0, 80) : null;
    };
    const count = (sel) => document.querySelectorAll(sel).length;
    return {
      title: document.title,
      nodes: count('*'),
      bodyChars: document.body ? document.body.innerText.length : 0,
      dataKeys: (() => { const d = globalValue('DATA'); return d && typeof d === 'object' ? Object.keys(d).length : null; })(),
      signalCount: (() => { const s = globalValue('allSignals'); return Array.isArray(s) ? s.length : null; })(),
      threeLoaded: typeOf('THREE') === 'object' || typeOf('THREE') === 'function',
      d3Loaded: typeOf('d3') === 'object',
      engineFns: ['enhancedScore', 'runMonteCarlo', 'simulateCascade', 'loadRegion']
        .map((n) => `${n}:${typeOf(n)}`).join(' '),
      signalCards: count('.signal-card'),
      tickerItems: count('.ticker-item, .tk-item'),
      svgPaths: count('svg path'),
      canvases: count('canvas'),
      lastUpdate: textOf('last-update'),
      clock: textOf('clock'),
      sourceDots: [...document.querySelectorAll('[id^="src-"]')]
        .map((el) => `${el.id}=${el.className || ''}`.trim()).sort(),
      // Marcadores de honestidad que las fases vigilan
      hasRobustezBadge: /ROBUSTEZ PREMIUM/i.test(document.body ? document.body.innerText : ''),
      hasLiveBadge: count('.live-badge') > 0 || !!document.getElementById('live-btn'),
    };
  }).catch((e) => ({ probeError: e.message.split('\n')[0] }));
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const report = { label: LABEL, base: BASE, startedAt: new Date().toISOString(), cases: {} };

  for (const scenario of SCENARIOS) {
    for (const vp of VIEWPORTS) {
      for (const pageName of PAGES) {
        const key = `${scenario.id} | ${pageName} | ${vp.name}`;
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
        });
        await freezeClock(context);
        const page = await context.newPage();
        const diag = collectDiagnostics(page, BASE);
        await routeSources(page, { sources: scenario.sources });

        let navigation = 'ok';
        try {
          await page.goto(`${BASE}/${pageName}`, { waitUntil: 'load', timeout: 45000 });
        } catch (err) {
          navigation = `ERROR: ${err.message.split('\n')[0]}`;
        }
        await settle(page);

        const observed = await probe(page);
        const shotName = `${scenario.id}__${pageName.replace(/\.html$/, '')}__${vp.name}.png`;
        try {
          await page.screenshot({ path: path.join(OUT_DIR, shotName) });
        } catch (err) {
          diag.pageErrors.push(`SCREENSHOT: ${err.message.split('\n')[0]}`);
        }

        report.cases[key] = {
          navigation,
          probe: observed,
          screenshot: shotName,
          consoleErrors: uniq(diag.consoleErrors),
          pageErrors: uniq(diag.pageErrors),
          requestFailures: uniq(diag.requestFailures),
          cspViolations: uniq(diag.cspViolations),
        };
        await context.close();
      }
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  printReport(report);
  return report;
}

function printReport(report) {
  console.log(`\n===== PRUEBA DE HUMO · ${report.label} · ${report.base} =====`);
  let totalConsole = 0, totalPageErr = 0, totalCsp = 0, totalReqFail = 0;
  for (const [key, c] of Object.entries(report.cases)) {
    totalConsole += c.consoleErrors.length;
    totalPageErr += c.pageErrors.length;
    totalCsp += c.cspViolations.length;
    totalReqFail += c.requestFailures.length;
    const flags = [
      c.navigation !== 'ok' ? `NAV ${c.navigation}` : null,
      c.pageErrors.length ? `pageerror=${c.pageErrors.length}` : null,
      c.cspViolations.length ? `CSP=${c.cspViolations.length}` : null,
      c.requestFailures.length ? `reqfail=${c.requestFailures.length}` : null,
    ].filter(Boolean).join(' ');
    console.log(`\n## ${key}${flags ? '   [' + flags + ']' : ''}`);
    console.log('   ' + JSON.stringify(c.probe));
    for (const e of c.consoleErrors) console.log('   ERROR  ' + e.slice(0, 200));
    for (const e of c.pageErrors) console.log('   PAGEERR ' + e.slice(0, 200));
    for (const e of c.requestFailures) console.log('   REQFAIL ' + e.slice(0, 200));
  }
  console.log(`\n--- TOTALES: consola=${totalConsole} pageerror=${totalPageErr} csp=${totalCsp} reqfail=${totalReqFail} ---`);
}

run().catch((err) => { console.error(err); process.exit(1); });
