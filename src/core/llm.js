/**
 * IA del panel: Ollama en local o un proveedor con la clave del VISITANTE
 * (fase IA con clave propia).
 *
 * Seguridad, porque AETHER es una web pública sin servidor:
 *   - La clave la escribe cada visitante y es SUYA. No hay ninguna clave en
 *     el repositorio, en el código publicado ni en los secretos de GitHub.
 *   - Se guarda solo en este navegador: por defecto en sessionStorage (se
 *     borra al cerrar la pestaña) y en localStorage solo si el visitante
 *     marca «recordar». Hay un botón para olvidarla.
 *   - Se envía solo al proveedor elegido, directamente desde el navegador,
 *     en una cabecera (nunca en la URL, que queda en registros e historial).
 *   - No se escribe en consola, no entra en el contrato de almacenamiento
 *     de AETHER ni en ninguna exportación, y se borra de cualquier mensaje
 *     de error antes de enseñarlo.
 *   - La política de seguridad (CSP) de la página solo permite conectar con
 *     los orígenes de estos proveedores, además de Ollama en local.
 */

export const PROVEEDORES = {
  ollama: {
    nombre: 'Ollama (local)', clave: false,
    modelos: [],
  },
  anthropic: {
    nombre: 'Anthropic', clave: true, url: 'https://api.anthropic.com/v1/messages',
    modelos: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
    ayuda: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    nombre: 'OpenAI', clave: true, url: 'https://api.openai.com/v1/chat/completions',
    modelos: ['gpt-4o-mini', 'gpt-4o'],
    ayuda: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    nombre: 'Google Gemini', clave: true, url: 'https://generativelanguage.googleapis.com/v1beta/models/',
    modelos: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    ayuda: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    nombre: 'OpenRouter', clave: true, url: 'https://openrouter.ai/api/v1/chat/completions',
    modelos: ['anthropic/claude-sonnet-5-5', 'openai/gpt-4o-mini', 'google/gemini-2.5-flash'],
    ayuda: 'https://openrouter.ai/settings/keys',
  },
};

const PREFIJO = 'aether.llm.';

function almacen(tipo) {
  try { return tipo === 'local' ? window.localStorage : window.sessionStorage; } catch (_e) { return null; }
}
function leer(k) {
  for (const t of ['session', 'local']) {
    try { const v = almacen(t) && almacen(t).getItem(PREFIJO + k); if (v != null) return v; } catch (_e) { /* almacenamiento bloqueado */ }
  }
  return null;
}

/** Proveedor y modelo elegidos (no son secretos: van en localStorage). */
export function configuracion() {
  let proveedor = null;
  let modelo = null;
  try { proveedor = localStorage.getItem(PREFIJO + 'proveedor'); modelo = localStorage.getItem(PREFIJO + 'modelo.' + proveedor); } catch (_e) { /* nada */ }
  if (!PROVEEDORES[proveedor]) proveedor = 'ollama';
  return { proveedor, modelo: modelo || PROVEEDORES[proveedor].modelos[0] || '' };
}

export function guardarConfiguracion(proveedor, modelo) {
  if (!PROVEEDORES[proveedor]) return;
  try {
    localStorage.setItem(PREFIJO + 'proveedor', proveedor);
    if (modelo) localStorage.setItem(PREFIJO + 'modelo.' + proveedor, String(modelo).slice(0, 120));
  } catch (_e) { /* nada */ }
}

/** ¿Hay clave guardada para el proveedor? No la devuelve. */
export function hayClave(proveedor) {
  return !!leer('clave.' + proveedor);
}

/** ¿Está la clave en localStorage (recordada) o solo en esta sesión? */
export function claveRecordada(proveedor) {
  try { return !!localStorage.getItem(PREFIJO + 'clave.' + proveedor); } catch (_e) { return false; }
}

/** Guarda la clave en sessionStorage, o en localStorage si `recordar`. */
export function guardarClave(proveedor, clave, recordar) {
  olvidarClave(proveedor);
  const limpia = String(clave || '').trim();
  if (!limpia || !PROVEEDORES[proveedor] || !PROVEEDORES[proveedor].clave) return false;
  const a = almacen(recordar ? 'local' : 'session');
  try { a.setItem(PREFIJO + 'clave.' + proveedor, limpia); return true; } catch (_e) { return false; }
}

export function olvidarClave(proveedor) {
  for (const t of ['session', 'local']) {
    try { almacen(t) && almacen(t).removeItem(PREFIJO + 'clave.' + proveedor); } catch (_e) { /* nada */ }
  }
}

