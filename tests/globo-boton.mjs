/**
 * AETHER · el botón GLOBE abre el globo pase lo que pase.
 *
 * El botón se quedó muerto en producción y ninguna prueba se enteró, porque
 * todas comprobaban que las dos páginas cargan por separado y ninguna el
 * camino de una a otra.
 *
 * Tenía dos formas de no hacer nada, las dos silenciosas:
 *
 *   1. `openAetherGlobe()` llamaba a `syncAetherGlobeBridge()` SIN proteger.
 *      Esa función lee `window.computeRegionProfile`, que vive en el motor
 *      del panel; si lanza, la excepción sale de `openAetherGlobe` y
 *      `window.open` no llega a ejecutarse.
 *   2. Si el navegador bloquea la ventana emergente, `window.open` devuelve
 *      `null` sin lanzar nada. Ni siquiera había error en consola: se pulsaba
 *      y no ocurría absolutamente nada.
 *
 * Cada caso de aquí inyecta UNO de esos fallos y exige que el globo se abra
 * igual. Son los mismos que se usaron para diagnosticarlo.
 *
 * Uso:
 *   node tests/globo-boton.mjs --base http://localhost:8080/OkrtSystemLabs
 */
import { chromium } from 'playwright';

const argOf = (n, d) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const BASE = argOf('base', 'http://localhost:8080/OkrtSystemLabs').replace(/\/$/, '');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

let fallos = 0;
const ok = (m) => console.log(`   OK    ${m}`);
const mal = (m) => { fallos++; console.log(`   FALLO ${m}`); };

/**
 * Pulsa GLOBE con un fallo inyectado y dice si el globo se abrió.
 *
 * @param {object} browser
 * @param {string} nombre      qué se está rompiendo
 * @param {Function|null} roto  se ejecuta en la página antes de nada
 * @param {boolean} esperaPestana  si debe abrirse en pestaña nueva
 */
async function caso(browser, nombre, roto, esperaPestana) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (roto) await ctx.addInitScript(roto);

  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await esperar(2500);
  await page.evaluate(() => document.querySelector('.nav-cta[data-launch-aether]')?.click());
  await esperar(2500);

  const antes = ctx.pages().length;
  const urlAntes = page.url();
  const boton = await page.$('[data-action="open-globe"]');
  if (!boton) { mal(`${nombre}: no existe el botón GLOBE`); await ctx.close(); return; }
  await boton.click();
  await esperar(6000);

  const paginas = ctx.pages();
  const nueva = paginas.length > antes ? paginas[paginas.length - 1] : null;
  const destino = nueva || (page.url() !== urlAntes ? page : null);

  if (!destino) {
    mal(`${nombre}: el botón no abre nada`);
  } else if (!/aether-globe-v3\.html/.test(destino.url())) {
    mal(`${nombre}: lleva a ${destino.url()}`);
  } else if (esperaPestana && !nueva) {
    mal(`${nombre}: debería abrir pestaña nueva y ha navegado en la actual`);
  } else if (!esperaPestana && nueva) {
    mal(`${nombre}: con la emergente bloqueada no puede abrir una pestaña`);
  } else {
    ok(`${nombre}: el globo se abre ${nueva ? 'en una pestaña nueva' : 'en la misma pestaña'}`);
  }
  await ctx.close();
}

(async () => {
  console.log('\n===== EL BOTÓN GLOBE =====\n');
  const browser = await chromium.launch();

  await caso(browser, 'sin nada roto', null, true);

  await caso(browser, 'syncAetherGlobeBridge lanza', () => {
    Object.defineProperty(window, 'syncAetherGlobeBridge', {
      configurable: true,
      get() { return function () { throw new TypeError('simulado: el puente falla'); }; },
      set() {},
    });
  }, true);

  await caso(browser, 'computeRegionProfile lanza', () => {
    Object.defineProperty(window, 'computeRegionProfile', {
      configurable: true,
      get() { return function () { throw new TypeError('simulado: perfil roto'); }; },
      set() {},
    });
  }, true);

  await caso(browser, 'localStorage bloqueado', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('simulado: almacenamiento bloqueado', 'SecurityError'); },
    });
  }, true);

  /* Con la emergente bloqueada NO debe abrirse una pestaña: debe navegar en
     la actual. Es peor que una pestaña nueva y mucho mejor que nada. */
  await caso(browser, 'ventana emergente bloqueada', () => {
    window.open = function () { return null; };
  }, false);

  await browser.close();
  console.log(`\n===== ${fallos === 0 ? 'SIN FALLOS' : fallos + ' FALLOS'} =====`);
  process.exit(fallos === 0 ? 0 : 1);
})();
