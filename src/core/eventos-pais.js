/**
 * Eventos recientes por país (fase eventos por país).
 *
 * Lee `data/events.json`, el fichero que el despliegue regenera cada media
 * hora, y agrupa sus eventos por los ISO3 que les asigna
 * tools/fetch-events.mjs (ver src/signal/paises.js).
 *
 * Antes el globo intentaba leer los eventos de `localStorage`, de una clave
 * (`aether_signal_events`) que no escribía ningún módulo: los puntos
 * calientes, el pulso de los marcadores y el recuento del panel salían
 * siempre vacíos. Este fichero es el mismo para cualquier visitante, haya
 * abierto Signal o no.
 *
 * La descarga se memoriza en una promesa compartida, como `cargarDatos()`,
 * para que el globo y sus refuerzos no la pidan dos veces.
 */

/** Ventana por defecto: lo de los últimos tres días. */
export const HORAS_POR_DEFECTO = 72;

const RUTA = 'data/events.json';
const VACIO = Object.freeze({ ok: false, eventos: [], descargado: null, conflicto: null, mercados: null });
let promesa = null;

/**
 * Agrupa por país los eventos de la ventana, del más reciente al más
 * antiguo. Un evento que nombra a varios países aparece en todos.
 *
 * @param {Array<{time: string|Date, paises?: string[]}>} eventos
 * @param {{horas?: number, ahora?: number}} [opciones]
 * @returns {Map<string, object[]>}
 */
export function agruparPorPais(eventos, { horas = HORAS_POR_DEFECTO, ahora = Date.now() } = {}) {
  const limite = ahora - horas * 3600000;
  const porPais = new Map();
  for (const ev of Array.isArray(eventos) ? eventos : []) {
    if (!ev || !Array.isArray(ev.paises) || !ev.paises.length) continue;
    const t = new Date(ev.time).getTime();
    // Sin fecha válida no se puede decir si es reciente; y una fecha futura
    // es un error de la fuente, no un evento de ahora.
    if (!Number.isFinite(t) || t < limite || t > ahora + 3600000) continue;
    for (const iso of ev.paises) {
      if (!porPais.has(iso)) porPais.set(iso, []);
      porPais.get(iso).push(ev);
    }
  }
  for (const lista of porPais.values()) {
    lista.sort((a, b) => new Date(b.time) - new Date(a.time));
  }
  return porPais;
}

/**
 * Los eventos de la ventana con país asignado, sin agrupar: para la vista
 * global y los agregados, que no son un país.
 */
export function recientesConPais(eventos, opciones) {
  const vistos = new Set();
  const salida = [];
  for (const lista of agruparPorPais(eventos, opciones).values()) {
    for (const ev of lista) {
      const id = ev.id || ev.title;
      if (vistos.has(id)) continue;
      vistos.add(id);
      salida.push(ev);
    }
  }
  return salida.sort((a, b) => new Date(b.time) - new Date(a.time));
}

/**
 * Descarga `data/events.json` una vez por carga de página.
 *
 * Nunca lanza: si no hay fichero (en local sin `npm run eventos`, o un
 * despliegue en el que falló la descarga) devuelve `ok: false` y la
 * interfaz lo dice en vez de enseñar «0 eventos» como si fuera un dato.
 *
 * @returns {Promise<{ok: boolean, eventos: object[], descargado: Date|null,
 *   conflicto: object|null, mercados: object|null}>}
 */
export function cargarEventos() {
  if (promesa) return promesa;
  promesa = (async () => {
    try {
      const url = new URL(RUTA, document.baseURI).href;
      const r = await fetch(url, { credentials: 'omit' });
      if (!r.ok) return VACIO;
      const d = await r.json();
      if (!d || !Array.isArray(d.eventos)) return VACIO;
      const descargado = d.descargado ? new Date(d.descargado) : null;
      return {
        ok: true,
        eventos: d.eventos,
        descargado: descargado && !isNaN(descargado.getTime()) ? descargado : null,
        // Fase datos de OSIRIS: resumen de GDELT por país y mercados.
        conflicto: d.conflicto && d.conflicto.paises ? d.conflicto : null,
        mercados: d.mercados && d.mercados.paises ? d.mercados : null,
      };
    } catch (_e) {
      promesa = null; // un fallo de red no se memoriza
      return VACIO;
    }
  })();
  return promesa;
}

/** «hace 3 h», «hace 2 d»: la antigüedad de un evento, corta. */
export function haceCuanto(time, ahora = Date.now()) {
  const t = new Date(time).getTime();
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.round((ahora - t) / 60000));
  if (min < 60) return 'hace ' + min + ' min';
  const h = Math.round(min / 60);
  if (h < 48) return 'hace ' + h + ' h';
  return 'hace ' + Math.round(h / 24) + ' d';
}

/** Nombre corto de la fuente, para la etiqueta de cada evento. */
export function etiquetaFuente(ev) {
  const f = String((ev && (ev.fuente || ev.source)) || '').toLowerCase();
  if (f === 'usgs') return 'USGS';
  if (f === 'nasa' || f.startsWith('nasa')) return 'NASA EONET';
  if (f === 'who' || f.startsWith('oms')) return 'OMS';
  if (f === 'gdacs') return 'GDACS';
  if (f === 'gdeltgeo') return 'GDELT';
  if (f === 'swpc') return 'NOAA SWPC';
  if (f === 'relief') return 'ReliefWeb';
  return (ev && ev.source) || f.toUpperCase() || '—';
}

/** «38 eventos de conflicto material · 12 verbal», o '' si no hay resumen. */
export function textoConflicto(conflicto, iso) {
  const r = conflicto && conflicto.paises && conflicto.paises[iso];
  if (!r) return '';
  return `GDELT ${conflicto.horas || 24} h: ${r.conflicto_material} eventos de conflicto material, `
    + `${r.conflicto_verbal} de conflicto verbal y ${r.cooperacion} de cooperación`;
}

/** «18 %» para una probabilidad 0..1. */
export function porcentaje(p) {
  const v = Math.round(Number(p) * 1000) / 10;
  return (v < 1 ? v.toFixed(1) : Math.round(v)).toString().replace('.', ',') + ' %';
}
