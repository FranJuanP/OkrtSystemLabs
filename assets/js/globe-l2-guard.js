/**
 * AETHER Globe · aviso de copia no autorizada ("L2 guard")
 *
 * T4: iba inline en aether-globe-v3.html; se externaliza para poder quitar
 * 'unsafe-inline' de script-src. Comportamiento sin cambios en este commit;
 * T6 corrige la comprobacion de host y deja de romper la pagina.
 */
(function(){
  const ALLOWED_HOST = "franjuanp.github.io";
  const ALLOWED_BASE = "/OkrtSystemLabs";

  function isAuthorizedLocation(){
    try{
      const host = String(window.location.hostname || "").toLowerCase();
      const path = String(window.location.pathname || "");
      return host === ALLOWED_HOST && (
        path === ALLOWED_BASE ||
        path === ALLOWED_BASE + "/" ||
        path.indexOf(ALLOWED_BASE + "/") === 0
      );
    }catch(_){
      return false;
    }
  }

  const authorized = isAuthorizedLocation();
  window.__AETHER_L2_ALLOWED__ = authorized;
  if (authorized) return;

  document.documentElement.classList.add("l2-protected");

  function mountL2(){
    let overlay = document.getElementById("aether-l2-overlay");
    if(overlay) return;
    overlay = document.createElement("div");
    overlay.id = "aether-l2-overlay";
    overlay.innerHTML =
      '<div class="aether-l2-card">' +
        '<div class="aether-l2-kicker">Copyright Protection · Nivel 2</div>' +
        '<h1 class="aether-l2-title">Uso no autorizado detectado</h1>' +
        '<p class="aether-l2-copy">Esta instancia se está ejecutando fuera del dominio autorizado. La visualización permanece visible como aviso de copyright, pero el uso queda restringido a la publicación oficial de OkrtSystem Labs.</p>' +
        '<div class="aether-l2-meta">' +
          '<div class="aether-l2-chip"><div class="aether-l2-label">Dominio autorizado</div><div class="aether-l2-value">franjuanp.github.io/OkrtSystemLabs</div></div>' +
          '<div class="aether-l2-chip"><div class="aether-l2-label">Origen detectado</div><div class="aether-l2-value">' + (window.location.href || "desconocido") + '</div></div>' +
          '<div class="aether-l2-chip"><div class="aether-l2-label">Estado</div><div class="aether-l2-value">Protección Nivel 2 activa</div></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", mountL2, {once:true});
  } else {
    mountL2();
  }
})();
