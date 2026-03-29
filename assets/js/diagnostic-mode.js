(function(){
  const DIAG_KEY = 'aether_diag_mode_v1';
  const state = {
    enabled: false,
    page: detectPage(),
    errors: [],
    rejected: [],
    startedAt: Date.now(),
    lastRenderAt: 0
  };

  function detectPage(){
    const p = location.pathname.split('/').pop() || 'index.html';
    if (p.includes('globe')) return 'globe';
    if (p.includes('signal')) return 'signal';
    if (p.includes('vector')) return 'vector';
    return 'index';
  }

  function envLabel(){
    return location.protocol === 'file:' ? 'LOCAL' : 'SERVER';
  }

  function safeGetLS(k){
    try { return localStorage.getItem(k); } catch(_) { return null; }
  }

  function jsonStatus(k){
    try {
      const raw = safeGetLS(k);
      if (!raw) return {key:k, present:false};
      const parsed = JSON.parse(raw);
      const t = Array.isArray(parsed) ? 'array' : typeof parsed;
      const size = Array.isArray(parsed) ? parsed.length : (parsed && typeof parsed === 'object' ? Object.keys(parsed).length : String(parsed).length);
      return {key:k, present:true, type:t, size:size};
    } catch(e){
      const raw = safeGetLS(k);
      return {key:k, present:!!raw, type:'raw', size: raw ? raw.length : 0, invalid:true};
    }
  }

  function depChecks(){
    const checks = [];
    checks.push({name:'THREE', ok: !!window.THREE, where:'globe'});
    checks.push({name:'d3', ok: !!window.d3, where:'globe/vector'});
    checks.push({name:'topojson', ok: !!window.topojson, where:'globe'});
    checks.push({name:'AetherDiagnostics', ok: !!window.AetherDiagnostics, where:'index'});
    checks.push({name:'AETHER_RUNTIME_STATE', ok: !!window.AETHER_RUNTIME_STATE, where:'index'});
    return checks.filter(c => c.where.includes(state.page) || c.where === 'index' && state.page === 'index');
  }

  function pageChecks(){
    const checks = [];
    if (state.page === 'index') {
      checks.push({name:'page-aether', ok: !!document.getElementById('page-aether')});
      checks.push({name:'region-sel', ok: !!document.getElementById('region-sel')});
      checks.push({name:'shell active', ok: !!document.body});
    } else if (state.page === 'globe') {
      checks.push({name:'canvas or renderer root', ok: !!document.querySelector('canvas') || !!document.getElementById('globe') || !!document.getElementById('scene')});
      checks.push({name:'panel', ok: !!document.getElementById('panel')});
      checks.push({name:'arc controls', ok: !!document.getElementById('arc-controls')});
    } else if (state.page === 'signal') {
      checks.push({name:'feed', ok: !!document.getElementById('feed')});
      checks.push({name:'detail', ok: !!document.getElementById('detail')});
      checks.push({name:'ticker', ok: !!document.getElementById('ticker')});
    } else if (state.page === 'vector') {
      checks.push({name:'map', ok: !!document.getElementById('map') || !!document.querySelector('svg')});
      checks.push({name:'threshold', ok: !!document.getElementById('threshold') || !!document.querySelector('input[type="range"]')});
      checks.push({name:'detail panel', ok: !!document.getElementById('detail-content') || !!document.getElementById('detail')});
    }
    return checks;
  }

  function scriptsSummary(){
    return Array.from(document.scripts)
      .map(s => s.src || 'inline')
      .filter(Boolean)
      .slice(-12)
      .map(src => src.split('/').slice(-2).join('/'));
  }

  function getPerf(){
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav) {
        return {
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
          loadMs: Math.round(nav.loadEventEnd || 0),
          type: nav.type || 'navigate'
        };
      }
    } catch(_) {}
    return null;
  }

  function diagnostics(){
    const lsKeys = [
      'aether_horizon','aether_signal_events','aether_globe_scores',
      'aether_watchlist_v1','aether_snapshots_v1','aether_history_v1'
    ].map(jsonStatus);

    const runtime = window.AetherDiagnostics && window.AetherDiagnostics.getSummary
      ? window.AetherDiagnostics.getSummary()
      : null;

    return {
      page: state.page,
      env: envLabel(),
      url: location.href,
      visible: !document.hidden,
      online: navigator.onLine,
      deps: depChecks(),
      checks: pageChecks(),
      perf: getPerf(),
      runtime,
      localStorage: lsKeys,
      scripts: scriptsSummary(),
      errors: state.errors.slice(-8),
      rejected: state.rejected.slice(-8),
      updatedAt: new Date().toISOString()
    };
  }

  function badge(ok){
    return '<span class="aether-diag-badge '+(ok?'ok':'ko')+'">'+(ok?'OK':'KO')+'</span>';
  }

  function render(){
    const panel = document.getElementById('aether-diagnostic-panel');
    if (!panel) return;
    const d = diagnostics();
    const deps = d.deps.map(x => '<div class="aether-diag-row"><span>'+x.name+'</span>'+badge(x.ok)+'</div>').join('');
    const checks = d.checks.map(x => '<div class="aether-diag-row"><span>'+x.name+'</span>'+badge(x.ok)+'</div>').join('');
    const ls = d.localStorage.map(x => '<div class="aether-diag-row"><span>'+x.key+'</span><span class="aether-diag-meta">'+(x.present ? (x.type + ' · ' + x.size) : 'vacío')+(x.invalid?' · inválido':'')+'</span></div>').join('');
    const errs = d.errors.length ? d.errors.map(x => '<div class="aether-diag-log">'+escapeHtml(x)+'</div>').join('') : '<div class="aether-diag-empty">Sin errores capturados</div>';
    const rej = d.rejected.length ? d.rejected.map(x => '<div class="aether-diag-log">'+escapeHtml(x)+'</div>').join('') : '<div class="aether-diag-empty">Sin promesas rechazadas</div>';
    const scripts = d.scripts.map(x => '<div class="aether-diag-script">'+escapeHtml(x)+'</div>').join('');
    const perf = d.perf ? 'DCL '+d.perf.domContentLoadedMs+' ms · LOAD '+d.perf.loadMs+' ms · '+d.perf.type : 'No disponible';
    const runtime = d.runtime ? ('Checks '+d.runtime.okChecks+'/'+d.runtime.totalChecks+' · W '+d.runtime.warnings+' · E '+d.runtime.errors) : 'No disponible en esta página';
    panel.innerHTML = '' +
      '<div class="aether-diag-head">' +
        '<div><div class="aether-diag-title">AETHER DIAGNÓSTICO</div><div class="aether-diag-sub">'+d.page.toUpperCase()+' · '+d.env+' · '+(d.visible?'VISIBLE':'BACKGROUND')+'</div></div>' +
        '<div class="aether-diag-actions">' +
          '<button type="button" class="aether-diag-btn" id="aether-diag-copy">COPIAR JSON</button>' +
          '<button type="button" class="aether-diag-btn" id="aether-diag-close">CERRAR</button>' +
        '</div>' +
      '</div>' +
      '<div class="aether-diag-grid">' +
        '<section class="aether-diag-card"><h3>Estado</h3><div class="aether-diag-kv"><div><span>Entorno</span><strong>'+d.env+'</strong></div><div><span>Online</span><strong>'+(d.online?'Sí':'No')+'</strong></div><div><span>Visibilidad</span><strong>'+(d.visible?'Activa':'Oculta')+'</strong></div><div><span>Rendimiento</span><strong>'+perf+'</strong></div><div><span>Runtime</span><strong>'+runtime+'</strong></div></div></section>' +
        '<section class="aether-diag-card"><h3>Dependencias</h3>'+deps+'</section>' +
        '<section class="aether-diag-card"><h3>Chequeos página</h3>'+checks+'</section>' +
        '<section class="aether-diag-card"><h3>LocalStorage</h3>'+ls+'</section>' +
        '<section class="aether-diag-card"><h3>Scripts activos</h3>'+scripts+'</section>' +
        '<section class="aether-diag-card"><h3>Errores</h3>'+errs+'<h4>Rechazos</h4>'+rej+'</section>' +
      '</div>';
    const copyBtn = document.getElementById('aether-diag-copy');
    const closeBtn = document.getElementById('aether-diag-close');
    if (copyBtn) copyBtn.onclick = copyJson;
    if (closeBtn) closeBtn.onclick = hide;
    state.lastRenderAt = Date.now();
  }

  function copyJson(){
    const payload = JSON.stringify(diagnostics(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).catch(function(){});
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>\"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c] || c; });
  }

  function ensureUI(){
    if (document.getElementById('aether-diag-toggle')) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'aether-diag-toggle';
    toggle.className = 'aether-diag-toggle';
    toggle.textContent = 'DIAG';
    toggle.title = 'Ctrl+Shift+D';
    toggle.addEventListener('click', togglePanel);

    const panel = document.createElement('div');
    panel.id = 'aether-diagnostic-panel';
    panel.className = 'aether-diagnostic-panel';
    panel.hidden = true;

    document.body.appendChild(toggle);
    document.body.appendChild(panel);
  }

  function show(){
    state.enabled = true;
    try { localStorage.setItem(DIAG_KEY, '1'); } catch(_) {}
    ensureUI();
    const toggle = document.getElementById('aether-diag-toggle');
    const panel = document.getElementById('aether-diagnostic-panel');
    if (toggle) toggle.classList.add('active');
    if (panel) panel.hidden = false;
    render();
  }

  function hide(){
    state.enabled = false;
    try { localStorage.removeItem(DIAG_KEY); } catch(_) {}
    const toggle = document.getElementById('aether-diag-toggle');
    const panel = document.getElementById('aether-diagnostic-panel');
    if (toggle) toggle.classList.remove('active');
    if (panel) panel.hidden = true;
  }

  function togglePanel(){
    const panel = document.getElementById('aether-diagnostic-panel');
    if (!panel || panel.hidden) show(); else hide();
  }

  function boot(){
    ensureUI();
    const wantsDiag = /(?:\?|&)diag=1(?:&|$)/.test(location.search) || safeGetLS(DIAG_KEY) === '1';
    if (wantsDiag) show();
    document.addEventListener('keydown', function(e){
      if (e.ctrlKey && e.shiftKey && String(e.key).toLowerCase() === 'd') {
        e.preventDefault();
        togglePanel();
      }
    });
    document.addEventListener('visibilitychange', function(){ if (state.enabled) render(); });
    window.addEventListener('online', function(){ if (state.enabled) render(); });
    window.addEventListener('offline', function(){ if (state.enabled) render(); });
    window.addEventListener('error', function(e){
      state.errors.push((e.message || 'Error desconocido') + (e.filename ? ' @ ' + e.filename.split('/').pop() : ''));
      if (state.enabled) render();
    });
    window.addEventListener('unhandledrejection', function(e){
      state.rejected.push(String((e.reason && (e.reason.message || e.reason)) || 'Promise rejected'));
      if (state.enabled) render();
    });
    setInterval(function(){ if (state.enabled && Date.now() - state.lastRenderAt > 1800) render(); }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
