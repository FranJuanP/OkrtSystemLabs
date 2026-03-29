

(function(){
  const state = {
    startedAt: Date.now(),
    resourceErrors: [],
    runtimeErrors: [],
    offline: !navigator.onLine,
    localAssets: 0,
    externalAssets: 0,
    fallbackReady: 0,
    moduleTargets: [
      {name:'Core local', type:'local', ok:true, detail:'index + assets'},
      {name:'AETHER Globe', type:'fallback', ok:true, detail:'texturas locales/inline'},
      {name:'AETHER Signal', type:'fallback', ok:true, detail:'fallback geopolítico'},
      {name:'AETHER Vector', type:'local', ok:true, detail:'módulo disponible'}
    ]
  };

  function classifyAssets(){
    const nodes = [...document.querySelectorAll('script[src],link[href][rel="stylesheet"],img[src]')];
    let local=0, external=0;
    nodes.forEach(n => {
      const url = n.src || n.href || '';
      if(!url) return;
      if(/^https?:\/\//i.test(url)) external++; else local++;
    });
    state.localAssets = local;
    state.externalAssets = external;
    state.fallbackReady = state.moduleTargets.filter(x=>x.type==='fallback').length;
  }

  function pushEvent(kind, msg){
    const arr = kind === 'runtime' ? state.runtimeErrors : state.resourceErrors;
    arr.unshift({t:Date.now(), msg});
    if(arr.length > 8) arr.length = 8;
    render();
  }

  function computeStatus(){
    const errors = state.runtimeErrors.length + state.resourceErrors.length;
    if (state.offline || errors >= 3) return {label:'degraded', cls:'warn', led:'warn'};
    if (errors > 0 || state.externalAssets > 6) return {label:'monitor', cls:'warn', led:'warn'};
    return {label:'stable', cls:'ok', led:'ok'};
  }

  function uptime(){
    const s = Math.round((Date.now()-state.startedAt)/1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s/60);
    if (m < 60) return m + 'm';
    return Math.floor(m/60) + 'h';
  }


  function mountSafeHTML(el, html){
    if (!el) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    window.AETHERDomGuard?.sanitizeElementTree?.(tpl.content);
    el.replaceChildren(...tpl.content.childNodes);
  }

  function ensureDock(){
    if (document.getElementById('aether-health-dock')) return document.getElementById('aether-health-dock');
    const dock = document.createElement('aside');
    dock.id = 'aether-health-dock';
    dock.className = 'aether-health-dock';
    mountSafeHTML(dock, `
      <div class="aether-health-head">
        <div class="aether-health-title"><span id="aether-health-led" class="aether-health-led"></span><span>System Health</span></div>
        <div class="aether-health-actions">
          <span id="aether-health-chip" class="aether-health-chip ok">stable</span>
          <button id="aether-health-toggle" class="aether-health-toggle" type="button">—</button>
        </div>
      </div>
      <div class="aether-health-body">
        <div class="aether-health-grid">
          <div class="aether-health-stat"><div class="aether-health-k">Runtime</div><div id="health-runtime" class="aether-health-v">OK</div><div class="aether-health-s">Núcleo operativo</div></div>
          <div class="aether-health-stat"><div class="aether-health-k">Fallbacks</div><div id="health-fallbacks" class="aether-health-v">0</div><div class="aether-health-s">Capas de continuidad</div></div>
          <div class="aether-health-stat"><div class="aether-health-k">Dependencias locales</div><div id="health-local" class="aether-health-v">0</div><div class="aether-health-s">Activos servidos por el proyecto</div></div>
          <div class="aether-health-stat"><div class="aether-health-k">Externo</div><div id="health-external" class="aether-health-v">0</div><div class="aether-health-s">CDN / fuentes remotas</div></div>
        </div>
        <div>
          <div class="aether-health-k" style="margin-bottom:8px">Módulos y capas</div>
          <div id="aether-health-list" class="aether-health-list"></div>
        </div>
        <div>
          <div class="aether-health-k" style="margin-bottom:8px">Incidencias recientes</div>
          <div id="aether-health-events" class="aether-health-events"></div>
        </div>
        <div class="aether-health-footer">Uptime <span id="aether-health-uptime">0s</span> · robustez premium activa</div>
      </div>`);
    document.body.appendChild(dock);
    dock.querySelector('#aether-health-toggle').addEventListener('click', () => {
      const collapsed = dock.dataset.collapsed === '1';
      dock.dataset.collapsed = collapsed ? '0' : '1';
      dock.querySelector('#aether-health-toggle').textContent = collapsed ? '—' : '+';
    });
    return dock;
  }

  function render(){
    const dock = ensureDock();
    const status = computeStatus();
    const chip = dock.querySelector('#aether-health-chip');
    const led = dock.querySelector('#aether-health-led');
    chip.className = 'aether-health-chip ' + status.cls;
    chip.textContent = status.label;
    led.className = 'aether-health-led ' + (status.led === 'ok' ? '' : status.led);
    dock.querySelector('#health-runtime').textContent = state.runtimeErrors.length ? 'WARN' : 'OK';
    dock.querySelector('#health-fallbacks').textContent = state.fallbackReady;
    dock.querySelector('#health-local').textContent = state.localAssets;
    dock.querySelector('#health-external').textContent = state.externalAssets;
    dock.querySelector('#aether-health-uptime').textContent = uptime();
    const list = dock.querySelector('#aether-health-list');
    mountSafeHTML(list, state.moduleTargets.map(item => `
      <div class="aether-health-row">
        <div><span>${item.name}</span><br><small>${item.detail}</small></div>
        <span class="aether-health-badge ${item.type}">${item.type}</span>
      </div>`).join(''));
    const ev = [...state.runtimeErrors, ...state.resourceErrors].sort((a,b)=>b.t-a.t).slice(0,6);
    mountSafeHTML(dock.querySelector('#aether-health-events'), ev.length ? ev.map(e => `<div class="aether-health-event">${new Date(e.t).toLocaleTimeString()} · ${escapeHtml(e.msg)}</div>`).join('') : '<div class="aether-health-event">Sin incidencias críticas. Sistema estable.</div>');
  }

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

  function patchResourceErrors(){
    window.addEventListener('error', function(ev){
      if (ev.target && ev.target !== window) {
        const src = ev.target.src || ev.target.href || ev.target.currentSrc || ev.target.tagName;
        pushEvent('resource', 'Recurso degradado: ' + src);
      } else if (ev.message) {
        pushEvent('runtime', ev.message);
      }
    }, true);
    window.addEventListener('unhandledrejection', function(ev){
      const msg = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason || 'Promise rechazada');
      pushEvent('runtime', msg);
    });
    window.addEventListener('online', ()=>{state.offline=false; render();});
    window.addEventListener('offline', ()=>{state.offline=true; pushEvent('runtime','Modo offline detectado');});
  }

  function addGentleFallbackLabels(){
    const tag = document.createElement('div');
    tag.id = 'aether-robust-topline';
    tag.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:9998;padding:8px 12px;border-radius:999px;background:rgba(8,18,28,.88);border:1px solid rgba(0,255,200,.12);color:#8ff7e6;font:10px "Share Tech Mono",monospace;letter-spacing:1px;text-transform:uppercase;box-shadow:0 8px 24px rgba(0,0,0,.28)';
    tag.textContent = 'Robustez premium · fallback elegante activo';
    document.body.appendChild(tag);
  }

  function init(){
    classifyAssets();
    patchResourceErrors();
    render();
    addGentleFallbackLabels();
    setInterval(render, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

