/**
 * AETHER SIGNAL · refuerzo del feed
 *
 * Consolida duplicados y añade eventos de fuentes adicionales reales
 * (USGS, EONET, ReliefWeb) cuando una categoría se queda corta.
 *
 * T1 le quitó todo lo que fabricaba señales: las semillas fijas firmadas
 * "AETHER Continuity", la función que las disfrazaba y el pintado forzado
 * de los puntos de estado.
 *
 * T12: era un IIFE que leía y reescribía las globales `allSignals` y
 * `filtered` del motor, y sustituía `loadAll` por una versión envuelta.
 * Ahora usa los accesores del motor y se engancha con registerAfterLoad.
 */
import {
  getAllSignals, setAllSignals, setFiltered,
  loadAll, applyFilter, renderFeed, buildTicker,
  setSrc, updateSignalCount, updateFeedState,
  registerAfterLoad,
} from './engine.js';


const TARGET_TOTAL = 24;
const CHECK_INTERVAL_MS = 30000;
const DUPLICATE_WINDOW_HOURS = 36;
const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };




const SHADOW_FETCH_TIMEOUT_MS = 7000;
const SHADOW_SOURCE_LIMIT = 6;
const shadowHealth = Object.create(null);
const shadowSources = [
  {
    id: 'src-usgs',
    cat: 'seismic',
    name: 'USGS GeoJSON Feed',
    urls: [
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson'
    ],
    parse(data) {
      const features = Array.isArray(data && data.features) ? data.features : [];
      return features.slice(0, SHADOW_SOURCE_LIMIT).map((feature, idx) => {
        const props = feature && feature.properties || {};
        const coords = Array.isArray(feature && feature.geometry && feature.geometry.coordinates) ? feature.geometry.coordinates : [];
        const mag = Number(props.mag);
        const place = props.place || 'Actividad sísmica global';
        return {
          id: `shadow_usgs_${props.code || idx}`,
          cat: 'seismic',
          severity: mag >= 6 ? 'HIGH' : (mag >= 4.5 ? 'MEDIUM' : 'LOW'),
          source: 'USGS GeoJSON Feed',
          title: props.title || `Evento sísmico ${place}`,
          location: place,
          time: new Date(props.time || Date.now()),
          summary: `Magnitud ${Number.isFinite(mag) ? mag.toFixed(1) : 'n/d'} · profundidad ${Number.isFinite(coords[2]) ? coords[2] + ' km' : 'n/d'} · actualización automática desde USGS.`,
          impacts: {
            Seismic: String(Math.max(45, Math.min(92, Math.round((Number.isFinite(mag) ? mag : 3.5) * 12)))) ,
            Infrastructure: String(Math.max(30, Math.min(88, Math.round((Number.isFinite(mag) ? mag : 3.5) * 10)))),
            Preparedness: String(mag >= 6 ? 81 : (mag >= 4.5 ? 63 : 44))
          },
          url: props.url || ''
        };
      });
    }
  },
  {
    id: 'src-nasa',
    cat: 'climate',
    name: 'NASA EONET',
    urls: [
      'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?limit=12&days=20&status=open',
      'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?limit=12&days=30'
    ],
    parse(data) {
      const features = Array.isArray(data && data.features) ? data.features : [];
      return features.slice(0, SHADOW_SOURCE_LIMIT).map((feature, idx) => {
        const props = feature && feature.properties || {};
        const categories = Array.isArray(props.categories) ? props.categories.map(c => c && c.title).filter(Boolean) : [];
        const title = props.title || `Evento natural ${idx+1}`;
        const firstCategory = String(categories[0] || '').toLowerCase();
        const cat = /fire|wildfire|volcano|severe storms?|flood|dust/i.test(firstCategory) ? 'climate' : 'geo';
        return {
          id: `shadow_eonet_${feature && feature.id || idx}`,
          cat,
          severity: /volcano|severe storms?|flood|wildfire/i.test(firstCategory) ? 'HIGH' : 'MEDIUM',
          source: 'NASA EONET',
          title,
          location: Array.isArray(feature && feature.geometry) && feature.geometry[0] && Array.isArray(feature.geometry[0].coordinates)
            ? `Lat ${Number(feature.geometry[0].coordinates[1]).toFixed(2)} / Lon ${Number(feature.geometry[0].coordinates[0]).toFixed(2)}`
            : 'Evento natural global',
          time: new Date(props.updated || props.closed || Date.now()),
          summary: `${title}. Categorías: ${categories.join(', ') || 'evento natural'} · seguimiento reforzado desde EONET.`,
          impacts: cat === 'climate'
            ? { Climate: '74', Logistics: '53', Risk: '58' }
            : { Diplomacy: '42', Stability: '47', Risk: '55' },
          url: props.sources && props.sources[0] && props.sources[0].url ? props.sources[0].url : ''
        };
      });
    }
  },
  /* La fuente en la sombra de ReliefWeb se retira.

     Llamaba a la API v2 con appname=aether, que ReliefWeb no ha aprobado,
     y respondia 403 en cada carga: dos peticiones mas por visita que no
     podian funcionar. Vuelve cuando haya un appname aprobado; el motivo
     esta en SOURCE_LABELS.relief del motor. */
];

