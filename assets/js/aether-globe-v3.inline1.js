
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
    const card = document.createElement('div');
    card.className = 'aether-l2-card';
    const kicker = document.createElement('div');
    kicker.className = 'aether-l2-kicker';
    kicker.textContent = 'Copyright Protection · Nivel 2';
    const title = document.createElement('h1');
    title.className = 'aether-l2-title';
    title.textContent = 'Uso no autorizado detectado';
    const copy = document.createElement('p');
    copy.className = 'aether-l2-copy';
    copy.textContent = 'Esta instancia se está ejecutando fuera del dominio autorizado. La visualización permanece visible como aviso de copyright, pero el uso queda restringido a la publicación oficial de OkrtSystem Labs.';
    const meta = document.createElement('div');
    meta.className = 'aether-l2-meta';
    [
      ['Dominio autorizado','franjuanp.github.io/OkrtSystemLabs'],
      ['Origen detectado', window.location.href || 'desconocido'],
      ['Estado','Protección Nivel 2 activa']
    ].forEach(([label, value]) => {
      const chip = document.createElement('div');
      chip.className = 'aether-l2-chip';
      const labelNode = document.createElement('div');
      labelNode.className = 'aether-l2-label';
      labelNode.textContent = label;
      const valueNode = document.createElement('div');
      valueNode.className = 'aether-l2-value';
      valueNode.textContent = value;
      chip.append(labelNode, valueNode);
      meta.appendChild(chip);
    });
    card.append(kicker, title, copy, meta);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", mountL2, {once:true});
  } else {
    mountL2();
  }
})();
