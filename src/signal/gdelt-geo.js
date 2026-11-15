/**
 * Eventos geolocalizados de GDELT 2.0 (fase datos de OSIRIS).
 *
 * GDELT publica cada 15 minutos una exportación de eventos codificados con
 * CAMEO: quién hizo qué a quién y, lo que aquí importa, DÓNDE ocurrió
 * (ActionGeo). Es distinto de la búsqueda de noticias que usa Signal, cuyo
 * país es el del periódico. Aquí el país es el del suceso, así que sí se
 * puede asignar.
 *
 * QuadClass agrupa los códigos CAMEO en cuatro tipos:
 *   1 cooperación verbal   2 cooperación material
 *   3 conflicto verbal     4 conflicto material
 *
 * Lo que mide: cobertura mediática de sucesos, no víctimas. Un país con más
 * prensa genera más eventos por el mismo hecho. Sirve para ver dónde se
 * concentra el conflicto ahora y cómo cambia, no para compararlo con los
 * recuentos del UCDP.
 *
 * Módulo puro: lo usan tools/fetch-events.mjs y las pruebas unitarias.
 */
import { paisesEnTexto } from './paises.js';

/** Columnas de la exportación de 61 campos. */
export const COL = {
  id: 0, rootCode: 28, quad: 29, goldstein: 30, menciones: 31, fuentes: 32,
  articulos: 33, tono: 34, geoTipo: 51, geoNombre: 52, geoPais: 53,
  lat: 56, lng: 57, fecha: 59, url: 60,
};

/** Raíces CAMEO de conflicto material, en español. */
export const RAIZ_CAMEO = {
  '14': 'Protesta', '15': 'Despliegue de fuerza', '16': 'Ruptura de relaciones',
  '17': 'Coerción', '18': 'Agresión', '19': 'Combate', '20': 'Violencia masiva',
};

/** Las que se pintan en el globo: hechos violentos, no amenazas ni posturas. */
export const RAICES_VIOLENTAS = new Set(['18', '19', '20']);

/** «20261115123000» → ISO. */
function fechaGdelt(s) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(s || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

/**
 * Convierte el CSV (tabulado) de una exportación en filas útiles.
 *
 * @param {string} csv
 * @param {Map<string,string>} dic  diccionario de países (paises.js)
 */
export function parsearExportacion(csv, dic) {
  const filas = [];
  for (const linea of String(csv || '').split('\n')) {
    if (!linea) continue;
    const c = linea.split('\t');
    if (c.length < 58) continue;
    const nombre = c[COL.geoNombre];
    if (!nombre) continue;
    // El país va al final del nombre: «Kharkiv, Kharkivs'ka Oblast', Ukraine».
    const partes = nombre.split(',');
    const paises = paisesEnTexto(partes[partes.length - 1], dic);
    if (!paises.length) continue;
    const quad = Number(c[COL.quad]) || 0;
    const lat = Number(c[COL.lat]);
    const lng = Number(c[COL.lng]);
    filas.push({
      id: c[COL.id],
      raiz: String(c[COL.rootCode] || '').padStart(2, '0'),
      quad,
      goldstein: Number(c[COL.goldstein]) || 0,
      articulos: Number(c[COL.articulos]) || 0,
      fuentes: Number(c[COL.fuentes]) || 0,
      lugar: nombre,
      pais: paises[0],
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
      fecha: fechaGdelt(c[COL.fecha]),
      url: c[COL.url] || '',
    });
  }
  return filas;
}

/**
 * Resumen por país: cuántos eventos de cada tipo y cuántos artículos.
 *
 * @param {ReturnType<typeof parsearExportacion>} filas
 * @returns {Record<string, {conflicto_material:number, conflicto_verbal:number,
 *   cooperacion:number, total:number, articulos_conflicto:number, goldstein_medio:number}>}
 */
export function resumirPorPais(filas) {
  const out = {};
  for (const f of filas) {
    const r = out[f.pais] || (out[f.pais] = {
      conflicto_material: 0, conflicto_verbal: 0, cooperacion: 0, total: 0,
      articulos_conflicto: 0, _g: 0,
    });
    r.total++;
    r._g += f.goldstein;
    if (f.quad === 4) { r.conflicto_material++; r.articulos_conflicto += f.articulos; }
    else if (f.quad === 3) { r.conflicto_verbal++; r.articulos_conflicto += f.articulos; }
    else if (f.quad === 1 || f.quad === 2) r.cooperacion++;
  }
  for (const r of Object.values(out)) {
    r.goldstein_medio = r.total ? Math.round((r._g / r.total) * 100) / 100 : 0;
    delete r._g;
  }
  return out;
}

/**
 * Los sucesos violentos más cubiertos, como eventos para el globo y el
 * panel. Se agrupan los que caen en el mismo sitio con la misma raíz CAMEO
 * (la misma noticia codificada varias veces) y se queda el de más artículos.
 *
 * @param {ReturnType<typeof parsearExportacion>} filas
 * @param {number} [max=40]
 */
export function eventosDestacados(filas, max = 40) {
  const grupos = new Map();
  for (const f of filas) {
    if (f.quad !== 4 || !RAICES_VIOLENTAS.has(f.raiz)) continue;
    if (f.lat == null || f.lng == null || f.fuentes < 2) continue;
    const clave = `${f.raiz}:${f.lat.toFixed(1)}:${f.lng.toFixed(1)}`;
    const g = grupos.get(clave);
    if (!g) grupos.set(clave, { ...f, total: f.articulos });
    else {
      g.total += f.articulos;
      if (f.articulos > g.articulos) Object.assign(g, { ...f, total: g.total });
    }
  }
  return Array.from(grupos.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, max)
    .map((g) => ({
      id: 'gdeltgeo_' + g.id,
      source: 'GDELT · eventos',
      fuente: 'gdeltgeo',
      cat: 'conflict',
      familia: 'conflicto',
      lat: g.lat,
      lng: g.lng,
      title: `${RAIZ_CAMEO[g.raiz] || 'Conflicto'} · ${g.lugar}`,
      location: g.lugar,
      time: g.fecha || new Date().toISOString(),
      severity: g.raiz === '20' ? 'CRITICAL' : g.total >= 20 ? 'HIGH' : 'MEDIUM',
      url: g.url,
      paises: [g.pais],
      detail: `Suceso codificado por GDELT a partir de ${g.total} artículos de prensa. Es cobertura mediática: no es un recuento de víctimas.`,
      impacts: {
        'TIPO': RAIZ_CAMEO[g.raiz] || '—',
        'ARTÍCULOS': String(g.total),
        'GOLDSTEIN': g.goldstein.toFixed(1),
        'FUENTE': 'GDELT 2.0',
      },
    }));
}

/** Las URL de las exportaciones de las últimas `horas`, desde la última. */
export function urlsHaciaAtras(ultima, horas) {
  const m = /(\d{14})\.export\.CSV\.zip$/.exec(ultima || '');
  if (!m) return [];
  const s = m[1];
  const t0 = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
  const p = (n) => String(n).padStart(2, '0');
  const out = [];
  for (let i = 0; i < Math.round(horas * 4); i++) {
    const d = new Date(t0 - i * 15 * 60000);
    const sello = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
    out.push(ultima.replace(/\d{14}\.export\.CSV\.zip$/, `${sello}.export.CSV.zip`));
  }
  return out;
}