function setSourceStatus(id, state) {
  // Delega en el motor de la pagina para que la fila muestre tambien
  // "Sin conexion con <fuente>" cuando el fetch real ha fallado.
  const shortId = String(id).replace(/^src-/, '');
  if (typeof setSrc === 'function') { setSrc(shortId, state); return; }
  const dot = document.getElementById(id);
  if (!dot) return;
  dot.classList.remove('load', 'ok', 'err');
  dot.classList.add(state);
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store', signal: controller ? controller.signal : undefined });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    // El service worker ya no intercepta otros origenes, asi que hoy nadie
    // pone esta cabecera. Se deja por lo mismo que en el motor: si se
    // vuelve a cachear una fuente, esto ya la trata como ultima lectura.
    // T18: el service worker marca con X-AETHER-Cache lo que sirve de su
    // cache cuando la red falla. Hay que mirarlo: si no, estas fuentes
    // pintarian su punto en verde con datos viejos y pisarian el estado
    // que el motor acaba de poner bien.
    return {
      data,
      fromCache: response.headers.get('X-AETHER-Cache') === 'hit',
      cachedAt: response.headers.get('X-AETHER-Cached-At'),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchShadowSource(source) {
  setSourceStatus(source.id, 'load');
  let lastError = null;
  for (const url of source.urls) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const bust = url + (url.includes('?') ? '&' : '?') + 'aether_retry=' + attempt + '&t=' + Date.now();
        const res = await fetchJsonWithTimeout(bust, SHADOW_FETCH_TIMEOUT_MS + (attempt * 1500));
        const events = source.parse(res.data).filter(Boolean);
        if (events.length) {
          shadowHealth[source.id] = { ok: !res.fromCache, count: events.length, ts: Date.now(), source: source.name };
          // Si vino de la cache del service worker, la fuente NO esta viva y
          // sus eventos son ultima lectura, no del momento.
          setSourceStatus(source.id, res.fromCache ? 'err' : 'ok');
          if (!res.fromCache) return events;
          const at = res.cachedAt ? new Date(res.cachedAt) : new Date();
          return events.map(ev => Object.assign({}, ev, {
            isNew: false,
            stale: true,
            fetchedAt: isNaN(at.getTime()) ? new Date() : at,
          }));
        }
      } catch (err) {
        lastError = err;
      }
    }
  }
  shadowHealth[source.id] = { ok: false, count: 0, ts: Date.now(), source: source.name, error: String(lastError && lastError.message || lastError || 'unknown') };
  setSourceStatus(source.id, 'err');
  return [];
}

function mergeShadowSignals(events) {
  if (!Array.isArray(events) || !events.length) return 0;
  const knownKeys = new Set((Array.isArray(getAllSignals()) ? getAllSignals() : []).map(eventKey));
  let added = 0;
  for (const event of events) {
    const key = eventKey(event);
    if (!key || knownKeys.has(key)) continue;
    knownKeys.add(key);
    getAllSignals().push(event);
    added += 1;
  }
  return added;
}

