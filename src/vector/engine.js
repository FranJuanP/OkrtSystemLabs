/**
 * AETHER VECTOR · motor de flujos financieros
 *
 * Fuente legible recuperada en la Fase 0 y verificada por AST contra el
 * bloque ofuscado que iba inline en aether-vector.html.
 *
 * Módulo ES (T12): exporta lo que la página y los módulos de apoyo
 * necesitan, en vez de dejarlo en el ámbito global.
 *
 * d3 sigue llegando como global desde el CDN; T16 lo sustituye por un
 * import de la build modular empaquetada en el repositorio.
 */
import { esc, safeHref, safeUrl } from '../core/escape.js';

/* T16: d3 modular. Vector solo usa dos cosas de toda la libreria, asi que
   se importan esas dos en vez de los 280 kB del paquete completo. */
import { select } from 'd3-selection';
import { range } from 'd3-array';

const d3 = { select, range };

// ═══════════════════════════════════════════════════════════════
//  AETHER VECTOR — Financial Flow Intelligence
//  OkrtSystem Labs — Data: World Bank / IMF / BIS (2022-23)
// ═══════════════════════════════════════════════════════════════

// ── DATA (B USD, 2022-2023 sourced from World Bank, IMF, BIS) ──
/* T25 · Los nodos y los enlaces salen de data/vector.json.

   Aqui habia 22 nodos y 42 enlaces escritos a mano. El problema no era solo
   que las cifras no tuvieran fuente: el diagrama MEZCLABA STOCKS CON FLUJOS.

     "RESERVAS 890"   es un saldo: lo que hay acumulado, en un instante.
     "COMERCIO 3.210" es un flujo: lo que se mueve en un ano.

   Sumar las dos cosas en el mismo diagrama, con la misma unidad y la misma
   escala, no significa nada: son magnitudes de dimensiones distintas. Un
   stock se mide en dolares; un flujo, en dolares por ano.

   Ahora van en bloques separados y etiquetados, cada uno con su periodo y su
   fuente, y cada bloque conserva: lo que entra por un lado sale por el otro,
   porque el reparto se construye como "los N primeros mas el resto" y el
   resto sale por diferencia con el total de la propia fuente.

   Lo genera tools/fetch-vector.mjs y lo comprueba tests/vector.mjs. */
