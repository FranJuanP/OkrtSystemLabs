/**
 * AETHER SIGNAL · motor del feed
 *
 * Fuente legible recuperada en la Fase 0 y verificada por AST contra el
 * bloque ofuscado que iba inline en aether-signal.html.
 *
 * Módulo ES (T12). Dos piezas merecen explicación, porque sustituyen a dos
 * acoplamientos que antes se hacían por variables globales:
 *
 *  - `allSignals` y `filtered` eran globales que feed-boost.js leía y
 *    reescribía. En un módulo, un binding importado es de solo lectura, así
 *    que el estado se expone con accesores: getAllSignals/setAllSignals y
 *    getFiltered/setFiltered.
 *  - feed-boost.js sustituía `loadAll` por una versión envuelta. Ahora el
 *    motor expone `registerAfterLoad(fn)` y llama a los hooks al terminar,
 *    que es lo mismo pero explícito y sin parchear nada.
 */
import { esc, safeHref, safeUrl } from '../core/escape.js';

// ═══════════════════════════════════════════════
//  AETHER SIGNAL — OkrtSystem Labs
//  Live Global Intelligence Feed
// ═══════════════════════════════════════════════

let allSignals = [];
let filtered   = [];

/** @returns {Array} las señales actuales. */
export function getAllSignals(){ return allSignals; }
/** Sustituye la lista de señales. */
export function setAllSignals(next){ allSignals = Array.isArray(next) ? next : []; }
/** @returns {Array} la lista filtrada que se está pintando. */
export function getFiltered(){ return filtered; }
/** Sustituye la lista filtrada. */
export function setFiltered(next){ filtered = Array.isArray(next) ? next : []; }

/** Hooks que corren al terminar cada loadAll(). Ver feed-boost.js. */
const afterLoadHooks = [];
/** Registra un hook posterior a la carga. Sustituye al parcheo de loadAll. */
export function registerAfterLoad(fn){ if (typeof fn === 'function') afterLoadHooks.push(fn); }

/** Hooks que corren tras seleccionar una señal. Ver mobile-fix.js. */
const afterSelectHooks = [];
/** Registra un hook posterior a la selección. Sustituye al parcheo de selectSignal. */
export function registerAfterSelect(fn){ if (typeof fn === 'function') afterSelectHooks.push(fn); }
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

/* ── T1 · estado real de las fuentes y ultima lectura ──────────────────────
   El punto de estado de cada fuente refleja unicamente el resultado de su
   fetch: 'load' mientras esta en vuelo, 'ok' si respondio, 'err' si fallo.
   Cuando una fuente falla se muestra "Sin conexion con <fuente>" en su fila
   y, si hay una lectura real guardada, se reinyecta marcada como tal. */

const SOURCE_LABELS = {
  usgs:   { name: 'USGS',           row: 'USGS Seismic' },
  gdelt:  { name: 'GDELT',          row: 'GDELT Project' },
  relief: { name: 'ReliefWeb',      row: 'ReliefWeb OCHA' },
  nasa:   { name: 'NASA EONET',     row: 'NASA EONET Events' },
};

const LAST_READING_PREFIX = 'aether.signal.lastReading.';
const LAST_READING_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function setSrc(id, st) {
  const el = document.getElementById('src-'+id);
  if(el){ el.className = 'source-status ' + st; }
  const label = document.getElementById('srclbl-'+id);
  const meta = SOURCE_LABELS[id];
  if(label && meta){
    label.textContent = st === 'err' ? ('Sin conexión con ' + meta.name) : meta.row;
  }
}

/** Guarda la ultima lectura real de una fuente. */
function saveLastReading(id, signals){
  if(!Array.isArray(signals) || !signals.length) return;
  try{
    const payload = {
      fetchedAt: new Date().toISOString(),
      signals: signals.map(s => Object.assign({}, s, {
        time: s.time instanceof Date ? s.time.toISOString() : s.time,
      })),
    };
    localStorage.setItem(LAST_READING_PREFIX + id, JSON.stringify(payload));
  }catch(e){ /* cuota llena o almacenamiento bloqueado: no es critico */ }
}

/**
 * Recupera la ultima lectura real de una fuente caida. Las senales vuelven
 * marcadas con stale/fetchedAt para que el feed las rotule "ultima lectura"
 * y nunca se confundan con datos del momento.
 */
