/**
 * Arnes comun de la prueba de humo de AETHER.
 *
 * Intercepta las fuentes externas con page.route y respuestas fijas de
 * tests/fixtures, y congela el reloj del navegador, para que dos ejecuciones
 * del mismo codigo produzcan capturas comparables pixel a pixel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TESTS_DIR = path.join(HERE, '..');
export const FIXTURES_DIR = path.join(TESTS_DIR, 'fixtures');
export const REPO_DIR = path.join(TESTS_DIR, '..');

/** Instante fijo del reloj del navegador: 2026-10-17T12:00:00Z */
export const FROZEN_NOW = Date.UTC(2026, 9, 17, 12, 0, 0);

export const PAGES = [
  'index.html',
  'aether-globe-v3.html',
  'aether-signal.html',
  'aether-vector.html',
  // T22: la pagina de metodologia. Entra en la prueba de humo como las
  // demas: se construye a partir de data/latest.json y puede fallar igual.
  'metodologia.html',
];

export const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));

/**
 * Las fuentes externas que la aplicacion consulta. Cada una tiene un patron
 * de URL y el fixture con el que se responde.
 */
export const SOURCES = [
  { id: 'usgs', label: 'USGS', match: /earthquake\.usgs\.gov/i, file: 'usgs.json' },
  { id: 'eonet', label: 'NASA EONET', match: /eonet\.gsfc\.nasa\.gov/i, file: 'eonet.json' },
  { id: 'reliefweb', label: 'ReliefWeb', match: /api\.reliefweb\.int/i, file: 'reliefweb.json' },
  { id: 'gdelt', label: 'GDELT', match: /api\.gdeltproject\.org/i, file: 'gdelt.json' },
  { id: 'worldbank', label: 'World Bank', match: /api\.worldbank\.org/i, file: 'worldbank.json' },
];

/**
 * Librerias de terceros servidas desde disco (tests/fixtures/vendor) en vez de
 * desde el CDN, para que el globo y Vector rendericen de verdad sin depender
 * de la red. La Fase 2 las empaqueta en el repo y esta tabla deja de usarse.
 */
