/**
 * Entrada de aether-globe-v3.html (T12)
 *
 * Una sola entrada de módulo en lugar de doce <script> sueltos. El HTML no
 * llama a nada: los botones de filtro de arco se enganchan aquí, que es lo
 * que hacía globe-module-hardening.js buscando `window.setArcFilter`.
 */
import '../core/fonts.js';
import '../styles/globe.css';
import '../core/frame-buster.js';
import '../core/domain-notice.js';
import '../core/storage.js';
import '../core/visibility.js';
import '../core/mobile-viewport-fix.js';
import '../core/pwa-register.js';
// En movil o en la app instalada esta pagina se abre en la MISMA ventana;
// sin esto no habria forma de volver al panel.
import '../core/volver.js';

import { setArcFilter, toggleGlobalMode } from '../globe/engine.js';
import '../globe/touch.js';
import '../globe/functional-boost.js';

/** Engancha los botones de filtro de tipo de arco. */
function bindArcFilters() {
  document.querySelectorAll('.arc-fbtn[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      if (type === 'GLOBAL') toggleGlobalMode();
      else setArcFilter(type);
    });
  });
}

function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

onReady(bindArcFilters);
