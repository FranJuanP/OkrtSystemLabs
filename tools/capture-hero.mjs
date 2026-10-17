/**
 * Genera la imagen de portada a partir del dashboard real (T15 / decisión 2e).
 *
 * La imagen que había era un montaje con texto ilegible y un país
 * inexistente, «Ucronia», en el ranking. Esta la hace Playwright sobre la
 * aplicación de verdad, así que lo que se ve en la portada es lo que el
 * visitante se encuentra al entrar.
 *
 * Encuadre y tamaño parecidos al original: 1536x1024, el dashboard
 * desplazado hasta la fila del mapa, el termómetro y el ranking.
 *
 * Requiere el sitio servido. Lo habitual:
 *   npm run build && npm run preview
 *   node tools/capture-hero.mjs
 *
 * Opciones:
 *   --base <url>   por defecto http://localhost:8080/OkrtSystemLabs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'img');

const args = process.argv.slice(2);
const argOf = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('base', 'http://localhost:8080/OkrtSystemLabs').replace(/\/$/, '');

/** Mismo tamaño que la imagen que sustituye. */
const WIDTH = 1536;
const HEIGHT = 1024;
/** Se captura al doble y se reduce, para que el texto quede nítido. */
const SCALE = 2;

/** Reloj fijo: la captura no debe cambiar de un día para otro. */
const FROZEN = Date.UTC(2026, 9, 17, 12, 0, 0);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
  });

  await context.addInitScript((frozen) => {
    const RealDate = Date;
    const Frozen = function (...a) {
      if (!(this instanceof Frozen)) return new RealDate(frozen).toString();
      return a.length === 0 ? new RealDate(frozen) : new RealDate(...a);
    };
    Frozen.prototype = RealDate.prototype;
    Frozen.now = () => frozen;
    Frozen.parse = RealDate.parse;
    Frozen.UTC = RealDate.UTC;
    window.Date = Frozen;
  }, FROZEN);

  const page = await context.newPage();
  // Nada de red externa: la captura debe depender solo del repositorio.
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort('connectionrefused'));

  console.log(`Abriendo ${BASE}/index.html ...`);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);

  const cta = await page.$('[data-launch-aether]');
  if (!cta) throw new Error('no se encontró el botón de entrada al dashboard');
  await cta.click();

  // El mapa y el grafo se montan con retardo dentro de initAetherApp.
  console.log('Esperando a que el dashboard termine de montarse ...');
  await page.waitForSelector('#world-map svg, #map-wrap svg', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(7000);

  // Encuadre: la fila del termómetro y el ranking. El dashboard desplaza el
  // <body>, no el documento, así que hay que desplazar ahí.
  await page.evaluate(() => {
    const el = document.getElementById('thermo-wrap');
    if (!el) return;
    const y = el.getBoundingClientRect().top + document.body.scrollTop;
    document.body.scrollTop = Math.max(0, y - 120);
  });
  await page.waitForTimeout(2200);

  const raw = await page.screenshot({ type: 'png' });
  await browser.close();

  fs.mkdirSync(OUT, { recursive: true });
  const base = path.join(OUT, 'aether-hero');

  const pipeline = () => sharp(raw).resize({ width: WIDTH, height: HEIGHT, fit: 'cover' });
  await pipeline().avif({ quality: 62, effort: 6 }).toFile(`${base}.avif`);
  await pipeline().webp({ quality: 84, effort: 6 }).toFile(`${base}.webp`);
  await pipeline().png({ compressionLevel: 9 }).toFile(`${base}.png`);

  console.log('\nImagen de portada regenerada desde el dashboard real:');
  for (const ext of ['avif', 'webp', 'png']) {
    console.log(`  aether-hero.${ext.padEnd(4)} ${(fs.statSync(`${base}.${ext}`).size / 1024).toFixed(1).padStart(7)} kB`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