const VECTOR = await (async () => {
  try {
    const url = new URL('data/vector.json', document.baseURI).href;
    const r = await fetch(url, { credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!d || d.esquema !== 1) throw new Error('esquema inesperado');
    return d;
  } catch (err) {
    console.error('AETHER Vector: no se han podido cargar los datos:', err);
    return { bloques: [], porDefecto: [], conservacion: [], generado: null };
  }
})();

/** Bloque por id, y el tipo de flujo al que responde cada boton. */
const BLOQUES = new Map(VECTOR.bloques.map((b) => [b.id, b]));
const BLOQUE_DE_TIPO = new Map();
for (const b of VECTOR.bloques) {
  // Si dos bloques comparten tipo (reservas por moneda y por pais), gana el
  // primero; el otro sigue accesible por su id.
  if (!BLOQUE_DE_TIPO.has(b.tipo)) BLOQUE_DE_TIPO.set(b.tipo, b);
}

/** Todos los nodos y enlaces, con el bloque al que pertenece cada uno. */
const NODES = [];
const ALL_LINKS = [];
for (const b of VECTOR.bloques) {
  for (const n of b.nodos) NODES.push(Object.assign({}, n, { bloque: b.id }));
  for (const l of b.enlaces) ALL_LINKS.push(Object.assign({}, l, { bloque: b.id, clase: b.clase }));
}

const FLOW_COLORS = {
  debt:'#FF4060', trade:'#FFB020', fdi:'#00FFC8',
  remit:'#A060FF', reserves:'#60BFFF', all:'#00FFC8'
};
const FLOW_LABELS = {
  debt:'DEUDA', trade:'COMERCIO', fdi:'IED', remit:'REMESAS', reserves:'RESERVAS'
};

let activeFlow = 'all';
let activeRegion = 'all';
/* T25: el umbral arranca en 0. Con los datos de verdad los bloques tienen
   escalas muy distintas (33 billones las exportaciones, 991 mil millones las
   remesas), asi que un umbral fijo de 50 mil millones ocultaba casi todo el
   bloque de remesas desde el principio. Filtrar es del usuario. */
let threshold = 0;

// Clock
setInterval(()=>{
  const n=new Date();
  document.getElementById('clock').textContent=
    [n.getUTCHours(),n.getUTCMinutes(),n.getUTCSeconds()].map(v=>String(v).padStart(2,'0')).join(':')+' UTC';
},1000);

// ── SANKEY LAYOUT ──
/* T25 · El porcentaje de un enlace se calcula sobre el total DE SU BLOQUE.
   Antes se dividia por la suma de los 42 enlaces, que sumaba stocks con
   flujos: un "% del flujo global total" que no era ni un flujo ni un total
   de nada. */
function totalDelBloque(l){
  const b = BLOQUES.get(l && l.bloque);
  return (b && b.total) || 0;
}
function porcentajeEnSuBloque(l){
  const t = totalDelBloque(l);
  return t ? (l.v / t * 100) : 0;
}

function computeSankey(links, nodes) {
  const wrap = document.getElementById('chart-wrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  const PAD = { top:40, right:60, bottom:40, left:60 };
  const cols = [0, 1, 2];
  const colX = { 0: PAD.left + 80, 1: W/2, 2: W - PAD.right - 80 };

  // assign x to nodes
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = {...n, inVal:0, outVal:0, links:[] }; });
  links.forEach(l => {
    if(nodeMap[l.s]) nodeMap[l.s].outVal += l.v;
    if(nodeMap[l.t]) nodeMap[l.t].inVal  += l.v;
  });

  // y positions per column
  const colNodes = {0:[], 1:[], 2:[]};
  Object.values(nodeMap).forEach(n => colNodes[n.col].push(n));

  const nodeH = (col, n) => {
    const total = colNodes[col].reduce((s,x) => s + Math.max(x.inVal, x.outVal, 100), 0);
    const avail = H - PAD.top - PAD.bottom;
    return Math.max(12, (Math.max(n.inVal, n.outVal, 100) / Math.max(total,1)) * avail * 0.88);
  };

  [0,1,2].forEach(col => {
    let y = PAD.top;
    const gap = (H - PAD.top - PAD.bottom - colNodes[col].reduce((s,n)=>s+nodeH(col,n),0)) /
               Math.max(colNodes[col].length - 1, 1);
    colNodes[col].forEach(n => {
      n.x = colX[col]; n.y = y; n.h = nodeH(col, n); n.w = 18;
      y += n.h + Math.max(8, gap);
    });
  });

  return { nodeMap, W, H, colX };
}

// ── RENDER ──

/* T25 · La barra inferior dice de que es el diagrama: si es un saldo o un
   flujo anual, de que periodo, de quien, y si el bloque conserva. */
function actualizarPieDeVector(links){
  const el = document.getElementById('vector-pie');
  if(!el) return;
  const ids = [...new Set(links.map(l => l.bloque))];
  if(!ids.length){
    el.textContent = VECTOR.generado ? 'SIN ENLACES POR ENCIMA DEL UMBRAL' : 'SIN DATOS: no se ha podido cargar data/vector.json';
    return;
  }
  const partes = ids.map(id => {
    const b = BLOQUES.get(id);
    if(!b) return id;
    const cons = (VECTOR.conservacion || []).find(c => c.bloque === id);
    const marca = cons ? (cons.ok ? 'cuadra' : 'residuo ' + cons.residuo) : '';
    return (b.clase === 'stock' ? 'SALDO' : 'FLUJO ANUAL') + ' · ' + b.titulo
      + ' · ' + b.periodo + ' · ' + b.source + (marca ? ' · ' + marca : '');
  });
  el.textContent = partes.join('   ·   ');
  el.title = ids.map(id => (BLOQUES.get(id) || {}).nota).filter(Boolean).join(' ');
}

