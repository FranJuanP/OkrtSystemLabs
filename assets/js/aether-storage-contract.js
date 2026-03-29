(function(){
  const KEY_RULES = {
    aether_globe_scores: { type: 'json-object' },
    aether_signal_events: { type: 'json-array', maxItems: 250 },
    aether_horizon: { type: 'enum', values: ['1m','3m','6m','12m','24m'] }
  };
  const VERSION = 1;
  const nativeGet = Storage.prototype.getItem;
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;

  function parseMaybeJSON(value){
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }

  function serializePayload(payload, rule){
    if (rule.type === 'enum') return String(payload);
    return JSON.stringify(payload);
  }

  function wrapValue(key, value, rule){
    const payload = parseMaybeJSON(value);
    if (rule.type === 'json-object' && (!payload || typeof payload !== 'object' || Array.isArray(payload))) return null;
    if (rule.type === 'json-array' && !Array.isArray(payload)) return null;
    if (rule.type === 'json-array' && rule.maxItems) payload.splice?.(rule.maxItems);
    if (rule.type === 'enum' && !rule.values.includes(String(payload))) return null;
    return JSON.stringify({ __aether_contract__: VERSION, key, payload: serializePayload(payload, rule) });
  }

  function unwrapValue(key, raw, rule){
    if (typeof raw !== 'string' || !raw) return raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.__aether_contract__ === VERSION && parsed.key === key) return String(parsed.payload);
    } catch {}
    const migrated = wrapValue(key, raw, rule);
    if (migrated) {
      try { nativeSet.call(localStorage, key, migrated); } catch {}
      return String(JSON.parse(migrated).payload);
    }
    return raw;
  }

  Storage.prototype.setItem = function(key, value){
    const rule = KEY_RULES[key];
    if (!rule) return nativeSet.call(this, key, value);
    const wrapped = wrapValue(key, value, rule);
    if (wrapped === null) {
      console.warn('[AETHER] localStorage rejected by contract:', key);
      return;
    }
    return nativeSet.call(this, key, wrapped);
  };

  Storage.prototype.getItem = function(key){
    const raw = nativeGet.call(this, key);
    const rule = KEY_RULES[key];
    if (!rule) return raw;
    return unwrapValue(key, raw, rule);
  };

  Storage.prototype.removeItem = function(key){
    return nativeRemove.call(this, key);
  };
})();