async function enrichFromShadowSources() {
  if (!Array.isArray(getAllSignals())) return { added: 0, fetched: 0 };
  const counts = categoryCounts(getAllSignals());
  const wanted = shadowSources.filter(source => (counts[source.cat] || 0) < 3 || getAllSignals().length < TARGET_TOTAL + 4);
  if (!wanted.length) return { added: 0, fetched: 0 };
  const batches = await Promise.allSettled(wanted.map(fetchShadowSource));
  let fetched = 0;
  let added = 0;
  for (const result of batches) {
    if (result.status !== 'fulfilled') continue;
    fetched += result.value.length;
    added += mergeShadowSignals(result.value);
  }
  if (added > 0) {
    const consolidated = consolidateSignals();
    setAllSignals(sortSignalsQuality(getAllSignals()));
    setFiltered(getAllSignals().slice());
    return { added, fetched, merged: consolidated.merged || 0 };
  }
  return { added: 0, fetched };
}

function cloneDeep(obj) {
  try { return structuredClone(obj); } catch (_) {
    return JSON.parse(JSON.stringify(obj));
  }
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeKey(value)
    .split(/\s+/)
    .filter(token => token && token.length > 2 && !/^(the|and|for|with|las|los|una|unos|unas|del|por|para|sobre|tras|into|from)$/.test(token));
}

function tokenSet(value) {
  return new Set(tokenize(value));
}

function tokenOverlapScore(a, b) {
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  if (!aSet.size || !bSet.size) return 0;
  let overlap = 0;
  for (const token of aSet) if (bSet.has(token)) overlap += 1;
  return overlap / Math.max(aSet.size, bSet.size);
}

function eventKey(evt) {
  return [normalizeKey(evt.title), normalizeKey(evt.cat), normalizeKey(evt.location)].join('|');
}

function categoryCounts(items) {
  const counts = Object.create(null);
  for (const item of items) counts[item.cat] = (counts[item.cat] || 0) + 1;
  return counts;
}

