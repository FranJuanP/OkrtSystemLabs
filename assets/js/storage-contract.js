/**
 * AETHER · contrato de almacenamiento local (T7)
 *
 * Qué había antes y por qué se cambia
 * -----------------------------------
 * La versión anterior reasignaba los métodos de la instancia de
 * `localStorage`:
 *
 *     storage.getItem    = function(key){ ... }
 *     storage.setItem    = function(key, value){ ... }
 *     storage.removeItem = function(key){ ... }
 *
 * `Storage` es un objeto de plataforma con setter de propiedades con
 * nombre, y cada motor resuelve esa asignación de forma distinta. Medido
 * sobre este mismo repositorio:
 *
 *   - Chromium: la asignación crea una propiedad propia que ensombrece el
 *     método del prototipo. El contrato se aplicaba y no se creaban claves
 *     basura.
 *   - WebKit (Safari): la asignación se resuelve como escritura con nombre,
 *     de modo que el CÓDIGO FUENTE de cada función se guarda como valor
 *     bajo las claves `getItem`, `setItem` y `removeItem`, los métodos
 *     siguen siendo los nativos y el contrato NO se aplica nunca. Un
 *     `aether_horizon` con valor "99m" se quedaba tal cual.
 *
 * Es decir: el contrato funcionaba en unos navegadores y en otros no, y de
 * paso ensuciaba el almacenamiento del usuario. Además, parchear un objeto
 * de plataforma afecta a todo el código de la página, incluido el de
 * terceros, y lo hace de forma invisible.
 *
 * Qué hace ahora
 * --------------
 * No se toca `localStorage`. Se expone `window.AETHER_STORAGE` con `get`,
 * `set` y `remove`, que validan contra el esquema, y los consumidores lo
 * usan explícitamente. Al cargar se limpian las claves basura que la
 * versión anterior pudo dejar en Safari.
 *
 * Nota: assets/js/aether-storage-contract.js es otro fichero, no se carga
 * en ninguna página y se borra en la Fase 2. No se toca aquí.
 */
