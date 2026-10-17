/**
 * Entrada de aether-vector.html (T12)
 *
 * Antes la página cargaba trece <script> sueltos que se comunicaban por
 * variables globales y por `window.X`. Ahora hay una sola entrada de módulo
 * y el orden de carga es el orden de los imports, que además es explícito.
 *
 * El HTML no llama a ninguna función global: los controles se enganchan
 * aquí con addEventListener.
 */
import '../core/frame-buster.js';
import '../core/domain-notice.js';
import '../core/security-hardening.js';
import '../core/storage.js';
import '../core/background-throttle.js';
import '../core/mobile-viewport-fix.js';
import '../core/pwa-register.js';
import '../core/dependency-resilience.js';

import { setFlow, setRegion, setThreshold, render } from '../vector/engine.js';
import '../vector/functional-boost.js';
import '../vector/mobile-fix.js';

/**
 * Engancha los controles del panel. Sustituye a
 * module-handlers-migration-2.js, que buscaba `window.setFlow` y compañía.
 */
function bindControls() {
  document.querySelectorAll('.flow-btn[data-flow]').forEach((btn) => {
    btn.addEventListener('click', () => setFlow(btn, btn.dataset.flow));
  });
  document.querySelectorAll('.reg-btn[data-region]').forEach((btn) => {
    btn.addEventListener('click', () => setRegion(btn, btn.dataset.region));
  });
  const slider = document.querySelector('[data-threshold-slider="true"]');
  if (slider) {
    slider.addEventListener('input', () => setThreshold(slider.value));
  }
}

function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

onReady(() => {
  bindControls();
  render();
  window.addEventListener('resize', render);
});
