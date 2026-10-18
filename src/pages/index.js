/**
 * Entrada de index.html (T12)
 *
 * Una sola entrada de módulo en lugar de veintisiete <script> sueltos, cuyo
 * orden de carga era además el contrato implícito entre ellos.
 *
 * El HTML no llama a ninguna función global: los botones de la portada y
 * los controles del dashboard se enganchan aquí con addEventListener.
 */
import '../core/fonts.js';
import '../styles/index.css';
import '../core/frame-buster.js';
import '../core/domain-notice.js';
import '../core/storage.js';
import '../core/visibility.js';
import '../core/mobile-viewport-fix.js';
import '../core/pwa-register.js';

import './../dashboard/shell-state.js';
import '../dashboard/app-shell-config.js';
import '../dashboard/runtime-guard.js';

import {
  onRegionChange, setHorizon,
  runAnalysis, runScenarios, showScenario, sendChat, checkOllama,
  exportPDF, setMapCat, filterArcType, toggleGlobeArcs,
  toggleShockSimulator, runShockCascade, resetShocks, applyPreset,
  renderRanking, updateCascadeModule, mapControls,
} from '../dashboard/engine.js';

import '../dashboard/app-shell-bindings.js';
import '../dashboard/app-dom.js';
import { launchAether } from '../dashboard/app-router-legacy.js';
import '../dashboard/app-aux.js';
import '../dashboard/app-shell-errors.js';
import '../dashboard/app-shell-health.js';
import '../dashboard/app-shell-panels.js';
import '../dashboard/app-shell-session.js';
import '../dashboard/app-shell-telemetry.js';
import '../dashboard/app-shell-diagnostics.js';
import '../dashboard/app-enhancements.js';
import '../dashboard/app-robustness.js';
import '../dashboard/okrt-flags-data.js';
import { openAetherGlobe } from '../dashboard/globe-bridge.js';
import { abrirPagina } from '../core/navegar.js';

/**
 * Que el panel estaba abierto, para poder VOLVER a él.
 *
 * `launchAether()` es una transición del DOM: esconde la portada y enseña el
 * panel, sin dejar entrada en el historial ni rastro en ninguna parte. Eso
 * estaba bien mientras el panel y el globo vivían en pestañas distintas, pero
 * en un teléfono —donde ahora el globo se abre en la misma ventana— el botón
 * «volver» aterrizaba en la PORTADA, con su animación de entrada, y había que
 * pulsar otra vez para llegar al sitio del que se venía.
 *
 * Se recuerda en `sessionStorage`, no en `localStorage`, a propósito: dura lo
 * que dura la sesión de la pestaña o de la app instalada. Quien entra nuevo
 * sigue viendo la portada, que es lo que tiene que ver; quien vuelve del globo
 * aterriza donde estaba.
 */
const CLAVE_PANEL = 'aether_panel_abierto';

function recuerdaPanelAbierto() {
  try { window.sessionStorage.setItem(CLAVE_PANEL, '1'); } catch (e) { /* bloqueado */ }
}
function seVeniaDelPanel() {
  try { return window.sessionStorage.getItem(CLAVE_PANEL) === '1'; } catch (e) { return false; }
}

/**
 * Acciones del dashboard que se declaran en el HTML con `data-action`.
 * Sustituye a inline-handlers-migration-1.js, que las resolvía buscando
 * `window.<nombre>` y fallaba en silencio si el motor aún no había cargado.
 */
const ACTIONS = {
  'launch-aether':     { on: 'click',   fn: (ev) => { ev.preventDefault(); recuerdaPanelAbierto(); launchAether(ev); } },
  'region-change':     { on: 'change',  fn: () => onRegionChange() },
  'render-ranking':    { on: 'change',  fn: () => renderRanking() },
  'run-analysis':      { on: 'click',   fn: () => runAnalysis() },
  'run-scenarios':     { on: 'click',   fn: () => runScenarios() },
  'send-chat':         { on: 'click',   fn: () => sendChat() },
  'export-pdf':        { on: 'click',   fn: () => exportPDF() },
  'toggle-globe-arcs': { on: 'click',   fn: () => toggleGlobeArcs() },
  'toggle-shock-sim':  { on: 'click',   fn: () => toggleShockSimulator() },
  'update-cascade':    { on: 'click',   fn: () => updateCascadeModule() },
  'reset-shocks':      { on: 'click',   fn: () => resetShocks() },
  'map-zoom-in':       { on: 'click',   fn: () => mapControls.zoomIn && mapControls.zoomIn() },
  'map-zoom-out':      { on: 'click',   fn: () => mapControls.zoomOut && mapControls.zoomOut() },
  'map-zoom-reset':    { on: 'click',   fn: () => mapControls.reset && mapControls.reset() },
  'open-globe':        { on: 'click',   fn: () => openAetherGlobe() },
  /* Por `abrirPagina`, igual que GLOBE: con `'noopener'` en las opciones
     `window.open` devuelve null siempre y no habia forma de saber si el
     navegador habia bloqueado la ventana. Cuando la bloqueaba, estos dos
     botones tampoco hacian nada. */
  'open-signal':       { on: 'click',   fn: () => abrirPagina('aether-signal.html') },
  'open-vector':       { on: 'click',   fn: () => abrirPagina('aether-vector.html') },
  'chat-keydown':      { on: 'keydown', fn: (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendChat(); }
    } },
};

function bindActions() {
  // Botones de la portada que entran a la aplicación.
  document.querySelectorAll('[data-launch-aether]').forEach((el) => {
    el.addEventListener('click', (ev) => { ev.preventDefault(); recuerdaPanelAbierto(); launchAether(ev); });
  });

  /* Y si en esta sesión ya se había entrado, se entra directamente: es la
     vuelta desde el globo, Signal o Vector. */
  if (seVeniaDelPanel()) launchAether();

  document.querySelectorAll('[data-action]').forEach((el) => {
    const action = ACTIONS[el.getAttribute('data-action')];
    if (!action) return;
    el.addEventListener(action.on, action.fn);
  });

  // El boton de verificar Ollama no lleva data-action, solo id.
  const checkBtn = document.getElementById('check-ollama-btn');
  if (checkBtn) checkBtn.addEventListener('click', () => checkOllama());

  // Horizonte temporal.
  document.querySelectorAll('[data-horizon]').forEach((btn) => {
    btn.addEventListener('click', () => setHorizon(btn, Number(btn.dataset.horizon)));
  });

  // Categoría del mapa.
  document.querySelectorAll('[data-map-cat]').forEach((btn) => {
    btn.addEventListener('click', () => setMapCat(btn, btn.dataset.mapCat));
  });

  // Filtros de tipo de arco en el mapa. 'ALL' significa sin filtro.
  document.querySelectorAll('[data-arc-type]').forEach((el) => {
    el.addEventListener('click', () => {
      const v = el.dataset.arcType;
      filterArcType(v === 'ALL' ? null : v);
    });
  });

  // Escenarios del panel de IA.
  document.querySelectorAll('[data-scenario]').forEach((tab) => {
    tab.addEventListener('click', () => showScenario(tab.dataset.scenario, tab));
  });

  // Presets del simulador de shocks.
  document.querySelectorAll('[data-shock-preset]').forEach((btn) => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.shockPreset));
  });

}

function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

onReady(bindActions);
