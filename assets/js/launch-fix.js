(function(){
  function byId(id){ return document.getElementById(id); }
  function showAetherPage(){
    var landing = byId('page-landing');
    var aether = byId('page-aether');
    if (!aether) return false;

    try { document.body.style.cursor = 'default'; } catch(e) {}
    try {
      var cur = byId('cur');
      var cur2 = byId('cur2');
      if (cur) cur.style.display = 'none';
      if (cur2) cur2.style.display = 'none';
    } catch(e) {}

    if (landing) {
      landing.classList.add('hidden');
      landing.style.display = 'none';
      landing.setAttribute('aria-hidden', 'true');
    }

    aether.style.display = 'block';
    aether.classList.add('active');
    aether.classList.remove('hidden');
    aether.setAttribute('aria-hidden', 'false');

    try {
      var loader = byId('loader');
      if (loader) loader.style.display = 'flex';
      var lm = byId('lm');
      if (lm && !lm.textContent.trim()) lm.textContent = 'INICIANDO SISTEMA...';
    } catch(e) {}

    try {
      if (history && history.pushState) history.pushState({page:'aether'}, '', '#aether');
    } catch(e) {}

    window.dispatchEvent(new Event('resize'));

    setTimeout(function(){
      try {
        if (typeof window.initAetherApp === 'function') window.initAetherApp();
      } catch(e) {}
      try {
        if (typeof window.initAetherApp2 === 'function') window.initAetherApp2();
      } catch(e) {}
      try {
        if (typeof window.loadRegion === 'function') window.loadRegion();
      } catch(e) {}
      try {
        if (typeof window.initClock === 'function') window.initClock();
      } catch(e) {}
      try {
        if (typeof window._drawGlobeArcs === 'function') setTimeout(window._drawGlobeArcs, 300);
      } catch(e) {}
      try {
        var loader2 = byId('loader');
        if (loader2) setTimeout(function(){ loader2.classList.add('out'); }, 900);
      } catch(e) {}
    }, 60);

    return true;
  }

  function cleanLaunch(event){
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    return showAetherPage();
  }

  window.launchAether = cleanLaunch;

  function bindLaunchers(){
    document.querySelectorAll('[data-launch-aether]').forEach(function(el){
      if (el.dataset.launchFixBound === '1') return;
      el.addEventListener('click', cleanLaunch, true);
      el.dataset.launchFixBound = '1';
      el.setAttribute('role', el.getAttribute('role') || 'button');
    });
  }

  function bindPopstate(){
    if (window.__launchFixPopstateBound) return;
    window.addEventListener('popstate', function(ev){
      var landing = byId('page-landing');
      var aether = byId('page-aether');
      if (!ev.state || ev.state.page !== 'aether') {
        if (aether) {
          aether.classList.remove('active');
          aether.style.display = 'none';
        }
        if (landing) {
          landing.style.display = '';
          landing.classList.remove('hidden');
        }
        try { document.body.style.cursor = 'default'; } catch(e) {}
      }
    });
    window.__launchFixPopstateBound = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ bindLaunchers(); bindPopstate(); });
  } else {
    bindLaunchers();
    bindPopstate();
  }
})();
