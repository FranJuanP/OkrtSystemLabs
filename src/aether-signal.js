/* ──────────────────────────────────────────────────────────────────────────
   BASELINE LEGIBLE · Fase 0
   Fuente recuperada sin ofuscar y verificada por AST contra el bloque
   <script> ofuscado que iba inline en esta pagina. No se cambia el
   comportamiento: este fichero es el punto de partida de la Fase 1.
   ────────────────────────────────────────────────────────────────────────── */

/* Bloqueo de dominio. Reproducido tal cual estaba en el publicado, incluida
   la comparacion por subcadena (indexOf) que la Fase 1 corrige en T6. */
(function(){
  var allowed = ['franjuanp.github.io', 'localhost', '127.0.0.1'];
  var host = window.location.hostname;
  var ok = false;
  for (var i = 0; i < allowed.length; i++) {
    if (host === allowed[i] || host.indexOf(allowed[i]) !== -1) { ok = true; break; }
  }
  if (!ok) {
    window._aetherLock = true;
    window.fetch = function(){
      return new Promise(function(resolve){
        setTimeout(function(){
          resolve({
            ok: false,
            json: function(){ return Promise.resolve({}); },
            text: function(){ return Promise.resolve(''); }
          });
        }, 3000);
      });
    };
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(function(){
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;pointer-events:none;';
        overlay.innerHTML = '<div style="font-family:monospace;color:rgba(0,255,200,0.10);transform:rotate(-35deg);user-select:none;font-size:clamp(12px,2vw,20px);font-weight:700;white-space:nowrap;letter-spacing:3px">UNAUTHORIZED COPY · OKRTSYSTEM LABS · UNAUTHORIZED COPY · OKRTSYSTEM LABS</div>';
        document.body.appendChild(overlay);
      }, 800);
    });
  }
})();

// ═══════════════════════════════════════════════
//  AETHER SIGNAL — OkrtSystem Labs
//  Live Global Intelligence Feed
// ═══════════════════════════════════════════════

let allSignals = [];
let filtered   = [];
let activeCat  = 'all';
let activeSort = 'time';
let selectedId = null;

// ── SEVERITY helpers ──
const SEV = {
  CRITICAL: { cls:'sev-critical', bg:'bg-critical', bar:'bar-critical', color:'#FF4060' },
  HIGH:     { cls:'sev-high',     bg:'bg-high',     bar:'bar-high',     color:'#FF8030' },
  MEDIUM:   { cls:'sev-medium',   bg:'bg-medium',   bar:'bar-medium',   color:'#FFB020' },
  LOW:      { cls:'sev-low',      bg:'bg-low',      bar:'bar-low',      color:'#00FFC8' },
};
const CAT_COLOR = {
  conflict:'#FF4060', geo:'#FF8030', eco:'#FFB020',
  seismic:'#60BFFF', climate:'#00FFC8', humanitarian:'#C060FF',
  health:'#FF60A0', other:'#888'
};
const CAT_LABEL = {
  conflict:'CONFLICTO', geo:'GEOPOLÍTICA', eco:'ECONOMÍA',
  seismic:'SISMOLOGÍA', climate:'CLIMA', humanitarian:'HUMANITARIA',
  health:'SALUD', other:'OTRO'
};

function setSrc(id, st) {
  const el = document.getElementById('src-'+id);
  if(el){ el.className = 'source-status ' + st; }
}

// ── CLOCK ──
setInterval(()=>{
  const n = new Date();
  document.getElementById('clock').textContent =
    [n.getUTCHours(),n.getUTCMinutes(),n.getUTCSeconds()].map(v=>String(v).padStart(2,'0')).join(':') + ' UTC';
},1000);

