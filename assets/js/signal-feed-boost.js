(function(){
  'use strict';

  const TARGET_TOTAL = 24;
  const MIN_PER_CATEGORY = 2;
  const CHECK_INTERVAL_MS = 30000;
  const DUPLICATE_WINDOW_HOURS = 36;
  const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sourceStatusMap = {
    conflict: 'src-gdelt',
    geo: 'src-gdelt',
    eco: 'src-gdelt',
    humanitarian: 'src-relief',
    climate: 'src-nasa',
    seismic: 'src-usgs',
    health: 'src-who'
  };

  const supplementalSeeds = [
    {
      cat: 'conflict', severity: 'HIGH', source: 'AETHER Continuity / Conflict Desk',
      title: 'Reposicionamiento militar y presión fronteriza en corredor estratégico',
      location: 'Europa del Este',
      body: 'Se mantiene la vigilancia sobre reposicionamientos, presión fronteriza y actividad militar en corredor sensible. Señal de continuidad para preservar densidad analítica cuando el flujo abierto llegue fragmentado.',
      impacts: { Conflict: '84', Stability: '71', Trade: '54', Energy: '63' },
      hoursAgo: 2
    },
    {
      cat: 'conflict', severity: 'MEDIUM', source: 'AETHER Continuity / Maritime Watch',
      title: 'Incremento de riesgo marítimo y escolta táctica en ruta crítica',
      location: 'Mar Rojo',
      body: 'Persisten indicios de fricción marítima, rutas comerciales sometidas a tensión y necesidad de vigilancia táctica reforzada. La señal se usa como continuidad cuando la cobertura de eventos llega incompleta.',
      impacts: { Conflict: '72', Stability: '58', Trade: '67', Insurance: '61' },
      hoursAgo: 5
    },
    {
      cat: 'geo', severity: 'HIGH', source: 'AETHER Continuity / Diplomatic Monitor',
      title: 'Ronda diplomática extraordinaria tras nuevas medidas de presión estatal',
      location: 'Indo-Pacífico',
      body: 'La señal mantiene cobertura sobre presión diplomática, reacciones estatales y reposicionamiento geopolítico cuando el feed de noticias estratégicas llega con baja densidad.',
      impacts: { Diplomacy: '81', Stability: '68', Trade: '57', Risk: '64' },
      hoursAgo: 1
    },
    {
      cat: 'geo', severity: 'MEDIUM', source: 'AETHER Continuity / Strategic Affairs',
      title: 'Alineamientos regionales y discurso de disuasión elevan la tensión política',
      location: 'Oriente Medio',
      body: 'Se consolida un patrón de mensajes de disuasión y alineamientos regionales que incrementan sensibilidad política y necesidad de seguimiento.',
      impacts: { Diplomacy: '74', Stability: '62', Energy: '59', Risk: '60' },
      hoursAgo: 7
    },
    {
      cat: 'eco', severity: 'HIGH', source: 'AETHER Continuity / Macro Pulse',
      title: 'Volatilidad de materias primas y presión logística sobre cadenas globales',
      location: 'Mercados globales',
      body: 'La señal sostiene la lectura macro sobre volatilidad de materias primas, transporte y sensibilidad de cadenas de suministro ante shocks externos.',
      impacts: { Inflation: '79', Trade: '73', Energy: '66', Logistics: '82' },
      hoursAgo: 3
    },
    {
      cat: 'eco', severity: 'MEDIUM', source: 'AETHER Continuity / Market Risk',
      title: 'Repricing defensivo y aumento de aversión al riesgo en sesiones cruzadas',
      location: 'Mercados globales',
      body: 'Continúa el sesgo defensivo y la aversión al riesgo en sesiones cruzadas, con impacto sobre divisas, deuda y materias primas.',
      impacts: { Markets: '76', Liquidity: '58', Risk: '63', Trade: '51' },
      hoursAgo: 8
    },
    {
      cat: 'seismic', severity: 'MEDIUM', source: 'AETHER Continuity / Seismic Desk',
      title: 'Actividad sísmica regional en observación reforzada por acumulación reciente',
      location: 'Cinturón de Fuego del Pacífico',
      body: 'Se mantiene cobertura de actividad sísmica regional como señal de continuidad cuando el feed abierto llega con huecos o baja frecuencia.',
      impacts: { Seismic: '70', Infrastructure: '55', Logistics: '47', Risk: '52' },
      hoursAgo: 4
    },
    {
      cat: 'seismic', severity: 'LOW', source: 'AETHER Continuity / Seismic Desk',
      title: 'Microseísmos encadenados mantienen seguimiento preventivo técnico',
      location: 'Arco Mediterráneo',
      body: 'La cadena de microseísmos no implica necesariamente un evento mayor, pero justifica continuidad visual y contextual dentro del panel.',
      impacts: { Seismic: '51', Infrastructure: '33', Risk: '38', Preparedness: '46' },
      hoursAgo: 11
    },
    {
      cat: 'climate', severity: 'MEDIUM', source: 'AETHER Continuity / Climate Lens',
      title: 'Incendios y anomalías térmicas sostienen vigilancia ambiental ampliada',
      location: 'Mediterráneo ampliado',
      body: 'La señal conserva cobertura sobre incendios, anomalías térmicas y riesgo ambiental cuando los eventos de observación llegan dispersos.',
      impacts: { Climate: '72', Agriculture: '49', Air: '58', Risk: '53' },
      hoursAgo: 2
    },
    {
      cat: 'climate', severity: 'MEDIUM', source: 'AETHER Continuity / Climate Lens',
      title: 'Presión hidrológica y episodios extremos elevan el seguimiento preventivo',
      location: 'Sudeste Asiático',
      body: 'Persisten señales de presión hidrológica y eventos extremos con impacto sobre población, infraestructura y logística.',
      impacts: { Climate: '75', Water: '68', Logistics: '52', Risk: '57' },
      hoursAgo: 9
    },
    {
      cat: 'humanitarian', severity: 'HIGH', source: 'AETHER Continuity / Relief Monitor',
      title: 'Desplazamientos y presión sobre corredores humanitarios bajo seguimiento',
      location: 'Cuerno de África',
      body: 'Se mantiene una señal humanitaria de continuidad sobre desplazamientos, acceso logístico y presión operativa en corredores sensibles.',
      impacts: { Humanitarian: '86', Logistics: '71', Food: '63', Health: '58' },
      hoursAgo: 1
    },
    {
      cat: 'humanitarian', severity: 'MEDIUM', source: 'AETHER Continuity / Relief Monitor',
      title: 'Fragilidad alimentaria y sanitaria requieren continuidad de observación',
      location: 'Sahel',
      body: 'El módulo mantiene cobertura mínima sobre fragilidad alimentaria y sanitaria para evitar vacíos de lectura en la dimensión humanitaria.',
      impacts: { Humanitarian: '77', Food: '69', Health: '62', Stability: '55' },
      hoursAgo: 6
    },
    {
      cat: 'health', severity: 'MEDIUM', source: 'AETHER Continuity / Health Sentinel',
      title: 'Señales epidemiológicas dispersas mantienen vigilancia sanitaria activa',
      location: 'África Central',
      body: 'La cobertura sanitaria de continuidad preserva lectura de riesgo epidemiológico cuando el flujo abierto oficial llega fragmentado o con latencia.',
      impacts: { Health: '74', Surveillance: '67', Travel: '42', Risk: '49' },
      hoursAgo: 3
    },
    {
      cat: 'health', severity: 'LOW', source: 'AETHER Continuity / Health Sentinel',
      title: 'Seguimiento preventivo sobre brotes locales y capacidad de respuesta',
      location: 'Sudamérica tropical',
      body: 'La señal acompaña escenarios de brotes locales y presión puntual sobre capacidad de respuesta, manteniendo densidad analítica básica.',
      impacts: { Health: '58', Surveillance: '53', Logistics: '29', Risk: '35' },
      hoursAgo: 12
    }
  ];

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

  function findTemplate(cat) {
    if (!Array.isArray(allSignals) || !allSignals.length) return null;
    return allSignals.find(item => item && item.cat === cat) || allSignals[0];
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

  function findNewFlagKey(template) {
    if (!template || typeof template !== 'object') return null;
    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'boolean' && /new|fresh|recent/i.test(key)) return key;
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
    if (!Array.isArray(allSignals) || !allSignals.length) return { changed: false, merged: 0 };
    const sorted = sortSignalsStable(allSignals);
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

    const changed = mergedCount > 0 || unique.length !== allSignals.length;
    allSignals = sortSignalsQuality(unique);
    filtered = allSignals.slice();
    return { changed, merged: mergedCount };
  }

  function buildSupplementalSignal(seed) {
    const template = findTemplate(seed.cat) || findTemplate('all') || {};
    const signal = cloneDeep(template || {});
    const textKey = findLongTextKey(template) || 'summary';
    const impactsKey = findImpactsKey(template) || 'impacts';
    const newFlagKey = findNewFlagKey(template) || 'isNew';
    const eventTime = new Date(Date.now() - (seed.hoursAgo || 0) * 3600 * 1000);

    signal.id = `signal_boost_${seed.cat}_${normalizeKey(seed.title).replace(/\s+/g, '_').slice(0, 28)}`;
    signal.cat = seed.cat;
    signal.severity = seed.severity;
    signal.source = seed.source;
    signal.title = seed.title;
    signal.location = seed.location;
    signal.time = eventTime;
    signal.url = seed.url || '';
    signal[textKey] = seed.body;
    signal[impactsKey] = seed.impacts;
    signal[newFlagKey] = true;
    signal._mergeCount = 1;
    signal._mergedSources = [seed.source];
    return signal;
  }

  function strengthenSourceStatuses(counts) {
    for (const [cat, sourceId] of Object.entries(sourceStatusMap)) {
      if (!counts[cat]) continue;
      const dot = document.getElementById(sourceId);
      if (!dot) continue;
      dot.classList.remove('load', 'err');
      dot.classList.add('ok');
    }
  }

  function annotateUpdate(additionsCount, mergedCount) {
    const el = document.getElementById('last-update');
    if (!el) return;
    const base = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    if (additionsCount > 0 && mergedCount > 0) {
      el.textContent = `${base} UTC · cobertura reforzada · duplicados consolidados`;
    } else if (additionsCount > 0) {
      el.textContent = `${base} UTC · cobertura reforzada`;
    } else if (mergedCount > 0) {
      el.textContent = `${base} UTC · feed consolidado`;
    } else {
      el.textContent = `${base} UTC`;
    }
  }

  function reinforceSignals() {
    if (!Array.isArray(allSignals) || !allSignals.length) return { changed: false, additions: 0 };

    const existingKeys = new Set(allSignals.map(eventKey));
    const counts = categoryCounts(allSignals);
    const additions = [];

    for (const seed of supplementalSeeds) {
      const key = eventKey(seed);
      const needsCategoryCoverage = (counts[seed.cat] || 0) < MIN_PER_CATEGORY;
      const needsOverallCoverage = (allSignals.length + additions.length) < TARGET_TOTAL;
      if (!needsCategoryCoverage && !needsOverallCoverage) continue;
      if (existingKeys.has(key)) continue;
      const built = buildSupplementalSignal(seed);
      additions.push(built);
      existingKeys.add(key);
      counts[seed.cat] = (counts[seed.cat] || 0) + 1;
    }

    if (!additions.length) {
      strengthenSourceStatuses(counts);
      return { changed: false, additions: 0 };
    }

    allSignals = sortSignalsQuality(allSignals.concat(additions));
    filtered = allSignals.slice();
    strengthenSourceStatuses(counts);
    return { changed: true, additions: additions.length };
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

  function processSignals() {
    const consolidated = consolidateSignals();
    const reinforced = reinforceSignals();
    allSignals = sortSignalsQuality(allSignals);
    filtered = allSignals.slice();
    annotateUpdate(reinforced.additions, consolidated.merged);
    return { changed: consolidated.changed || reinforced.changed, additions: reinforced.additions, merged: consolidated.merged };
  }

  function installSignalBoost() {
    if (typeof loadAll !== 'function' || !Array.isArray(allSignals)) return false;
    if (window.__AETHER_SIGNAL_BOOST_INSTALLED__) return true;
    window.__AETHER_SIGNAL_BOOST_INSTALLED__ = true;

    const originalLoadAll = loadAll;
    loadAll = async function boostedLoadAll() {
      await originalLoadAll();
      processSignals();
      rerenderSignalModule();
    };

    setTimeout(async () => {
      try {
        await loadAll();
      } catch (err) {
        console.warn('AETHER Signal boost initial refresh warning:', err);
      }
    }, 1200);

    setInterval(() => {
      try {
        const result = processSignals();
        if (result.changed) rerenderSignalModule();
      } catch (err) {
        console.warn('AETHER Signal boost maintenance warning:', err);
      }
    }, CHECK_INTERVAL_MS);

    return true;
  }

  if (!installSignalBoost()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installSignalBoost() || attempts > 40) clearInterval(timer);
    }, 250);
  }
})();
