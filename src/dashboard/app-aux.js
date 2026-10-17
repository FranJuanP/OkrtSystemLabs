/**
 * AETHER · constantes auxiliares de fase.
 *
 * T12: módulo ES. Antes era un IIFE que se comunicaba con el resto por
 * variables globales; ahora las dependencias son imports explícitos.
 */
// Fase III: compatibilidad. El router legado se carga desde index.html.
export const AETHER_PHASE3 = Object.freeze({
  routerModularized: true,
  cardsEngineUntouched: true
});