function loadLastReading(id){
  try{
    const raw = localStorage.getItem(LAST_READING_PREFIX + id);
    if(!raw) return [];
    const payload = JSON.parse(raw);
    const fetchedAt = new Date(payload && payload.fetchedAt);
    if(isNaN(fetchedAt.getTime())) return [];
    if(Date.now() - fetchedAt.getTime() > LAST_READING_MAX_AGE_MS) return [];
    if(!Array.isArray(payload.signals)) return [];
    return payload.signals.map(s => Object.assign({}, s, {
      time: new Date(s.time),
      isNew: false,
      stale: true,
      fetchedAt: fetchedAt,
    }));
  }catch(e){ return []; }
}

/** Marca la fuente como caida y devuelve su ultima lectura real, si la hay. */
function sourceFailed(id){
  setSrc(id, 'err');
  return loadLastReading(id);
}

/** Marca la fuente como viva, guarda la lectura y la devuelve. */
function sourceOk(id, signals){
  setSrc(id, 'ok');
  saveLastReading(id, signals);
  return signals;
}

/** Fecha corta y legible en UTC para la etiqueta "ultima lectura". */
function formatReadingDate(d){
  if(!(d instanceof Date) || isNaN(d.getTime())) return '—';
  const p = v => String(v).padStart(2, '0');
  return p(d.getUTCDate())+'/'+p(d.getUTCMonth()+1)+' '+p(d.getUTCHours())+':'+p(d.getUTCMinutes())+' UTC';
}

/**
 * Hora de la ultima actualizacion, en UTC de verdad.
 * Antes se usaba toLocaleTimeString() y se le pegaba el sufijo " UTC", de
 * modo que un navegador en Madrid rotulaba las 12:00 UTC como "14:00 UTC".
 */
function formatUTCClock(d){
  return d.toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'UTC',
  });
}

function updateLastUpdate(suffix){
  const el = document.getElementById('last-update');
  if(!el) return;
  el.textContent = formatUTCClock(new Date()) + ' UTC' + (suffix ? ' · ' + suffix : '');
}

/**
 * Contador de cabecera. Cuenta solo eventos reales y separa los que
 * provienen de una ultima lectura guardada de una fuente caida.
 */
