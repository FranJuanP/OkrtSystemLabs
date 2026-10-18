/**
 * T3 · Prueba de XSS.
 *
 * Sirve a las cuatro fuentes externas respuestas con cargas de inyección en
 * los mismos campos que la aplicación pinta (title, place, location, detail,
 * body, country, url) y comprueba que:
 *
 *   1. ninguna carga llega a ejecutarse;
 *   2. el texto se ve como texto, es decir el titular aparece literal en la
 *      pantalla en vez de desaparecer convertido en una etiqueta;
 *   3. ningún enlace acaba con un href javascript: ni data:.
 *
 * Además inyecta una watchlist envenenada en localStorage antes de cargar el
 * dashboard, para cubrir app-enhancements.js.
 *
 * Uso: node tests/xss.mjs [--base http://localhost:8080]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { FIXTURES_DIR, freezeClock, VIEWPORTS } from './lib/harness.mjs';

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080').replace(/\/$/, '');

const P = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'xss.json'), 'utf8')).payloads;

/** Titular canónico del encargo, el que debe aparecer literal en pantalla. */
const HEADLINE = '<img src=x onerror=alert(1)>';

const usgs = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    id: `xss_${P.breakout}`,
    properties: {
      mag: 7.7,
      place: `${HEADLINE} ${P.img}`,
      time: Date.UTC(2026, 9, 16, 10, 0, 0),
      url: P.jsurl,
      status: P.svg,
      alert: P.img,
      tsunami: 0,
    },
    geometry: { type: 'Point', coordinates: [0, 0, 10] },
  }],
};

const eonet = {
  events: [{
    id: `xss_${P.breakout}`,
    title: `${HEADLINE} ${P.svg}`,
    description: P.script,
    categories: [{ id: 8, title: P.img }],
    sources: [{ id: 'x', url: P.datauri }],
    geometry: [{ date: '2026-10-16T10:00:00Z', type: 'Point', coordinates: [0, 0] }],
  }],
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    id: `xss_${P.breakout}`,
    properties: {
      title: `${HEADLINE} ${P.svg}`,
      categories: [{ title: P.img }],
      sources: [{ url: P.jsurl }],
      updated: '2026-10-16T10:00:00Z',
    },
    geometry: [{ date: '2026-10-16T10:00:00Z', type: 'Point', coordinates: [0, 0] }],
  }],
};

const reliefweb = {
  data: [{
    id: `xss_${P.breakout}`,
    fields: {
      title: `${HEADLINE} ${P.script}`,
      date: { created: '2026-10-16T10:00:00+00:00' },
      country: [{ name: P.img }],
      disaster_type: [{ name: P.svg }],
      url_alias: P.jsurl,
      body: P.img,
    },
  }],
};

const gdelt = {
  articles: [{
    title: `${HEADLINE} ${P.img}`,
    url: P.jsurl,
    domain: P.svg,
    sourcecountry: P.img,
    seendate: '20261016T100000Z',
    tone: '-1.0',
  }],
};

const ROUTES = [
  [/earthquake\.usgs\.gov/i, usgs],
  [/eonet\.gsfc\.nasa\.gov/i, eonet],
  [/api\.reliefweb\.int/i, reliefweb],
  [/api\.gdeltproject\.org/i, gdelt],
];

const POISONED_WATCHLIST = [{
  code: `ESP${P.breakout}`,
  name: `${HEADLINE} ${P.img}`,
  score: 61,
  delta: 3,
  band: P.svg,
  dominant: P.img,
  dominantColor: `red;x:expression(window.__XSS_FIRED__.push('css'))`,
  confidence: P.script,
}];

let failures = 0;
const ok = (msg) => console.log(`   OK    ${msg}`);
const bad = (msg) => { failures++; console.log(`   FALLO ${msg}`); };

