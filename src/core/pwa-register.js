/**
 * AETHER · registro del service worker y recarga tras una versión nueva.
 *
 * Hubo tres políticas aquí, y conviene saber por qué estamos en la tercera.
 *
 * 1. Al principio el worker hacía `skipWaiting()` nada más instalarse: se
 *    activaba solo y le cambiaba el código a quien estuviera usando la página
 *    en ese momento, sin avisar y sin recargar. Mezcla de versiones.
 *
 * 2. Luego se quedaba esperando y esta capa mostraba «Nueva versión
 *    disponible · Recargar». Suena más prudente. Era peor: mientras nadie
 *    pulsara ese aviso, el worker ANTERIOR seguía sirviendo su HTML y su JS
 *    desde el precache, que es «caché primero». El visitante se quedaba una
 *    versión por detrás de forma indefinida, y pulsar GLOBE abría el globo de
 *    la versión de antes. El aviso, además, es fácil de no ver.
 *
 * 3. Ahora el worker se activa y toma el control, y esta capa recarga la
 *    página UNA vez, conservando lo que estuviera elegido. El cambio de
 *    versión ocurre en un parpadeo y la siguiente navegación ya es la nueva.
 */
import { Workbox } from 'workbox-window';

/** Lo que no se puede perder en la recarga, mientras dura la recarga. */
const CLAVE_ESTADO = 'aether_estado_recarga';

/**
 * Guarda la región y el horizonte elegidos.
 *
 * Los dos se escriben ya en `localStorage` —lo hace el puente del globo— pero
 * NADIE los vuelve a leer al arrancar: el panel siempre empieza en Global y
 * 6 meses. Si la recarga se llevara por delante lo que la persona había
 * elegido, el remedio sería peor que la enfermedad.
 *
 * Va en `sessionStorage` a propósito: dura lo que dura esta recarga. No se
 * convierte en «el panel recuerda tu última región para siempre», que es otra
 * decisión y no la que toca aquí.
 */
function guardarAntesDeRecargar() {
  try {
    const sel = document.getElementById('region-sel');
    const activo = document.querySelector('.horizon .hbtn.active');
    if (!sel && !activo) return;
    window.sessionStorage.setItem(CLAVE_ESTADO, JSON.stringify({
      region: sel ? sel.value : '',
      horizonte: activo ? (activo.dataset.horizon || '') : '',
    }));
  } catch (e) { /* almacenamiento bloqueado: se recarga igual */ }
}

/**
 * Devuelve lo guardado antes de la recarga, y lo borra.
 * Lo consume `src/pages/index.js` cuando el panel ya está montado.
 * @returns {{region:string, horizonte:string}|null}
 */
export function estadoTrasRecarga() {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_ESTADO);
    if (!crudo) return null;
    window.sessionStorage.removeItem(CLAVE_ESTADO);
    const d = JSON.parse(crudo);
    return d && typeof d === 'object' ? d : null;
  } catch (e) {
    return null;
  }
}

function register() {
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;
  if (!/^https?:$/i.test(location.protocol)) return;

  /* ¿Había ya un worker controlando esta página?
     Importa para no recargar en la PRIMERA visita: ahí `clientsClaim()`
     también dispara `controllerchange`, pero no hay ninguna versión anterior
     que sustituir y recargar sería un parpadeo gratuito. */
  const habiaControlador = !!navigator.serviceWorker.controller;
  let recargando = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador) return;   // primera instalación
    if (recargando) return;          // una sola vez
    recargando = true;
    guardarAntesDeRecargar();
    window.location.reload();
  });

  // `import.meta.env.BASE_URL` es '/OkrtSystemLabs/' en el build, así que el
  // worker se registra con el ámbito correcto en GitHub Pages.
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  /* `updateViaCache: 'none'` para que el navegador NO use su caché HTTP al
     comprobar si hay un worker nuevo, ni para el script ni para sus imports.
     En GitHub Pages no se pueden fijar cabeceras, así que es lo único que se
     puede controlar desde aquí. */
  const wb = new Workbox(`${base}sw.js`, { scope: base, updateViaCache: 'none' });

  wb.register().catch((err) => {
    console.warn('[AETHER PWA] no se pudo registrar el service worker:', err);
  });
}

if (document.readyState === 'complete') register();
else window.addEventListener('load', register, { once: true });
