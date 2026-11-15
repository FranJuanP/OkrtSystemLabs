/**
 * AETHER Globe · refuerzo funcional.
 *
 * Reordena los corredores por prioridad, pinta los puntos calientes y
 * enriquece el panel de país con las señales activas.
 *
 * T12: antes sustituía showGlobalArcs y envolvía showPanel y animate
 * reasignando variables del motor, con marcas como __gfPatched para no
 * hacerlo dos veces. Ahora usa los tres puntos de extensión que el motor
 * exporta: setGlobalArcsStrategy, registerAfterShowPanel y
 * registerBeforeFrame.
 */
import {
  setGlobalArcsStrategy, registerAfterShowPanel, registerBeforeFrame,
  deactivateAllArcs, arcObjects, activationTimers, currentArcFilter,
  COUNTRIES_DEDUP, TENSION_ARCS, pulseMeshes, markerData, showPanel,
} from './engine.js';
import { ISO_DE_ARCO } from './datos-globo.js';
import { safeUrl } from '../core/escape.js';
import {
  cargarEventos, agruparPorPais, haceCuanto, etiquetaFuente, HORAS_POR_DEFECTO,
} from '../core/eventos-pais.js';

function ready(fn){
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
  else fn();
}

const SEV_W = {critical:40, high:28, medium:18, low:10};
const RISK_W = {CRITICAL:26, HIGH:18, MEDIUM:10, LOW:4};
const TYPE_W = {CRITICAL:30, HIGH:22, SANCTION:16, ENERGY:14, ALLIANCE:12, PROXY:18};

/* ── Eventos recientes por país (fase eventos por país) ─────────────────

   Antes se leían de localStorage, de la clave 'aether_signal_events', que
   ningún módulo escribe: el mapa de señales salía siempre vacío. Además
   COUNTRIES_DEDUP, TENSION_ARCS y showPanel se consultaban como globales
   con `typeof`, y el motor ya es un módulo ES que no las publica en
   window, así que este refuerzo no llegaba a hacer nada.

   Ahora los eventos salen de data/events.json, con su país asignado en el
   despliegue (src/signal/paises.js), y las tablas se importan del motor. */
let porPais = new Map();
let lectura = { ok: false, eventos: [], descargado: null };

/** Nombres con los que se busca un país: el del Banco Mundial y los de los arcos. */
const NOMBRES_DE_ISO = new Map();
for (const c of COUNTRIES_DEDUP) NOMBRES_DE_ISO.set(c.iso, [c.name]);
for (const [nombre, iso] of Object.entries(ISO_DE_ARCO)) {
  if (!NOMBRES_DE_ISO.has(iso)) NOMBRES_DE_ISO.set(iso, []);
  if (!NOMBRES_DE_ISO.get(iso).includes(nombre)) NOMBRES_DE_ISO.get(iso).push(nombre);
}

async function refrescarEventos(){
  lectura = await cargarEventos();
  porPais = agruparPorPais(lectura.eventos);
}

function buildCountrySignalMap(){
  const map = new Map();
  for (const [iso, eventos] of porPais) {
    const entry = { iso, count: eventos.length, maxSeverity: 0, latest: 0, cats: new Set(), eventos };
    for (const ev of eventos) {
      entry.maxSeverity = Math.max(entry.maxSeverity, SEV_W[String(ev.severity || '').toLowerCase()] || 12);
      entry.latest = Math.max(entry.latest, new Date(ev.time).getTime() || 0);
      if (ev.cat) entry.cats.add(ev.cat);
    }
    for (const nombre of NOMBRES_DE_ISO.get(iso) || []) map.set(nombre, entry);
  }
  return map;
}

/* En escritorio la lista va dentro del bloque PRIORITARIOS, debajo de su
   lista: antes se añadía a #arc-controls y en escritorio quedaba encima de
   ese bloque. En pantallas estrechas PRIORITARIOS se oculta, y entonces
   vuelve a #arc-controls como antes. */
function ensureHotspotBox(){
  const desk = document.getElementById('desktop-hotspots');
  const enEscritorio = !!(desk && desk.offsetParent !== null);
  const host = enEscritorio ? desk : (document.getElementById('arc-controls') || document.body);
  let box = document.getElementById('globe-hotspots');
  if(!box){
    box = document.createElement('div');
    box.id = 'globe-hotspots';
    box.innerHTML = '<div class="gh-title">// EVENTOS RECIENTES · ' + HORAS_POR_DEFECTO + ' H</div><div id="globe-hotspots-list"></div>';
  }
  if(box.parentNode !== host) host.appendChild(box);
  box.classList.toggle('gh-en-prioritarios', enEscritorio);
  return box;
}

function computeCountryPriority(name, signalMap){
  const sig = signalMap.get(name);
  const country = COUNTRIES_DEDUP.find(c => c.name === name)
    || (ISO_DE_ARCO[name] ? COUNTRIES_DEDUP.find(c => c.iso === ISO_DE_ARCO[name]) : null);
  const baseRisk = country ? (RISK_W[country.risk] || 0) : 0;
  const nombres = country ? (NOMBRES_DE_ISO.get(country.iso) || [name]) : [name];
  const connected = TENSION_ARCS.filter(a => nombres.includes(a.a) || nombres.includes(a.b)).length;
  const freshness = sig ? Math.max(0, 12 - Math.min(12, (Date.now() - sig.latest)/(60*60*1000))) : 0;
  return baseRisk + connected * 2 + (sig ? sig.count * 10 + sig.maxSeverity + freshness : 0);
}

