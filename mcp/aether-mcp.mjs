#!/usr/bin/env node
/**
 * AETHER · servidor MCP (fase datos de OSIRIS).
 *
 * Deja que un agente (Claude Desktop, Claude Code, Cursor, un cliente con
 * Ollama…) consulte AETHER: riesgo de un país, ranking, eventos recientes,
 * conflicto según GDELT, mercados de predicción y tendencias.
 *
 * Sin dependencias y sin claves: lee los mismos ficheros públicos que la web
 * (data/latest.json y data/events.json), de GitHub Pages o de una carpeta
 * local, y calcula las puntuaciones con el mismo src/core/scoring.js.
 * Corre en la máquina de quien lo use; AETHER sigue sin servidor.
 *
 * Uso:
 *   node mcp/aether-mcp.mjs                       datos publicados
 *   node mcp/aether-mcp.mjs --local ./data        datos de una carpeta
 *   AETHER_DATOS_URL=https://…/data/ node mcp/aether-mcp.mjs
 *
 * Protocolo: MCP sobre stdio (JSON-RPC 2.0, un mensaje por línea).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { calcular } from '../src/core/scoring.js';
import { crearDiccionario, paisesEnTexto, normalizarNombre } from '../src/signal/paises.js';

const VERSION = '1.0.0';
const args = process.argv.slice(2);
const iLocal = args.indexOf('--local');
const LOCAL = iLocal >= 0 ? path.resolve(args[iLocal + 1] || 'data') : null;
const URL_BASE = (process.env.AETHER_DATOS_URL || 'https://franjuanp.github.io/OkrtSystemLabs/data/').replace(/\/?$/, '/');

/* ── Datos, con caché de 10 minutos ─────────────────────────────────── */
const cache = new Map();
async function leerJSON(nombre) {
  const c = cache.get(nombre);
  if (c && Date.now() - c.t < 600000) return c.v;
  let v;
  if (LOCAL) v = JSON.parse(fs.readFileSync(path.join(LOCAL, nombre), 'utf8'));
  else {
    const r = await fetch(URL_BASE + nombre, { headers: { 'user-agent': 'aether-mcp/' + VERSION } });
    if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status}`);
    v = await r.json();
  }
  cache.set(nombre, { t: Date.now(), v });
  return v;
}
async function contexto() {
  const datos = await leerJSON('latest.json');
  const c = cache.get('calculo');
  if (c && c.gen === datos.generado) return c.v;
  const v = { datos, calc: calcular(datos), dic: crearDiccionario(datos.paises) };
  cache.set('calculo', { gen: datos.generado, v });
  return v;
}
async function eventos() {
  try { return await leerJSON('events.json'); } catch (_e) { return null; }
}

/** ISO3 de un país escrito como código, nombre español o inglés. */
function resolverPais(ctx, texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  const up = t.toUpperCase();
  if (ctx.calc.paises[up] || (ctx.calc.agregados || {})[up]) return up;
  const n = normalizarNombre(t);
  for (const [iso, p] of Object.entries(ctx.calc.paises)) if (normalizarNombre(p.nombre) === n) return iso;
  return paisesEnTexto(t, ctx.dic)[0] || null;
}

const redondo = (x) => (x == null ? null : Math.round(x * 10) / 10);

/* ── Herramientas ───────────────────────────────────────────────────── */
const HERRAMIENTAS = {
  riesgo_pais: {
    descripcion: 'Riesgo de un país en AETHER: índice 0-100, nivel, puesto, las categorías peores con su tendencia (puntos/año), conflicto GDELT 24 h, eventos de 72 h y mercados de predicción.',
    esquema: { type: 'object', properties: { pais: { type: 'string', description: 'ISO3 (ESP) o nombre (España, Spain)' } }, required: ['pais'] },
    async run({ pais }) {
      const ctx = await contexto();
      const iso = resolverPais(ctx, pais);
      const p = iso && (ctx.calc.paises[iso] || ctx.calc.agregados[iso]);
      if (!p) return { error: `No encuentro el país «${pais}».` };
      const ranking = Object.entries(ctx.calc.paises).filter(([, x]) => x.score != null).sort((a, b) => b[1].score - a[1].score);
      const cats = Object.entries(p.categorias).filter(([, c]) => c.score != null)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([k, c]) => ({ categoria: k, score: c.score, tendencia_pts_anio: (p.ritmos || {})[k] ?? 0, confianza: c.confianza && c.confianza.nivel }));
      const ev = await eventos();
      const limite = Date.now() - 72 * 3600000;
      const recientes = ev ? ev.eventos.filter((e) => (e.paises || []).includes(iso) && new Date(e.time).getTime() >= limite)
        .slice(0, 10).map((e) => ({ fecha: e.time, fuente: e.source, severidad: e.severity, titulo: e.title, url: e.url })) : null;
      return {
        iso, nombre: p.nombre, indice: p.score, nivel: p.nivel && (p.nivel.etiqueta || p.nivel.clave),
        puesto: ranking.findIndex(([k]) => k === iso) + 1 || null, de: ranking.length,
        categorias_peores: cats.slice(0, 5),
        conflicto_gdelt: ev && ev.conflicto ? (ev.conflicto.paises[iso] || 'sin eventos') : 'sin lectura',
        eventos_72h: recientes,
        mercados: ev && ev.mercados ? (ev.mercados.paises[iso] || []) : 'sin lectura',
        datos: ctx.datos.generado,
        avisos: 'Puntuación relativa entre 217 países. GDELT mide cobertura de prensa, no víctimas. Los mercados son el precio de preguntas concretas.',
      };
    },
  },
  ranking: {
    descripcion: 'Países ordenados por índice de riesgo o por una categoría (eco, geo, health, climate, social, tech, food, mental, energy, demo, urban, science, justice, finance, ocean, bio).',
    esquema: { type: 'object', properties: { categoria: { type: 'string' }, n: { type: 'number', description: 'cuántos (por defecto 10, máximo 50)' }, orden: { type: 'string', enum: ['peores', 'mejores'] } } },
    async run({ categoria, n = 10, orden = 'peores' }) {
      const ctx = await contexto();
      const val = (p) => (categoria ? p.categorias[categoria] && p.categorias[categoria].score : p.score);
      if (categoria && !ctx.calc.correlacion.categorias.includes(categoria)) return { error: `Categoría desconocida: ${categoria}` };
      const lista = Object.entries(ctx.calc.paises).filter(([, p]) => val(p) != null)
        .sort((a, b) => (orden === 'mejores' ? val(a[1]) - val(b[1]) : val(b[1]) - val(a[1])))
        .slice(0, Math.min(50, Math.max(1, n)))
        .map(([iso, p], i) => ({ puesto: i + 1, iso, nombre: p.nombre, valor: val(p) }));
      return { criterio: categoria || 'índice', orden, lista };
    },
  },
  tendencias: {
    descripcion: 'Países que más empeoran (o mejoran) según la tendencia medida de sus categorías, en puntos de riesgo por año (mediana de las categorías con dato).',
    esquema: { type: 'object', properties: { n: { type: 'number' }, sentido: { type: 'string', enum: ['empeoran', 'mejoran'] } } },
    async run({ n = 10, sentido = 'empeoran' }) {
      const ctx = await contexto();
      const med = (xs) => { const o = xs.slice().sort((a, b) => a - b); const m = o.length >> 1; return o.length ? (o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2) : null; };
      const lista = Object.entries(ctx.calc.paises).map(([iso, p]) => {
        const r = Object.entries(p.ritmos || {}).filter(([k]) => p.categorias[k] && p.categorias[k].ritmoDe > 0).map(([, v]) => v);
        return { iso, nombre: p.nombre, tendencia_pts_anio: redondo(med(r)), categorias_con_dato: r.length };
      }).filter((x) => x.tendencia_pts_anio != null && x.categorias_con_dato >= 4)
        .sort((a, b) => (sentido === 'mejoran' ? a.tendencia_pts_anio - b.tendencia_pts_anio : b.tendencia_pts_anio - a.tendencia_pts_anio))
        .slice(0, Math.min(50, Math.max(1, n)));
      return { sentido, lista, nota: 'Positivo = más riesgo. Mide el cambio entre los dos últimos datos publicados de cada indicador.' };
    },
  },
  eventos_recientes: {
    descripcion: 'Eventos de las últimas horas (USGS, NASA EONET, OMS, GDACS, GDELT geolocalizado, NOAA SWPC), de un país o de todos.',
    esquema: { type: 'object', properties: { pais: { type: 'string' }, horas: { type: 'number', description: 'por defecto 72' }, n: { type: 'number' } } },
    async run({ pais, horas = 72, n = 20 }) {
      const ev = await eventos();
      if (!ev) return { error: 'No hay lectura de eventos (data/events.json).' };
      let iso = null;
      if (pais) { const ctx = await contexto(); iso = resolverPais(ctx, pais); if (!iso) return { error: `No encuentro el país «${pais}».` }; }
      const limite = Date.now() - horas * 3600000;
      const lista = ev.eventos.filter((e) => new Date(e.time).getTime() >= limite && (!iso || (e.paises || []).includes(iso)))
        .slice(0, Math.min(100, n)).map((e) => ({ fecha: e.time, paises: e.paises, fuente: e.source, severidad: e.severity, titulo: e.title, url: e.url }));
      return { pais: iso, horas, descargado: ev.descargado, total: lista.length, eventos: lista };
    },
  },
  conflicto: {
    descripcion: 'Países con más eventos de conflicto material en las últimas 24 h según GDELT (cobertura de prensa, no víctimas).',
    esquema: { type: 'object', properties: { n: { type: 'number' } } },
    async run({ n = 10 }) {
      const ev = await eventos();
      if (!ev || !ev.conflicto) return { error: 'No hay lectura de GDELT.' };
      const ctx = await contexto();
      const lista = Object.entries(ev.conflicto.paises).sort((a, b) => b[1].conflicto_material - a[1].conflicto_material)
        .slice(0, Math.min(50, n)).map(([iso, r]) => ({ iso, nombre: ctx.calc.paises[iso] ? ctx.calc.paises[iso].nombre : iso, ...r }));
      return { horas: ev.conflicto.horas, lista, aviso: ev.conflicto.aviso };
    },
  },
};

/* ── JSON-RPC sobre stdio ───────────────────────────────────────────── */
function enviar(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function responder(id, result) { enviar({ jsonrpc: '2.0', id, result }); }
function fallar(id, code, message) { enviar({ jsonrpc: '2.0', id, error: { code, message } }); }

async function atender(m) {
  if (!m || m.jsonrpc !== '2.0') return;
  const { id, method, params = {} } = m;
  const esNotificacion = id === undefined || id === null;
  try {
    switch (method) {
      case 'initialize':
        return responder(id, {
          protocolVersion: params.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'aether', version: VERSION },
          instructions: 'Datos de AETHER (OkrtSystem Labs): riesgo relativo de 217 países en 16 categorías con fuentes oficiales, eventos recientes, conflicto GDELT y mercados de predicción.',
        });
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return;
      case 'ping':
        return responder(id, {});
      case 'tools/list':
        return responder(id, { tools: Object.entries(HERRAMIENTAS).map(([name, h]) => ({ name, description: h.descripcion, inputSchema: h.esquema })) });
      case 'tools/call': {
        const h = HERRAMIENTAS[params.name];
        if (!h) return fallar(id, -32602, `Herramienta desconocida: ${params.name}`);
        const r = await h.run(params.arguments || {});
        return responder(id, { content: [{ type: 'text', text: JSON.stringify(r, null, 1) }], isError: !!(r && r.error) });
      }
      default:
        if (!esNotificacion) fallar(id, -32601, `Método no soportado: ${method}`);
    }
  } catch (e) {
    if (!esNotificacion) responder(id, { content: [{ type: 'text', text: 'Error: ' + (e && e.message) }], isError: true });
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (l) => {
  const t = l.trim();
  if (!t) return;
  let m;
  try { m = JSON.parse(t); } catch (_e) { return fallar(null, -32700, 'JSON no válido'); }
  atender(m);
});
