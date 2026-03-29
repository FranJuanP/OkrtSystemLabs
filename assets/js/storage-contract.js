
(function(){
  'use strict';
  const CONTRACT_VERSION = '1.0.0';
  const META_KEY = 'aether_contract_meta';
  const SCHEMAS = {
    aether_horizon: {
      type: 'string',
      allowed: ['1m','3m','6m','12m','24m'],
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
  function sanitizeBySchema(key, value){
    const schema = SCHEMAS[key];
    if (!schema) return { ok: true, value };
    let parsed = parseMaybeJSON(value);
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
  function normalizeExisting(storage){
    Object.keys(SCHEMAS).forEach((key) => {
      try {
        const current = storage.getItem(key);
        if (current == null) return;
        const res = sanitizeBySchema(key, current);
        if (!res.ok || res.repaired) persistRaw(storage, key, res.value);
      } catch {}
    });
    try {
      persistRaw(storage, META_KEY, { version: CONTRACT_VERSION, updatedAt: new Date().toISOString() });
    } catch {}
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
        try { nativeSet(key, typeof res.value === 'string' ? res.value : JSON.stringify(res.value)); } catch {}
      }
      return typeof res.value === 'string' ? res.value : JSON.stringify(res.value);
    };

    storage.setItem = function(key, value){
      if (!(key in SCHEMAS)) return nativeSet(key, value);
      const res = sanitizeBySchema(key, value);
      const finalValue = typeof res.value === 'string' ? res.value : JSON.stringify(res.value);
      return nativeSet(key, finalValue);
    };

    storage.removeItem = function(key){
      if (key === META_KEY) return;
      return nativeRemove(key);
    };

    normalizeExisting(storage);
    window.AETHER_STORAGE_CONTRACT = { version: CONTRACT_VERSION, keys: Object.keys(SCHEMAS).slice() };
  } catch {}
})();