function render() {
  /* T25 · Que bloques se muestran.

     'all' muestra SOLO los flujos anuales, nunca mezclados con los stocks:
     mezclarlos es el error que esta tarea viene a corregir. Cada boton de
     tipo muestra su bloque, con su clase (STOCK o FLUJO), su periodo y su
     fuente escritos en la barra inferior. */
  const visibles = activeFlow === 'all'
    ? new Set(VECTOR.porDefecto || [])
    : new Set([(BLOQUE_DE_TIPO.get(activeFlow) || {}).id].filter(Boolean));

  const links = ALL_LINKS.filter(l => {
    if(!visibles.has(l.bloque)) return false;
    if(l.v < threshold) return false;
    return true;
  });

  // filter nodes to only those with active links
  const activeIds = new Set();
  links.forEach(l => { activeIds.add(l.s); activeIds.add(l.t); });
  const nodes = NODES.filter(n => {
    if(!visibles.has(n.bloque)) return false;
    if(activeRegion !== 'all' && !n.isHub && n.region !== activeRegion) return false;
    return activeIds.has(n.id);
  });

  const { nodeMap, W, H } = computeSankey(links, nodes);

  // volumes for controls
  ['debt','trade','fdi','remit','reserves'].forEach(type => {
    const b = BLOQUE_DE_TIPO.get(type);
    const el = document.getElementById('vol-'+type);
    if(!el) return;
    if(!b){ el.textContent = '—'; el.title = 'sin datos'; return; }
    const vol = b.total;
    el.textContent = vol >= 1000 ? (vol/1000).toFixed(1)+'T' : Math.round(vol)+'B';
    // El periodo y la clase, en el title: un saldo y un flujo anual no se
    // comparan, y el boton tiene que decir cual es cual.
    el.title = (b.clase === 'stock' ? 'Saldo' : 'Flujo anual') + ' · ' + b.periodo + ' · ' + b.source;
  });
  /* El boton "todos" solo agrega FLUJOS, que si son sumables entre si
     (todos son miles de millones de dolares al ano). Los stocks no se suman
     a nada: cada uno es un saldo con su propio instante. */
  const volFlujos = (VECTOR.porDefecto || [])
    .map(id => (BLOQUES.get(id) || {}).total || 0)
    .reduce((a,b)=>a+b, 0);
  const visVol = links.reduce((s,l)=>s+l.v,0);
  const elAll = document.getElementById('vol-all');
  if(elAll){
    elAll.textContent = (volFlujos/1000).toFixed(1)+'T';
    elAll.title = 'Suma de los flujos anuales. Los saldos no se suman a esto.';
  }
  const clases = new Set(links.map(l => l.clase));
  const etiquetaClase = clases.size === 1 ? (clases.has('stock') ? 'SALDO VISIBLE' : 'FLUJO ANUAL VISIBLE') : 'VISIBLE';
  document.getElementById('total-flow').textContent = '$' + (visVol/1000).toFixed(1)+'T';
  const lblTotal = document.querySelector('#total-flow')?.parentElement?.querySelector('.lbl');
  if(lblTotal) lblTotal.textContent = etiquetaClase;
  document.getElementById('node-count').textContent = Object.keys(nodeMap).length;
  actualizarPieDeVector(links);

  // build SVG
  const svg = d3.select('#sankey-svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio','xMidYMid meet');
  svg.selectAll('*').remove();

  // defs: gradients per link
  const defs = svg.append('defs');
  links.forEach((l,i) => {
    const sn = nodeMap[l.s], tn = nodeMap[l.t];
    if(!sn || !tn) return;
    const grad = defs.append('linearGradient')
      .attr('id','lg'+i).attr('gradientUnits','userSpaceOnUse')
      .attr('x1',sn.x).attr('x2',tn.x).attr('y1',sn.y).attr('y2',tn.y);
    const col = FLOW_COLORS[l.type] || '#00FFC8';
    grad.append('stop').attr('offset','0%').attr('stop-color',col).attr('stop-opacity',.7);
    grad.append('stop').attr('offset','100%').attr('stop-color',col).attr('stop-opacity',.25);
  });

  // grid lines
  svg.append('g').attr('class','grid').selectAll('line')
    .data(d3.range(0, W, 120)).enter().append('line')
    .attr('x1',d=>d).attr('x2',d=>d).attr('y1',0).attr('y2',H)
    .attr('stroke','rgba(0,255,200,0.025)').attr('stroke-width',1);

  // link offset tracker
  const sOffset = {}, tOffset = {};
  Object.keys(nodeMap).forEach(id => { sOffset[id]=0; tOffset[id]=0; });

  // links
  const linkG = svg.append('g');
  links.forEach((l,i) => {
    const sn = nodeMap[l.s], tn = nodeMap[l.t];
    if(!sn || !tn) return;
    const maxSrc = Math.max(sn.inVal, sn.outVal, 1);
    const maxTgt = Math.max(tn.inVal, tn.outVal, 1);
    const sh = (l.v / maxSrc) * sn.h;
    const th = (l.v / maxTgt) * tn.h;
    const sy = sn.y + sOffset[l.s];
    const ty = tn.y + tOffset[l.t];
    sOffset[l.s] += sh;
    tOffset[l.t] += th;

    const x0 = sn.x + sn.w, x1 = tn.x;
    const cx = (x0+x1)/2;
    const pathD = `M${x0},${sy} C${cx},${sy} ${cx},${ty} ${x1},${ty} L${x1},${ty+th} C${cx},${ty+th} ${cx},${sy+sh} ${x0},${sy+sh} Z`;
    const col = FLOW_COLORS[l.type] || '#00FFC8';

    const path = linkG.append('path').attr('class','link-path')
      .attr('d', pathD)
      .attr('fill', `url(#lg${i})`)
      .attr('opacity', 0.35)
      .attr('stroke','none');

    path.on('mouseenter', (ev)=>{
      path.attr('opacity',0.65);
      showTooltip(ev, `${nodeMap[l.s]?.label||l.s} → ${nodeMap[l.t]?.label||l.t}`,
        [['TIPO', FLOW_LABELS[l.type]||l.type],
         ['VOLUMEN', linkAmount(l)],
         ['UNIDAD', linkUnit(l)],
         ['PERIODO', linkPeriod(l)],
         ...(linkPublished(l) ? [['PUBLICADO', linkPublished(l)]] : []),
         ['FUENTE', linkSource(l)],
         ['% DE SU BLOQUE', porcentajeEnSuBloque(l).toFixed(1)+'%']]);
    })
    .on('mouseleave', ()=>{
      path.attr('opacity',0.35);
      hideTooltip();
    })
    .on('click', ()=> showLinkDetail(l, nodeMap));
  });

  // nodes
  const nodeG = svg.append('g');
  Object.values(nodeMap).forEach(n => {
    const isHub = n.isHub;
    const col = isHub ? 'rgba(0,255,200,0.15)' : getNodeColor(n);
    const borderCol = isHub ? 'rgba(0,255,200,0.5)' : getNodeColor(n);

    const g = nodeG.append('g').attr('class','node-group').style('cursor','pointer');
    g.append('rect').attr('class','node-rect')
      .attr('x', n.x).attr('y', n.y).attr('width', n.w).attr('height', n.h)
      .attr('fill', col).attr('stroke', borderCol).attr('stroke-width', 1)
      .attr('rx', 2);

    // label
    const labelX = n.col === 0 ? n.x - 6 : (n.col === 1 ? n.x + n.w/2 : n.x + n.w + 6);
    const anchor = n.col === 0 ? 'end' : (n.col === 1 ? 'middle' : 'start');
    const labelY = n.col === 1 ? n.y - 8 : n.y + n.h/2 + 4;

    g.append('text').attr('class','node-label')
      .attr('x', labelX).attr('y', labelY)
      .attr('text-anchor', anchor)
      .text(n.label);

    if(!isHub) {
      const vol = Math.max(n.inVal, n.outVal);
      g.append('text').attr('class','node-label-val')
        .attr('x', labelX).attr('y', labelY + 13)
        .attr('text-anchor', anchor)
        .text('$' + (vol>=1000?(vol/1000).toFixed(1)+'T':vol+'B'));
    }

    g.on('mouseenter', (ev)=>{
      g.select('.node-rect').attr('opacity', 0.7);
      const vol = Math.max(n.inVal, n.outVal);
      showTooltip(ev, n.label, [
        ['VOLUMEN', '$'+(vol>=1000?(vol/1000).toFixed(1)+'T':vol+'B')],
        ['ENTRADA', '$'+n.inVal+'B'], ['SALIDA', '$'+n.outVal+'B']
      ]);
    })
    .on('mouseleave', ()=>{ g.select('.node-rect').attr('opacity',1); hideTooltip(); })
    .on('click', ()=> showNodeDetail(n, links, nodeMap));
  });

  // column headers
  const headers = [{x: Object.values(nodeMap).find(n=>n.col===0)?.x||80, l:'ORIGEN'},
                   {x: Object.values(nodeMap).find(n=>n.col===1)?.x||W/2, l:'TIPO DE FLUJO'},
                   {x: Object.values(nodeMap).find(n=>n.col===2)?.x||(W-80), l:'DESTINO'}];
  headers.forEach(h=>{
    svg.append('text').attr('x',h.x).attr('y',22).attr('text-anchor','middle')
      .attr('fill','rgba(0,255,200,.3)').attr('font-family','Space Mono,monospace')
      .attr('font-size',9).attr('letter-spacing',3).text(h.l);
  });

  // top flows list
  const top5 = [...links].sort((a,b)=>b.v-a.v).slice(0,6);
  document.getElementById('top-flows-list').innerHTML = top5.map(l=>{
    const col = FLOW_COLORS[l.type]||'#888';
    return `<div class="top-row">
      <span class="pair">${(nodeMap[l.s]?.label||l.s).slice(0,8)} → ${(nodeMap[l.t]?.label||l.t).slice(0,8)}</span>
      <span class="top-type" style="color:${col};border:1px solid ${col}40;background:${col}10">${FLOW_LABELS[l.type]||l.type}</span>
      <span class="top-val">$${l.v >= 1000 ? (l.v/1000).toFixed(1)+'T' : l.v+'B'}</span>
    </div>`;
  }).join('');
}