(function (global) {
  'use strict';

  var CONTRACT_VERSION = '2.0.0';
  var META_KEY = 'aether_contract_meta';

  /** Claves que la versión anterior creaba por accidente en Safari. */
  var JUNK_KEYS = ['getItem', 'setItem', 'removeItem'];

  /**
   * Esquema por clave. Los nombres son los que de verdad usa la aplicación.
   * Los de la versión anterior (aether_watchlist_v1, aether_snapshots_v1,
   * aether_history_v1) no coincidían con ninguna clave real —la aplicación
   * usa los sufijos _v3—, así que esas tres validaciones nunca se aplicaban
   * a nada. Corregidos aquí.
   */
  var SCHEMAS = {
    aether_horizon: { type: 'horizon', fallback: '12m', allowedMonths: [1, 3, 6, 12, 24] },
    aether_signal_events: { type: 'array', fallback: [], maxItems: 250 },
    aether_globe_scores: { type: 'object', fallback: {} },
    aether_globe_context: { type: 'object', fallback: {} },
    aether_watchlist_v3: { type: 'array', fallback: [], maxItems: 50 },
    aether_region_snapshots_v3: { type: 'object', fallback: {} },
    aether_brief_history_v3: { type: 'array', fallback: [], maxItems: 18 },
  };

  var debug = { normalizations: [], junkRemoved: [], version: CONTRACT_VERSION };

  function clone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }
  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function parseMaybeJSON(raw) {
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  function normalizeHorizon(value, schema) {
    var parsed = parseMaybeJSON(value);
    var legacy = { 0: '6m', 1: '12m', 2: '24m', '0': '6m', '1': '12m', '2': '24m' };
    if (typeof parsed === 'string') {
      var cleaned = parsed.trim().toLowerCase();
      if (legacy[cleaned] != null) return { ok: false, value: legacy[cleaned] };
      var m = cleaned.match(/^(1|3|6|12|24)\s*m?$/);
      if (m) return { ok: cleaned === m[1] + 'm', value: m[1] + 'm' };
    }
    if (typeof parsed === 'number' && isFinite(parsed)) {
      var r = Math.round(parsed);
      if (legacy[r] != null) return { ok: false, value: legacy[r] };
      if (schema.allowedMonths.indexOf(r) !== -1) return { ok: false, value: r + 'm' };
    }
    return { ok: false, value: schema.fallback };
  }

  /**
   * Valida un valor contra el esquema de su clave.
   * @returns {{ok: boolean, value: *}} ok=false significa que hubo que reparar.
   */
  function validate(key, value) {
    var schema = SCHEMAS[key];
    if (!schema) return { ok: true, value: value };
    if (schema.type === 'horizon') return normalizeHorizon(value, schema);

    var parsed = parseMaybeJSON(value);
    if (schema.type === 'array') {
      if (!Array.isArray(parsed)) return { ok: false, value: clone(schema.fallback) };
      if (schema.maxItems && parsed.length > schema.maxItems) {
        return { ok: false, value: parsed.slice(0, schema.maxItems) };
      }
      return { ok: true, value: parsed };
    }
    if (schema.type === 'object') {
      if (!isPlainObject(parsed)) return { ok: false, value: clone(schema.fallback) };
      return { ok: true, value: parsed };
    }
    return { ok: true, value: parsed };
  }

  function serialize(value) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  function note(key, before, after) {
    try {
      debug.normalizations.push({
        key: key,
        before: String(before).slice(0, 120),
        after: String(serialize(after)).slice(0, 120),
        at: new Date().toISOString(),
      });
      if (debug.normalizations.length > 20) debug.normalizations.shift();
    } catch (e) { /* el registro no es critico */ }
  }

  function backing() {
    try { return global.localStorage || null; } catch (e) { return null; }
  }

  /**
   * Lee una clave, ya parseada y validada contra su esquema.
   * Si el valor guardado no cumple el esquema, se repara en el acto.
   * @param {string} key
   * @param {*} [fallback] valor a devolver si no hay nada guardado
   */
  function get(key, fallback) {
    var store = backing();
    if (!store) return fallback;
    var raw;
    try { raw = store.getItem(key); } catch (e) { return fallback; }
    if (raw == null) return fallback !== undefined ? fallback : (SCHEMAS[key] ? clone(SCHEMAS[key].fallback) : null);
    var res = validate(key, raw);
    if (!res.ok) {
      note(key, raw, res.value);
      try { store.setItem(key, serialize(res.value)); } catch (e) { /* cuota */ }
    }
    return res.value;
  }

  /** Lee el valor crudo, sin parsear. Para claves sin esquema. */
  function getRaw(key) {
    var store = backing();
    if (!store) return null;
    try { return store.getItem(key); } catch (e) { return null; }
  }

  /**
   * Escribe una clave validando antes contra su esquema.
   * @returns {boolean} si se pudo escribir
   */
  function set(key, value) {
    var store = backing();
    if (!store) return false;
    var res = validate(key, value);
    if (!res.ok) note(key, serialize(value), res.value);
    try {
      store.setItem(key, serialize(res.value));
      return true;
    } catch (e) {
      return false;   // cuota llena o almacenamiento bloqueado
    }
  }

  function remove(key) {
    var store = backing();
    if (!store) return false;
    try { store.removeItem(key); return true; } catch (e) { return false; }
  }

  /** Limpia las claves basura que dejaba la version anterior en Safari. */
  function cleanJunk() {
    var store = backing();
    if (!store) return;
    JUNK_KEYS.forEach(function (key) {
      try {
        var raw = store.getItem(key);
        if (raw == null) return;
        store.removeItem(key);
        debug.junkRemoved.push(key);
      } catch (e) { /* nada que hacer */ }
    });
    if (debug.junkRemoved.length) {
      console.info('[AETHER] Limpiadas claves de localStorage que dejó el contrato anterior: ' +
        debug.junkRemoved.join(', '));
    }
  }

  /** Repara de una pasada todas las claves conocidas que esten mal guardadas. */
  function normalizeAll() {
    var store = backing();
    if (!store) return;
    Object.keys(SCHEMAS).forEach(function (key) {
      try {
        var raw = store.getItem(key);
        if (raw == null) return;
        var res = validate(key, raw);
        var out = serialize(res.value);
        if (!res.ok || raw !== out) { note(key, raw, res.value); store.setItem(key, out); }
      } catch (e) { /* clave intratable: se deja */ }
    });
    try {
      store.setItem(META_KEY, JSON.stringify({
        version: CONTRACT_VERSION,
        updatedAt: new Date().toISOString(),
        keys: Object.keys(SCHEMAS),
        junkRemoved: debug.junkRemoved,
      }));
    } catch (e) { /* cuota */ }
  }

  cleanJunk();
  normalizeAll();

  global.AETHER_STORAGE = {
    version: CONTRACT_VERSION,
    get: get,
    getRaw: getRaw,
    set: set,
    remove: remove,
    keys: function () { return Object.keys(SCHEMAS).slice(); },
    getDebug: function () { return clone(debug); },
  };

  // Nombre anterior, para que nada que lo consultara se rompa.
  global.AETHER_STORAGE_CONTRACT = {
    version: CONTRACT_VERSION,
    keys: Object.keys(SCHEMAS).slice(),
    getDebug: function () { return clone(debug); },
  };
})(window);