function renderHotspots(){
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
  /* Solo los que tienen eventos: el nivel de riesgo ya lo enseña la
     lista PRIORITARIOS del motor, y repetirla aquí no añade nada. */
  .filter(r => r.signals > 0)
  .sort((a,b)=>b.score-a.score)
  /* Dentro de PRIORITARIOS el espacio lo marca la leyenda de abajo: con
     menos de 960 px de alto solo caben dos filas sin pisarla. */
  .slice(0, !box.classList.contains('gh-en-prioritarios') ? 5 : innerHeight >= 960 ? 3 : 2);

  list.replaceChildren();
  rows.forEach((row, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'gh-item';
    item.innerHTML = '<span class="gh-rank">0'+(idx+1)+'</span>'+
      '<span class="gh-name">'+row.name.toUpperCase()+'</span>'+
      '<span class="gh-meta">'+(row.signals === 1 ? '1 evento' : row.signals+' eventos')+'</span>';
    item.addEventListener('click', function(){
      const country = COUNTRIES_DEDUP.find(c => c.name === row.name);
      if(country) showPanel(country);
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

function installGlobalArcsStrategy(){
  setGlobalArcsStrategy(function(){
    deactivateAllArcs();
    const signalMap = buildCountrySignalMap();
    const filtered = arcObjects.filter(ao => !currentArcFilter || ao.data.type === currentArcFilter)
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
  });
}

function installPanelEnrichment(){
  registerAfterShowPanel(function(c){
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

      pintarEventosDelPais(c, selected);

      Array.from(document.querySelectorAll('#arcList .arc-row')).forEach(row => {
        const other = (row.querySelector('.arc-name')?.textContent || '').replace('↔','').trim();
        const data = signalMap.get(other);
        row.querySelector('.arc-heat-badge')?.remove();
        if(data){
          const badge = document.createElement('span');
          badge.className = 'arc-heat-badge';
          badge.textContent = data.count+(data.count>1?' eventos':' evento');
          row.querySelector('.arc-head')?.appendChild(badge);
        }
      });
    } catch(_e){}
  });
}

function pulseHotCountries(){
  const signalMap = buildCountrySignalMap();
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

function installHotspotRefresh(){
  let lastHotspotRefresh = 0;
  registerBeforeFrame(function(){
    const now = Date.now();
    if(now - lastHotspotRefresh > 15000){
      renderHotspots();
      pulseHotCountries();
      lastHotspotRefresh = now;
    }
  });
}

/* Bloque del panel con los eventos del país: cuántos, de qué fuentes y los
   cinco más recientes con su enlace. Todo con textContent: los títulos
   vienen de fuentes externas. */
function pintarEventosDelPais(c, selected){
  const coords = document.getElementById('pCoords');
  if(!coords) return;
  let box = document.getElementById('globe-signal-badge');
  if(!box){
    box = document.createElement('div');
    box.id = 'globe-signal-badge';
    box.className = 'globe-signal-badge';
    coords.parentNode.insertBefore(box, coords.nextSibling);
  }
  box.replaceChildren();

  const cab = document.createElement('div');
  cab.className = 'gsb-head';
  if(!lectura.ok){
    cab.textContent = 'EVENTOS · SIN LECTURA DEL PROCESO PERIÓDICO';
    box.appendChild(cab);
    return;
  }
  if(!selected){
    cab.textContent = 'SIN EVENTOS EN LAS ÚLTIMAS ' + HORAS_POR_DEFECTO + ' H';
    box.appendChild(cab);
    return;
  }
  cab.textContent = 'EVENTOS · ' + HORAS_POR_DEFECTO + ' H: ' + selected.count
    + ' · CATEGORÍAS: ' + selected.cats.size;
  box.appendChild(cab);

  const lista = document.createElement('ul');
  lista.className = 'gsb-list';
  for (const ev of selected.eventos.slice(0, 5)) {
    const li = document.createElement('li');
    const meta = document.createElement('span');
    meta.className = 'gsb-meta';
    meta.textContent = etiquetaFuente(ev) + ' · ' + haceCuanto(ev.time);
    const url = safeUrl(ev.url);
    const titulo = document.createElement(url ? 'a' : 'span');
    titulo.className = 'gsb-title';
    titulo.textContent = ev.title || '—';
    if(url){ titulo.href = url; titulo.target = '_blank'; titulo.rel = 'noopener noreferrer'; }
    li.append(meta, titulo);
    lista.appendChild(li);
  }
  box.appendChild(lista);

  if(lectura.descargado){
    const pie = document.createElement('div');
    pie.className = 'gsb-foot';
    pie.textContent = 'Lectura de ' + lectura.descargado.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    }) + ' · GDELT no se asigna a países';
    box.appendChild(pie);
  }
}

function boot(){
  installGlobalArcsStrategy();
  installPanelEnrichment();
  installHotspotRefresh();
  renderHotspots();
  pulseHotCountries();
  // Los datos del país ya están (el motor espera a latest.json); los
  // eventos llegan después y se repintan al llegar.
  refrescarEventos().then(() => {
    renderHotspots();
    pulseHotCountries();
  });
}

ready(boot);