/** Quita la clave de un texto (por si un proveedor la repite en un error). */
export function sinClave(texto, clave) {
  let t = String(texto || '');
  if (clave && clave.length >= 8) t = t.split(clave).join('[clave oculta]');
  // Por si llega recortada: patrones habituales de claves.
  return t.replace(/\b(sk-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/g, '$1…').replace(/\bAIza[0-9A-Za-z_-]{10,}/g, 'AIza…');
}

/**
 * Construye la petición para un proveedor. Pura y exportada para las
 * pruebas: así se comprueba que la clave va en una cabecera y nunca en la URL.
 *
 * @param {string} proveedor
 * @param {{modelo:string, clave?:string, system?:string,
 *   messages:{role:'user'|'assistant', content:string}[], ollamaURL?:string}} p
 * @returns {{url:string, init:RequestInit}}
 */
export function construirPeticion(proveedor, { modelo, clave, system, messages, ollamaURL }) {
  const json = (url, headers, body) => ({
    url, init: { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body: JSON.stringify(body) },
  });
  const conSistema = system ? [{ role: 'system', content: system }, ...messages] : messages;
  switch (proveedor) {
    case 'anthropic':
      return json(PROVEEDORES.anthropic.url, {
        'x-api-key': clave,
        'anthropic-version': '2023-06-01',
        // Necesaria para llamar a la API desde el navegador con la clave del propio usuario.
        'anthropic-dangerous-direct-browser-access': 'true',
      }, Object.assign({ model: modelo, max_tokens: 1500, messages }, system ? { system } : {}));
    case 'openai':
      return json(PROVEEDORES.openai.url, { authorization: 'Bearer ' + clave }, { model: modelo, messages: conSistema });
    case 'openrouter':
      return json(PROVEEDORES.openrouter.url, { authorization: 'Bearer ' + clave, 'x-title': 'AETHER' }, { model: modelo, messages: conSistema });
    case 'gemini':
      return json(PROVEEDORES.gemini.url + encodeURIComponent(modelo) + ':generateContent', { 'x-goog-api-key': clave }, Object.assign({
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      }, system ? { systemInstruction: { parts: [{ text: system }] } } : {}));
    default:
      return json(String(ollamaURL || 'http://localhost:11434') + '/api/chat', {}, { model: modelo, stream: false, messages: conSistema });
  }
}

/** El texto de la respuesta de cada proveedor. */
export function leerRespuesta(proveedor, d) {
  if (!d) return '';
  if (d.error) throw new Error(typeof d.error === 'string' ? d.error : (d.error.message || 'error del proveedor'));
  switch (proveedor) {
    case 'anthropic': return (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    case 'openai':
    case 'openrouter': return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    case 'gemini': return ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map((p) => p.text || '').join('');
    default: return (d.message && d.message.content) || '';
  }
}

/**
 * Una respuesta del modelo elegido.
 *
 * @param {{system?:string, messages:{role:string, content:string}[], ollamaURL?:string, modelo?:string}} p
 */
export async function preguntar({ system, messages, ollamaURL, modelo }) {
  const conf = configuracion();
  const proveedor = conf.proveedor;
  const meta = PROVEEDORES[proveedor];
  const clave = meta.clave ? leer('clave.' + proveedor) : '';
  if (meta.clave && !clave) throw new Error('Falta la clave de ' + meta.nombre + '. Escríbela en la barra de IA.');
  const { url, init } = construirPeticion(proveedor, {
    modelo: modelo || conf.modelo, clave, system, messages, ollamaURL,
  });
  let res;
  try {
    res = await fetch(url, Object.assign(init, { credentials: 'omit', referrerPolicy: 'no-referrer' }));
  } catch (e) {
    throw new Error(sinClave('No se pudo conectar con ' + meta.nombre + ': ' + (e && e.message), clave));
  }
  let d = null;
  try { d = await res.json(); } catch (_e) { d = null; }
  if (!res.ok) {
    const m = d && (d.error && (d.error.message || d.error)) || ('HTTP ' + res.status);
    throw new Error(sinClave(meta.nombre + ': ' + (typeof m === 'string' ? m : JSON.stringify(m)).slice(0, 200), clave));
  }
  try {
    return leerRespuesta(proveedor, d) || 'Sin respuesta';
  } catch (e) {
    throw new Error(sinClave(e.message, clave));
  }
}
