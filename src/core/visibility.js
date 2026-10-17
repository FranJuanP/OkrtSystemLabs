/**
 * AETHER · pausa del trabajo periódico cuando la pestaña no se ve (T14)
 *
 * Qué había antes
 * ---------------
 * `background-throttle.js` sustituía `window.setInterval`,
 * `window.clearInterval`, `window.requestAnimationFrame` y
 * `window.cancelAnimationFrame` por versiones propias que, con la pestaña
 * oculta, se tragaban la llamada. Tres problemas:
 *
 *  1. Afectaba a TODO el código de la página, incluido el de terceros, de
 *     forma invisible. Un `setInterval` de cualquier librería dejaba de
 *     dispararse sin que nada lo dijera.
 *  2. El temporizador seguía corriendo y consumiendo; solo se descartaba el
 *     trabajo. No ahorraba lo que parecía ahorrar.
 *  3. Los navegadores ya limitan por su cuenta los temporizadores y paran
 *     `requestAnimationFrame` en pestañas ocultas, así que la capa de rAF
 *     no hacía nada salvo añadir una indirección.
 *
 * Qué hace ahora
 * --------------
 * Nada de parches. Un único módulo que escucha `visibilitychange` y avisa a
 * quien se registre. Cada módulo decide qué parar: el globo suelta su bucle
 * con `renderer.setAnimationLoop(null)`, y quien tenga un intervalo caro lo
 * limpia y lo vuelve a crear al regresar.
 */

/** @type {Array<(hidden: boolean) => void>} */
const listeners = [];

/** ¿Está la pestaña oculta ahora mismo? */
export function isHidden() {
  return typeof document !== 'undefined' && document.hidden === true;
}

/**
 * Registra un oyente de cambios de visibilidad.
 * Se le llama inmediatamente con el estado actual, para que no tenga que
 * duplicar la lógica de arranque.
 *
 * @param {(hidden: boolean) => void} fn
 * @returns {() => void} función para darse de baja
 */
export function onVisibilityChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.push(fn);
  try { fn(isHidden()); } catch (err) { console.warn('AETHER: oyente de visibilidad fallido:', err); }
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

/**
 * Crea un intervalo que deja de correr de verdad mientras la pestaña está
 * oculta: se limpia al ocultarse y se vuelve a crear al volver. A diferencia
 * del parche anterior, aquí el temporizador no queda vivo descartando
 * trabajo.
 *
 * @param {() => void} fn
 * @param {number} delayMs
 * @returns {() => void} función para detenerlo
 */
export function intervalWhileVisible(fn, delayMs) {
  let id = null;
  const start = () => { if (id === null) id = setInterval(fn, delayMs); };
  const stop = () => { if (id !== null) { clearInterval(id); id = null; } };
  const unsubscribe = onVisibilityChange((hidden) => (hidden ? stop() : start()));
  return () => { unsubscribe(); stop(); };
}

document.addEventListener('visibilitychange', () => {
  const hidden = isHidden();
  // Marca en el <html>, que algunas reglas CSS usan para pausar animaciones.
  document.documentElement.toggleAttribute('data-aether-hidden', hidden);
  for (const fn of listeners.slice()) {
    try { fn(hidden); } catch (err) { console.warn('AETHER: oyente de visibilidad fallido:', err); }
  }
}, { passive: true });

document.documentElement.toggleAttribute('data-aether-hidden', isHidden());
