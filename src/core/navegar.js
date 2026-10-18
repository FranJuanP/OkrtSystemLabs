/**
 * AETHER · abrir una página del sitio desde otra.
 *
 * Tres botones del panel llevan a otras páginas —GLOBE, SIGNAL y VECTOR— y
 * los tres hacían lo mismo mal, cada uno por su cuenta:
 *
 *   window.open('aether-signal.html', '_blank', 'noopener')
 *
 * Con `'noopener'` en las opciones, `window.open` devuelve `null` SIEMPRE por
 * especificación, haya abierto la pestaña o no. Es decir: era imposible saber
 * si el navegador había bloqueado la ventana, y cuando la bloqueaba el botón
 * no hacía absolutamente nada, sin un error en consola que lo explicara.
 *
 * Y en un teléfono una pestaña nueva es casi siempre lo que NO se quiere: el
 * navegador las apila fuera de la vista, y en una app instalada en modo
 * `standalone` ni siquiera hay pestañas que mostrar. Ahí la navegación tiene
 * que ocurrir en la misma ventana, con una forma visible de volver.
 */

/** Si el contexto es de los que no deben abrir pestañas nuevas. */
export function navegaEnLaMismaVentana() {
  try {
    // App instalada: no hay barra de pestañas donde encontrar la nueva.
    const instalada = ['standalone', 'fullscreen', 'minimal-ui']
      .some((m) => window.matchMedia(`(display-mode: ${m})`).matches)
      || window.navigator.standalone === true;   // iOS, que no implementa lo anterior
    if (instalada) return true;

    // Teléfono o tableta: puntero grueso y pantalla estrecha.
    const tactil = window.matchMedia('(pointer: coarse)').matches;
    const estrecha = window.matchMedia('(max-width: 900px)').matches;
    return tactil && estrecha;
  } catch (e) {
    return false;
  }
}

/**
 * Abre una página del sitio. Pase lo que pase.
 *
 * @param {string} url  relativa a la página actual
 * @returns {Window|null} la ventana nueva, o null si se navegó aquí
 */
export function abrirPagina(url) {
  if (navegaEnLaMismaVentana()) {
    window.location.href = url;
    return null;
  }

  let w = null;
  try {
    /* Sin `'noopener'` a propósito: con esa opción no se puede distinguir el
       éxito del bloqueo. El aislamiento se consigue igual poniendo `opener` a
       null justo después, y el destino es una página nuestra del mismo
       origen. */
    w = window.open(url, '_blank');
  } catch (err) {
    console.error('[AETHER] window.open ha fallado:', err);
  }

  if (w) { try { w.opener = null; } catch (e) { /* algunos navegadores lo impiden */ } return w; }

  console.warn('[AETHER] ventana emergente bloqueada; se abre en esta ventana:', url);
  window.location.href = url;
  return null;
}
