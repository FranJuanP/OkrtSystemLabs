/**
 * AETHER · el botón de volver al panel.
 *
 * Cuando GLOBE, SIGNAL o VECTOR se abren en la MISMA ventana —en un teléfono,
 * o en la app instalada, donde una pestaña nueva no se ve o no existe— hay
 * que poder volver. El gesto «atrás» del sistema existe, pero en una app
 * instalada en iOS no hay barra de navegación visible: sin esto, la única
 * salida es cerrar la aplicación.
 *
 * Se monta solo en ese caso. En un escritorio con pestañas no aparece: ahí la
 * forma de volver es la pestaña del panel, que sigue abierta.
 */
import { navegaEnLaMismaVentana } from './navegar.js';

const ID = 'aether-volver';

/**
 * @param {string} destino  a dónde vuelve, relativo a esta página
 */
export function montarVolver(destino = 'index.html') {
  if (!navegaEnLaMismaVentana()) return null;
  if (document.getElementById(ID)) return document.getElementById(ID);

  const b = document.createElement('button');
  b.id = ID;
  b.type = 'button';
  b.textContent = '← PANEL';
  b.setAttribute('aria-label', 'Volver al panel de AETHER');
  /* Mismo lenguaje visual que el resto: la tipografía mono del sistema y el
     cian de los acentos. Se queda sobre el contenido y lejos de los controles
     del globo, que viven abajo. */
  b.style.cssText = [
    'position:fixed', 'top:max(10px, env(safe-area-inset-top))', 'left:10px',
    'z-index:2147482000', 'font-family:"Share Tech Mono",monospace',
    'font-size:11px', 'letter-spacing:.14em', 'cursor:pointer',
    'padding:7px 12px', 'border-radius:999px',
    'color:rgba(0,255,200,.92)', 'background:rgba(4,10,18,.88)',
    'border:1px solid rgba(0,255,200,.35)',
    'box-shadow:0 4px 16px rgba(0,0,0,.4)',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');

  b.addEventListener('click', () => {
    /* `history.back()` conserva el estado del panel —la región elegida, el
       horizonte— y es instantáneo. Solo si no hay a dónde volver (se ha
       entrado por un enlace directo) se navega. */
    if (window.history.length > 1) window.history.back();
    else window.location.href = destino;
  });

  document.body.appendChild(b);
  return b;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => montarVolver(), { once: true });
} else {
  montarVolver();
}