function asTimestamp(value) {
  if (!value) return 0;
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function sortSignalsStable(items) {
  return items.slice().sort((a, b) => {
    const timeA = asTimestamp(a && a.time);
    const timeB = asTimestamp(b && b.time);
    if (timeB !== timeA) return timeB - timeA;
    const sevA = severityRank[a && a.severity] || 0;
    const sevB = severityRank[b && b.severity] || 0;
    if (sevB !== sevA) return sevB - sevA;
    return String(a && a.title || '').localeCompare(String(b && b.title || ''));
  });
}

function scoreSignal(signal) {
  const recencyHours = Math.max(0, (Date.now() - asTimestamp(signal && signal.time)) / 3600000);
  const severity = severityRank[signal && signal.severity] || 0;
  const impacts = signal && typeof signal.impacts === 'object' && signal.impacts ? Object.keys(signal.impacts).length : 0;
  const hasUrl = signal && signal.url ? 1 : 0;
  const bodyLength = Math.min(240, String(extractLongText(signal) || '').length);
  const sourceBoost = /usgs|nasa|relief|who|gdelt/i.test(String(signal && signal.source || '')) ? 0.5 : 0;
  return (severity * 100) + Math.max(0, 48 - recencyHours) + (impacts * 3) + (hasUrl * 4) + (bodyLength / 80) + sourceBoost;
}

function sortSignalsQuality(items) {
  return items.slice().sort((a, b) => {
    const scoreDiff = scoreSignal(b) - scoreSignal(a);
    if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
    return sortSignalsStable([a, b])[0] === a ? -1 : 1;
  });
}


function findLongTextKey(template) {
  if (!template || typeof template !== 'object') return null;
  const skip = new Set(['id', 'title', 'source', 'location', 'severity', 'cat', 'url']);
  let bestKey = null;
  let bestLen = 0;
  for (const [key, value] of Object.entries(template)) {
    if (skip.has(key)) continue;
    if (typeof value !== 'string') continue;
    if (value.length > bestLen) {
      bestLen = value.length;
      bestKey = key;
    }
  }
  return bestLen >= 40 ? bestKey : null;
}

function findImpactsKey(template) {
  if (!template || typeof template !== 'object') return null;
  for (const [key, value] of Object.entries(template)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const keys = Object.keys(value);
    if (!keys.length || keys.length > 8) continue;
    const numericish = keys.filter(k => /\d/.test(String(value[k])) || typeof value[k] === 'number');
    if (numericish.length >= Math.max(1, Math.floor(keys.length / 2))) return key;
  }
  return null;
}


function extractLongText(signal) {
  if (!signal || typeof signal !== 'object') return '';
  const preferredKeys = ['summary', 'body', 'description', 'detail', 'details', 'text', 'content'];
  for (const key of preferredKeys) {
    if (typeof signal[key] === 'string' && signal[key].length > 20) return signal[key];
  }
  const dynamicKey = findLongTextKey(signal);
  return dynamicKey ? String(signal[dynamicKey] || '') : '';
}

function mergeImpacts(baseImpacts, nextImpacts) {
  const result = Object.assign({}, baseImpacts || {});
  for (const [key, value] of Object.entries(nextImpacts || {})) {
    if (!(key in result)) {
      result[key] = value;
      continue;
    }
    const currentNum = Number(String(result[key]).replace(/[^\d.-]/g, ''));
    const nextNum = Number(String(value).replace(/[^\d.-]/g, ''));
    if (Number.isFinite(currentNum) && Number.isFinite(nextNum)) result[key] = String(Math.max(currentNum, nextNum));
    else if (String(value).length > String(result[key]).length) result[key] = value;
  }
  return result;
}

function areEventsNearDuplicate(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (normalizeKey(a.cat) !== normalizeKey(b.cat)) return false;
  const timeDiffHours = Math.abs(asTimestamp(a.time) - asTimestamp(b.time)) / 3600000;
  if (timeDiffHours > DUPLICATE_WINDOW_HOURS) return false;

  const titleA = normalizeKey(a.title);
  const titleB = normalizeKey(b.title);
  const locationA = normalizeKey(a.location);
  const locationB = normalizeKey(b.location);
  const sourceA = normalizeKey(a.source);
  const sourceB = normalizeKey(b.source);

  if (titleA && titleA === titleB && locationA === locationB) return true;
  if (titleA && titleB && (titleA.includes(titleB) || titleB.includes(titleA)) && locationA === locationB) return true;

  const titleOverlap = tokenOverlapScore(a.title, b.title);
  const bodyOverlap = tokenOverlapScore(extractLongText(a), extractLongText(b));
  const sameLocationFamily = !!locationA && !!locationB && (locationA === locationB || locationA.includes(locationB) || locationB.includes(locationA));
  const sameSourceFamily = !!sourceA && !!sourceB && (sourceA === sourceB || sourceA.includes(sourceB) || sourceB.includes(sourceA));

  if (sameLocationFamily && titleOverlap >= 0.45) return true;
  if (sameSourceFamily && titleOverlap >= 0.72) return true;
  if (sameLocationFamily && bodyOverlap >= 0.58 && titleOverlap >= 0.25) return true;

  return false;
}

function mergePair(primary, secondary) {
  const merged = cloneDeep(primary || {});
  const mergedTime = Math.max(asTimestamp(primary && primary.time), asTimestamp(secondary && secondary.time));
  merged.time = mergedTime ? new Date(mergedTime) : (primary && primary.time) || (secondary && secondary.time) || new Date();

  if ((severityRank[secondary && secondary.severity] || 0) > (severityRank[primary && primary.severity] || 0)) {
    merged.severity = secondary.severity;
  }

  const primaryText = extractLongText(primary);
  const secondaryText = extractLongText(secondary);
  const textKey = findLongTextKey(primary) || findLongTextKey(secondary) || 'summary';
  merged[textKey] = secondaryText.length > primaryText.length ? secondaryText : primaryText;

  merged.source = String(primary && primary.source || '').length >= String(secondary && secondary.source || '').length
    ? (primary && primary.source) : (secondary && secondary.source);
  merged.location = String(primary && primary.location || '').length >= String(secondary && secondary.location || '').length
    ? (primary && primary.location) : (secondary && secondary.location);
  merged.title = String(primary && primary.title || '').length >= String(secondary && secondary.title || '').length
    ? (primary && primary.title) : (secondary && secondary.title);
  merged.url = primary && primary.url ? primary.url : (secondary && secondary.url) || '';

  const impactsKey = findImpactsKey(primary) || findImpactsKey(secondary) || 'impacts';
  merged[impactsKey] = mergeImpacts(primary && primary[impactsKey], secondary && secondary[impactsKey]);

  merged._mergedSources = Array.from(new Set([
    ...(Array.isArray(primary && primary._mergedSources) ? primary._mergedSources : [primary && primary.source].filter(Boolean)),
    ...(Array.isArray(secondary && secondary._mergedSources) ? secondary._mergedSources : [secondary && secondary.source].filter(Boolean))
  ]));
  merged._mergeCount = (primary && primary._mergeCount || 1) + (secondary && secondary._mergeCount || 1);
  return merged;
}

function consolidateSignals() {
  if (!Array.isArray(getAllSignals()) || !getAllSignals().length) return { changed: false, merged: 0 };
  const sorted = sortSignalsStable(getAllSignals());
  const unique = [];
  let mergedCount = 0;

  for (const item of sorted) {
    if (!item || !item.title) continue;
    const directKey = eventKey(item);
    const directIndex = unique.findIndex(existing => eventKey(existing) === directKey);
    if (directIndex >= 0) {
      unique[directIndex] = mergePair(unique[directIndex], item);
      mergedCount += 1;
      continue;
    }
    const nearIndex = unique.findIndex(existing => areEventsNearDuplicate(existing, item));
    if (nearIndex >= 0) {
      unique[nearIndex] = mergePair(unique[nearIndex], item);
      mergedCount += 1;
    } else {
      unique.push(cloneDeep(item));
    }
  }

  const changed = mergedCount > 0 || unique.length !== getAllSignals().length;
  setAllSignals(sortSignalsQuality(unique));
  setFiltered(getAllSignals().slice());
  return { changed, merged: mergedCount };
}



/**
 * Hora de la ultima actualizacion, en UTC de verdad.
 * Antes se componia con toLocaleTimeString() sin zona y se le pegaba el
 * sufijo " UTC", asi que un navegador en Madrid rotulaba las 12:00 UTC
 * como "14:00 UTC". Ahora se fuerza timeZone: 'UTC'.
 */
function annotateUpdate(mergedCount, shadowAdded) {
  const el = document.getElementById('last-update');
  if (!el) return;
  const base = new Date().toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'UTC'
  });
  const notes = [];
  if (shadowAdded > 0) notes.push(`${shadowAdded} evento${shadowAdded === 1 ? '' : 's'} nuevo${shadowAdded === 1 ? '' : 's'}`);
  if (mergedCount > 0) notes.push('duplicados consolidados');
  el.textContent = `${base} UTC${notes.length ? ' · ' + notes.join(' · ') : ''}`;
}



