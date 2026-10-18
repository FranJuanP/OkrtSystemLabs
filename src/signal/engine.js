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
import {
  normalizarUSGS, normalizarEONET, normalizarGDELT, normalizarWHO,
  CONSULTAS_GDELT, urlGDELT, URLS, rehidratar,
} from './normalizar.js';

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
  /* ReliefWeb no se consulta.
     Su API v1, que es la que esta pagina usaba, devuelve 410 Gone ("The API
     version 'v1' has been decommissioned"), y la v2 responde 403 a cualquier
     appname que ReliefWeb no haya aprobado antes. Seguir llamandola solo
     servia para llenar la consola de errores y pintar un punto rojo que
     invita a esperar algo que no va a llegar por si solo.

     Se queda en la lista, en gris, como PENDIENTE DE AUTORIZACION, que es lo
     que de verdad ocurre: hace falta solicitar un appname en
     https://apidoc.reliefweb.int/ y ponerlo aqui. */
  relief: {
    name: 'ReliefWeb',
    row: 'ReliefWeb OCHA',
    pendiente: 'Pendiente de autorización de ReliefWeb',
    motivo: 'La API v1 está retirada (410) y la v2 exige un «appname» aprobado por ReliefWeb. '
          + 'Se solicita en https://apidoc.reliefweb.int/ y se pone en fetchReliefWeb().',
  },
  nasa:   { name: 'NASA EONET',     row: 'NASA EONET Events' },
  who:    { name: 'OMS',             row: 'OMS · Brotes (DON)' },
  /* GDACS ocupa el hueco que dejó ReliefWeb en la categoría HUMANITARIA.

     `servidor: true` quiere decir que esta página NO la consulta: la
     descarga el trabajo automático cada media hora y llega por
     data/events.json. No es un fallo ni una caída, así que su punto va en
     verde cuando el fichero trae sus eventos, y no en rojo como el de una
     fuente que no ha respondido. */
  gdacs: {
    name: 'GDACS',
    row: 'GDACS · Alertas (ONU/CE)',
    servidor: true,
    motivo: 'Alertas automáticas de GDACS (ONU y Comisión Europea), sin revisión humana previa. '
          + 'Se descargan en el proceso periódico, no desde el navegador.',
  },
};

/** Fuentes que no se consultan porque no se puede, con su motivo. */
const FUENTES_PENDIENTES = Object.entries(SOURCE_LABELS)
  .filter(([, m]) => m.pendiente)
  .map(([id]) => id);

const LAST_READING_PREFIX = 'aether.signal.lastReading.';
const LAST_READING_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

/**
 * Estado de una fuente: 'load' en vuelo, 'ok' respondió, 'err' falló,
 * 'pendiente' no se consulta porque no se puede.
 *
 * `detalle` permite decir algo más concreto que "sin conexión": el límite de
 * consultas de GDELT, por ejemplo, no es lo mismo que una caída.
 */