function getNodeColor(n){
  const regionColor = {NA:'rgba(255,176,32,.7)',EU:'rgba(96,191,255,.7)',AS:'rgba(0,255,200,.7)',
                        ME:'rgba(255,128,48,.7)',LA:'rgba(160,96,255,.7)',AF:'rgba(255,64,96,.7)'};
  return regionColor[n.region] || 'rgba(255,255,255,.2)';
}

/* ── T10 · procedencia por enlace ────────────────────────────────────────
   Cada enlace puede declarar unit, year, source, sourceUrl y pending. El
   tooltip y el panel de detalle muestran siempre unidad y ano, y dicen
   "pendiente de verificar" cuando la cifra no tiene fuente comprobada, en
   vez de presentarla como si la tuviera. */

/** Unidad de un enlace. Por defecto, miles de millones de dolares. */
function linkUnit(l){ return (l && l.unit) || 'B USD'; }

/** Periodo del dato (ano o trimestre), o la marca de pendiente. */
function linkPeriod(l){
  if(l && l.year) return String(l.year);
  return 'pendiente de verificar';
}

/**
 * Fecha en que la fuente publico ese dato, si se sabe.
 * Para series trimestrales como COFER importa tanto como el periodo: el dato
 * de 2026 Q2 no existio hasta el 30/09/2026.
 */
