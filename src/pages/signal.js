/**
 * Entrada de aether-signal.html (T12)
 *
 * Una sola entrada de módulo en lugar de once <script> sueltos acoplados
 * por variables globales. El HTML no llama a nada: los filtros y el orden
 * se enganchan aquí con addEventListener.
 */
import '../core/frame-buster.js';
import '../core/domain-notice.js';
import '../core/storage.js';
import '../core/visibility.js';
import '../core/mobile-viewport-fix.js';
import '../core/pwa-register.js';

import { loadAll, filterCat, sortBy } from '../signal/engine.js';
import { installSignalBoost } from '../signal/feed-boost.js';
import '../signal/mobile-fix.js';

/** Refresco periódico del feed. */
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Engancha los controles de categoría y orden. Sustituye a
 * module-handlers-migration-2.js, que buscaba `window.filterCat`/`window.sortBy`.
 */
function bindControls() {
  document.querySelectorAll('.cat-btn[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => filterCat(btn, btn.dataset.cat));
  });
  document.querySelectorAll('.sort-btn[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => sortBy(btn, btn.dataset.sort));
  });
}

function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

onReady(() => {
  bindControls();
  installSignalBoost();
  loadAll();
  setInterval(loadAll, REFRESH_MS);
});