// ── FETCH: USGS Earthquakes ──
async function fetchUSGS() {
  try {
    const r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson');
    const d = await r.json();
    setSrc('usgs','ok');
    return (d.features || []).slice(0,30).map(f=>{
      const p = f.properties;
      const mag = p.mag || 0;
      const sev = mag >= 7 ? 'CRITICAL' : mag >= 6 ? 'HIGH' : mag >= 5 ? 'MEDIUM' : 'LOW';
      return {
        id: 'usgs_' + f.id,
        source: 'USGS',
        cat: 'seismic',
        title: `M${mag.toFixed(1)} — ${p.place || 'Desconocido'}`,
        location: p.place || '—',
        time: new Date(p.time),
        severity: sev,
        url: p.url,
        detail: `Terremoto de magnitud ${mag.toFixed(1)} registrado en ${p.place}. Profundidad: ${(f.geometry?.coordinates?.[2]||0).toFixed(1)} km. Estado USGS: ${p.status||'revisado'}.`,
        impacts: { 'MAGNITUD': mag.toFixed(1), 'PROFUNDIDAD': (f.geometry?.coordinates?.[2]||0).toFixed(0)+'km',
                   'ALERTA': p.alert||'verde', 'TSUNAMI': p.tsunami ? 'SÍ' : 'NO' },
        isNew: (Date.now() - new Date(p.time).getTime()) < 3600000
      };
    });
  } catch(e) { setSrc('usgs','err'); return []; }
}

// ── FETCH: NASA EONET natural events ──
async function fetchNASA() {
  try {
    const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=25&days=14');
    const d = await r.json();
    setSrc('nasa','ok');
    const catMap = { Wildfires:'climate', Volcanoes:'seismic', 'Severe Storms':'climate',
                     Floods:'climate', Drought:'climate', 'Sea and Lake Ice':'climate',
                     Earthquakes:'seismic', 'Dust and Haze':'climate' };
    return (d.events||[]).map(ev=>{
      const cat = catMap[ev.categories?.[0]?.title] || 'climate';
      const geo = ev.geometry?.[0];
      const days = geo ? Math.round((Date.now()-new Date(geo.date).getTime())/86400000) : 0;
      return {
        id: 'nasa_' + ev.id,
        source: 'NASA EONET',
        cat,
        title: ev.title,
        location: ev.categories?.[0]?.title || 'Evento natural',
        time: geo ? new Date(geo.date) : new Date(),
        severity: days < 2 ? 'HIGH' : 'MEDIUM',
        url: ev.sources?.[0]?.url || '',
        detail: `Evento natural clasificado como "${ev.categories?.[0]?.title}" activo. ${ev.description||'Monitoreo continuo activo por NASA Earth Observatory.'} Duración estimada: ${days} días en seguimiento.`,
        impacts: { 'DURACIÓN': days+'d', 'ESTADO': 'ACTIVO', 'FUENTE': 'NASA', 'TIPO': ev.categories?.[0]?.title||'—' },
        isNew: days < 1
      };
    });
  } catch(e) { setSrc('nasa','err'); return []; }
}

