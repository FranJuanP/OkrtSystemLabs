/**
 * AETHER · frame-buster (T4)
 *
 * `frame-ancestors` es la defensa real contra el clickjacking, pero el
 * navegador la IGNORA cuando llega en una etiqueta <meta>: solo la aplica
 * si viene en una cabecera HTTP de respuesta. GitHub Pages no permite
 * añadir cabeceras propias, así que la directiva se ha retirado de las
 * <meta> (donde no hacía nada y además ensuciaba la consola con un aviso)
 * y se sustituye por esta comprobación en JavaScript.
 *
 * Esto es una mitigación, no un equivalente: un atacante que controle el
 * marco puede impedir la navegación con sandbox. Si en el futuro el sitio
 * se sirve desde un origen con cabeceras propias, hay que volver a poner
 * `Content-Security-Policy: frame-ancestors 'self'` como cabecera HTTP y
 * este fichero pasa a ser redundante.
 */
(function () {
  'use strict';
  try {
    if (window.top === window.self) return;      // no estamos enmarcados
    // Enmarcados: se intenta salir del marco.
    window.top.location = window.self.location.href;
  } catch (e) {
    // El marco es de otro origen y ni siquiera deja leer window.top.location.
    // No se puede navegar, así que al menos se avisa en pantalla.
    document.addEventListener('DOMContentLoaded', function () {
      try {
        var warn = document.createElement('div');
        warn.setAttribute('role', 'alert');
        warn.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;' +
          'align-items:center;justify-content:center;background:#000508;color:#00FFC8;' +
          'font-family:monospace;font-size:14px;text-align:center;padding:24px';
        var link = document.createElement('a');
        link.href = window.self.location.href;
        link.target = '_top';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'color:#00FFC8;text-decoration:underline';
        link.textContent = 'Abrir AETHER en una pestaña propia';
        warn.appendChild(document.createTextNode(
          'Esta página no puede mostrarse dentro de otro sitio. '));
        warn.appendChild(link);
        document.body.appendChild(warn);
      } catch (e2) { /* nada más que hacer */ }
    });
  }
})();