function linkPublished(l){ return (l && l.published) || null; }

/** Volumen con su unidad. */
function linkAmount(l){ return '$' + l.v + ' ' + linkUnit(l); }

/** Fuente legible del enlace. */
function linkSource(l){
  if(l && l.source) return l.source;
  if(l && l.pending) return 'sin fuente verificada';
  return 'sin documentar';
}

// Tooltip
function showTooltip(ev, title, rows){
  const tt = document.getElementById('tooltip');
  tt.innerHTML = `<div class="tt-title">${esc(title)}</div>` +
    rows.map(r=>`<div class="tt-row"><span>${esc(r[0])}</span><span class="tt-val">${esc(r[1])}</span></div>`).join('');
  const wrap = document.getElementById('chart-wrap');
  const rect = wrap.getBoundingClientRect();
  let x = ev.clientX - rect.left + 14;
  let y = ev.clientY - rect.top - 10;
  if(x + 260 > wrap.clientWidth) x -= 280;
  tt.style.left = x+'px'; tt.style.top = y+'px'; tt.style.opacity = '1';
}
function hideTooltip(){ document.getElementById('tooltip').style.opacity='0'; }

// Detail panels
function showNodeDetail(n, links, nodeMap){
  document.getElementById('dp-placeholder').style.display='none';
  const dc = document.getElementById('dp-content'); dc.style.display='block';
  const outLinks = links.filter(l=>l.s===n.id).sort((a,b)=>b.v-a.v);
  const inLinks  = links.filter(l=>l.t===n.id).sort((a,b)=>b.v-a.v);
  const total    = Math.max(n.inVal, n.outVal);
  const barMax   = Math.max(...[...outLinks,...inLinks].map(l=>l.v), 1);

  dc.innerHTML = `
    <div class="dp-meta">// AETHER VECTOR · NODO</div>
    <div class="dp-title">${esc(n.label)}</div>
    <div class="dp-amount">$${total>=1000?(total/1000).toFixed(1)+'T':total+'B'}</div>
    <div class="dp-amount-lbl">VOLUMEN TOTAL EN FLUJO</div>
    <div class="dp-divider"></div>
    ${outLinks.length?`<div class="dp-label">// FLUJOS DE SALIDA</div>
    <div class="dp-bars">${outLinks.slice(0,5).map(l=>{
      const col=FLOW_COLORS[l.type]||'#888';
      return `<div class="dp-bar-row">
        <div class="dp-bar-label"><span>${(nodeMap[l.t]?.label||l.t).slice(0,16)} · ${esc(FLOW_LABELS[l.type]||l.type)}</span><span style="color:${col}">$${l.v}B</span></div>
        <div class="dp-bar-track"><div class="dp-bar-fill" style="width:${(l.v/barMax*100).toFixed(0)}%;background:${col}"></div></div>
      </div>`}).join('')}</div><div class="dp-divider"></div>`:'' }
    ${inLinks.length?`<div class="dp-label">// FLUJOS DE ENTRADA</div>
    <div class="dp-bars">${inLinks.slice(0,5).map(l=>{
      const col=FLOW_COLORS[l.type]||'#888';
      return `<div class="dp-bar-row">
        <div class="dp-bar-label"><span>${(nodeMap[l.s]?.label||l.s).slice(0,16)} · ${esc(FLOW_LABELS[l.type]||l.type)}</span><span style="color:${col}">$${l.v}B</span></div>
        <div class="dp-bar-track"><div class="dp-bar-fill" style="width:${(l.v/barMax*100).toFixed(0)}%;background:${col}"></div></div>
      </div>`}).join('')}</div>`:'' }`;
}