// ── FETCH: ReliefWeb Humanitarian ──
async function fetchReliefWeb() {
  try {
    const url = 'https://api.reliefweb.int/v1/reports?appname=aethersignal&filter[field]=status&filter[value]=published&limit=20&sort[]=date:desc&fields[include][]=title&fields[include][]=date&fields[include][]=country&fields[include][]=disaster_type&fields[include][]=url_alias';
    const r = await fetch(url);
    const d = await r.json();
    setSrc('relief','ok');
    const typeMap = { 'Conflict':'conflict', 'Epidemic':'health', 'Drought':'climate',
                      'Flood':'climate','Earthquake':'seismic','Cyclone / Typhoon / Hurricane':'climate',
                      'Famine':'humanitarian' };
    return (d.data||[]).map((item,i)=>{
      const f = item.fields;
      const dtype = f.disaster_type?.[0]?.name || '';
      const cat = typeMap[dtype] || 'humanitarian';
      const country = f.country?.[0]?.name || 'Global';
      return {
        id: 'relief_' + item.id,
        source: 'ReliefWeb OCHA',
        cat,
        title: f.title || 'Alerta humanitaria',
        location: country,
        time: new Date(f.date?.created || Date.now()),
        severity: i < 3 ? 'HIGH' : 'MEDIUM',
        url: f.url_alias ? 'https://reliefweb.int'+f.url_alias : 'https://reliefweb.int',
        detail: `Informe humanitario publicado por OCHA ReliefWeb. País afectado: ${country}. Tipo de emergencia: ${dtype||'humanitaria'}. Acceder al informe completo para datos operacionales.`,
        impacts: { 'PAÍS': country.slice(0,12), 'TIPO': (dtype||'HUMANIT.').slice(0,10), 'ESTADO': 'ACTIVO', 'FUENTE': 'OCHA' },
        isNew: (Date.now() - new Date(f.date?.created||0).getTime()) < 86400000
      };
    });
  } catch(e) { setSrc('relief','err'); return []; }
}

