/**
 * AETHER · estado compartido del shell del dashboard (T12)
 *
 * Seis ficheros del shell (errors, health, panels, session, telemetry,
 * diagnostics) compartían un mismo objeto de estado por `window`, y cada uno
 * lo creaba si no existía:
 *
 *     const state = window.AETHER_RUNTIME_STATE || (window.AETHER_RUNTIME_STATE = { ... });
 *
 * Eso funcionaba por accidente del orden de carga: quien llegara primero
 * ganaba, y si uno de ellos se adelantaba con una forma distinta del objeto,
 * el resto heredaba la suya. Ahora el estado vive aquí, en un solo sitio, y
 * los demás lo importan.
 */

/** Estado de ejecución del shell: errores, avisos, comprobaciones y eventos. */
export const AETHER_RUNTIME_STATE = {
  phase: 'VI',
  startedAt: new Date().toISOString(),
  errors: [],
  warnings: [],
  checks: {},
  events: [],
};

/** Límite de entradas que se conservan de cada lista, para no crecer sin fin. */
export const MAX_ENTRIES = 50;

/** Añade una entrada a una de las listas del estado, recortando por la cola. */
export function pushEntry(listName, entry) {
  const list = AETHER_RUNTIME_STATE[listName];
  if (!Array.isArray(list)) return;
  list.push(entry);
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
}

// Sigue expuesto en window porque el panel de diagnóstico lo consulta desde
// la consola del navegador. Ningún módulo lo lee de ahí.
window.AETHER_RUNTIME_STATE = AETHER_RUNTIME_STATE;
