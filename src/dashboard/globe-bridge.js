/**
 * AETHER · puente de contexto entre el dashboard y el globo.
 *
 * T12: módulo ES. Antes era un IIFE que se comunicaba con el resto por
 * variables globales; ahora las dependencias son imports explícitos.
 */
import { AETHER_STORAGE } from '../core/storage.js';
function $(id){ return document.getElementById(id); }
// T7: escribe a traves del contrato, que valida el esquema de la clave.
function safeSet(k,v){
  AETHER_STORAGE.set(k, v);
}
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
  safeSet('aether_horizon', ctx.horizon);
  return ctx;
};
/** La página del globo, con una marca de tiempo para no servir una copia. */
function urlDelGlobo(){
  return 'aether-globe-v3.html?ctx=' + Date.now();
}

/**
 * Abre el globo. Pase lo que pase.
 *
 * Tenía dos formas de no hacer nada, las dos silenciosas:
 *
 * 1. `syncAetherGlobeBridge()` se llamaba SIN proteger. Si lanzaba —y puede:
 *    lee `window.computeRegionProfile`, que vive en el motor del panel— la
 *    excepción salía de aquí y `window.open` no llegaba a ejecutarse. El
 *    botón quedaba muerto y la única pista era un error de consola que nadie
 *    relaciona con el botón. Pasar el contexto es una MEJORA: que falle
 *    justifica abrir el globo sin contexto, no no abrirlo.
 *
 * 2. Si el navegador bloquea la ventana emergente, `window.open` devuelve
 *    `null` y no lanza nada. Ahí no había ni error de consola: el usuario
 *    pulsaba y no ocurría absolutamente nada. Ahora se navega en la misma
 *    pestaña, que es lo que la persona pidió.
 */
export function openAetherGlobe(){
  try {
    window.syncAetherGlobeBridge();
  } catch (err) {
    console.error('[AETHER] el contexto para el globo no se pudo preparar; '
      + 'se abre igualmente, sin él:', err);
  }

  /* Sin 'noopener' en las opciones, A PROPOSITO.

     Con esa opcion `window.open` devuelve `null` SIEMPRE, por especificacion,
     haya abierto la pestaña o no. Es decir: no hay forma de distinguir el
     exito del bloqueo, y el primer intento de este arreglo acababa navegando
     la pestaña actual ADEMAS de abrir la nueva, en todos los casos.

     El aislamiento se consigue igual poniendo `opener` a null a continuacion,
     que es lo que ya intentaba el codigo anterior —y que con 'noopener' nunca
     llegaba a ejecutarse, porque `w` era null—. La pagina de destino es una
     nuestra y del mismo origen, asi que no hay nada que aislar de un tercero. */
  let w = null;
  try {
    w = window.open(urlDelGlobo(), '_blank');
  } catch (err) {
    console.error('[AETHER] window.open ha fallado:', err);
  }

  if (w) { try { w.opener = null; } catch(e){} return w; }

  /* Emergente bloqueada. Antes el botón no hacía nada; ahora el globo se abre
     en esta misma pestaña, que es peor que una pestaña nueva pero
     incomparablemente mejor que nada. */
  console.warn('[AETHER] ventana emergente bloqueada; el globo se abre en esta pestaña.');
  window.location.href = urlDelGlobo();
  return null;
}
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
