(function(){
  function ready(fn){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  const SEV_W = {critical:40, high:28, medium:18, low:10};
  const RISK_W = {CRITICAL:26, HIGH:18, MEDIUM:10, LOW:4};
  const TYPE_W = {CRITICAL:30, HIGH:22, SANCTION:16, ENERGY:14, ALLIANCE:12, PROXY:18};
  const COUNTRY_ALIASES = {
    'usa':'EE.UU.', 'united states':'EE.UU.', 'united states of america':'EE.UU.', 'us':'EE.UU.',
    'uk':'Reino Unido', 'united kingdom':'Reino Unido',
    'russia':'Rusia', 'china':'China', 'iran':'Irán', 'israel':'Israel', 'gaza':'Israel',
    'south korea':'Corea del Sur', 'north korea':'Corea del Norte', 'ivory coast':'Costa de Marfil',
    'drc':'República Democrática del Congo', 'dr congo':'República Democrática del Congo',
    'congo, democratic republic of the':'República Democrática del Congo',
    'czechia':'República Checa', 'uae':'Emiratos Árabes Unidos', 'turkiye':'Turquía'
  };

  function normalizeCountry(name){
    if(!name || typeof name !== 'string') return null;
    const raw = name.trim();
    const key = raw.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9\s.-]/g,'')
      .replace(/\s+/g,' ');
    if(COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
    if(typeof COUNTRIES_DEDUP !== 'undefined'){
      const match = COUNTRIES_DEDUP.find(c => {
        const ck = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s.-]/g,'').replace(/\s+/g,' ');
        return ck === key;
      });
      if(match) return match.name;
    }
    return raw;
  }

  function readSignalEvents(){
    try{
      const raw = localStorage.getItem('aether_signal_events');
      if(!raw) return [];
      const arr = JSON.parse(raw);
      if(!Array.isArray(arr)) return [];
      const now = Date.now();
      return arr.filter(ev => ev && (ev.country || ev.location) && ev.ts && (now - Number(ev.ts)) < 48*60*60*1000)
        .map(ev => ({
          country: normalizeCountry(ev.country || ev.location || ''),
          severity: String(ev.severity || 'medium').toLowerCase(),
          cat: ev.cat || ev.category || 'general',
          title: ev.title || ev.label || '',
          ts: Number(ev.ts) || now
        }))
        .filter(ev => ev.country);
    }catch(_e){ return []; }
  }

  function buildCountrySignalMap(){
    const events = readSignalEvents();
    const map = new Map();
    events.forEach(ev => {
      const entry = map.get(ev.country) || {count:0, maxSeverity:0, latest:0, cats:new Set(), headlines:[]};
      entry.count += 1;
      entry.maxSeverity = Math.max(entry.maxSeverity, SEV_W[ev.severity] || 12);
      entry.latest = Math.max(entry.latest, ev.ts || 0);
      if(ev.cat) entry.cats.add(ev.cat);
      if(ev.title && entry.headlines.length < 3) entry.headlines.push(ev.title);
      map.set(ev.country, entry);
    });
    return map;
  }

  function ensureHotspotBox(){
    if(document.getElementById('globe-hotspots')) return document.getElementById('globe-hotspots');
    const host = document.getElementById('arc-controls') || document.body;
    const box = document.createElement('div');
    box.id = 'globe-hotspots';
    box.innerHTML = '<div class="gh-title">// HOTSPOTS PRIORITARIOS</div><div id="globe-hotspots-list"></div>';
    host.appendChild(box);
    return box;
  }

  function computeCountryPriority(name, signalMap){
    const country = (typeof COUNTRIES_DEDUP !== 'undefined') ? COUNTRIES_DEDUP.find(c => c.name === name) : null;
    const sig = signalMap.get(name);
    const baseRisk = country ? (RISK_W[country.risk] || 0) : 0;
    const connected = (typeof TENSION_ARCS !== 'undefined') ? TENSION_ARCS.filter(a => a.a===name || a.b===name).length : 0;
    const freshness = sig ? Math.max(0, 12 - Math.min(12, (Date.now() - sig.latest)/(60*60*1000))) : 0;
    return baseRisk + connected * 2 + (sig ? sig.count * 10 + sig.maxSeverity + freshness : 0);
  }

  function renderHotspots(){
    if(typeof COUNTRIES_DEDUP === 'undefined') return;
    const signalMap = buildCountrySignalMap();
    const box = ensureHotspotBox();
    const list = document.getElementById('globe-hotspots-list');
    const rows = COUNTRIES_DEDUP.map(c => ({
      name: c.name,
      risk: c.risk,
      score: computeCountryPriority(c.name, signalMap),
      signals: signalMap.get(c.name)?.count || 0,
      cats: signalMap.get(c.name)?.cats.size || 0
    }))
    .filter(r => r.score > 10)
    .sort((a,b)=>b.score-a.score)
    .slice(0,5);

    list.replaceChildren();
    rows.forEach((row, idx) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'gh-item';
      item.innerHTML = '<span class="gh-rank">0'+(idx+1)+'</span>'+
        '<span class="gh-name">'+row.name.toUpperCase()+'</span>'+
        '<span class="gh-meta">'+(row.signals ? row.signals+' señales' : row.risk)+'</span>';
      item.addEventListener('click', function(){
        if(typeof showPanel === 'function'){
          const country = COUNTRIES_DEDUP.find(c => c.name === row.name);
          if(country) showPanel(country);
        }
      });
      list.appendChild(item);
    });
    box.classList.toggle('has-data', rows.length > 0);
  }

  function corridorPriority(arc, signalMap){
    const type = TYPE_W[arc.data?.type || arc.type] || 8;
    const a = arc.data?.a || arc.a;
    const b = arc.data?.b || arc.b;
    const countryScore = computeCountryPriority(a, signalMap) + computeCountryPriority(b, signalMap);
    const labelBoost = /nuclear|estrecho|guerra|sancion|maximas|proxy|energia/i.test((arc.data?.label || arc.label || '')+' '+(arc.data?.signal || arc.signal || '')) ? 10 : 0;
    return type + countryScore + labelBoost;
  }

  function patchGlobalArcs(){
    if(typeof showGlobalArcs !== 'function' || showGlobalArcs.__gfPatched) return;
    const original = showGlobalArcs;
    showGlobalArcs = function(){
      if(typeof deactivateAllArcs === 'function') deactivateAllArcs();
      const signalMap = buildCountrySignalMap();
      const filtered = (typeof arcObjects !== 'undefined' ? arcObjects : []).filter(ao => !currentArcFilter || ao.data.type === currentArcFilter)
        .sort((a,b)=>corridorPriority(b, signalMap)-corridorPriority(a, signalMap));
      filtered.forEach((ao, i) => {
        const t = setTimeout(() => {
          ao.line.visible = true; ao.glow.visible = true;
          ao.animating = true; ao.progress = 0;
          ao.line.geometry.setDrawRange(0,0); ao.glow.geometry.setDrawRange(0,0);
          ao.targetProgress = 1;
          const priorityBoost = Math.min(1.35, 1 + corridorPriority(ao, signalMap) / 220);
          ao._intensityMult = Math.max(ao._intensityMult || 1, priorityBoost);
          ao.convoy.forEach(p => { p.mesh.visible = true; p.trail = []; });
        }, i * 24);
        activationTimers.push(t);
      });
    };
    showGlobalArcs.__gfPatched = true;
  }

  function patchShowPanel(){
    if(typeof showPanel !== 'function' || showPanel.__gfPatched) return;
    const original = showPanel;
    showPanel = function(c){
      original(c);
      try {
        const signalMap = buildCountrySignalMap();
        const selected = signalMap.get(c.name);
        const arcList = document.getElementById('arcList');
        if(arcList && arcList.children.length > 1){
          const rows = Array.from(arcList.children);
          rows.sort((ra, rb) => {
            const aName = (ra.querySelector('.arc-name')?.textContent || '').replace('↔','').trim();
            const bName = (rb.querySelector('.arc-name')?.textContent || '').replace('↔','').trim();
            const aScore = computeCountryPriority(aName, signalMap);
            const bScore = computeCountryPriority(bName, signalMap);
            return bScore - aScore;
          }).forEach(row => arcList.appendChild(row));
        }

        const coords = document.getElementById('pCoords');
        if(coords && selected){
          let badge = document.getElementById('globe-signal-badge');
          if(!badge){
            badge = document.createElement('div');
            badge.id = 'globe-signal-badge';
            badge.className = 'globe-signal-badge';
            coords.parentNode.insertBefore(badge, coords.nextSibling);
          }
          badge.textContent = 'SEÑALES ACTIVAS: '+selected.count+' · CATEGORÍAS: '+selected.cats.size;
        } else {
          document.getElementById('globe-signal-badge')?.remove();
        }

        Array.from(document.querySelectorAll('#arcList .arc-row')).forEach(row => {
          const other = (row.querySelector('.arc-name')?.textContent || '').replace('↔','').trim();
          const data = signalMap.get(other);
          row.querySelector('.arc-heat-badge')?.remove();
          if(data){
            const badge = document.createElement('span');
            badge.className = 'arc-heat-badge';
            badge.textContent = data.count+' señal'+(data.count>1?'es':'');
            row.querySelector('.arc-head')?.appendChild(badge);
          }
        });
      } catch(_e){}
    };
    showPanel.__gfPatched = true;
  }

  function pulseHotCountries(){
    const signalMap = buildCountrySignalMap();
    if(typeof pulseMeshes === 'undefined' || typeof markerData === 'undefined') return;
    pulseMeshes.forEach((mesh, idx) => {
      const country = markerData[idx];
      if(!mesh || !country) return;
      const sig = signalMap.get(country.name);
      mesh.userData.hotBoost = sig ? Math.min(1.8, 1 + sig.count * 0.12) : 1;
      if(mesh.material){
        mesh.material.opacity = sig ? Math.min(0.95, 0.45 + sig.count * 0.07) : 0.45;
      }
    });
  }

  function patchAnimate(){
    if(typeof animate !== 'function' || animate.__gfWrapped) return;
    const original = animate;
    let lastHotspotRefresh = 0;
    animate = function(){
      const now = Date.now();
      if(now - lastHotspotRefresh > 15000){
        renderHotspots();
        pulseHotCountries();
        lastHotspotRefresh = now;
      }
      return original();
    };
    animate.__gfWrapped = true;
  }

  function boot(){
    patchGlobalArcs();
    patchShowPanel();
    patchAnimate();
    renderHotspots();
    pulseHotCountries();
    window.addEventListener('storage', function(e){
      if(e.key === 'aether_signal_events'){
        renderHotspots();
        pulseHotCountries();
      }
    });
  }

  ready(function(){
    const wait = setInterval(function(){
      if(typeof showPanel === 'function' && typeof showGlobalArcs === 'function' && typeof COUNTRIES_DEDUP !== 'undefined'){
        clearInterval(wait);
        boot();
      }
    }, 200);
    setTimeout(function(){ clearInterval(wait); boot(); }, 8000);
  });
})();
