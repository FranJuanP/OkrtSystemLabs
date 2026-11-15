/**
 * Mercados de predicción por país (fase datos de OSIRIS).
 *
 * Polymarket (dinero real) y Manifold (dinero ficticio) publican preguntas
 * abiertas con una probabilidad que fija la gente que apuesta: «¿Alto el
 * fuego en Sudán antes de junio?». Junto a la proyección de AETHER, que es
 * un modelo ilustrativo, dan una referencia externa: lo que la multitud
 * paga hoy por un desenlace.
 *
 * Se descargan en el despliegue, sin clave, y cada pregunta se asigna a los
 * países que nombra con el mismo diccionario que los eventos
 * (src/signal/paises.js). Una probabilidad de mercado no es una medida del
 * riesgo del país: es el precio de una pregunta concreta.
 *
 * Módulo puro: lo usan tools/fetch-events.mjs y las pruebas unitarias.
 */
import { paisesEnTexto } from './paises.js';

const NUM = (v) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN);
const lista = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch (_e) { return []; } }
  return [];
};

/**
 * Mercados sí/no abiertos de Polymarket. Acepta la respuesta de /events
 * (una lista) o la de la búsqueda ({events: [...]}).
 */
export function parsearPolymarket(cuerpo) {
  const eventos = Array.isArray(cuerpo) ? cuerpo : (cuerpo && Array.isArray(cuerpo.events) ? cuerpo.events : []);
  const out = [];
  for (const e of eventos) {
    if (!e || typeof e !== 'object') continue;
    const slug = typeof e.slug === 'string' && /^[a-z0-9-]+$/i.test(e.slug) ? e.slug : '';
    for (const m of Array.isArray(e.markets) ? e.markets : []) {
      const resultados = lista(m.outcomes).map(String);
      const precios = lista(m.outcomePrices).map(NUM);
      const pregunta = typeof m.question === 'string' ? m.question.trim() : '';
      if (!slug || !pregunta || m.closed === true || m.active === false) continue;
      if (resultados[0] !== 'Yes' || !Number.isFinite(precios[0])) continue;
      const volumen = [m.volumeNum, m.volume, e.volume].map(NUM).find(Number.isFinite) || 0;
      out.push({
        plataforma: 'Polymarket',
        pregunta,
        contexto: typeof e.title === 'string' ? e.title : '',
        probabilidad: precios[0],
        volumen,
        cierre: typeof m.endDate === 'string' ? m.endDate : (typeof e.endDate === 'string' ? e.endDate : ''),
        url: `https://polymarket.com/event/${slug}`,
      });
    }
  }
  return out;
}

/** Mercados binarios abiertos de Manifold (respuesta de search-markets). */
export function parsearManifold(cuerpo) {
  const out = [];
  for (const m of Array.isArray(cuerpo) ? cuerpo : []) {
    if (!m || typeof m !== 'object') continue;
    const url = typeof m.url === 'string' && /^https:\/\/manifold\.markets\//.test(m.url) ? m.url : '';
    const p = NUM(m.probability);
    if (!url || m.outcomeType !== 'BINARY' || m.isResolved === true || !Number.isFinite(p) || typeof m.question !== 'string') continue;
    const cierre = NUM(m.closeTime);
    out.push({
      plataforma: 'Manifold',
      pregunta: m.question.trim(),
      contexto: '',
      probabilidad: p,
      volumen: NUM(m.volume) || 0,
      cierre: Number.isFinite(cierre) ? new Date(cierre).toISOString() : '',
      url,
    });
  }
  return out;
}

/**
 * Agrupa por país los mercados que nombran alguno, quitando duplicados,
 * los casi decididos (probabilidad < 1 % o > 99 %) y los de poco volumen.
 * Para cada país, los de más volumen primero, hasta `max`.
 *
 * @param {ReturnType<typeof parsearPolymarket>} mercados
 * @param {Map<string,string>} dic
 * @param {number} [max=6]
 */
export function mercadosPorPais(mercados, dic, max = 6) {
  const vistos = new Set();
  const porPais = {};
  for (const m of mercados) {
    const clave = m.plataforma + ':' + m.pregunta.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    if (!(m.probabilidad > 0.01 && m.probabilidad < 0.99)) continue;
    if (m.volumen < (m.plataforma === 'Manifold' ? 100 : 1000)) continue;
    const paises = paisesEnTexto(m.pregunta + ' ' + (m.contexto || ''), dic);
    for (const iso of paises) (porPais[iso] || (porPais[iso] = [])).push({
      plataforma: m.plataforma,
      pregunta: m.pregunta,
      probabilidad: Math.round(m.probabilidad * 1000) / 1000,
      volumen: Math.round(m.volumen),
      cierre: m.cierre,
      url: m.url,
    });
  }
  for (const iso of Object.keys(porPais)) {
    porPais[iso] = porPais[iso].sort((a, b) => b.volumen - a.volumen).slice(0, max);
  }
  return porPais;
}