async function checkPage(browser, pageName, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await freezeClock(context);

  // Centinela: cualquier carga que se ejecute deja rastro aqui.
  await context.addInitScript(() => { window.__XSS_FIRED__ = []; });
  // Un alert() bloquearia la pagina; se intercepta y se contabiliza.
  await context.addInitScript(() => {
    window.__XSS_FIRED__ = window.__XSS_FIRED__ || [];
    window.alert = (...a) => window.__XSS_FIRED__.push('alert:' + a.join(' '));
    window.confirm = () => { window.__XSS_FIRED__.push('confirm'); return false; };
    window.prompt = () => { window.__XSS_FIRED__.push('prompt'); return null; };
  });
  await context.addInitScript((wl) => {
    try { localStorage.setItem('aether_watchlist_v3', JSON.stringify(wl)); } catch (e) { /* vacio */ }
  }, POISONED_WATCHLIST);

  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  for (const [match, body] of ROUTES) {
    await page.route(match, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    }));
  }
  // Terceros fuera: la prueba no debe depender de la red.
  await page.route(/flagcdn\.com|fonts\.g|11434/i, (r) => r.abort('connectionrefused'));
  for (const [name, file] of [[/three/i, 'three.min.js'], [/d3(\.min)?\.js/i, 'd3.min.js'], [/topojson/i, 'topojson.min.js']]) {
    await page.route(name, async (route) => {
      const f = path.join(FIXTURES_DIR, 'vendor', file);
      if (!fs.existsSync(f)) return route.abort('connectionrefused');
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) });
    });
  }

  console.log(`\n## ${pageName} @ ${vp.name}`);
  await page.goto(`${BASE}/${pageName}`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(7000);

  // En el dashboard hay que entrar para que se pinte la watchlist.
  try {
    const cta = await page.$('[data-launch-aether]');
    // Puede estar ya abierto: el panel se recuerda en sessionStorage.
    if (cta && await cta.isVisible().catch(() => false)) { await cta.click(); }
    await page.waitForTimeout(2500);
  } catch { /* la pagina no tiene portada */ }

  // Si hay feed, se abre el primer evento para cubrir el panel de detalle.
  try {
    const card = await page.$('.signal-card');
    if (card) { await card.click(); await page.waitForTimeout(800); }
  } catch { /* sin feed en esta pagina */ }

  const result = await page.evaluate(() => ({
    fired: window.__XSS_FIRED__ || [],
    injectedTags: document.querySelectorAll(
      'img[src="x"], svg[onload], [onerror]'
    ).length,
    badHrefs: [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => /^\s*(javascript|data|vbscript):/i.test(h)),
    linksWithoutRel: [...document.querySelectorAll('a[target="_blank"]')]
      .filter((a) => !/noopener/.test(a.getAttribute('rel') || '')).length,
    bodyText: document.body ? document.body.innerText : '',
  }));

  if (result.fired.length === 0) ok('ninguna carga se ejecuto');
  else bad(`se ejecutaron cargas: ${JSON.stringify(result.fired)}`);

  if (result.injectedTags === 0) ok('no se inyecto ninguna etiqueta img/svg/onerror');
  else bad(`${result.injectedTags} etiquetas inyectadas llegaron al DOM`);

  if (result.badHrefs.length === 0) ok('ningun href con esquema peligroso');
  else bad(`hrefs peligrosos: ${JSON.stringify(result.badHrefs.slice(0, 3))}`);

  if (result.linksWithoutRel === 0) ok('todos los target=_blank llevan rel noopener');
  else bad(`${result.linksWithoutRel} enlaces target=_blank sin rel noopener`);

  // El titular debe verse literal: prueba de que se escapo en vez de ejecutarse.
  if (/signal/.test(pageName)) {
    if (result.bodyText.includes(HEADLINE)) ok('el titular se muestra literal como texto');
    else bad('el titular no aparece literal: puede haberse interpretado como HTML');
  }

  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  console.log('===== PRUEBA DE XSS (T3) =====');
  for (const pageName of ['aether-signal.html', 'index.html', 'aether-vector.html', 'aether-globe-v3.html']) {
    for (const vp of VIEWPORTS.slice(0, 1)) await checkPage(browser, pageName, vp);
  }
  await browser.close();
  console.log(`\n===== ${failures === 0 ? 'SIN FALLOS' : failures + ' FALLOS'} =====`);
  process.exit(failures === 0 ? 0 : 1);
})();