function setSrc(id, st, detalle) {
  const el = document.getElementById('src-'+id);
  if(el){ el.className = 'source-status ' + st; }
  const label = document.getElementById('srclbl-'+id);
  const meta = SOURCE_LABELS[id];
  if(label && meta){
    /* Una fuente retirada no esta "sin conexion": no hay nada que
       reintentar hasta que ReliefWeb apruebe un appname, asi que va en gris
       y lo dice. `detalle` permite ademas mensajes propios, como el limite
       de consultas de GDELT. */
    if(detalle) label.textContent = detalle;
    else if(st === 'pendiente') label.textContent = meta.pendiente || (meta.name + ' · pendiente');
    else if(st === 'err') label.textContent = 'Sin conexión con ' + meta.name;
    else label.textContent = meta.row;
    label.title = (st === 'pendiente' && meta.motivo) ? meta.motivo : '';
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

/**
 * Marca la fuente como viva, guarda la lectura y la devuelve.
 *
 * NOTA (correccion posterior): el service worker ya NO intercepta las
 * peticiones a otros origenes, asi que hoy nadie pone estas cabeceras y la
 * comprobacion no se dispara. Se mantiene a proposito: es la forma correcta
 * de tratar una respuesta servida de cache, y si algun dia se vuelve a
 * cachear una fuente, el feed seguira sin presentarla como recien traida.
 *
 * T18: el service worker puede servir una respuesta de su cache cuando la
 * red falla, y a nivel de `fetch` eso es indistinguible de una respuesta
 * recien traida. Si no se mirara, el feed pintaria datos viejos con el
 * punto de la fuente en verde, que es justo lo que T1 quito. Por eso el
 * service worker marca esas respuestas con X-AETHER-Cache y aqui se tratan
 * como lo que son: ultima lectura.
 *
 * @param {string} id
 * @param {Array} signals
 * @param {Response} [response] la respuesta, para mirar sus cabeceras
 */
function sourceOk(id, signals, response){
  const fromCache = response && response.headers && response.headers.get('X-AETHER-Cache') === 'hit';
  if(!fromCache){
    setSrc(id, 'ok');
    saveLastReading(id, signals);
    fuentesVivasEnEstaCarga++;
    return signals;
  }

  setSrc(id, 'err');
  const at = response.headers.get('X-AETHER-Cached-At');
  const fetchedAt = at ? new Date(at) : new Date();
  return signals.map(sig => Object.assign({}, sig, {
    isNew: false,
    stale: true,
    fetchedAt: isNaN(fetchedAt.getTime()) ? new Date() : fetchedAt,
  }));
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
  const delServidor = allSignals.filter(s => s && s.servidor).length;
  const stale = allSignals.filter(s => s && s.stale && !s.servidor).length;
  const live = total - stale - delServidor;
  let text = live + ' señales activas';
  if(stale) text += ' · ' + stale + ' de última lectura';
  if(delServidor) text += ' · ' + delServidor + ' del proceso periódico';
  // Mientras se consulta no se dice "sin señales": todavia no se sabe.
  if(!total) text = faseDeCarga === 'cargando' ? 'consultando fuentes…' : 'sin señales disponibles';
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
    const r = await fetch(URLS.usgs);
    const d = await r.json();
    return sourceOk('usgs', normalizarUSGS(d), r);
  } catch(e) { return sourceFailed('usgs'); }
}

// ── FETCH: NASA EONET natural events ──
async function fetchNASA() {
  try {
    const r = await fetch(URLS.eonet);
    const d = await r.json();
    return sourceOk('nasa', normalizarEONET(d), r);
  } catch(e) { return sourceFailed('nasa'); }
}

// ── FETCH: ReliefWeb Humanitarian ──
async function fetchReliefWeb() {
  /* No se hace ninguna petición: ver el comentario de SOURCE_LABELS.relief.
     Se devuelve la última lectura guardada si la hay, que son eventos reales
     que ReliefWeb sirvió cuando todavía respondía, marcados como tales. */
  setSrc('relief', 'pendiente');
  return loadLastReading('relief');
}

// ── FETCH: OMS · Disease Outbreak News ──
async function fetchWHO() {
  try {
    const r = await fetch(URLS.who);
    if(!r.ok) return sourceFailed('who');
    return sourceOk('who', normalizarWHO(await r.json()), r);
  } catch(e) { return sourceFailed('who'); }
}

// ── FETCH: GDELT via RSS proxy ──
/* GDELT pide una consulta cada cinco segundos.

   Se hacian las tres seguidas, sin esperar, y GDELT respondia 429:

     "Please limit requests to one every 5 seconds or contact ... for larger
      queries."

   Es decir, no era una caida de GDELT: era esta pagina pidiendo demasiado
   deprisa. Y el 429 de GDELT NO lleva Access-Control-Allow-Origin, asi que
   desde el navegador la peticion ni siquiera se puede leer: el fetch falla y
   lo unico que se sabe es que fallo.

   Ahora las tres consultas van espaciadas 5 s. Si una responde 429 -o falla
   justo despues de otra, que es como se manifiesta el limite cuando no se
   puede leer la respuesta-, se dice "limite de consultas, reintentando" y se
   reintenta UNA sola vez pasados 10 s. */
const GDELT_ESPERA_MS = 5000;
const GDELT_REINTENTO_MS = 10000;

/* La lista de consultas, el constructor de URL y la conversion a senales
   viven en src/signal/normalizar.js, que es el mismo modulo que usa el
   trabajo automatico de eventos: si vivieran en dos sitios, un cambio en el
   formato de GDELT se arreglaria en uno y no en el otro. Lo que si es propio
   del navegador, y se queda aqui, es el RITMO: cuanto se espera entre
   consultas y que hacer ante un limite. */

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Una consulta. Devuelve {senales} si fue bien, o {limite:true} si GDELT
 * dijo que no por exceso de peticiones.
 */
async function consultaGDELT(qi){
  try {
    const r = await fetch(urlGDELT(CONSULTAS_GDELT[qi].q));
    if(r.status === 429) return { limite: true };
    if(!r.ok) return { fallo: 'HTTP ' + r.status };
    const cacheada = r.headers && r.headers.get('X-AETHER-Cache') === 'hit';
    return { senales: normalizarGDELT(await r.json(), qi), respuesta: cacheada ? r : null };
  } catch(e) {
    /* No se puede leer la respuesta. El 429 de GDELT no lleva cabecera de
       CORS, asi que este es el aspecto que tiene su limite de consultas
       desde un navegador; tambien lo tendria una caida de red. No se afirma
       cual de las dos es: lo dice quien llama, segun el contexto. */
    return { ilegible: true };
  }
}

async function fetchGDELT() {
  let results = [];
  let gdeltResponse = null;
  let limitado = false;
  let ilegible = false;

  for(let qi=0; qi<CONSULTAS_GDELT.length; qi++){
    if(qi > 0) await esperar(GDELT_ESPERA_MS);
    const r = await consultaGDELT(qi);
    if(r.senales){
      results = results.concat(r.senales);
      if(r.respuesta) gdeltResponse = r.respuesta;
      continue;
    }
    /* Si una consulta no sale bien, no se insiste con las siguientes: o nos
       estan limitando -y pedir mas lo empeora- o no se llega a GDELT, y en
       ese caso esperar otros cinco segundos solo retrasa la pagina. */
    if(r.limite) limitado = true;
    else ilegible = true;
    break;
  }

  /* El 429 de GDELT no lleva cabecera de CORS, asi que desde el navegador un
     limite de consultas y una caida de red se ven igual: un fetch que falla.
     No se afirma cual es sin saberlo. Si el navegador dice que no hay red,
     es una caida; si dice que si la hay, lo mas probable con GDELT es el
     limite, y se reintenta UNA vez. */
  const sinRed = (typeof navigator !== 'undefined' && navigator.onLine === false);

  /* Si la peticion fallo sin poder leerse, antes de decidir el motivo se
     espera un momento a ver si las otras fuentes responden. GDELT puede
     fallar en el primer segundo, cuando USGS y EONET todavia estan en vuelo,
     y entonces "no ha respondido ninguna otra" no significa todavia nada. */
  if(ilegible && !sinRed && fuentesVivasEnEstaCarga === 0) await esperar(1500);

  // Si ninguna otra fuente ha respondido, lo que falla es la red, no GDELT:
  // decir "limite de consultas" ahi seria inventarse el motivo.
  const pareceLimite = limitado || (ilegible && !sinRed && fuentesVivasEnEstaCarga > 0);

  if(!results.length && pareceLimite){
    setSrc('gdelt', 'load', 'GDELT: límite de consultas, reintentando');
    await esperar(GDELT_REINTENTO_MS);
    const r = await consultaGDELT(0);
    if(r.senales){
      results = r.senales;
    } else {
      setSrc('gdelt', 'err', 'GDELT: límite de consultas alcanzado');
      return loadLastReading('gdelt');
    }
  }

  if(!results.length) return sourceFailed('gdelt');
  return sourceOk('gdelt', results, gdeltResponse);
}

// ── SYNTHETIC WHO-style health signals (real WHO RSS is CORS-blocked) ──
// Use hardcoded recent WHO Disease Outbreak News
/* T1 · getWHOSignals eliminada.
   Eran tres items escritos a mano con marcas de tiempo sinteticas
   (new Date(Date.now() - i*6h)), de modo que siempre parecian eventos de
   las ultimas 18 horas, y ademas pintaban src-who en verde sin existir
   ningun fetch detras. La categoria SALUD se sigue alimentando de
   ReliefWeb (disaster_type 'Epidemic'), que si es una fuente real. */

/* T24 · Lee data/events.json y devuelve los eventos de las fuentes que
   pide, marcados como ultima lectura del servidor.

   El fichero lo escribe .github/workflows/eventos.yml cada media hora con
   las mismas funciones de normalizacion que usa esta pagina
   (src/signal/normalizar.js), para que no puedan divergir. */
async function cargarEventosDelServidor(ids) {
  try {
    const url = new URL('data/events.json', document.baseURI).href;
    const r = await fetch(url, { credentials: 'omit' });
    if(!r.ok) return [];
    const d = await r.json();
    if(!d || !Array.isArray(d.eventos)) return [];
    const quiero = new Set(ids);
    const salida = [];
    for(const ev of d.eventos){
      if(!quiero.has(ev.fuente)) continue;
      const metaFuente = SOURCE_LABELS[ev.fuente];
      /* `servidor` distingue dos cosas que no son iguales: una fuente que ha
         fallado y de la que se rescata una lectura vieja, y una que SOLO se
         descarga en el proceso periodico porque asi esta disenada. Las dos
         llegan del fichero y ninguna es «en vivo», pero la segunda no esta
         degradada y el feed no debe rotularla como si lo estuviera. */
      salida.push(Object.assign(rehidratar(ev, d.descargado),
        metaFuente && metaFuente.servidor ? { servidor: true } : null));
      /* Una fuente pendiente de autorizacion sigue estandolo aunque el
         servidor tenga eventos suyos de cuando respondia: su punto se queda
         en gris, no pasa a rojo. Y una fuente que SOLO se descarga en el
         servidor -GDACS- esta funcionando: va en verde. */
      const meta = SOURCE_LABELS[ev.fuente];
      setSrc(ev.fuente,
        meta && meta.pendiente ? 'pendiente'
          : meta && meta.servidor ? 'ok'
            : 'err');
    }
    return salida;
  } catch(e) {
    // Sin fichero y sin red no hay nada que mostrar, y eso ya lo dice la
    // cabecera: SIN CONEXION con los puntos de fuente en rojo.
    return [];
  }
}

// ── LOAD ALL ──
/* Fase de la carga, que es lo que faltaba.

   El HTML venia con "FEED EN VIVO" y "LIVE" escritos como estado inicial, y
   updateFeedState() solo se llamaba AL FINAL de loadAll(). Entre que se abria
   la pagina y respondian las fuentes -en la web publicada, hasta medio
   minuto- la cabecera afirmaba estar en vivo sin haber consultado nada y con
   cero senales. Es el mismo defecto que se quito en T1, un paso mas atras.

   Ahora hay tres fases y la interfaz dice cual es:
     'cargando'  se esta consultando; punto gris, "CONECTANDO..."
     'vivo'      al menos una fuente respondio con datos de ahora
     'sin-red'   el primer intento termino y no hay nada en vivo  */
let faseDeCarga = 'cargando';

/* Cuanto se puede decir "CONECTANDO..." antes de reconocer que no hay nada.

   GDELT puede tardar hasta medio minuto entre el espaciado de sus consultas
   y el reintento. Dejar la cabecera en "CONECTANDO" todo ese rato seria otra
   forma de no decir lo que pasa: a los ocho segundos sin una sola senal en
   vivo, lo honesto es SIN CONEXION. Si una fuente lenta llega despues, la
   cabecera pasa a EN VIVO en ese momento. */
const ESPERA_MAXIMA_MS = 8000;
let relojDeEspera = null;

/* Cuantas fuentes han respondido con datos en la carga en curso.

   Sirve para una distincion que si no seria imposible: cuando una peticion a
   GDELT falla sin poder leerse, puede ser su limite de consultas o puede ser
   que no haya red. Si OTRAS fuentes si han respondido, la red funciona y lo
   que falla es GDELT; si no ha respondido ninguna, es la red. */
let fuentesVivasEnEstaCarga = 0;

async function loadAll() {
  faseDeCarga = 'cargando';
  allSignals = [];
  fuentesVivasEnEstaCarga = 0;
  clearTimeout(relojDeEspera);
  relojDeEspera = setTimeout(() => {
    if(faseDeCarga !== 'cargando') return;
    faseDeCarga = 'sin-red';
    updateFeedState();
    updateSignalCount();
    buildTicker();
  }, ESPERA_MAXIMA_MS);
  updateFeedState();
  updateSignalCount();
  document.getElementById('feed').innerHTML = `<div class="loading-row"><div class="spinner"></div><br>CONECTANDO CON FUENTES GLOBALES...</div>`;

  /* Las cuatro fuentes se consultan a la vez, pero NO se espera a todas para
     pintar. USGS y NASA contestan en un segundo; GDELT, con sus tres
     consultas espaciadas cinco segundos, tarda quince. Esperar a la mas
     lenta era dejar la pagina vacia todo ese rato teniendo ya eventos que
     mostrar. */
  const recibidas = [];
  const pintar = (senales) => {
    if(Array.isArray(senales) && senales.length) recibidas.push(...senales);

    /* En cuanto UNA fuente entrega datos de ahora, la carga deja de estar en
       el aire: ya hay feed en vivo, aunque las demas sigan en camino. Esperar
       a GDELT -que tarda quince segundos por el espaciado- para decirlo seria
       volver a dejar la cabecera muda teniendo ya eventos que mostrar. */
    if(faseDeCarga === 'cargando' && recibidas.some(x => x && !x.stale)) faseDeCarga = 'vivo';

    const vistos = new Set();
    allSignals = recibidas.filter(x => {
      const clave = String(x && x.title || '').slice(0,40).toLowerCase();
      if(!clave || vistos.has(clave)) return false;
      vistos.add(clave); return true;
    }).sort((a,b) => b.time - a.time);

    applyFilter();
    updateCounts();
    buildTicker();
    updateLastUpdate();
    updateSignalCount();
    updateFeedState();
  };

  const enCurso = [
    fetchUSGS(), fetchNASA(), fetchWHO(), fetchReliefWeb(), fetchGDELT(),
    /* GDACS no se consulta desde aqui: la descarga el proceso periodico. No
       es un respaldo de nada, asi que no espera a que las demas fallen; va
       con las otras y pinta en cuanto llega el fichero, que tarda menos que
       cualquier fuente externa.

       Y si el fichero no trae nada suyo -su descarga falla sin abortar el
       despliegue- hay que DECIRLO: sin esto su punto se quedaba girando
       indefinidamente, que es la version de «cargando» que nunca termina. */
    cargarEventosDelServidor(['gdacs']).then((evs) => {
      if(!evs.length) setSrc('gdacs', 'err', 'GDACS: sin lectura del proceso periódico');
      return evs;
    }),
  ].map(promesa => promesa.then(pintar).catch(err => {
    console.warn('AETHER Signal: una fuente ha fallado:', err);
  }));

  await Promise.all(enCurso);

  /* Caida al fichero del servidor.

     Si una fuente no ha dado nada desde el navegador, antes solo quedaba la
     ultima lectura guardada en ESTE navegador: quien entraba por primera vez
     con la fuente caida no veia nada suyo. Un trabajo automatico descarga los
     mismos eventos cada media hora y los deja en data/events.json, asi que
     hay una lectura reciente para todo el mundo.

     Importa mas desde que el service worker dejo de interceptar las fuentes:
     ya no hay copia en cache de sus respuestas, y este fichero es lo unico
     que queda. Los eventos entran marcados como ultima lectura, con la hora
     de la descarga del servidor; no se presentan como si fueran de ahora. */
  const porFuente = new Map();
  for(const x of recibidas){
    const id = String(x && x.source || '').toLowerCase();
    const clave = id.includes('usgs') ? 'usgs'
      : id.includes('eonet') || id.includes('nasa') ? 'nasa'
      : id.includes('gdelt') ? 'gdelt'
      : id.includes('oms') || id.includes('who') ? 'who'
      : id.includes('relief') ? 'relief'
        : id.includes('gdacs') ? 'gdacs' : null;
    if(clave) porFuente.set(clave, (porFuente.get(clave) || 0) + 1);
  }
  const vacias = ['usgs','nasa','who','gdelt','relief'].filter(id => !porFuente.get(id));
  if(vacias.length){
    const delServidor = await cargarEventosDelServidor(vacias);
    if(delServidor.length) pintar(delServidor);
  }

  // El primer intento ha terminado: a partir de aqui el estado ya no puede
  // ser "cargando", sea cual sea el resultado.
  clearTimeout(relojDeEspera);
  faseDeCarga = allSignals.some(x => x && !x.stale) ? 'vivo' : 'sin-red';
  pintar(null);

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
    /* Una fuente de proceso periodico ensena la fecha REAL del evento: no
       esta degradada, y poner en su lugar la hora de la descarga ocultaria
       cuando ocurrio de verdad, que es el dato. */
    const timeStr = s.servidor ? formatTime(s.time)
      : s.stale ? ('última lectura · ' + formatReadingDate(s.fetchedAt))
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
    if(faseDeCarga === 'cargando'){
      ti.style.animation = 'none';
      ti.innerHTML = `<span class="ticker-item"><div class="t-dot" style="background:var(--dim)"></div>Consultando fuentes…</span>`;
      return;
    }
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
    const prefix = s.servidor ? 'proceso periódico · ' : s.stale ? 'última lectura · ' : '';
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
  /* "FEED EN VIVO" solo si alguna fuente ha respondido CON DATOS en esta
     carga. Las senales marcadas como `stale` vienen de una lectura guardada,
     no de ahora, y mientras se esta consultando no se afirma nada. */
  const hayEnVivo = allSignals.some(s => s && !s.stale);
  const cargando = faseDeCarga === 'cargando';

  const badge = document.getElementById('feed-state');
  const dot   = document.getElementById('feed-state-dot');
  const label = document.getElementById('feed-state-label');

  const texto = cargando ? 'CONECTANDO…' : (hayEnVivo ? 'FEED EN VIVO' : 'SIN CONEXIÓN');
  if(label) label.textContent = texto;

  // Gris mientras se consulta, rojo si el intento acabo sin nada en vivo,
  // y el verde con pulso solo cuando hay datos de ahora.
  if(dot){
    dot.classList.toggle('cargando', cargando);
    dot.classList.toggle('offline', !cargando && !hayEnVivo);
  }
  if(badge){
    badge.classList.toggle('cargando', cargando);
    badge.classList.toggle('offline', !cargando && !hayEnVivo);
  }

  const tickerLabel = document.getElementById('ticker-state-label');
  if(tickerLabel){
    tickerLabel.textContent = cargando ? '⬡ CONECTANDO' : (hayEnVivo ? '⬡ LIVE' : '⬡ SIN CONEXIÓN');
    tickerLabel.classList.toggle('cargando', cargando);
    tickerLabel.classList.toggle('offline', !cargando && !hayEnVivo);
  }
}

export {
  SEV, CAT_COLOR, CAT_LABEL, SOURCE_LABELS,
  setSrc, loadAll, applyFilter, updateCounts, renderFeed, selectSignal,
  filterCat, sortBy, formatTime, buildTicker,
  updateLastUpdate, updateSignalCount, updateFeedState,
  saveLastReading, loadLastReading,
};
