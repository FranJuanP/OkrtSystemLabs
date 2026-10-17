/**
 * AETHER · registro del service worker y aviso de versión nueva (T18)
 *
 * Antes se registraba el service worker y punto, y el propio worker hacía
 * `skipWaiting()` en cuanto se instalaba: se activaba solo y le cambiaba el
 * código a quien estuviera usando la página en ese momento.
 *
 * Ahora el worker nuevo se queda esperando y esta capa avisa: «Nueva versión
 * disponible · Recargar». Solo al pulsar se le manda `SKIP_WAITING` y se
 * recarga, así que el cambio ocurre cuando la persona decide.
 */
import { Workbox } from 'workbox-window';

/** Id del aviso, para no montarlo dos veces. */
const NOTICE_ID = 'aether-update-notice';

function mountNotice(onReload) {
  if (document.getElementById(NOTICE_ID)) return;

  const el = document.createElement('div');
  el.id = NOTICE_ID;
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:18px', 'transform:translateX(-50%)',
    'z-index:2147483000', 'display:flex', 'align-items:center', 'gap:12px',
    'padding:9px 14px', 'border-radius:999px',
    'font-family:"Share Tech Mono",monospace', 'font-size:11px',
    'letter-spacing:.12em', 'color:rgba(0,255,200,.9)',
    'background:rgba(4,10,18,.94)', 'border:1px solid rgba(0,255,200,.35)',
    'box-shadow:0 8px 28px rgba(0,0,0,.45)',
  ].join(';');

  const text = document.createElement('span');
  text.textContent = 'Nueva versión disponible';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Recargar';
  button.style.cssText = [
    'font:inherit', 'letter-spacing:.14em', 'cursor:pointer',
    'padding:4px 12px', 'border-radius:999px',
    'color:#041018', 'background:rgba(0,255,200,.9)', 'border:0',
  ].join(';');
  button.addEventListener('click', onReload, { once: true });

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = '✕';
  dismiss.setAttribute('aria-label', 'Descartar el aviso');
  dismiss.style.cssText = [
    'font:inherit', 'cursor:pointer', 'color:rgba(0,255,200,.5)',
    'background:transparent', 'border:0', 'padding:0 2px',
  ].join(';');
  dismiss.addEventListener('click', () => el.remove(), { once: true });

  el.append(text, button, dismiss);
  document.body.appendChild(el);
}

function register() {
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;
  if (!/^https?:$/i.test(location.protocol)) return;

  // `import.meta.env.BASE_URL` es '/OkrtSystemLabs/' en el build, así que el
  // worker se registra con el ámbito correcto en GitHub Pages.
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  const wb = new Workbox(`${base}sw.js`, { scope: base });

  wb.addEventListener('waiting', () => {
    mountNotice(() => {
      // Cuando el worker nuevo tome el control, recargar una sola vez.
      wb.addEventListener('controlling', () => window.location.reload(), { once: true });
      wb.messageSkipWaiting();
    });
  });

  wb.register().catch((err) => {
    console.warn('[AETHER PWA] no se pudo registrar el service worker:', err);
  });
}

if (document.readyState === 'complete') register();
else window.addEventListener('load', register, { once: true });