function updateSignalCount(){
  const el = document.getElementById('signal-count');
  if(!el) return;
  const total = allSignals.length;
  const stale = allSignals.filter(s => s && s.stale).length;
  const live = total - stale;
  let text = live + ' señales activas';
  if(stale) text += ' · ' + stale + ' de última lectura';
  if(!total) text = 'sin señales disponibles';
  el.textContent = text;
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
    const out = (d.features || []).slice(0,30).map(f=>{
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
    return sourceOk('usgs', out);
  } catch(e) { return sourceFailed('usgs'); }
}

// ── FETCH: NASA EONET natural events ──
async function fetchNASA() {
  try {
    const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=25&days=14');
    const d = await r.json();
    const catMap = { Wildfires:'climate', Volcanoes:'seismic', 'Severe Storms':'climate',
                     Floods:'climate', Drought:'climate', 'Sea and Lake Ice':'climate',
                     Earthquakes:'seismic', 'Dust and Haze':'climate' };
    const out = (d.events||[]).map(ev=>{
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
    return sourceOk('nasa', out);
  } catch(e) { return sourceFailed('nasa'); }
}

// ── FETCH: ReliefWeb Humanitarian ──
async function fetchReliefWeb() {
  try {
    const url = 'https://api.reliefweb.int/v1/reports?appname=aethersignal&filter[field]=status&filter[value]=published&limit=20&sort[]=date:desc&fields[include][]=title&fields[include][]=date&fields[include][]=country&fields[include][]=disaster_type&fields[include][]=url_alias';
    const r = await fetch(url);
    const d = await r.json();
    const typeMap = { 'Conflict':'conflict', 'Epidemic':'health', 'Drought':'climate',
                      'Flood':'climate','Earthquake':'seismic','Cyclone / Typhoon / Hurricane':'climate',
                      'Famine':'humanitarian' };
    const out = (d.data||[]).map((item,i)=>{
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
    return sourceOk('relief', out);
  } catch(e) { return sourceFailed('relief'); }
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
    if(!results.length) return sourceFailed('gdelt');
    return sourceOk('gdelt', results);
  } catch(e) { return sourceFailed('gdelt'); }
}

// ── SYNTHETIC WHO-style health signals (real WHO RSS is CORS-blocked) ──
// Use hardcoded recent WHO Disease Outbreak News
/* T1 · getWHOSignals eliminada.
   Eran tres items escritos a mano con marcas de tiempo sinteticas
   (new Date(Date.now() - i*6h)), de modo que siempre parecian eventos de
   las ultimas 18 horas, y ademas pintaban src-who en verde sin existir
   ningun fetch detras. La categoria SALUD se sigue alimentando de
   ReliefWeb (disaster_type 'Epidemic'), que si es una fuente real. */

// ── LOAD ALL ──
async function loadAll() {
  document.getElementById('feed').innerHTML = `<div class="loading-row"><div class="spinner"></div><br>CONECTANDO CON FUENTES GLOBALES...</div>`;

  const [usgs, nasa, relief, gdelt] = await Promise.all([
    fetchUSGS(), fetchNASA(), fetchReliefWeb(), fetchGDELT()
  ]);

  // Solo eventos reales: lo que devolvio cada fuente, o su ultima lectura
  // real guardada si la fuente esta caida. Nada generado por la aplicacion.
  allSignals = [...usgs, ...gdelt, ...relief, ...nasa];

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

  updateLastUpdate();
  updateSignalCount();
  updateFeedState();

  for (const hook of afterLoadHooks) {
    try { await hook(); } catch (err) { console.warn('AETHER Signal: hook posterior a la carga fallido:', err); }
  }
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
    // T1: las senales recuperadas de una fuente caida se rotulan con la fecha
    // de su ultima lectura real, nunca como si fueran de ahora mismo.
    const timeStr = s.stale
      ? ('última lectura · ' + formatReadingDate(s.fetchedAt))
      : formatTime(s.time);
    return `
    <div class="signal-card ${s.id===selectedId?'selected':''}" data-signal-id="${esc(s.id)}"
         style="border-left-color:${col}">
      <div style="position:absolute;top:0;left:0;bottom:0;width:2px;background:${col}"></div>
      <div class="card-top">
        <span class="card-source">${esc(s.source)}</span>
        <span class="card-category ${sv.cls}" style="background:${col}18;border:1px solid ${col}40">${esc(CAT_LABEL[s.cat]||String(s.cat).toUpperCase())}</span>
        <span class="card-time">${esc(timeStr)}</span>
      </div>
      <div class="card-title">${esc(s.title)}</div>
      <div class="card-meta">
        <span class="card-loc">⌖ ${esc(s.location)}</span>
        <span class="card-impact ${sv.cls}">▲ ${esc(s.severity)}</span>
      </div>
      ${s.isNew ? '<div class="card-new">NUEVA</div>' : ''}
    </div>`;
  }).join('');

  // T3/T4: sin onclick inline. El id viaja escapado en data-signal-id y el
  // manejador se engancha aqui, lo que ademas permite quitar 'unsafe-inline'.
  feed.querySelectorAll('.signal-card').forEach(card=>{
    card.addEventListener('click', ()=>selectSignal(card.getAttribute('data-signal-id')));
  });
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
      <div class="d-impact-cat">${esc(k)}</div>
      <div class="d-impact-val ${sv.cls}" style="font-size:${String(v).length>6?'16px':'26px'}">${esc(v)}</div>
    </div>`).join('');

  dc.innerHTML = `
    <div class="d-meta">// AETHER SIGNAL · ANÁLISIS DE EVENTO</div>
    <div class="d-title">${esc(s.title)}</div>
    <div class="d-badge-row">
      <span class="d-badge ${sv.cls} ${sv.bg}">${esc(s.severity)}</span>
      <span class="d-badge" style="color:${col};background:${col}12;border:1px solid ${col}40">${esc(CAT_LABEL[s.cat]||String(s.cat).toUpperCase())}</span>
      <span class="d-badge" style="color:var(--dim);border:1px solid rgba(255,255,255,.08)">${esc(s.source)}</span>
    </div>
    <div class="d-label">// SEÑAL</div>
    <div class="d-text">${esc(s.detail)}</div>
    <div class="d-divider"></div>
    <div class="d-label">// INDICADORES</div>
    <div class="d-impact-grid">${impactHTML}</div>
    <div class="d-divider"></div>
    <div class="d-label">// LOCALIZACIÓN · TIEMPO</div>
    <div class="d-text" style="font-size:12px">
      <span style="color:var(--cyan)">⌖</span> ${esc(s.location)}<br>
      <span style="color:var(--dim)">${esc(s.time instanceof Date && !isNaN(s.time.getTime()) ? s.time.toUTCString() : "—")}</span>
    </div>
    ${safeUrl(s.url) ? `<a class="d-link" href="${safeHref(s.url)}" target="_blank" rel="noopener noreferrer">⬡ VER FUENTE ORIGINAL →</a>` : ''}
  `;

  for (const hook of afterSelectHooks) {
    try { hook(s); } catch (err) { console.warn('AETHER Signal: hook de selección fallido:', err); }
  }
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
  const ti = document.getElementById('ticker-inner');
  if(!ti) return;

  // T1: antes esta funcion hacia `if(!allSignals.length) return;`, de modo
  // que sin senales el ticker se quedaba para siempre con los dos items de
  // relleno del HTML ("Cargando senales en tiempo real...", "Conectando con
  // fuentes globales..."), dando a entender que seguia intentandolo. Ahora,
  // tras el primer intento, dice el estado real.
  if(!allSignals.length){
    const anyStored = Object.keys(SOURCE_LABELS).some(id => loadLastReading(id).length);
    const msg = anyStored
      ? 'Sin conexión con las fuentes · no hay lecturas recientes guardadas'
      : 'Sin conexión con las fuentes · sin eventos que mostrar';
    ti.style.animation = 'none';
    ti.innerHTML = `<span class="ticker-item"><div class="t-dot" style="background:var(--red)"></div>${esc(msg)}</span>`;
    return;
  }

  ti.style.animation = '';
  const items = allSignals.slice(0,30).map(s=>{
    const col = CAT_COLOR[s.cat]||'#888';
    const prefix = s.stale ? 'última lectura · ' : '';
    return `<span class="ticker-item"><div class="t-dot" style="background:${col}"></div>${esc(prefix + String(s.title||'').slice(0,70))}<span class="ticker-sep">·</span></span>`;
  }).join('');
  ti.innerHTML = items + items; // double for seamless loop
}

// Auto-refresh every 5 minutes
// T12: el arranque y el temporizador los monta src/pages/signal.js.

/**
 * T1 · La insignia de cabecera refleja el estado real del feed.
 * Con todas las fuentes caidas ya no puede decir "FEED EN VIVO": pasa a
 * "SIN CONEXION" y se le quita el pulso, porque lo que se ve en pantalla es
 * la ultima lectura guardada, no datos del momento.
 */
function updateFeedState(){
  // ¿Hay alguna fuente que haya respondido en esta carga? Las señales
  // marcadas como `stale` vienen de una lectura guardada, no de ahora.
  const live = allSignals.some(s => s && !s.stale);

  const badge = document.getElementById('feed-state');
  const dot   = document.getElementById('feed-state-dot');
  const label = document.getElementById('feed-state-label');
  if(label) label.textContent = live ? 'FEED EN VIVO' : 'SIN CONEXIÓN';
  // El punto pasa a rojo y sin pulso, como los puntos de fuente caída.
  if(dot)   dot.classList.toggle('offline', !live);
  if(badge) badge.classList.toggle('offline', !live);

  // La etiqueta del ticker decía "⬡ LIVE" pasara lo que pasara.
  const tickerLabel = document.getElementById('ticker-state-label');
  if(tickerLabel){
    tickerLabel.textContent = live ? '⬡ LIVE' : '⬡ SIN CONEXIÓN';
    tickerLabel.classList.toggle('offline', !live);
  }
}

export {
  SEV, CAT_COLOR, CAT_LABEL, SOURCE_LABELS,
  setSrc, loadAll, applyFilter, updateCounts, renderFeed, selectSignal,
  filterCat, sortBy, formatTime, buildTicker,
  updateLastUpdate, updateSignalCount, updateFeedState,
  saveLastReading, loadLastReading,
};