function rerenderSignalModule() {
  try {
    if (typeof applyFilter === 'function') applyFilter();
    else if (typeof renderFeed === 'function') renderFeed();
    if (typeof buildTicker === 'function') buildTicker();
  } catch (err) {
    console.warn('AETHER Signal boost rerender warning:', err);
  }
}

async function processSignals() {
  const consolidated = consolidateSignals();
  const shadow = await enrichFromShadowSources();
  setAllSignals(sortSignalsQuality(getAllSignals()));
  setFiltered(getAllSignals().slice());
  const merged = (consolidated.merged || 0) + (shadow.merged || 0);
  annotateUpdate(merged, shadow.added || 0);
  // El contador de cabecera lo mantiene el motor de la pagina, que ya solo
  // cuenta eventos reales y separa los que vienen de una ultima lectura.
  if (typeof updateSignalCount === 'function') updateSignalCount();
  if (typeof updateFeedState === 'function') updateFeedState();
  return {
    changed: consolidated.changed || (shadow.added || 0) > 0,
    merged: merged,
    shadowAdded: shadow.added || 0,
    shadowFetched: shadow.fetched || 0
  };
}


/**
 * Engancha el refuerzo al motor.
 *
 * Antes sustituia loadAll por una version envuelta; ahora se registra como
 * hook posterior a la carga, que el motor llama al terminar. El efecto es
 * el mismo y no se parchea nada.
 */
export function installSignalBoost() {
  registerAfterLoad(async () => {
    await processSignals();
    rerenderSignalModule();
  });

  // Mantenimiento periodico: consolidar duplicados y refrescar las fuentes
  // adicionales sin volver a cargarlo todo.
  setInterval(() => {
    processSignals()
      .then((result) => { if (result.changed) rerenderSignalModule(); })
      .catch((err) => console.warn('AETHER Signal: mantenimiento fallido:', err));
  }, CHECK_INTERVAL_MS);
}