// ── FETCH: GDELT via RSS proxy ──
async function fetchGDELT() {
  // Use GDELT DOC 2.0 API for geopolitical events
  try {
    const queries = [
      'conflict+war+military',
      'sanctions+geopolitical+crisis',
      'economic+recession+market+crash'
    ];
    const cats   = ['conflict','geo','eco'];
    const sevs   = ['HIGH','MEDIUM','MEDIUM'];
    let results  = [];

    for(let qi=0; qi<queries.length; qi++){
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${queries[qi]}&mode=artlist&maxrecords=8&format=json&timespan=1d`;
      try {
        const r = await fetch(url);
        const d = await r.json();
        (d.articles||[]).forEach((art,i)=>{
          results.push({
            id: 'gdelt_' + qi + '_' + i,
            source: 'GDELT',
            cat: cats[qi],
            title: art.title || 'Evento geopolítico detectado',
            location: art.sourcecountry || art.domain || 'Global',
            time: art.seendate ? new Date(art.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,'$1-$2-$3T$4:$5:$6Z')) : new Date(),
            severity: i === 0 ? sevs[qi] : 'MEDIUM',
            url: art.url || '',
            detail: `Evento detectado por sistema GDELT en tiempo real. Fuente: ${art.domain||'múltiples medios'}. Tono analítico: ${art.tone ? parseFloat(art.tone).toFixed(2) : '—'}. Cobertura: ${art.sourcecountry||'global'}.`,
            impacts: { 'TONO': art.tone ? parseFloat(art.tone).toFixed(1) : '—', 'FUENTE': (art.domain||'—').slice(0,12),
                       'PAÍS': (art.sourcecountry||'GLOBAL').slice(0,10), 'GDELT': 'ACTIVO' },
            isNew: true
          });
        });
      } catch(e2){ /* individual query fail is ok */ }
    }
    setSrc('gdelt', results.length > 0 ? 'ok' : 'err');
    return results;
  } catch(e) { setSrc('gdelt','err'); return []; }
}

// ── SYNTHETIC WHO-style health signals (real WHO RSS is CORS-blocked) ──
// Use hardcoded recent WHO Disease Outbreak News
function getWHOSignals() {
  setSrc('who','ok');
  const items = [
    { title:'Alerta Mpox: incremento de casos en Africa Central',location:'RDC / Congo', sev:'HIGH', cat:'health',
      detail:'OMS monitorea incremento de casos de Mpox (viruela del mono) clado Ib en República Democrática del Congo. Vigilancia epidemiológica reforzada. Riesgo de extensión regional: moderado-alto.',
      impacts:{'CLADE':'Ib','REGIÓN':'Africa Central','ESTADO':'ACTIVO','RIESGO':'MODERADO-ALTO'} },
    { title:'Dengue: temporada de alto riesgo activa en América',location:'Brasil / Colombia / México', sev:'HIGH', cat:'health',
      detail:'OPS/OMS reporta temporada de dengue con cifras históricas en Américas. Múltiples países con transmisión activa. Brasil supera 3M casos reportados en lo que va de año.',
      impacts:{'VECTOR':'Aedes','REGIÓN':'Américas','CASOS':'Histórico','SEROTIPOS':'1,2,3'} },
    { title:'Influenza estacional: vigilancia activa hemisferio norte',location:'Europa / América del Norte', sev:'MEDIUM', cat:'health',
      detail:'OMS activa protocolo de vigilancia estacional en hemisferio norte. Circulación de H3N2 y B/Victoria. Sin señales de variante pandémica. Cobertura de vacunación por debajo del objetivo.',
      impacts:{'TIPO':'H3N2 / B','FASE':'ESTACIONAL','PANDEMIA':'NO','COBERTURA':'BAJA'} },
  ];
  return items.map((it,i)=>({
    id:'who_'+i, source:'WHO / OMS', cat:it.cat,
    title:it.title, location:it.location,
    time:new Date(Date.now()-i*3600000*6),
    severity:it.sev, url:'https://www.who.int/emergencies/disease-outbreak-news',
    detail:it.detail, impacts:it.impacts, isNew:i===0
  }));
}

// ── LOAD ALL ──
async function loadAll() {
  document.getElementById('feed').innerHTML = `<div class="loading-row"><div class="spinner"></div><br>CONECTANDO CON FUENTES GLOBALES...</div>`;

  const [usgs, nasa, relief, gdelt] = await Promise.all([
    fetchUSGS(), fetchNASA(), fetchReliefWeb(), fetchGDELT()
  ]);
  const who = getWHOSignals();

  allSignals = [...usgs, ...gdelt, ...relief, ...nasa, ...who];

  // deduplicate by title similarity
  const seen = new Set();
  allSignals = allSignals.filter(s=>{
    const key = s.title.slice(0,40).toLowerCase();
    if(seen.has(key)) return false;
    seen.add(key); return true;
  });

  // sort by time desc
  allSignals.sort((a,b)=>b.time-a.time);

  applyFilter();
  updateCounts();
  buildTicker();

  const now = new Date();
  document.getElementById('last-update').textContent =
    [now.getUTCHours(),now.getUTCMinutes()].map(v=>String(v).padStart(2,'0')).join(':')+' UTC';
  document.getElementById('signal-count').textContent = allSignals.length + ' señales activas';
}

function applyFilter(){
  filtered = activeCat==='all' ? [...allSignals] : allSignals.filter(s=>s.cat===activeCat);
  if(activeSort==='severity'){
    const order = {CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};
    filtered.sort((a,b)=>(order[a.severity]||2)-(order[b.severity]||2));
  } else if(activeSort==='cat'){
    filtered.sort((a,b)=>a.cat.localeCompare(b.cat));
  }
  renderFeed();
}

function updateCounts(){
  const cats = ['all','conflict','geo','eco','seismic','climate','humanitarian','health'];
  cats.forEach(cat=>{
    const count = cat==='all' ? allSignals.length : allSignals.filter(s=>s.cat===cat).length;
    const el = document.getElementById('cnt-'+cat);
    if(el) el.textContent = count || '—';
  });
}

function renderFeed(){
  const feed = document.getElementById('feed');
  if(!filtered.length){
    feed.innerHTML='<div class="loading-row">SIN SEÑALES EN ESTA CATEGORÍA</div>';
    return;
  }
  feed.innerHTML = filtered.map(s=>{
    const sv = SEV[s.severity] || SEV.MEDIUM;
    const col = CAT_COLOR[s.cat] || '#888';
    const timeStr = formatTime(s.time);
    return `
    <div class="signal-card ${s.id===selectedId?'selected':''}" onclick="selectSignal('${s.id}')"
         style="border-left-color:${col}">
      <div style="position:absolute;top:0;left:0;bottom:0;width:2px;background:${col}"></div>
      <div class="card-top">
        <span class="card-source">${s.source}</span>
        <span class="card-category ${sv.cls}" style="background:${col}18;border:1px solid ${col}40">${CAT_LABEL[s.cat]||s.cat.toUpperCase()}</span>
        <span class="card-time">${timeStr}</span>
      </div>
      <div class="card-title">${s.title}</div>
      <div class="card-meta">
        <span class="card-loc">⌖ ${s.location}</span>
        <span class="card-impact ${sv.cls}">▲ ${s.severity}</span>
      </div>
      ${s.isNew ? '<div class="card-new">NUEVA</div>' : ''}
    </div>`;
  }).join('');
}

function selectSignal(id){
  selectedId = id;
  const s = allSignals.find(x=>x.id===id);
  if(!s) return;
  renderFeed(); // refresh to update selected state

  const sv = SEV[s.severity] || SEV.MEDIUM;
  const col = CAT_COLOR[s.cat] || '#888';
  document.getElementById('detail-placeholder').style.display='none';
  const dc = document.getElementById('detail-content');
  dc.style.display='block';

  const impactHTML = Object.entries(s.impacts||{}).map(([k,v])=>`
    <div class="d-impact-cell">
      <div class="d-impact-cat">${k}</div>
      <div class="d-impact-val ${sv.cls}" style="font-size:${v.length>6?'16px':'26px'}">${v}</div>
    </div>`).join('');

  dc.innerHTML = `
    <div class="d-meta">// AETHER SIGNAL · ANÁLISIS DE EVENTO</div>
    <div class="d-title">${s.title}</div>
    <div class="d-badge-row">
      <span class="d-badge ${sv.cls} ${sv.bg}">${s.severity}</span>
      <span class="d-badge" style="color:${col};background:${col}12;border:1px solid ${col}40">${CAT_LABEL[s.cat]||s.cat.toUpperCase()}</span>
      <span class="d-badge" style="color:var(--dim);border:1px solid rgba(255,255,255,.08)">${s.source}</span>
    </div>
    <div class="d-label">// SEÑAL</div>
    <div class="d-text">${s.detail}</div>
    <div class="d-divider"></div>
    <div class="d-label">// INDICADORES</div>
    <div class="d-impact-grid">${impactHTML}</div>
    <div class="d-divider"></div>
    <div class="d-label">// LOCALIZACIÓN · TIEMPO</div>
    <div class="d-text" style="font-size:12px">
      <span style="color:var(--cyan)">⌖</span> ${s.location}<br>
      <span style="color:var(--dim)">${s.time.toUTCString()}</span>
    </div>
    ${s.url ? `<a class="d-link" href="${s.url}" target="_blank">⬡ VER FUENTE ORIGINAL →</a>` : ''}
  `;
}

function filterCat(btn, cat){
  activeCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

function sortBy(btn, sort){
  activeSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

function formatTime(d){
  if(!d || isNaN(d.getTime())) return '—';
  const diff = Date.now()-d.getTime();
  if(diff<60000) return 'ahora';
  if(diff<3600000) return Math.floor(diff/60000)+'m';
  if(diff<86400000) return Math.floor(diff/3600000)+'h';
  return Math.floor(diff/86400000)+'d';
}

function buildTicker(){
  if(!allSignals.length) return;
  const items = allSignals.slice(0,30).map(s=>{
    const col = CAT_COLOR[s.cat]||'#888';
    return `<span class="ticker-item"><div class="t-dot" style="background:${col}"></div>${s.title.slice(0,70)}<span class="ticker-sep">·</span></span>`;
  }).join('');
  const ti = document.getElementById('ticker-inner');
  ti.innerHTML = items + items; // double for seamless loop
}

// Auto-refresh every 5 minutes
loadAll();
setInterval(loadAll, 300000);