function showLinkDetail(l, nodeMap){
  document.getElementById('dp-placeholder').style.display='none';
  const dc = document.getElementById('dp-content'); dc.style.display='block';
  const col = FLOW_COLORS[l.type]||'#888';
  const pct = porcentajeEnSuBloque(l);
  dc.innerHTML=`
    <div class="dp-meta">// AETHER VECTOR · FLUJO</div>
    <div class="dp-title">${esc(nodeMap[l.s]?.label||l.s)} → ${esc(nodeMap[l.t]?.label||l.t)}</div>
    <div class="dp-amount" style="color:${col};text-shadow:0 0 30px ${col}80">$${l.v}${esc(linkUnit(l)).replace(' USD','')}</div>
    <div class="dp-amount-lbl">${esc(linkUnit(l))} · ${esc(linkPeriod(l).toUpperCase())}${linkPublished(l) ? ` · PUBL. ${esc(linkPublished(l))}` : ''}</div>
    <div class="dp-divider"></div>
    <div class="dp-label">// TIPO DE FLUJO</div>
    <div style="display:inline-block;font-size:9px;letter-spacing:.2em;padding:4px 12px;
      color:${col};background:${col}12;border:1px solid ${col}40;margin-bottom:16px">${FLOW_LABELS[l.type]||l.type}</div>
    <div class="dp-label">// ANÁLISIS</div>
    <div class="dp-text">${esc(l.detail)}</div>
    <div class="dp-divider"></div>
    <div class="dp-label">// PROCEDENCIA</div>
    <div class="dp-text" style="font-size:11px">
      ${l.pending
        ? `<span style="color:var(--amber)">⚠ Pendiente de verificar.</span> ${esc(l.pending)}`
        : (l.sourceUrl
            ? `<a href="${safeHref(l.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan);text-decoration:none;border-bottom:1px solid rgba(0,255,200,.3)">${esc(linkSource(l))} ↗</a>`
            : esc(linkSource(l)))}
    </div>
    <div class="dp-divider"></div>
    <div class="dp-label">// PESO RELATIVO</div>
    <div class="dp-bars">
      <div class="dp-bar-row">
        <div class="dp-bar-label"><span>% de ${esc((BLOQUES.get(l.bloque)||{}).titulo || 'su bloque')}</span><span style="color:${col}">${pct.toFixed(1)}%</span></div>
        <div class="dp-bar-track"><div class="dp-bar-fill" style="width:${Math.min(100, pct).toFixed(0)}%;background:${col}"></div></div>
      </div>
    </div>`;
}

// Controls
function setFlow(btn, flow){
  activeFlow = flow;
  document.querySelectorAll('.flow-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  render();
}
function setRegion(btn, region){
  activeRegion = region;
  document.querySelectorAll('.reg-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  render();
}
function setThreshold(val){
  threshold = parseInt(val);
  document.getElementById('thresh-val').textContent = val+'B';
  render();
}

// Initial render + resize
// T12: el arranque lo hace src/pages/vector.js, no el propio motor.

export {
  NODES, ALL_LINKS, FLOW_COLORS, FLOW_LABELS,
  computeSankey, render, getNodeColor,
  showTooltip, hideTooltip, showNodeDetail, showLinkDetail,
  setFlow, setRegion, setThreshold,
  threshold,
};
