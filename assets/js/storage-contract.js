(function(){
  'use strict';
  const CONTRACT_VERSION = '1.1.0';
  const META_KEY = 'aether_contract_meta';
  const debug = { normalizations: [], lastMeta: null };
  const SCHEMAS = {
    aether_horizon: {
      type: 'horizon',
      allowedMonths: [1,3,6,12,24],
      fallback: '12m'
    },
    aether_signal_events: {
      type: 'array',
      fallback: []
    },
    aether_globe_scores: {
      type: 'object',
      fallback: {}
    },
    aether_watchlist_v1: {
      type: 'array',
      fallback: []
    },
    aether_snapshots_v1: {
      type: 'object',
      fallback: {}
    },
    aether_history_v1: {
      type: 'array',
      fallback: []
    }
  };

  function clone(v){
    try { return JSON.parse(JSON.stringify(v)); } catch { return v; }
  }
  function isPlainObject(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }
  function parseMaybeJSON(raw){
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return raw; }
  }
  function normalizeHorizon(value, schema){
    const parsed = parseMaybeJSON(value);
    const legacyMap = { 0:'6m', 1:'12m', 2:'24m', '0':'6m', '1':'12m', '2':'24m' };
    if (typeof parsed === 'string') {
      const cleaned = parsed.trim().toLowerCase();
      if (legacyMap[cleaned] != null) return { ok: true, value: legacyMap[cleaned], repaired: true, legacy: true };
      const match = cleaned.match(/^(1|3|6|12|24)\s*m?$/);
      if (match) return { ok: true, value: match[1] + 'm', repaired: cleaned !== (match[1] + 'm') };
    }
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      const rounded = Math.round(parsed);
      if (legacyMap[rounded] != null) return { ok: true, value: legacyMap[rounded], repaired: true, legacy: true };
      if (schema.allowedMonths.includes(rounded)) return { ok: true, value: rounded + 'm', repaired: true };
    }
    return { ok: false, value: schema.fallback, repaired: true };
  }
  function sanitizeBySchema(key, value){
    const schema = SCHEMAS[key];
    if (!schema) return { ok: true, value };
    let parsed = parseMaybeJSON(value);
    if (schema.type === 'horizon') return normalizeHorizon(parsed, schema);
    if (schema.type === 'string') {
      if (typeof parsed !== 'string') return { ok: false, value: schema.fallback, repaired: true };
      if (schema.allowed && !schema.allowed.includes(parsed)) return { ok: false, value: schema.fallback, repaired: true };
      return { ok: true, value: parsed };
    }
    if (schema.type === 'array') {
      if (!Array.isArray(parsed)) return { ok: false, value: clone(schema.fallback), repaired: true };
      return { ok: true, value: parsed };
    }
    if (schema.type === 'object') {
      if (!isPlainObject(parsed)) return { ok: false, value: clone(schema.fallback), repaired: true };
      return { ok: true, value: parsed };
    }
    return { ok: true, value: parsed };
  }
  function persistRaw(storage, key, value){
    const out = typeof value === 'string' ? value : JSON.stringify(value);
    storage.setItem(key, out);
    return out;
  }
  function rememberNormalization(key, beforeRaw, afterValue){
    try {
      debug.normalizations.push({
        key,
        before: beforeRaw,
        after: typeof afterValue === 'string' ? afterValue : JSON.stringify(afterValue),
        at: new Date().toISOString()
      });
      if (debug.normalizations.length > 20) debug.normalizations.shift();
    } catch(_) {}
  }
  function writeMeta(storage){
    try {
      const payload = {
        version: CONTRACT_VERSION,
        updatedAt: new Date().toISOString(),
        normalizedCount: debug.normalizations.length,
        keys: Object.keys(SCHEMAS)
      };
      debug.lastMeta = payload;
      persistRaw(storage, META_KEY, payload);
    } catch (_) {}
  }
  function normalizeExisting(storage){
    Object.keys(SCHEMAS).forEach((key) => {
      try {
        const current = storage.getItem(key);
        if (current == null) return;
        const res = sanitizeBySchema(key, current);
        if (!res.ok || res.repaired) {
          rememberNormalization(key, current, res.value);
          persistRaw(storage, key, res.value);
        }
      } catch {}
    });
    writeMeta(storage);
  }
  try {
    const storage = window.localStorage;
    if (!storage) return;
    const nativeGet = storage.getItem.bind(storage);
    const nativeSet = storage.setItem.bind(storage);
    const nativeRemove = storage.removeItem.bind(storage);

    storage.getItem = function(key){
      const raw = nativeGet(key);
      if (!(key in SCHEMAS) || raw == null) return raw;
      const res = sanitizeBySchema(key, raw);
      if (!res.ok || res.repaired) {
        try {
          rememberNormalization(key, raw, res.value);
          nativeSet(key, typeof res.value === 'string' ? res.value : JSON.stringify(res.value));
          writeMeta(storage);
        } catch {}
      }
      return typeof res.value === 'string' ? res.value : JSON.stringify(res.value);
    };

    storage.setItem = function(key, value){
      if (!(key in SCHEMAS)) return nativeSet(key, value);
      const res = sanitizeBySchema(key, value);
      const finalValue = typeof res.value === 'string' ? res.value : JSON.stringify(res.value);
      if ((!res.ok || res.repaired) && String(value) !== finalValue) rememberNormalization(key, value, res.value);
      const out = nativeSet(key, finalValue);
      writeMeta(storage);
      return out;
    };

    storage.removeItem = function(key){
      if (key === META_KEY) return;
      const out = nativeRemove(key);
      writeMeta(storage);
      return out;
    };

    normalizeExisting(storage);

    function enforceKnownKeys(){
      try {
        Object.keys(SCHEMAS).forEach((key) => {
          const current = nativeGet(key);
          if (current == null) return;
          const res = sanitizeBySchema(key, current);
          const finalValue = typeof res.value === 'string' ? res.value : JSON.stringify(res.value);
          if (current !== finalValue) {
            rememberNormalization(key, current, res.value);
            nativeSet(key, finalValue);
          }
        });
        writeMeta(storage);
      } catch (_) {}
    }

    enforceKnownKeys();
    window.addEventListener('pageshow', enforceKnownKeys);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) enforceKnownKeys(); });
    setTimeout(enforceKnownKeys, 250);
    window.AETHER_STORAGE_CONTRACT = {
      version: CONTRACT_VERSION,
      keys: Object.keys(SCHEMAS).slice(),
      getDebug: function(){ return { version: CONTRACT_VERSION, normalizations: debug.normalizations.slice(), meta: debug.lastMeta }; }
    };
  } catch {}
})();