const VENDOR = [
  { match: /(three\.min\.js|three@[\d.]+\/build\/three\.min\.js)/i, file: 'three.min.js' },
  { match: /(d3\.min\.js|d3@[\d.]+\/dist\/d3\.min\.js)/i, file: 'd3.min.js' },
  { match: /topojson[a-z-]*(@3|\/3\.0\.2)?[^"']*\.min\.js/i, file: 'topojson.min.js' },
];

/** Dominios de terceros que no son fuentes de datos pero sí peticiones de red. */
const THIRD_PARTY = [
  /flagcdn\.com/i,
  /fonts\.googleapis\.com/i,
  /fonts\.gstatic\.com/i,
  /localhost:11434/i,
  /127\.0\.0\.1:11434/i,
  /unpkg\.com\/three-globe/i,
];

/** CDNs: se resuelven desde disco si hay vendor, si no se cortan. */
const CDN = [/cdnjs\.cloudflare\.com/i, /cdn\.jsdelivr\.net/i, /unpkg\.com/i];

/**
 * Congela Date en el navegador. new Date() y Date.now() devuelven FROZEN_NOW;
 * new Date(args) sigue funcionando con normalidad.
 */
export async function freezeClock(context, nowMs = FROZEN_NOW) {
  await context.addInitScript((frozen) => {
    const RealDate = Date;
    const FrozenDate = function (...args) {
      if (!(this instanceof FrozenDate)) return new RealDate(frozen).toString();
      return args.length === 0 ? new RealDate(frozen) : new RealDate(...args);
    };
    FrozenDate.prototype = RealDate.prototype;
    FrozenDate.now = () => frozen;
    FrozenDate.parse = RealDate.parse;
    FrozenDate.UTC = RealDate.UTC;
    // eslint-disable-next-line no-global-assign
    window.Date = FrozenDate;
    try { performance.now = () => 0; } catch (e) { /* solo lectura en algunos navegadores */ }
  }, nowMs);
}

/**
 * Instala la interceptacion de red.
 *
 * IMPORTANTE: hay que enrutar sobre el BrowserContext, no sobre la Page.
 * `page.route` no intercepta las peticiones que hace un service worker por
 * su cuenta, solo las de la pagina. Desde T18 el service worker media las
 * llamadas a las APIs, asi que con page.route el escenario "todas las
 * fuentes caidas" dejaba de ser tal: el worker salia a la red de verdad y
 * la prueba media otra cosa. `context.route` si las cubre.
 *
 * @param {import('playwright').Page|import('playwright').BrowserContext} target
 * @param {object} opts
 * @param {'up'|'down'} opts.sources  'down' = todas las fuentes caidas.
 * @param {Record<string,object>} [opts.override]  fixture alternativo por id de fuente.
 */
export async function routeSources(target, { sources = 'up', override = {} } = {}) {
  // Si llega una Page, se enruta su contexto, que es lo que cubre al worker.
  const page = (typeof target.context === 'function') ? target.context() : target;
  for (const src of SOURCES) {
    await page.route(src.match, async (route) => {
      if (sources === 'down') {
        await route.abort('connectionrefused');
        return;
      }
      const body = override[src.id] ?? fixture(src.file);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(body),
      });
    });
  }

  // Librerias de CDN: se sirven desde tests/fixtures/vendor.
  for (const pattern of CDN) {
    await page.route(pattern, async (route) => {
      const url = route.request().url();
      const vendor = VENDOR.find((v) => v.match.test(url));
      if (!vendor) { await route.abort('connectionrefused'); return; }
      const file = path.join(FIXTURES_DIR, 'vendor', vendor.file);
      if (!fs.existsSync(file)) { await route.abort('connectionrefused'); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        headers: { 'access-control-allow-origin': '*' },
        body: fs.readFileSync(file),
      });
    });
  }

  // Terceros no esenciales: se cortan siempre, para que la captura no dependa
  // de la red y el conteo de peticiones fallidas sea estable.
  for (const pattern of THIRD_PARTY) {
    await page.route(pattern, (route) => route.abort('connectionrefused'));
  }
}

/** Recolector de errores de consola, pageerror y peticiones fallidas. */
export function collectDiagnostics(page, baseUrl) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const requestFailures = [];
  const cspViolations = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      // "Failed to load resource: net::ERR_..." no dice QUE recurso fallo, y
      // lo que de verdad importa ya se recoge con detalle en requestFailures,
      // que ademas filtra las fuentes que el escenario tumba a proposito.
      // Ademas el texto cambia segun quien produzca el fallo: la red da
      // ERR_CONNECTION_REFUSED y el service worker ERR_FAILED, de modo que
      // contarlo convertia un cambio de capa en una regresion aparente.
      const esRuidoDeRed = /^Failed to load resource: net::ERR_/.test(text);
      if (!esRuidoDeRed) consoleErrors.push(text);
      if (/Content Security Policy|Refused to/i.test(text)) cspViolations.push(text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
      if (/Content Security Policy/i.test(text)) cspViolations.push(text);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push((err && err.message ? err.message : String(err)).split('\n')[0]);
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    // Los terceros y las fuentes caidas se cortan a proposito: no son fallos.
    if (THIRD_PARTY.some((p) => p.test(url))) return;
    if (CDN.some((p) => p.test(url))) return;
    if (SOURCES.some((s) => s.match.test(url))) return;
    requestFailures.push(`${url.replace(baseUrl, '')} :: ${(req.failure() || {}).errorText}`);
  });

  return { consoleErrors, consoleWarnings, pageErrors, requestFailures, cspViolations };
}

/** Espera a que los temporizadores de arranque hayan corrido. */
export async function settle(page, ms = 6000) {
  await page.waitForTimeout(ms);
}

export function uniq(list) {
  return [...new Set(list)];
}
