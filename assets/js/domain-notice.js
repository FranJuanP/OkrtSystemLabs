/**
 * AETHER · aviso de copyright fuera del dominio oficial (T6)
 *
 * Esto NO es una medida de seguridad y no debe presentarse como tal: todo
 * el código se ejecuta en el navegador de quien visita la página, así que
 * cualquiera puede borrar este fichero de una copia. Es, exactamente, un
 * aviso de autoría.
 *
 * Qué cambia respecto de lo que había (había cuatro copias de lo mismo:
 * runtime-guard.js, el motor de Signal, el de Vector y el overlay del globo):
 *
 *  1. La comprobación era por subcadena (`host.indexOf(permitido) !== -1`),
 *     de modo que `localhost.evil.com` y `franjuanp.github.io.evil.com`
 *     pasaban el filtro, y en cambio el overlay del globo exigía además una
 *     ruta concreta y por eso se disparaba en local, contra lo que dice el
 *     README. Ahora es igualdad exacta de host.
 *  2. `localhost` y `127.0.0.1` están permitidos, que es lo que el README
 *     lleva documentando desde el principio.
 *  3. Fuera de esos hosts ya no se sustituye `window.fetch` por una función
 *     que devuelve respuestas vacías tras 3 segundos, ni se tapa la página
 *     con una tarjeta a pantalla completa. Queda solo un aviso discreto en
 *     una esquina, y la aplicación sigue funcionando.
 */
(function () {
  'use strict';

  var ALLOWED_HOSTS = ['franjuanp.github.io', 'localhost', '127.0.0.1', '[::1]'];

  var host = '';
  try { host = String(window.location.hostname || '').toLowerCase(); } catch (e) { host = ''; }

  // Igualdad exacta, nunca subcadena.
  var authorized = ALLOWED_HOSTS.indexOf(host) !== -1;

  window.__AETHER_AUTHORIZED_HOST__ = authorized;
  // Compatibilidad con el nombre que usaba el overlay del globo.
  window.__AETHER_L2_ALLOWED__ = authorized;

  if (authorized) return;

  console.info(
    '[AETHER] Copia ejecutándose fuera de franjuanp.github.io. ' +
    '© OkrtSystem Labs. La aplicación funciona con normalidad; esto es solo un aviso de autoría.'
  );

  function mountNotice() {
    if (document.getElementById('aether-copyright-notice')) return;
    var el = document.createElement('div');
    el.id = 'aether-copyright-notice';
    el.setAttribute('role', 'note');
    el.style.cssText = [
      'position:fixed', 'right:10px', 'bottom:10px', 'z-index:99999',
      'max-width:min(78vw,340px)', 'padding:6px 10px',
      'font-family:monospace', 'font-size:10px', 'line-height:1.5',
      'letter-spacing:.06em', 'color:rgba(0,255,200,.55)',
      'background:rgba(0,5,10,.72)', 'border:1px solid rgba(0,255,200,.22)',
      'border-radius:4px', 'pointer-events:none', 'user-select:none',
    ].join(';');
    el.textContent = '© OkrtSystem Labs · AETHER · copia no oficial';
    document.body.appendChild(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountNotice, { once: true });
  } else {
    mountNotice();
  }
})();
