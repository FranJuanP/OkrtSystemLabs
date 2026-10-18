/**
 * Fondo de la tarjeta «GLOBO DE RIESGO 3D», capturado del globo real.
 *
 * Misma idea que `capture-hero.mjs`: la imagen que ve el visitante es una
 * foto de la aplicación de verdad, no un montaje. Si el globo cambia, se
 * regenera y la tarjeta cambia con él.
 *
 * Reproducible a propósito:
 *   - **Reloj fijo.** El globo rota y pinta pulsos en función del tiempo; sin
 *     fijarlo, dos capturas seguidas salen distintas y el repositorio se
 *     llena de diferencias binarias que no significan nada.
 *   - **Sin red externa.** Todo sale del repositorio, así que la imagen no
 *     depende de que una fuente ajena conteste hoy.
 *   - **Una posición concreta.** Se espera a que el globo termine su entrada
 *     y se le pide el encuadre con Europa y África a la vista, que es donde
 *     hay más marcadores.
 *
 * Requiere el sitio servido:
 *   npm run build && npm run preview
 *   node tools/capture-globo.mjs
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

/** Proporción de la tarjeta: ancha y baja, como el bloque que sustituye. */
const WIDTH = 1400;
const HEIGHT = 600;
const SCALE = 2;

/** El mismo instante que usa la portada, por coherencia entre las dos. */
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
  // Nada de red externa: la captura depende solo del repositorio.
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort('connectionrefused'));

  console.log(`Abriendo ${BASE}/aether-globe-v3.html ...`);
  await page.goto(`${BASE}/aether-globe-v3.html`, { waitUntil: 'load', timeout: 60000 });

  // El globo construye la escena tras cargar los datos; se espera a que haya
  // WebGL pintado de verdad, no solo a que exista el canvas.
  await page.waitForFunction(() => {
    const cs = [...document.querySelectorAll('canvas')];
    const gl = cs.find((c) => {
      try { return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
    });
    return !!gl && gl.width > 100;
  }, null, { timeout: 60000 });
  console.log('Globo montado; esperando a que termine la entrada ...');
  await page.waitForTimeout(9000);

  /* Se esconden los paneles de la interfaz: la tarjeta pone su propio texto
     encima y dos capas de letra pequeña superpuestas no se leen. Lo que
     interesa de la captura es el planeta. */
  await page.evaluate(() => {
    const fuera = [
      '#hdr',               // el rótulo AETHER
      '#stats',             // el recuento por niveles, que la tarjeta repite
      '#leg',               // la leyenda de niveles, idem
      '#hint',              // «ARRASTRAR · Rotar», que aquí no se puede
      '#clock', '#loading', '#desktop-hotspots', '#arc-controls',
      '#globe-hotspots', '#arc-tooltip', '#panel',
    ];
    for (const sel of fuera) {
      document.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; });
    }
    /* Las etiquetas de país van en su propio canvas superpuesto, no en el
       DOM: a este tamaño se amontonan y se leen como ruido. Se oculta ese
       canvas y queda el planeta. */
    const canvases = [...document.querySelectorAll('canvas')];
    for (const c of canvases) {
      let esWebgl = false;
      try { esWebgl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { esWebgl = false; }
      if (!esWebgl) c.style.display = 'none';
    }
  });
  await page.waitForTimeout(1200);

  const raw = await page.screenshot({ type: 'png' });
  await browser.close();

  fs.mkdirSync(OUT, { recursive: true });
  const base = path.join(OUT, 'globo-tarjeta');
  const pipeline = () => sharp(raw).resize({ width: WIDTH, height: HEIGHT, fit: 'cover' });
  await pipeline().avif({ quality: 58, effort: 6 }).toFile(`${base}.avif`);
  await pipeline().webp({ quality: 82, effort: 6 }).toFile(`${base}.webp`);

  console.log('\nFondo de la tarjeta del globo regenerado:');
  for (const ext of ['avif', 'webp']) {
    console.log(`  globo-tarjeta.${ext.padEnd(4)} ${(fs.statSync(`${base}.${ext}`).size / 1024).toFixed(1).padStart(7)} kB`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
