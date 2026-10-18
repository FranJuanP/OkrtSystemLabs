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
  exportPDF,
  toggleShockSimulator, runShockCascade, resetShocks, applyPreset,
  renderRanking, updateCascadeModule,
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
import { estadoTrasRecarga } from '../core/pwa-register.js';

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
  'toggle-shock-sim':  { on: 'click',   fn: () => toggleShockSimulator() },
  'update-cascade':    { on: 'click',   fn: () => updateCascadeModule() },
  'reset-shocks':      { on: 'click',   fn: () => resetShocks() },
  /* La tarjeta del globo es un <a href>, para que funcione sin JavaScript y
     para que el teclado la active con Enter como cualquier enlace. Por eso
     hay que frenar la navegacion por defecto: sin esto el navegador seguiria
     el href ADEMAS de abrir la pestaña, y se abririan dos.

     Con Ctrl, Cmd, Shift o el boton central no se frena nada: ahi la persona
     esta pidiendo explicitamente al navegador que haga lo suyo. */
  'open-globe':        { on: 'click',   fn: (ev) => {
      if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1)) return;
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      openAetherGlobe();
    } },
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

  /* Lo que estuviera elegido antes de que el service worker nuevo recargara
     la página. El panel arranca siempre en Global y 6 meses, así que sin esto
     la actualización automática se llevaría por delante lo que la persona
     había seleccionado. */
  const previo = estadoTrasRecarga();
  if (previo) {
    // El panel tarda en montarse; se aplica cuando sus controles existen.
    setTimeout(() => {
      try {
        if (previo.horizonte) {
          const hb = document.querySelector(`.horizon .hbtn[data-horizon="${previo.horizonte}"]`);
          if (hb) hb.click();
        }
        const sel = document.getElementById('region-sel');
        if (previo.region && sel && sel.value !== previo.region) {
          sel.value = previo.region;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (e) {
        console.warn('[AETHER] no se pudo restaurar la selección tras la recarga:', e);
      }
    }, 3600);
  }

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
