(function(){
  function $(id){ return document.getElementById(id); }
  function safeSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function cleanRegionName(name){
    return String(name || '').replace(/^\s*[🌍🌐🗺️🧭]+\s*/u,'').replace(/^\s*[A-Z]{2}\s+/,'').trim();
  }
  function mapRegionToGlobeName(code, name){
    const n = String(cleanRegionName(name)).toLowerCase();
    const aliases = {
      'estados unidos':'Estados Unidos','usa':'Estados Unidos','eeuu':'Estados Unidos','reino unido':'Reino Unido','uk':'Reino Unido','rusia':'Rusia','iran':'Irán',
      'corea del norte':'Corea del Norte','corea del sur':'Corea del Sur','taiwan':'Taiwán','australia':'Australia','nueva zelanda':'Nueva Zelanda',
      'mexico':'México','canada':'Canadá','brasil':'Brasil','argentina':'Argentina','colombia':'Colombia','venezuela':'Venezuela','chile':'Chile','peru':'Perú',
      'sudafrica':'Sudáfrica','nigeria':'Nigeria','etiopia':'Etiopía','kenia':'Kenia','argelia':'Argelia','marruecos':'Marruecos','sudan':'Sudán','sudan del sur':'Sudán del Sur','rd congo':'RD Congo','somalia':'Somalia',
      'españa':'España','alemania':'Alemania','francia':'Francia','italia':'Italia','japon':'Japón','china':'China','india':'India','turquia':'Turquía','egipto':'Egipto','arabia saudi':'Arabia Saudí'
    };
    if(code === 'WLD') return null;
    return aliases[n] || cleanRegionName(name);
  }
  function getHorizonValue(){
    try {
      const active = document.querySelector('.horizon .hbtn.active');
      if (!active) return '12m';
      const m = String(active.textContent || '').match(/(\d+)/);
      return m ? (m[1] + 'm') : '12m';
    } catch(e){ return '12m'; }
  }
  function getRegionContext(){
    const sel = $('region-sel');
    const code = sel?.value || 'WLD';
    const opt = sel?.selectedOptions?.[0] || sel?.querySelector('option:checked');
    const regionName = cleanRegionName(opt?.textContent || code);
    const profile = (typeof window.computeRegionProfile === 'function') ? window.computeRegionProfile(code) : null;
    const scores = {};
    if (profile && Array.isArray(profile.cats)) profile.cats.forEach(c => { scores[c.key] = c.score; });
    return {
      ts: Date.now(),
      code,
      regionName,
      globeName: mapRegionToGlobeName(code, regionName),
      overall: profile?.overall ?? null,
      dominant: profile?.top?.[0]?.label || '',
      confidence: profile?.confidence ?? null,
      scores,
      horizon: getHorizonValue()
    };
  }
  window.syncAetherGlobeBridge = function(){
    const ctx = getRegionContext();
    safeSet('aether_globe_context', ctx);
    safeSet('aether_globe_scores', { ts: ctx.ts, code: ctx.code, regionName: ctx.regionName, scores: ctx.scores, overall: ctx.overall, dominant: ctx.dominant, confidence: ctx.confidence });
    try { localStorage.setItem('aether_horizon', ctx.horizon); } catch(e){}
    return ctx;
  };
  window.openAetherGlobe = function(){
    window.syncAetherGlobeBridge();
    const w = window.open('aether-globe-v3.html?ctx=' + Date.now(), '_blank', 'noopener');
    if (w) { try { w.opener = null; } catch(e){} }
  };
  function installBridgeHooks(){
    try { window.syncAetherGlobeBridge(); } catch(e){}
    const sel = $('region-sel');
    if (sel && !sel.dataset.globeBridgeBound) {
      sel.addEventListener('change', () => setTimeout(window.syncAetherGlobeBridge, 80));
      sel.dataset.globeBridgeBound = '1';
    }
    document.addEventListener('click', function(ev){
      const b = ev.target.closest('.horizon .hbtn, #analyze-btn, #scenario-btn, #shock-sim-btn');
      if (b) setTimeout(window.syncAetherGlobeBridge, 120);
    }, true);
    setInterval(window.syncAetherGlobeBridge, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installBridgeHooks); else installBridgeHooks();
})();
